"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { INJECTION_ZONES, ZONE_COLORS } from "@/lib/zones";
import { scoreAllZones, IntakeAnswers, ZoneScore } from "@/lib/scoring";
import { preprocessImage } from "@/lib/imageProcessing";
import { detectHeadPose, calculateZoneConfidence, HeadPose, ZoneConfidence } from "@/lib/faceAnalysis";

export interface ZoneAnalysisCache {
  landmarks: { x: number; y: number }[];
  correctedCanvas: HTMLCanvasElement;
  correctedDataUrl: string;
  headPose: HeadPose;
  confidences: ZoneConfidence[];
}

interface ZoneOverlayProps {
  imageDataUrl: string;
  intake: IntakeAnswers;
  selectedZoneIds: string[];
  onZonesDetected: (scores: ZoneScore[], cache: ZoneAnalysisCache) => void;
  onToggleZone: (zoneId: string) => void;
  readOnly?: boolean;
  showBeforeAfter?: boolean;
  // Pass cached result to skip re-running MediaPipe
  cache?: ZoneAnalysisCache;
  lightingImbalance?: number;
}

export default function ZoneOverlay({
  imageDataUrl,
  intake,
  selectedZoneIds,
  onZonesDetected,
  onToggleZone,
  readOnly = false,
  showBeforeAfter = false,
  cache,
  lightingImbalance = 0,
}: ZoneOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const correctedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarksRef = useRef<{ x: number; y: number }[]>([]);

  const [loading, setLoading] = useState(!cache);
  const [loadingMsg, setLoadingMsg] = useState("Correcting lighting...");
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [correctedDataUrl, setCorrectedDataUrl] = useState<string | null>(cache?.correctedDataUrl ?? null);
  const [headPose, setHeadPose] = useState<HeadPose | null>(cache?.headPose ?? null);
  const [confidences, setConfidences] = useState<ZoneConfidence[]>(cache?.confidences ?? []);
  const [showBefore, setShowBefore] = useState(false);

  // If cache is provided, just load refs and skip pipeline
  useEffect(() => {
    if (cache) {
      correctedCanvasRef.current = cache.correctedCanvas;
      landmarksRef.current = cache.landmarks;
      setCorrectedDataUrl(cache.correctedDataUrl);
      setHeadPose(cache.headPose);
      setConfidences(cache.confidences);
      setLoading(false);
    }
  }, [cache]);

  // Run pipeline only when no cache
  useEffect(() => {
    if (cache) return;
    let cancelled = false;

    async function run() {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "IMAGE",
          numFaces: 1,
        });

        setLoadingMsg("Correcting lighting...");
        const correctedCanvas = await preprocessImage(imageDataUrl);
        correctedCanvasRef.current = correctedCanvas;
        const correctedUrl = correctedCanvas.toDataURL("image/jpeg", 0.95);
        setCorrectedDataUrl(correctedUrl);

        if (cancelled) return;

        setLoadingMsg("Analyzing facial landmarks...");
        const result = faceLandmarker.detect(correctedCanvas);

        if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
          setError("No face detected in this photo.");
          setErrorHint(
            "Tips: face the camera directly, ensure your whole face is visible, avoid harsh backlighting, and hold still."
          );
          setLoading(false);
          return;
        }

        const landmarks = result.faceLandmarks[0];
        landmarksRef.current = landmarks;

        setLoadingMsg("Detecting head angle...");
        const pose = detectHeadPose(landmarks);
        setHeadPose(pose);

        setLoadingMsg("Scoring zones...");
        const scores = scoreAllZones(landmarks, intake, correctedCanvas);

        const confs = scores.map((s) =>
          calculateZoneConfidence(s.zone.id, s.zone.landmarks, landmarks, pose, lightingImbalance)
        );
        setConfidences(confs);

        const analysisCache: ZoneAnalysisCache = {
          landmarks,
          correctedCanvas,
          correctedDataUrl: correctedUrl,
          headPose: pose,
          confidences: confs,
        };

        if (cancelled) return;
        try { onZonesDetected(scores, analysisCache); } catch (cbErr) { console.error("onZonesDetected callback error:", cbErr); }
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        console.error("ZoneOverlay pipeline error:", e);
        setError("Face analysis failed.");
        setErrorHint("Please retake the photo in good lighting with your face centred in the frame.");
        setLoading(false);
      }
    }

    run().catch((e) => {
      if (!cancelled) console.error("ZoneOverlay unhandled:", e);
    });
    return () => { cancelled = true; };
  }, [imageDataUrl, intake, cache, lightingImbalance, onZonesDetected]);

  // Redraw canvas whenever selected zones change
  useEffect(() => {
    if (loading || !canvasRef.current || !correctedCanvasRef.current || landmarksRef.current.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const src = correctedCanvasRef.current;
    canvas.width = src.width;
    canvas.height = src.height;
    ctx.drawImage(src, 0, 0);

    const landmarks = landmarksRef.current;
    const W = canvas.width;
    const H = canvas.height;

    for (const zone of INJECTION_ZONES.filter((z) => selectedZoneIds.includes(z.id))) {
      const points = zone.landmarks
        .filter((i) => i < landmarks.length)
        .map((i) => ({ x: landmarks[i].x * W, y: landmarks[i].y * H }));

      if (points.length < 2) continue;

      const colors = ZONE_COLORS[zone.treatment];
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.closePath();
      ctx.fillStyle = colors.fill;
      ctx.fill();
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();

      const cx = points.reduce((a, p) => a + p.x, 0) / points.length;
      const cy = points.reduce((a, p) => a + p.y, 0) / points.length;
      const fontSize = Math.max(11, W * 0.016);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 3;
      ctx.strokeText(zone.name, cx, cy);
      ctx.fillStyle = "white";
      ctx.fillText(zone.name, cx, cy);
    }
  }, [loading, selectedZoneIds]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">{loadingMsg}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center px-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-xl font-bold">!</div>
        <div>
          <p className="text-red-600 font-medium">{error}</p>
          {errorHint && <p className="text-gray-500 text-sm mt-2 max-w-xs">{errorHint}</p>}
        </div>
      </div>
    );
  }

  const lowConfidenceZones = confidences.filter((c) => selectedZoneIds.includes(c.zoneId) && c.level === "low");

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Head pose warning */}
      {headPose && !headPose.isAcceptable && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <span className="font-medium">Head angle detected: </span>
          {headPose.warnings.join(" · ")}
          <span className="text-amber-500 text-xs block mt-0.5">Scores may be less accurate. Retake for best results.</span>
        </div>
      )}

      {/* Low confidence zones */}
      {lowConfidenceZones.length > 0 && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600">
          <span className="font-medium">Low confidence: </span>
          {lowConfidenceZones.map((c) => c.zoneId.replace(/_/g, " ")).join(", ")}
          {lowConfidenceZones[0].reason && ` — ${lowConfidenceZones[0].reason}`}
        </div>
      )}

      <div className="relative w-full">
        <canvas
          ref={canvasRef}
          className="w-full rounded-2xl shadow-lg"
          style={{ maxHeight: "65vh", objectFit: "contain" }}
        />
        {/* Head pose indicator — only shown when angle is problematic */}
        {headPose && !headPose.isAcceptable && (
          <div className="absolute top-2 right-2 bg-amber-500/80 rounded-lg px-2 py-1 text-xs text-white font-medium">
            Head angle off
          </div>
        )}
      </div>

      {/* Before/After toggle */}
      {showBeforeAfter && correctedDataUrl && (
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBefore(false)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${!showBefore ? "bg-rose-600 text-white border-rose-600" : "bg-white text-gray-600 border-gray-300"}`}
            >
              Corrected
            </button>
            <button
              onClick={() => setShowBefore(true)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${showBefore ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300"}`}
            >
              Original
            </button>
            <span className="text-xs text-gray-400">Lighting correction</span>
          </div>
          {showBefore && (
            <img
              src={imageDataUrl}
              alt="Original"
              className="w-full rounded-2xl shadow-lg"
              style={{ maxHeight: "65vh", objectFit: "contain" }}
            />
          )}
        </div>
      )}

      {!readOnly && (
        <p className="text-xs text-gray-400 text-center">Toggle zones in the panel on the right</p>
      )}
    </div>
  );
}

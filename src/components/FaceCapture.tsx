"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { analyzeLighting, LightingAnalysis } from "@/lib/imageProcessing";

interface FaceCaptureProps {
  onCapture: (imageDataUrl: string) => void;
}

export default function FaceCapture({ onCapture }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lighting, setLighting] = useState<LightingAnalysis | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
        setError(null);
      }
    } catch {
      setError("Camera access denied. Please allow camera permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      setStreaming(false);
    }
  }, []);

  // Poll lighting every 500ms while streaming
  useEffect(() => {
    if (!streaming) return;
    let last = 0;

    const tick = (ts: number) => {
      if (ts - last > 500 && videoRef.current && videoRef.current.readyState >= 2) {
        setLighting(analyzeLighting(videoRef.current));
        last = ts;
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [streaming]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    // Un-mirror for natural capture
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    // Don't stop camera here — let unmount cleanup handle it so the
    // new angle's camera can start without a stream-release race condition
    onCapture(dataUrl);
  }, [onCapture]);

  const lightingColor = !lighting
    ? "bg-gray-300"
    : lighting.isAcceptable
    ? "bg-green-500"
    : lighting.overallBrightness < 60 || lighting.overallBrightness > 220
    ? "bg-red-500"
    : "bg-yellow-400";

  const lightingLabel = !lighting
    ? "Checking..."
    : lighting.isAcceptable
    ? "Good lighting"
    : lighting.warnings[0];

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg">
      {/* Camera view */}
      <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-xl">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-white text-center p-6">
            <p>{error}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        )}

        {/* Face oval guide */}
        {streaming && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Darkened outside-oval overlay using clip-path */}
            <div className="absolute inset-0 bg-black/35" style={{
              maskImage: "radial-gradient(ellipse 48% 60% at 50% 48%, transparent 99%, black 100%)",
              WebkitMaskImage: "radial-gradient(ellipse 48% 60% at 50% 48%, transparent 99%, black 100%)",
            }} />
            <div
              className="w-[52%] aspect-[3/4] rounded-full"
              style={{
                border: "3px solid rgba(255,255,255,0.9)",
                boxShadow: "0 0 0 2px rgba(0,0,0,0.4), inset 0 0 0 2px rgba(0,0,0,0.2)",
              }}
            />
          </div>
        )}

        {/* Lighting status badge */}
        {streaming && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/50 rounded-full px-3 py-1.5">
            <div className={`w-2 h-2 rounded-full ${lightingColor}`} />
            <span className="text-white text-xs">{lightingLabel}</span>
          </div>
        )}

        {/* Imbalance bar — shows left vs right brightness */}
        {streaming && lighting && lighting.imbalance > 10 && (
          <div className="absolute bottom-3 left-3 right-3 bg-black/50 rounded-xl px-3 py-2">
            <div className="flex items-center justify-between text-xs text-white/70 mb-1">
              <span>Left</span>
              <span className="text-white/50 text-[10px]">Lighting balance</span>
              <span>Right</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-white/20">
              <div
                className="bg-white/80 transition-all"
                style={{
                  width: `${(lighting.leftBrightness / (lighting.leftBrightness + lighting.rightBrightness)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Warnings */}
      {lighting && !lighting.isAcceptable && (
        <div className="w-full rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <ul className="flex flex-col gap-1">
            {lighting.warnings.map((w, i) => (
              <li key={i} className="text-sm text-amber-700 flex items-center gap-2">
                <span className="text-amber-400">⚠</span> {w}
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-500 mt-1">
            You can still proceed — lighting will be corrected automatically.
          </p>
        </div>
      )}

      <div className="flex flex-col items-center gap-2 w-full">
        <p className="text-sm text-gray-500 text-center">
          Position your face within the oval, look directly at the camera
        </p>
        <button
          onClick={capture}
          disabled={!streaming}
          className="w-full max-w-xs py-3 bg-rose-600 text-white rounded-full font-medium text-lg
            hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md"
        >
          Capture Photo
        </button>
      </div>
    </div>
  );
}

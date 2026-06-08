"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import IntakeForm from "@/components/IntakeForm";
import MultiAngleCapture from "@/components/MultiAngleCapture";
import ZoneOverlay, { ZoneAnalysisCache } from "@/components/ZoneOverlay";
import ZonePanel from "@/components/ZonePanel";
import ConsentScreen from "@/components/ConsentScreen";
import { IntakeAnswers } from "@/lib/scoring";
import { ZoneScore, detectAsymmetry, AsymmetryReport } from "@/lib/scoring";
import { createPatient, uploadPhoto, createSession, fetchLastSession, getPhotoUrl, OverrideReason } from "@/lib/db";
import { exportTreatmentPDF } from "@/lib/pdf";
import { AnglePhotos } from "@/components/MultiAngleCapture";

type Step = "intake" | "capture" | "review" | "consent" | "saving" | "patient";

const STEP_LABELS: Record<Step, string> = {
  intake: "Patient Intake",
  capture: "Photo Capture",
  review: "Clinician Review",
  consent: "Consent",
  saving: "Saving",
  patient: "Treatment Plan",
};

const STEP_ORDER: Step[] = ["intake", "capture", "review", "consent", "patient"];

interface PreviousSession {
  created_at: string;
  selected_zone_ids: string[];
  clinician_notes: string;
  photoUrl?: string;
  patientAge?: number;
}

export default function Home() {
  const [step, setStep] = useState<Step>("intake");
  const [intake, setIntake] = useState<IntakeAnswers | null>(null);
  const [photos, setPhotos] = useState<AnglePhotos | null>(null);
  const [analysisCache, setAnalysisCache] = useState<ZoneAnalysisCache | null>(null);
  const [annotatedDataUrl, setAnnotatedDataUrl] = useState<string | null>(null);
  const [scores, setScores] = useState<ZoneScore[]>([]);
  const [asymmetry, setAsymmetry] = useState<AsymmetryReport[]>([]);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [clinicianNotes, setClinicianNotes] = useState("");
  const [overrideReasons, setOverrideReasons] = useState<Record<string, OverrideReason>>({});
  const [aiRecommendedIds, setAiRecommendedIds] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveRetrying, setSaveRetrying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previousSession, setPreviousSession] = useState<PreviousSession | null>(null);
  const [showHistorical, setShowHistorical] = useState(false);
  const reviewStartRef = useRef<number | null>(null);

  // Pre-fetch last session for historical comparison
  useEffect(() => {
    fetchLastSession()
      .then(async (session) => {
        if (!session) return;
        const ps: PreviousSession = {
          created_at: session.created_at,
          selected_zone_ids: session.selected_zone_ids as string[],
          clinician_notes: session.clinician_notes ?? "",
          patientAge: (session.patients as unknown as { age: number } | null)?.age,
        };
        if (session.photo_url) {
          try { ps.photoUrl = await getPhotoUrl(session.photo_url); } catch { /* ignore */ }
        }
        setPreviousSession(ps);
      })
      .catch(() => { /* non-critical */ });
  }, []);

  const handleIntakeSubmit = (answers: IntakeAnswers) => {
    setIntake(answers);
    setStep("capture");
  };

  const handlePhotosComplete = (captured: AnglePhotos) => {
    setPhotos(captured);
    setStep("review");
  };

  const handleZonesDetected = useCallback((detected: ZoneScore[], cache: ZoneAnalysisCache) => {
    setScores(detected);
    setAnalysisCache(cache);
    setAsymmetry(detectAsymmetry(detected));
    const recommended = detected.filter((s) => s.status === "recommend").map((s) => s.zone.id);
    setAiRecommendedIds(recommended);
    setSelectedZoneIds(recommended);
    reviewStartRef.current = Date.now();
  }, []);

  const handleToggleZone = (zoneId: string) => {
    setSelectedZoneIds((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]
    );
  };

  const handleOverrideReason = (zoneId: string, reason: OverrideReason) => {
    setOverrideReasons((prev) => ({ ...prev, [zoneId]: reason }));
  };

  // Capture annotated canvas URL at approval time (fixes PDF bug)
  const handleClinicianApprove = () => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
    if (canvas) setAnnotatedDataUrl(canvas.toDataURL("image/jpeg", 0.92));
    setStep("consent");
  };

  const computeSessionQuality = (durationSeconds: number): number => {
    // Quality based on review time + how many overrides had reasons captured
    const timeScore = Math.min(100, (durationSeconds / 120) * 60); // 2min = full time score
    const overrideCount = Object.keys(overrideReasons).length;
    const overrideScore = Math.min(40, overrideCount * 10);
    return Math.round(timeScore + overrideScore);
  };

  const doSave = async () => {
    if (!intake || !photos) return;
    const durationSeconds = reviewStartRef.current
      ? Math.round((Date.now() - reviewStartRef.current) / 1000)
      : 0;
    const quality = computeSessionQuality(durationSeconds);
    const patientId = await createPatient(intake);
    const photoPath = await uploadPhoto(patientId, photos.front);
    await createSession({
      patientId, photoPath, selectedZoneIds, scores, clinicianNotes,
      overrideReasons, reviewDurationSeconds: durationSeconds, sessionQuality: quality,
    });
  };

  const handleConsent = async () => {
    setSaveError(null);
    setStep("saving");
    try {
      await doSave();
    } catch (e) {
      console.error("Save failed:", e);
      setSaveError("Session could not be saved.");
    }
    setStep("patient");
  };

  const handleRetrySave = async () => {
    setSaveRetrying(true);
    setSaveError(null);
    try {
      await doSave();
      setSaveError(null);
    } catch {
      setSaveError("Retry failed. Use Download Backup to save locally.");
    } finally {
      setSaveRetrying(false);
    }
  };

  const handleDownloadBackup = () => {
    const backup = {
      date: new Date().toISOString(),
      patientAge: intake?.age,
      concerns: intake?.concerns,
      selectedZones: selectedZoneIds,
      clinicianNotes,
      scores: scores.map((s) => ({ zone: s.zone.id, score: Math.round(s.score) })),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medspa-session-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    if (!intake) return;
    setExporting(true);
    try {
      await exportTreatmentPDF({
        annotatedImageDataUrl: annotatedDataUrl ?? analysisCache?.correctedDataUrl ?? "",
        scores,
        selectedZoneIds,
        clinicianNotes,
        patientAge: intake.age,
        sessionDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      });
    } finally {
      setExporting(false);
    }
  };

  const handleReset = () => {
    setStep("intake");
    setIntake(null);
    setPhotos(null);
    setAnalysisCache(null);
    setAnnotatedDataUrl(null);
    setScores([]);
    setAsymmetry([]);
    setSelectedZoneIds([]);
    setClinicianNotes("");
    setSaveError(null);
    setOverrideReasons({});
    setAiRecommendedIds([]);
    reviewStartRef.current = null;
  };

  const selectedZones = scores.filter((s) => selectedZoneIds.includes(s.zone.id));
  const botoxZones = selectedZones.filter((s) => s.zone.treatment === "botox");
  const fillerZones = selectedZones.filter((s) => s.zone.treatment === "filler");
  const hasHighRisk = selectedZones.some((s) => s.zone.risk === "high");
  const stepIndex = STEP_ORDER.indexOf(step === "saving" ? "consent" : step);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">M</span>
          </div>
          <span className="font-semibold text-gray-900 hidden sm:block">MedSpa</span>
          <span className="text-gray-300 hidden sm:block">|</span>
          <span className="text-sm text-gray-500">{STEP_LABELS[step]}</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/follow-up" className="text-sm text-gray-400 hover:text-gray-600 transition-colors hidden sm:block">
            Follow-ups
          </Link>
          <Link href="/sessions" className="text-sm text-gray-400 hover:text-gray-600 transition-colors hidden sm:block">
            Sessions
          </Link>
          <div className="flex items-center gap-1.5">
            {STEP_ORDER.map((s, i) => (
              <div key={s} className={`rounded-full transition-all ${
                i === stepIndex ? "w-4 h-2 bg-rose-600" :
                i < stepIndex ? "w-2 h-2 bg-rose-300" : "w-2 h-2 bg-gray-200"
              }`} />
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6">

        {/* Step 1: Intake */}
        {step === "intake" && (
          <div className="flex items-start justify-center min-h-[80vh] pt-4">
            <IntakeForm onSubmit={handleIntakeSubmit} />
          </div>
        )}

        {/* Step 2: Multi-angle capture */}
        {step === "capture" && (
          <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900">Capture Photos</h2>
              <p className="text-gray-500 text-sm mt-1">3 angles for best accuracy</p>
            </div>
            <MultiAngleCapture onComplete={handlePhotosComplete} onBack={() => setStep("intake")} />
          </div>
        )}

        {/* Step 3: Clinician Review */}
        {step === "review" && photos && intake && (
          <div className="max-w-6xl mx-auto flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Clinician Review</h2>
                <p className="text-sm text-gray-500">Approve zones before showing the patient</p>
              </div>
              <div className="flex items-center gap-3">
                {previousSession && (
                  <button
                    onClick={() => setShowHistorical(!showHistorical)}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-all ${
                      showHistorical ? "bg-gray-900 text-white border-gray-900" : "text-gray-500 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {showHistorical ? "Hide" : "Compare"} Previous
                  </button>
                )}
                <button onClick={() => setStep("capture")} className="text-sm text-gray-400 hover:text-gray-600">
                  Retake
                </button>
              </div>
            </div>

            {hasHighRisk && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
                High-risk zone selected (Tear Trough). Ensure experienced injector is present.
              </div>
            )}

            {/* Historical comparison panel */}
            {showHistorical && previousSession && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">
                  Previous Session — {new Date(previousSession.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {previousSession.patientAge ? ` · Age ${previousSession.patientAge}` : ""}
                </p>
                <div className="flex gap-4 flex-wrap">
                  {previousSession.photoUrl && (
                    <img src={previousSession.photoUrl} alt="Previous session"
                      className="w-28 h-28 rounded-xl object-cover border border-blue-200 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-blue-700 font-medium mb-1">Treated zones:</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {previousSession.selected_zone_ids.map((z) => (
                        <span key={z} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                          {z.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                    {previousSession.clinician_notes && (
                      <p className="text-xs text-blue-600 italic">"{previousSession.clinician_notes}"</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col lg:grid lg:grid-cols-[1fr_300px] gap-4">
              {/* Analysis from front photo — cache result to avoid re-running on patient view */}
              <ZoneOverlay
                imageDataUrl={photos.front}
                intake={intake}
                selectedZoneIds={selectedZoneIds}
                onZonesDetected={handleZonesDetected}
                onToggleZone={handleToggleZone}
                showBeforeAfter
                lightingImbalance={0}
              />

              <div className="flex flex-col gap-3">
                <div className="max-h-[50vh] lg:max-h-[55vh] overflow-y-auto">
                  <ZonePanel
                    scores={scores}
                    selectedZoneIds={selectedZoneIds}
                    aiRecommendedIds={aiRecommendedIds}
                    onToggle={handleToggleZone}
                    onOverrideReason={handleOverrideReason}
                    asymmetry={asymmetry}
                    confidences={analysisCache?.confidences}
                  />
                </div>
                <textarea
                  value={clinicianNotes}
                  onChange={(e) => setClinicianNotes(e.target.value)}
                  placeholder="Clinician notes (optional)..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-300"
                />
                <button
                  onClick={handleClinicianApprove}
                  disabled={selectedZoneIds.length === 0}
                  className="w-full py-3 bg-rose-600 text-white rounded-full font-medium
                    hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Proceed to Consent ({selectedZoneIds.length} zone{selectedZoneIds.length !== 1 ? "s" : ""})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Consent */}
        {step === "consent" && (
          <div className="flex items-center justify-center min-h-[80vh]">
            <ConsentScreen selectedZoneCount={selectedZoneIds.length} onConsent={handleConsent} />
          </div>
        )}

        {/* Saving */}
        {step === "saving" && (
          <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
            <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
            <p className="text-gray-500">Saving session...</p>
          </div>
        )}

        {/* Step 5: Patient View — uses cached analysis, no re-run */}
        {step === "patient" && photos && intake && analysisCache && (
          <div className="max-w-xl mx-auto flex flex-col gap-4 pb-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-900">Your Treatment Plan</h2>
              <p className="text-gray-500 text-sm mt-1">
                Highlighted areas show your clinician's recommended treatment today
              </p>
            </div>

            {/* Save error with retry + download backup */}
            {saveError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-2">
                <p className="text-sm text-red-700">{saveError}</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRetrySave}
                    disabled={saveRetrying}
                    className="flex-1 py-2 bg-red-600 text-white rounded-full text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {saveRetrying ? "Retrying..." : "Retry Save"}
                  </button>
                  <button
                    onClick={handleDownloadBackup}
                    className="flex-1 py-2 border border-red-300 text-red-700 rounded-full text-xs font-medium hover:bg-red-50 transition-colors"
                  >
                    Download Backup
                  </button>
                </div>
              </div>
            )}

            {/* Reuse cached analysis — zero re-processing */}
            <ZoneOverlay
              imageDataUrl={photos.front}
              intake={intake}
              selectedZoneIds={selectedZoneIds}
              onZonesDetected={() => {}}
              onToggleZone={() => {}}
              readOnly
              cache={analysisCache}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {botoxZones.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full bg-blue-400" />
                    <span className="font-semibold text-blue-900 text-sm">Botox</span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {botoxZones.map((s) => (
                      <li key={s.zone.id} className="flex items-center justify-between">
                        <span className="text-sm text-blue-800">{s.zone.name}</span>
                        <span className="text-xs text-blue-500 font-medium">
                          {s.zone.dosageRange.min}–{s.zone.dosageRange.max} {s.zone.dosageRange.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {fillerZones.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="font-semibold text-green-900 text-sm">Filler</span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {fillerZones.map((s) => (
                      <li key={s.zone.id} className="flex items-center justify-between">
                        <span className="text-sm text-green-800">{s.zone.name}</span>
                        <span className="text-xs text-green-600 font-medium">
                          {s.zone.dosageRange.min}–{s.zone.dosageRange.max} {s.zone.dosageRange.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {clinicianNotes && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Clinician Notes</p>
                <p className="text-sm text-gray-700">{clinicianNotes}</p>
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
              Visual guide only. Dosage ranges are indicative — not a guarantee of outcomes. All treatment decisions are made by your licensed clinician.
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex-1 py-3 bg-gray-900 text-white rounded-full font-medium
                  hover:bg-gray-800 disabled:opacity-50 transition-colors text-sm"
              >
                {exporting ? "Exporting..." : "Export PDF"}
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-full font-medium hover:bg-gray-50 transition-colors text-sm"
              >
                New Patient
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

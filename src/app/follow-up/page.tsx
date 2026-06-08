"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchRecentSessions, getPhotoUrl, createFollowUp, ZoneOutcome } from "@/lib/db";
import { INJECTION_ZONES } from "@/lib/zones";

const zoneNameMap = Object.fromEntries(INJECTION_ZONES.map((z) => [z.id, z.name]));

type Session = Awaited<ReturnType<typeof fetchRecentSessions>>[number];

type Step = "select" | "rate" | "zones" | "done";

export default function FollowUpPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("select");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [overallRating, setOverallRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [zoneOutcomes, setZoneOutcomes] = useState<Record<string, ZoneOutcome>>({});
  const [clinicianNotes, setClinicianNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentSessions(30).then(async (data) => {
      setSessions(data);
      setLoading(false);
      const urls: Record<string, string> = {};
      await Promise.all(
        data.filter((s) => s.photo_url).map(async (s) => {
          try { urls[s.id] = await getPhotoUrl(s.photo_url!); } catch { /* ignore */ }
        })
      );
      setPhotoUrls(urls);
    }).catch(() => setLoading(false));
  }, []);

  const handleSelectSession = (s: Session) => {
    setSelectedSession(s);
    // Pre-populate zone outcomes for zones that were treated
    const initial: Record<string, ZoneOutcome> = {};
    (s.selected_zone_ids as string[]).forEach((zoneId) => {
      initial[zoneId] = { wasNeeded: true, dosageAccurate: true, patientSatisfaction: 4 };
    });
    setZoneOutcomes(initial);
    setStep("rate");
  };

  const handleSave = async () => {
    if (!selectedSession || !overallRating) return;
    setSaving(true);
    setError(null);
    try {
      await createFollowUp({
        originalSessionId: selectedSession.id,
        overallRating,
        zoneOutcomes,
        clinicianNotes,
      });
      setStep("done");
    } catch (e) {
      setError("Could not save follow-up. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const updateZoneOutcome = (zoneId: string, field: keyof ZoneOutcome, value: boolean | number) => {
    setZoneOutcomes((prev) => ({
      ...prev,
      [zoneId]: { ...prev[zoneId], [field]: value },
    }));
  };

  const treatedZoneIds = (selectedSession?.selected_zone_ids as string[]) ?? [];
  const treatedZones = INJECTION_ZONES.filter((z) => treatedZoneIds.includes(z.id));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">M</span>
          </div>
          <span className="font-semibold text-gray-900 hidden sm:block">MedSpa</span>
          <span className="text-gray-300 hidden sm:block">|</span>
          <span className="text-sm text-gray-500">Follow-up & Outcomes</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sessions" className="text-sm text-gray-400 hover:text-gray-600">Sessions</Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">New Patient</Link>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-2xl mx-auto w-full">

        {/* Step 1: Select original session */}
        {step === "select" && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Select Original Session</h2>
              <p className="text-sm text-gray-500 mt-1">Find the patient's previous treatment session to record outcomes</p>
            </div>

            {loading && (
              <div className="flex flex-col gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 flex gap-4 animate-pulse">
                    <div className="w-14 h-14 rounded-xl bg-gray-200 flex-shrink-0" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                      <div className="h-3 bg-gray-100 rounded w-40" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && sessions.map((s) => {
              const patient = s.patients as unknown as { age: number } | null;
              const date = new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              const zones = (s.selected_zone_ids as string[]).slice(0, 3);

              return (
                <button
                  key={s.id}
                  onClick={() => handleSelectSession(s)}
                  className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4 hover:border-rose-300 hover:shadow-sm transition-all text-left"
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    {photoUrls[s.id]
                      ? <img src={photoUrls[s.id]} alt="Patient" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">👤</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">Age {patient?.age ?? "—"} · {date}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {zones.map((z) => (
                        <span key={z} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{zoneNameMap[z] ?? z.replace(/_/g, " ")}</span>
                      ))}
                      {(s.selected_zone_ids as string[]).length > 3 && (
                        <span className="text-xs text-gray-400">+{(s.selected_zone_ids as string[]).length - 3}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-rose-500 text-sm">→</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: Overall rating */}
        {step === "rate" && selectedSession && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Overall Outcome</h2>
              <p className="text-sm text-gray-500 mt-1">How well did the treatment plan match the patient's needs?</p>
            </div>

            {photoUrls[selectedSession.id] && (
              <img src={photoUrls[selectedSession.id]} alt="Original session"
                className="w-full max-h-48 object-cover rounded-2xl" />
            )}

            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-gray-700">Overall treatment accuracy</p>
              <div className="flex gap-2">
                {([1, 2, 3, 4, 5] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setOverallRating(r)}
                    className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      overallRating === r
                        ? "border-rose-500 bg-rose-50 text-rose-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {r}★
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-400 px-1">
                <span>AI was mostly wrong</span>
                <span>AI was spot on</span>
              </div>
            </div>

            <button
              onClick={() => setStep("zones")}
              disabled={!overallRating}
              className="w-full py-3 bg-rose-600 text-white rounded-full font-medium
                hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Rate Individual Zones →
            </button>

            <button onClick={() => setStep("select")} className="text-sm text-gray-400 text-center hover:text-gray-600">
              Back
            </button>
          </div>
        )}

        {/* Step 3: Per-zone outcomes */}
        {step === "zones" && selectedSession && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Zone Outcomes</h2>
              <p className="text-sm text-gray-500 mt-1">Rate each treated zone to train the AI model</p>
            </div>

            {treatedZones.map((zone) => {
              const outcome = zoneOutcomes[zone.id] ?? { wasNeeded: true, dosageAccurate: true, patientSatisfaction: 4 };
              return (
                <div key={zone.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-gray-900">{zone.name}</p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Was this zone actually needed?</span>
                    <div className="flex gap-2">
                      {[true, false].map((v) => (
                        <button
                          key={String(v)}
                          onClick={() => updateZoneOutcome(zone.id, "wasNeeded", v)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                            outcome.wasNeeded === v
                              ? v ? "bg-green-600 text-white border-green-600" : "bg-red-500 text-white border-red-500"
                              : "border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}
                        >
                          {v ? "Yes" : "No"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Was the dosage range accurate?</span>
                    <div className="flex gap-2">
                      {[true, false].map((v) => (
                        <button
                          key={String(v)}
                          onClick={() => updateZoneOutcome(zone.id, "dosageAccurate", v)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                            outcome.dosageAccurate === v
                              ? v ? "bg-green-600 text-white border-green-600" : "bg-red-500 text-white border-red-500"
                              : "border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}
                        >
                          {v ? "Yes" : "No"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Patient satisfaction</span>
                    <div className="flex gap-1">
                      {([1, 2, 3, 4, 5] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => updateZoneOutcome(zone.id, "patientSatisfaction", r)}
                          className={`w-7 h-7 rounded-full text-xs font-medium border transition-all ${
                            outcome.patientSatisfaction === r
                              ? "bg-rose-600 text-white border-rose-600"
                              : "border-gray-200 text-gray-500 hover:border-rose-300"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            <textarea
              value={clinicianNotes}
              onChange={(e) => setClinicianNotes(e.target.value)}
              placeholder="Follow-up notes (optional)..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-300"
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-rose-600 text-white rounded-full font-medium
                hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Outcomes"}
            </button>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-6 py-20 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-2xl">✓</div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Outcomes Saved</h2>
              <p className="text-sm text-gray-500 mt-1">
                This data will improve future AI recommendations
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/follow-up"
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors">
                Another Follow-up
              </Link>
              <Link href="/" className="px-5 py-2.5 bg-rose-600 text-white rounded-full text-sm font-medium hover:bg-rose-700 transition-colors">
                New Patient
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

import { supabase } from "./supabase";
import { IntakeAnswers, ZoneScore } from "./scoring";

// --- Patients ---

export async function createPatient(intake: IntakeAnswers): Promise<string> {
  const { data, error } = await supabase
    .from("patients")
    .insert({
      age: intake.age,
      concerns: intake.concerns,
      previous_injectables: intake.previousInjectables,
      skin_type: intake.skinType,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// --- Photos ---

export async function uploadPhoto(patientId: string, imageDataUrl: string): Promise<string> {
  const res = await fetch(imageDataUrl);
  const blob = await res.blob();
  const path = `${patientId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("patient-photos")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

export async function getPhotoUrl(path: string): Promise<string> {
  const { data } = await supabase.storage
    .from("patient-photos")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? "";
}

// --- Sessions ---

export interface OverrideReason {
  action: "removed" | "added";
  reason: string;
}

export async function createSession({
  patientId,
  photoPath,
  selectedZoneIds,
  scores,
  clinicianNotes,
  overrideReasons,
  reviewDurationSeconds,
  sessionQuality,
}: {
  patientId: string;
  photoPath: string;
  selectedZoneIds: string[];
  scores: ZoneScore[];
  clinicianNotes: string;
  overrideReasons: Record<string, OverrideReason>;
  reviewDurationSeconds: number;
  sessionQuality: number;
}): Promise<string> {
  const zoneScores: Record<string, number> = {};
  scores.forEach((s) => (zoneScores[s.zone.id] = Math.round(s.score)));

  const { data, error } = await supabase
    .from("treatment_sessions")
    .insert({
      patient_id: patientId,
      photo_url: photoPath,
      selected_zone_ids: selectedZoneIds,
      zone_scores: zoneScores,
      clinician_notes: clinicianNotes,
      consented_at: new Date().toISOString(),
      zone_override_reasons: overrideReasons,
      review_duration_seconds: reviewDurationSeconds,
      session_quality: sessionQuality,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function fetchRecentSessions(limit = 20) {
  const { data, error } = await supabase
    .from("treatment_sessions")
    .select(`
      id, created_at, selected_zone_ids, clinician_notes,
      photo_url, consented_at, session_quality, review_duration_seconds,
      patients ( id, age, concerns )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchLastSession() {
  const { data, error } = await supabase
    .from("treatment_sessions")
    .select(`
      id, created_at, selected_zone_ids, zone_scores,
      clinician_notes, photo_url,
      patients ( age, concerns )
    `)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// --- Follow-up sessions ---

export interface ZoneOutcome {
  wasNeeded: boolean;
  dosageAccurate: boolean;
  patientSatisfaction: 1 | 2 | 3 | 4 | 5;
}

export async function createFollowUp({
  originalSessionId,
  overallRating,
  zoneOutcomes,
  clinicianNotes,
}: {
  originalSessionId: string;
  overallRating: 1 | 2 | 3 | 4 | 5;
  zoneOutcomes: Record<string, ZoneOutcome>;
  clinicianNotes: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("follow_up_sessions")
    .insert({
      original_session_id: originalSessionId,
      overall_rating: overallRating,
      zone_outcomes: zoneOutcomes,
      clinician_notes: clinicianNotes,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// --- Data export for ML training ---

export async function exportTrainingData() {
  const { data: sessions, error } = await supabase
    .from("treatment_sessions")
    .select(`
      id, created_at,
      selected_zone_ids, zone_scores, zone_override_reasons,
      review_duration_seconds, session_quality,
      patients ( age, skin_type, concerns, previous_injectables ),
      follow_up_sessions ( overall_rating, zone_outcomes )
    `)
    .not("session_quality", "is", null)
    .gte("session_quality", 40) // exclude rubber-stamped sessions
    .order("created_at", { ascending: true });

  if (error) throw error;
  return sessions ?? [];
}

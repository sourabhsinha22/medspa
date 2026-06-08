import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

export type Patient = {
  id: string;
  created_at: string;
  age: number;
  concerns: string[];
  previous_injectables: boolean;
  skin_type: number;
};

export type TreatmentSession = {
  id: string;
  created_at: string;
  patient_id: string;
  photo_url: string | null;
  selected_zone_ids: string[];
  zone_scores: Record<string, number>;
  clinician_notes: string;
  consented_at: string | null;
  zone_override_reasons: Record<string, { action: "removed" | "added"; reason: string }>;
  review_duration_seconds: number | null;
  session_quality: number | null;
};

export type FollowUpSession = {
  id: string;
  created_at: string;
  original_session_id: string | null;
  overall_rating: number;
  zone_outcomes: Record<string, {
    wasNeeded: boolean;
    dosageAccurate: boolean;
    patientSatisfaction: number;
  }>;
  clinician_notes: string;
};

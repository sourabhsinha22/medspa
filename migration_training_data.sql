-- Add training data fields to treatment_sessions
ALTER TABLE treatment_sessions
  ADD COLUMN IF NOT EXISTS zone_override_reasons jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS review_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS session_quality integer; -- 0-100

-- Follow-up sessions table
CREATE TABLE IF NOT EXISTS follow_up_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  original_session_id uuid REFERENCES treatment_sessions(id) ON DELETE SET NULL,
  overall_rating integer CHECK (overall_rating BETWEEN 1 AND 5),
  zone_outcomes jsonb DEFAULT '{}', -- { zoneId: { was_needed: bool, dosage_accurate: bool, patient_satisfaction: 1-5 } }
  clinician_notes text DEFAULT ''
);

ALTER TABLE follow_up_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all follow_ups" ON follow_up_sessions FOR ALL USING (true);

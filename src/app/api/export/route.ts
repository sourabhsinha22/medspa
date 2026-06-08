import { NextRequest, NextResponse } from "next/server";
import { exportTrainingData } from "@/lib/db";
import { INJECTION_ZONES } from "@/lib/zones";

// GET /api/export?format=csv|json
// Exports training-ready data for ML model development
// Each row = one session with features + clinician labels

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") ?? "json";

  try {
    const sessions = await exportTrainingData();

    const rows = sessions.map((s) => {
      const patient = s.patients as unknown as {
        age: number; skin_type: number; concerns: string[]; previous_injectables: boolean;
      } | null;

      const zoneScores = (s.zone_scores ?? {}) as Record<string, number>;
      const overrideReasons = (s.zone_override_reasons ?? {}) as Record<string, { action: string; reason: string }>;
      const selectedZones = (s.selected_zone_ids ?? []) as string[];
      const followUps = (s.follow_up_sessions ?? []) as Array<{
        overall_rating: number;
        zone_outcomes: Record<string, { wasNeeded: boolean; dosageAccurate: boolean; patientSatisfaction: number }>;
      }>;

      // Concern flags (one-hot)
      const concernKeys = [
        "forehead_lines", "frown_lines", "between_brows", "crows_feet", "eye_wrinkles",
        "bunny_lines", "smile_lines", "nasolabial", "thin_lips", "lip_volume",
        "marionette", "mouth_corners", "chin", "jaw_slimming", "teeth_grinding",
        "cheek_volume", "hollow_cheeks", "under_eye", "dark_circles", "deep_lines",
      ];
      const concernFlags = Object.fromEntries(
        concernKeys.map((k) => [`concern_${k}`, patient?.concerns?.includes(k) ? 1 : 0])
      );

      // Zone scores (AI's raw scores)
      const aiScores = Object.fromEntries(
        INJECTION_ZONES.map((z) => [`ai_score_${z.id}`, zoneScores[z.id] ?? 0])
      );

      // Clinician labels (ground truth for ML)
      const clinicianLabels = Object.fromEntries(
        INJECTION_ZONES.map((z) => [`label_${z.id}`, selectedZones.includes(z.id) ? 1 : 0])
      );

      // Override signals
      const overrides: Record<string, string> = {};
      INJECTION_ZONES.forEach((z) => {
        const override = overrideReasons[z.id];
        overrides[`override_action_${z.id}`] = override?.action ?? "none";
        overrides[`override_reason_${z.id}`] = override?.reason ?? "";
      });

      // Outcome data (from follow-up if available)
      const latestFollowUp = followUps[followUps.length - 1];
      const outcomeLabels = Object.fromEntries(
        INJECTION_ZONES.map((z) => {
          const outcome = latestFollowUp?.zone_outcomes?.[z.id];
          return [
            [`outcome_needed_${z.id}`, outcome ? (outcome.wasNeeded ? 1 : 0) : null],
            [`outcome_dosage_ok_${z.id}`, outcome ? (outcome.dosageAccurate ? 1 : 0) : null],
            [`outcome_satisfaction_${z.id}`, outcome?.patientSatisfaction ?? null],
          ];
        }).flat()
      );

      return {
        session_id: s.id,
        created_at: s.created_at,
        // Patient features
        age: patient?.age ?? null,
        skin_type: patient?.skin_type ?? null,
        previous_injectables: patient?.previous_injectables ? 1 : 0,
        ...concernFlags,
        // AI scores
        ...aiScores,
        // Training labels (clinician decisions)
        ...clinicianLabels,
        // Override signals
        ...overrides,
        // Quality
        review_duration_seconds: s.review_duration_seconds,
        session_quality: s.session_quality,
        overall_outcome_rating: latestFollowUp?.overall_rating ?? null,
        ...outcomeLabels,
      };
    });

    if (format === "csv") {
      if (rows.length === 0) {
        return new NextResponse("session_id\n", {
          headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=medspa_training_data.csv" },
        });
      }
      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(","),
        ...rows.map((r) =>
          headers.map((h) => {
            const v = (r as Record<string, unknown>)[h];
            if (v === null || v === undefined) return "";
            const s = String(v);
            return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
          }).join(",")
        ),
      ].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=medspa_training_data.csv",
        },
      });
    }

    return NextResponse.json({
      exported_at: new Date().toISOString(),
      total_sessions: rows.length,
      note: "Only sessions with quality_score >= 40 are included. Sessions under 30s review are excluded.",
      columns: {
        features: ["age", "skin_type", "previous_injectables", "concern_*", "ai_score_*"],
        labels: ["label_*  (1 = clinician selected this zone, 0 = not selected)"],
        overrides: ["override_action_*  (removed/added/none)", "override_reason_*"],
        outcomes: ["outcome_needed_*", "outcome_dosage_ok_*", "outcome_satisfaction_*"],
        quality: ["review_duration_seconds", "session_quality", "overall_outcome_rating"],
      },
      data: rows,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

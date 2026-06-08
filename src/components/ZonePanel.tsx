"use client";

import { useState } from "react";
import { ZoneScore, AsymmetryReport } from "@/lib/scoring";
import { ZoneConfidence } from "@/lib/faceAnalysis";
import { OverrideReason } from "@/lib/db";
import { RISK_COLORS, ZONE_COLORS } from "@/lib/zones";

const REMOVE_REASONS = [
  "Not clinically needed",
  "Already recently treated",
  "Wrong severity assessment",
  "Patient preference",
  "Contraindicated",
  "Other",
];

const ADD_REASONS = [
  "Clearly visible on assessment",
  "Patient requested",
  "Clinical judgment",
  "Complement to other zones",
  "Other",
];

interface ZonePanelProps {
  scores: ZoneScore[];
  selectedZoneIds: string[];
  aiRecommendedIds: string[]; // what AI originally recommended
  onToggle: (zoneId: string) => void;
  onOverrideReason: (zoneId: string, reason: OverrideReason) => void;
  asymmetry?: AsymmetryReport[];
  confidences?: ZoneConfidence[];
}

export default function ZonePanel({
  scores,
  selectedZoneIds,
  aiRecommendedIds,
  onToggle,
  onOverrideReason,
  asymmetry = [],
  confidences = [],
}: ZonePanelProps) {
  const byScore = (a: ZoneScore, b: ZoneScore) => b.score - a.score;
  const recommended = scores.filter((s) => s.status === "recommend").sort(byScore);
  const suggested = scores.filter((s) => s.status === "suggest").sort(byScore);
  const rest = scores.filter((s) => s.status === "none").sort(byScore);
  const significantAsymmetry = asymmetry.filter((a) => a.delta > 15 && a.dominantSide !== "balanced");
  const confMap = Object.fromEntries(confidences.map((c) => [c.zoneId, c]));

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">
      {significantAsymmetry.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Asymmetry Detected</p>
          {significantAsymmetry.map((a) => (
            <p key={a.zoneId} className="text-xs text-amber-700">
              <strong className="capitalize">{a.zoneId.replace(/_/g, " ")}</strong>
              {" — "}{a.dominantSide} side more pronounced ({Math.round(a.delta)} pt)
            </p>
          ))}
        </div>
      )}

      {recommended.length > 0 && (
        <Section title="Recommended">
          {recommended.map((s) => (
            <ZoneCard key={s.zone.id} score={s}
              selected={selectedZoneIds.includes(s.zone.id)}
              aiRecommended={aiRecommendedIds.includes(s.zone.id)}
              onToggle={() => onToggle(s.zone.id)}
              onOverrideReason={(r) => onOverrideReason(s.zone.id, r)}
              confidence={confMap[s.zone.id]} />
          ))}
        </Section>
      )}
      {suggested.length > 0 && (
        <Section title="Suggested">
          {suggested.map((s) => (
            <ZoneCard key={s.zone.id} score={s}
              selected={selectedZoneIds.includes(s.zone.id)}
              aiRecommended={aiRecommendedIds.includes(s.zone.id)}
              onToggle={() => onToggle(s.zone.id)}
              onOverrideReason={(r) => onOverrideReason(s.zone.id, r)}
              confidence={confMap[s.zone.id]} />
          ))}
        </Section>
      )}
      {rest.length > 0 && (
        <Section title="All Zones">
          {rest.map((s) => (
            <ZoneCard key={s.zone.id} score={s}
              selected={selectedZoneIds.includes(s.zone.id)}
              aiRecommended={aiRecommendedIds.includes(s.zone.id)}
              onToggle={() => onToggle(s.zone.id)}
              onOverrideReason={(r) => onOverrideReason(s.zone.id, r)}
              confidence={confMap[s.zone.id]} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

const CONFIDENCE_STYLES = {
  high: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-red-100 text-red-700",
};

function ZoneCard({
  score, selected, aiRecommended, onToggle, onOverrideReason, confidence,
}: {
  score: ZoneScore;
  selected: boolean;
  aiRecommended: boolean;
  onToggle: () => void;
  onOverrideReason: (r: OverrideReason) => void;
  confidence?: ZoneConfidence;
}) {
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [pendingAction, setPendingAction] = useState<"removed" | "added" | null>(null);

  const { zone } = score;
  const colors = ZONE_COLORS[zone.treatment];
  const riskClass = RISK_COLORS[zone.risk];
  const dosage = `${zone.dosageRange.min}–${zone.dosageRange.max} ${zone.dosageRange.unit}`;

  // Determine if this toggle is an override (clinician diverging from AI)
  const isOverride = selected
    ? !aiRecommended  // clinician added something AI didn't recommend
    : aiRecommended;  // clinician removed something AI recommended

  const handleToggle = () => {
    if (isOverride || (!selected && !aiRecommended)) {
      // About to diverge from AI — ask why
      const action = selected ? "removed" : "added";
      if (isOverride) {
        setPendingAction(action);
        setShowReasonPicker(true);
        return;
      }
    }
    onToggle();
  };

  const handleReasonSelect = (reason: string) => {
    if (!pendingAction) return;
    onOverrideReason({ action: pendingAction, reason });
    onToggle();
    setShowReasonPicker(false);
    setPendingAction(null);
  };

  const handleReasonCancel = () => {
    setShowReasonPicker(false);
    setPendingAction(null);
  };

  const reasons = pendingAction === "removed" ? REMOVE_REASONS : ADD_REASONS;

  return (
    <div className={`rounded-xl border transition-all ${
      selected ? "border-rose-400 bg-rose-50 shadow-sm" : "border-gray-200 bg-white"
    }`}>
      <button onClick={handleToggle} className="w-full text-left p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-3 h-3 rounded-full flex-shrink-0 border"
              style={{ backgroundColor: colors.fill, borderColor: colors.stroke }} />
            <span className="text-sm font-medium text-gray-800 leading-tight">{zone.name}</span>
            {/* Override indicator */}
            {selected && !aiRecommended && (
              <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full flex-shrink-0">
                + Added
              </span>
            )}
            {!selected && aiRecommended && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full flex-shrink-0">
                Removed
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
            {confidence && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${CONFIDENCE_STYLES[confidence.level]}`}
                title={confidence.reason}>
                {confidence.level === "high" ? "✓" : confidence.level === "medium" ? "~" : "!"} {Math.round(confidence.confidence)}%
              </span>
            )}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${riskClass}`}>{zone.risk}</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium capitalize">{zone.treatment}</span>
          </div>
        </div>

        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.max(2, score.score)}%` }} />
          </div>
          <span className="text-xs text-gray-400 w-8 text-right">{Math.round(score.score)}</span>
        </div>

        <div className="mt-1 flex gap-2 text-xs text-gray-400">
          <span>Geo {Math.round(score.geometryScore)}</span>
          <span>·</span>
          <span>Tex {Math.round(score.textureScore)}</span>
          <span>·</span>
          <span>Int {Math.round(score.intakeScore)}</span>
        </div>

        <div className="mt-1 text-xs text-gray-500">
          Suggested: <span className="font-medium text-gray-700">{dosage}</span>
        </div>
      </button>

      {/* Override reason picker */}
      {showReasonPicker && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-2">
          <p className="text-xs font-medium text-gray-600 mb-2">
            Why are you {pendingAction === "removed" ? "removing" : "adding"} this zone?
          </p>
          <div className="flex flex-col gap-1">
            {reasons.map((r) => (
              <button
                key={r}
                onClick={() => handleReasonSelect(r)}
                className="text-left text-xs px-3 py-2 rounded-lg bg-white border border-gray-200 hover:border-rose-300 hover:bg-rose-50 transition-colors"
              >
                {r}
              </button>
            ))}
          </div>
          <button onClick={handleReasonCancel} className="mt-2 text-xs text-gray-400 hover:text-gray-600 w-full text-center">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

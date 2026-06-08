import { INJECTION_ZONES, InjectionZone } from "./zones";

export type SkinType = 1 | 2 | 3 | 4 | 5 | 6; // Fitzpatrick scale

export interface IntakeAnswers {
  concerns: string[];
  age: number;
  previousInjectables: boolean;
  skinType: SkinType;
}

export interface AsymmetryReport {
  zoneId: string;
  leftScore: number;
  rightScore: number;
  delta: number; // 0-100, how asymmetric
  dominantSide: "left" | "right" | "balanced";
}

export interface ZoneScore {
  zone: InjectionZone;
  score: number;
  status: "recommend" | "suggest" | "none";
  geometryScore: number;
  textureScore: number;
  intakeScore: number;
  asymmetry?: AsymmetryReport;
}

// --- Geometry helpers ---

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function faceWidth(lm: { x: number; y: number }[]): number {
  // Cheekbone width: landmarks 234 (left) and 454 (right)
  if (lm.length < 455) return 0.3;
  return dist(lm[234], lm[454]);
}

// Lip height: vertical span of lip landmarks
function lipHeightScore(lm: { x: number; y: number }[]): number {
  const upper = [37, 0, 267]; // top of upper lip
  const lower = [84, 17, 314]; // bottom of lower lip
  const available = upper.concat(lower).filter((i) => i < lm.length);
  if (available.length < 4) return 0;

  const upperY = Math.min(...upper.filter((i) => i < lm.length).map((i) => lm[i].y));
  const lowerY = Math.max(...lower.filter((i) => i < lm.length).map((i) => lm[i].y));
  const height = lowerY - upperY;

  // Normalize against face height (landmark 10 = top, 152 = chin)
  const faceH = lm.length > 152 ? Math.abs(lm[152].y - lm[10].y) : 0.6;
  const ratio = faceH > 0 ? height / faceH : 0;

  // Thin lips = low ratio → higher score (more need for filler)
  return Math.max(0, Math.min(100, (0.08 - ratio) * 2000));
}

// Nasolabial fold depth: distance from nose-ala to mouth corner,
// normalised by face width. A deeper/longer fold scores higher.
function nasolabialScore(
  lm: { x: number; y: number }[],
  side: "left" | "right"
): number {
  if (lm.length < 370) return 0;
  // Nose ala (edge of nostril): 129 left, 358 right
  const noseAla = side === "left" ? lm[129] : lm[358];
  const mouthCorner = side === "left" ? lm[61] : lm[291];
  if (!noseAla || !mouthCorner) return 0;

  const foldDist = dist(noseAla, mouthCorner);
  const fw = faceWidth(lm);
  // Typical fold length ~20–28% of face width; deep fold 30%+
  return Math.min(100, Math.max(0, (foldDist / (fw || 0.3) - 0.20) * 700));
}

// Jaw width vs cheekbone width ratio (masseter size proxy)
function massetorScore(lm: { x: number; y: number }[]): number {
  if (lm.length < 455) return 0;
  const fw = faceWidth(lm);
  // Jaw corners: 172 (left), 397 (right)
  const jawW = dist(lm[172], lm[397]);
  const ratio = fw > 0 ? jawW / fw : 0;
  // Higher jaw/cheek ratio = wider jaw = more masseter
  return Math.min(100, Math.max(0, (ratio - 0.7) * 300));
}

// Forehead: brow elevation relative to face height.
// A raised brow (compensating for heavy upper eyelid / deep lines) sits higher.
// Normal brow-to-hairline ratio ~0.22–0.28; relaxed/elevated: 0.30+
function foreheadScore(lm: { x: number; y: number }[]): number {
  if (lm.length < 152) return 0;
  const faceH = Math.abs(lm[152].y - lm[10].y);
  if (faceH === 0) return 0;
  // Use both brow landmarks (107 left, 336 right) for robustness
  const browY = lm.length > 336
    ? (lm[107].y + lm[336].y) / 2
    : lm.length > 107 ? lm[107].y : lm[10].y + faceH * 0.25;
  const foreheadH = Math.abs(browY - lm[10].y);
  const ratio = foreheadH / faceH;
  // Score rises above normal range (0.22). Neutral ~0.22 → 0; large forehead ~0.32 → 50
  return Math.min(100, Math.max(0, (ratio - 0.22) * 1000));
}

// Under-eye depth: vertical gap between lower eyelid and cheek landmarks
function underEyeScore(
  lm: { x: number; y: number }[],
  side: "left" | "right"
): number {
  if (lm.length < 430) return 0;
  const lowerLid = side === "left" ? lm[23] : lm[253];
  const cheek = side === "left" ? lm[116] : lm[345];
  if (!lowerLid || !cheek) return 0;
  const gap = cheek.y - lowerLid.y;
  const fw = faceWidth(lm);
  return Math.min(100, Math.max(0, (gap / (fw || 0.3) - 0.15) * 400));
}

// Crow's feet: max pairwise distance of lateral eye-corner landmarks
// normalised by face width. Wider spread = more pronounced lines.
function crowsFeetScore(
  lm: { x: number; y: number }[],
  side: "left" | "right"
): number {
  const idxs = side === "left"
    ? [22, 23, 24, 130, 243]
    : [252, 253, 254, 359, 463];
  const pts = idxs.filter((i) => i < lm.length).map((i) => lm[i]);
  if (pts.length < 2) return 0;
  let maxD = 0;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      maxD = Math.max(maxD, dist(pts[i], pts[j]));
  const fw = faceWidth(lm);
  // Typical resting spread ~8–12% of face width; crow's feet push to 14–20%+
  return Math.min(100, Math.max(0, (maxD / (fw || 0.3) - 0.08) * 800));
}

// Glabella: horizontal distance between medial brow landmarks (55 left, 285 right)
// normalised by face width. Brows closer together = more furrowing/11-line potential.
function glabellaScore(lm: { x: number; y: number }[]): number {
  if (lm.length < 286) return 0;
  const medialBrowDist = dist(lm[55], lm[285]);
  const fw = faceWidth(lm);
  // Wide brow gap = relaxed (~18–22% fw). Closer = furrowed. Score inverted.
  return Math.min(100, Math.max(0, (0.22 - medialBrowDist / (fw || 0.3)) * 1000));
}

// Route each zone to its best geometry function
function geometryScoreForZone(
  lm: { x: number; y: number }[],
  zone: InjectionZone
): number {
  switch (zone.id) {
    case "glabella":
      return glabellaScore(lm);
    case "lips":
      return lipHeightScore(lm);
    case "nasolabial_left":
      return nasolabialScore(lm, "left");
    case "nasolabial_right":
      return nasolabialScore(lm, "right");
    case "masseter_left":
    case "masseter_right":
      return massetorScore(lm);
    case "forehead":
      return foreheadScore(lm);
    case "tear_trough_left":
      return underEyeScore(lm, "left");
    case "tear_trough_right":
      return underEyeScore(lm, "right");
    case "crows_feet_left":
      return crowsFeetScore(lm, "left");
    case "crows_feet_right":
      return crowsFeetScore(lm, "right");
    // Zones where landmark positions are anatomically fixed — geometry can't
    // detect treatment need. Rely entirely on texture + intake.
    case "marionette_left":
    case "marionette_right":
    case "cheeks_left":
    case "cheeks_right":
    case "chin":
    case "bunny_lines":
      return 0;
    default: {
      // Generic: centroid deviation normalised by face width
      const pts = zone.landmarks
        .filter((i) => i < lm.length)
        .map((i) => lm[i]);
      if (pts.length < 2) return 0;
      const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
      const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      const avgDev = pts.reduce((a, p) => a + dist(p, { x: cx, y: cy }), 0) / pts.length;
      const fw = faceWidth(lm);
      return Math.min(100, Math.max(0, (avgDev / (fw || 0.3) - 0.01) * 500));
    }
  }
}

// --- Texture analysis ---
// Reads pixel brightness variance within landmark region from a canvas
// Higher variance = more micro-shadow = more pronounced wrinkles
export function textureScoreForZone(
  canvas: HTMLCanvasElement,
  lm: { x: number; y: number }[],
  zone: InjectionZone
): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;

  const W = canvas.width;
  const H = canvas.height;

  const points = zone.landmarks
    .filter((i) => i < lm.length)
    .map((i) => ({ x: lm[i].x * W, y: lm[i].y * H }));

  if (points.length < 2) return 0;

  const minX = Math.max(0, Math.floor(Math.min(...points.map((p) => p.x)) - 10));
  const maxX = Math.min(W, Math.ceil(Math.max(...points.map((p) => p.x)) + 10));
  const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y)) - 10));
  const maxY = Math.min(H, Math.ceil(Math.max(...points.map((p) => p.y)) + 10));

  if (maxX <= minX || maxY <= minY) return 0;

  const data = ctx.getImageData(minX, minY, maxX - minX, maxY - minY).data;

  const luminances: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    luminances.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  const mean = luminances.reduce((a, b) => a + b, 0) / luminances.length;
  const variance =
    luminances.reduce((a, b) => a + (b - mean) ** 2, 0) / luminances.length;

  // Normalize — typical range 0–800 variance
  return Math.min(100, (variance / 8));
}

// --- Intake scoring ---
function scoreIntake(intake: IntakeAnswers, zone: InjectionZone): number {
  const matched = zone.intakeTriggers.filter((t) =>
    intake.concerns.includes(t)
  ).length;
  if (matched === 0) return 0;
  const base = (matched / zone.intakeTriggers.length) * 100;
  const ageBoost = intake.age > 45 ? 20 : intake.age > 35 ? 10 : intake.age > 25 ? 5 : 0;
  return Math.min(100, base + ageBoost);
}

// Skin type weight: darker skin (IV-VI) has different texture characteristics
// Fitzpatrick I-II: texture analysis more reliable; IV-VI: reduce texture weight, boost geometry
function skinTypeWeights(skinType: SkinType): {
  geometry: number;
  texture: number;
  intake: number;
} {
  if (skinType <= 2) return { geometry: 0.45, texture: 0.25, intake: 0.30 };
  if (skinType <= 3) return { geometry: 0.50, texture: 0.20, intake: 0.30 };
  return { geometry: 0.55, texture: 0.15, intake: 0.30 };
}

// --- Asymmetry ---
const PAIRED_ZONES: [string, string][] = [
  ["crows_feet_left", "crows_feet_right"],
  ["nasolabial_left", "nasolabial_right"],
  ["marionette_left", "marionette_right"],
  ["masseter_left", "masseter_right"],
  ["cheeks_left", "cheeks_right"],
  ["tear_trough_left", "tear_trough_right"],
];

export function detectAsymmetry(scores: ZoneScore[]): AsymmetryReport[] {
  const reports: AsymmetryReport[] = [];
  const byId = Object.fromEntries(scores.map((s) => [s.zone.id, s]));

  for (const [leftId, rightId] of PAIRED_ZONES) {
    const left = byId[leftId];
    const right = byId[rightId];
    if (!left || !right) continue;

    const delta = Math.abs(left.score - right.score);
    reports.push({
      zoneId: leftId.replace("_left", ""),
      leftScore: left.score,
      rightScore: right.score,
      delta,
      dominantSide:
        delta < 10
          ? "balanced"
          : left.score > right.score
          ? "left"
          : "right",
    });
  }

  return reports;
}

// --- Main scoring ---
export function scoreAllZones(
  lm: { x: number; y: number }[],
  intake: IntakeAnswers,
  canvas?: HTMLCanvasElement
): ZoneScore[] {
  const weights = skinTypeWeights(intake.skinType);

  return INJECTION_ZONES.map((zone) => {
    const geometryScore = geometryScoreForZone(lm, zone);
    const textureScore = canvas ? textureScoreForZone(canvas, lm, zone) : 0;
    const intakeScore = scoreIntake(intake, zone);

    const score =
      geometryScore * weights.geometry +
      textureScore * weights.texture +
      intakeScore * weights.intake;

    const status =
      score >= 68 ? "recommend" : score >= 38 ? "suggest" : "none";

    return { zone, score, status, geometryScore, textureScore, intakeScore };
  });
}

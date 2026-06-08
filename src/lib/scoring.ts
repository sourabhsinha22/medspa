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

// Nasolabial angle: approximated by angle between nose base and mouth corner
function nasolabialScore(
  lm: { x: number; y: number }[],
  side: "left" | "right"
): number {
  if (lm.length < 370) return 0;
  const noseBase = lm[2]; // nose tip
  const noseSide = side === "left" ? lm[102] : lm[331];
  const mouthCorner = side === "left" ? lm[61] : lm[291];

  if (!noseBase || !noseSide || !mouthCorner) return 0;

  // Vector from nose side to mouth corner
  const dx = mouthCorner.x - noseSide.x;
  const dy = mouthCorner.y - noseSide.y;
  const angle = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));

  // Steeper angle = deeper fold. Normalize 0–100
  return Math.min(100, Math.max(0, (angle - 60) * 2));
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

// Forehead height as proxy for wrinkle surface area
function foreheadScore(lm: { x: number; y: number }[]): number {
  if (lm.length < 152) return 0;
  const faceH = Math.abs(lm[152].y - lm[10].y);
  const browY = lm.length > 107 ? lm[107].y : lm[10].y + faceH * 0.35;
  const foreheadH = Math.abs(browY - lm[10].y);
  const ratio = faceH > 0 ? foreheadH / faceH : 0;
  return Math.min(100, ratio * 300);
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

// Crow's feet: spread of lateral eye corner landmarks
function crowsFeetScore(
  lm: { x: number; y: number }[],
  side: "left" | "right"
): number {
  const pts = side === "left"
    ? [22, 23, 24, 130].filter((i) => i < lm.length).map((i) => lm[i])
    : [252, 253, 254, 359].filter((i) => i < lm.length).map((i) => lm[i]);
  if (pts.length < 2) return 0;
  const ys = pts.map((p) => p.y);
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const variance = ys.reduce((a, b) => a + (b - mean) ** 2, 0) / ys.length;
  return Math.min(100, variance * 80000);
}

// Route each zone to its best geometry function
function geometryScoreForZone(
  lm: { x: number; y: number }[],
  zone: InjectionZone
): number {
  switch (zone.id) {
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
    default: {
      // Generic: landmark spread variance
      const pts = zone.landmarks
        .filter((i) => i < lm.length)
        .map((i) => lm[i]);
      if (pts.length < 2) return 0;
      const ys = pts.map((p) => p.y);
      const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
      const variance = ys.reduce((a, b) => a + (b - mean) ** 2, 0) / ys.length;
      return Math.min(100, variance * 100000);
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

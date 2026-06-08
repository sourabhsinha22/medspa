export type Treatment = "botox" | "filler";
export type RiskLevel = "low" | "medium" | "high";

export interface InjectionZone {
  id: string;
  name: string;
  treatment: Treatment;
  risk: RiskLevel;
  landmarks: number[];
  intakeTriggers: string[];
  description: string;
  dosageRange: { min: number; max: number; unit: string };
}

export const INJECTION_ZONES: InjectionZone[] = [
  {
    id: "glabella",
    name: "Glabella (11 Lines)",
    treatment: "botox",
    risk: "low",
    landmarks: [55, 107, 151, 9, 336, 285, 168],
    intakeTriggers: ["frown_lines", "between_brows"],
    description: "Vertical lines between the eyebrows",
    dosageRange: { min: 10, max: 25, unit: "units" },
  },
  {
    id: "forehead",
    name: "Forehead Lines",
    treatment: "botox",
    risk: "low",
    landmarks: [10, 67, 69, 104, 108, 151, 337, 299, 333],
    intakeTriggers: ["forehead_lines"],
    description: "Horizontal lines across the forehead",
    dosageRange: { min: 10, max: 20, unit: "units" },
  },
  {
    id: "crows_feet_left",
    name: "Crow's Feet (Left)",
    treatment: "botox",
    risk: "low",
    landmarks: [130, 243, 112, 26, 22, 23, 24],
    intakeTriggers: ["crows_feet", "eye_wrinkles"],
    description: "Fine lines at the outer corner of the left eye",
    dosageRange: { min: 8, max: 15, unit: "units" },
  },
  {
    id: "crows_feet_right",
    name: "Crow's Feet (Right)",
    treatment: "botox",
    risk: "low",
    landmarks: [359, 463, 341, 256, 252, 253, 254],
    intakeTriggers: ["crows_feet", "eye_wrinkles"],
    description: "Fine lines at the outer corner of the right eye",
    dosageRange: { min: 8, max: 15, unit: "units" },
  },
  {
    id: "bunny_lines",
    name: "Bunny Lines",
    treatment: "botox",
    risk: "low",
    landmarks: [1, 44, 274, 209, 429],
    intakeTriggers: ["bunny_lines"],
    description: "Diagonal lines on the nose bridge when scrunching",
    dosageRange: { min: 4, max: 10, unit: "units" },
  },
  {
    id: "nasolabial_left",
    name: "Nasolabial Fold (Left)",
    treatment: "filler",
    risk: "medium",
    landmarks: [36, 92, 132, 49, 57, 187],
    intakeTriggers: ["smile_lines", "nasolabial", "deep_lines"],
    description: "Smile lines running from nose to mouth corner (left)",
    dosageRange: { min: 0.5, max: 1.5, unit: "mL" },
  },
  {
    id: "nasolabial_right",
    name: "Nasolabial Fold (Right)",
    treatment: "filler",
    risk: "medium",
    landmarks: [266, 322, 361, 279, 287, 411],
    intakeTriggers: ["smile_lines", "nasolabial", "deep_lines"],
    description: "Smile lines running from nose to mouth corner (right)",
    dosageRange: { min: 0.5, max: 1.5, unit: "mL" },
  },
  {
    id: "lips",
    name: "Lip Enhancement",
    treatment: "filler",
    risk: "medium",
    landmarks: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 146, 91, 181, 84, 17, 314, 405, 321, 375],
    intakeTriggers: ["thin_lips", "lip_volume", "lip_border"],
    description: "Lip border definition and volume enhancement",
    dosageRange: { min: 0.5, max: 1.0, unit: "mL" },
  },
  {
    id: "marionette_left",
    name: "Marionette Lines (Left)",
    treatment: "filler",
    risk: "medium",
    landmarks: [57, 172, 136, 150, 149],
    intakeTriggers: ["marionette", "mouth_corners", "deep_lines"],
    description: "Lines from mouth corners downward (left)",
    dosageRange: { min: 0.3, max: 1.0, unit: "mL" },
  },
  {
    id: "marionette_right",
    name: "Marionette Lines (Right)",
    treatment: "filler",
    risk: "medium",
    landmarks: [287, 397, 365, 379, 378],
    intakeTriggers: ["marionette", "mouth_corners", "deep_lines"],
    description: "Lines from mouth corners downward (right)",
    dosageRange: { min: 0.3, max: 1.0, unit: "mL" },
  },
  {
    id: "chin",
    name: "Chin",
    treatment: "filler",
    risk: "medium",
    landmarks: [152, 175, 194, 200, 199, 418],
    intakeTriggers: ["chin"],
    description: "Chin projection and dimpling correction",
    dosageRange: { min: 0.5, max: 2.0, unit: "mL" },
  },
  {
    id: "masseter_left",
    name: "Masseter / Jawline (Left)",
    treatment: "botox",
    risk: "medium",
    landmarks: [172, 136, 58, 132, 150],
    intakeTriggers: ["jaw_slimming", "teeth_grinding"],
    description: "Jaw slimming and bruxism treatment (left)",
    dosageRange: { min: 20, max: 40, unit: "units" },
  },
  {
    id: "masseter_right",
    name: "Masseter / Jawline (Right)",
    treatment: "botox",
    risk: "medium",
    landmarks: [397, 365, 288, 361, 379],
    intakeTriggers: ["jaw_slimming", "teeth_grinding"],
    description: "Jaw slimming and bruxism treatment (right)",
    dosageRange: { min: 20, max: 40, unit: "units" },
  },
  {
    id: "cheeks_left",
    name: "Cheek / Malar (Left)",
    treatment: "filler",
    risk: "medium",
    landmarks: [116, 123, 147, 187, 207],
    intakeTriggers: ["cheek_volume", "hollow_cheeks", "facial_volume"],
    description: "Cheek volume restoration and lift (left)",
    dosageRange: { min: 0.5, max: 2.0, unit: "mL" },
  },
  {
    id: "cheeks_right",
    name: "Cheek / Malar (Right)",
    treatment: "filler",
    risk: "medium",
    landmarks: [345, 352, 376, 411, 427],
    intakeTriggers: ["cheek_volume", "hollow_cheeks", "facial_volume"],
    description: "Cheek volume restoration and lift (right)",
    dosageRange: { min: 0.5, max: 2.0, unit: "mL" },
  },
  {
    id: "tear_trough_left",
    name: "Tear Trough (Left)",
    treatment: "filler",
    risk: "high",
    landmarks: [110, 25, 24, 23, 22],
    intakeTriggers: ["under_eye", "dark_circles"],
    description: "Under-eye hollowing correction — HIGH RISK ZONE",
    dosageRange: { min: 0.2, max: 0.5, unit: "mL" },
  },
  {
    id: "tear_trough_right",
    name: "Tear Trough (Right)",
    treatment: "filler",
    risk: "high",
    landmarks: [339, 255, 254, 253, 252],
    intakeTriggers: ["under_eye", "dark_circles"],
    description: "Under-eye hollowing correction — HIGH RISK ZONE",
    dosageRange: { min: 0.2, max: 0.5, unit: "mL" },
  },
];

export const ZONE_COLORS: Record<Treatment, { fill: string; stroke: string }> = {
  botox: { fill: "rgba(99, 179, 237, 0.35)", stroke: "rgba(49, 130, 206, 0.9)" },
  filler: { fill: "rgba(154, 205, 90, 0.35)", stroke: "rgba(100, 160, 40, 0.9)" },
};

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

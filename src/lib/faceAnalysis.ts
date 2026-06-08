// Face angle detection and confidence scoring

export interface HeadPose {
  yaw: number;   // left/right rotation degrees
  pitch: number; // up/down degrees
  roll: number;  // tilt degrees
  isAcceptable: boolean;
  warnings: string[];
}

export interface ZoneConfidence {
  zoneId: string;
  confidence: number; // 0-100
  level: "high" | "medium" | "low";
  reason?: string;
}

// Estimate head pose from facial landmarks
// Uses nose tip, chin, eye corners, and mouth corners as reference points
export function detectHeadPose(lm: { x: number; y: number; z?: number }[]): HeadPose {
  if (lm.length < 468) {
    return { yaw: 0, pitch: 0, roll: 0, isAcceptable: false, warnings: ["Incomplete face detection"] };
  }

  // Key landmarks
  const noseTip = lm[1];
  const chin = lm[152];
  const leftEye = lm[33];
  const rightEye = lm[263];
  const leftMouth = lm[61];
  const rightMouth = lm[291];
  const noseBase = lm[2];

  // Roll: angle of eye line from horizontal
  const eyeDx = rightEye.x - leftEye.x;
  const eyeDy = rightEye.y - leftEye.y;
  const roll = Math.atan2(eyeDy, eyeDx) * (180 / Math.PI);

  // Yaw: asymmetry between nose tip and face midpoint
  const faceMidX = (leftEye.x + rightEye.x) / 2;
  const faceWidth = Math.abs(rightEye.x - leftEye.x);
  const noseOffset = (noseTip.x - faceMidX) / (faceWidth || 0.1);
  const yaw = noseOffset * 90; // rough degrees

  // Pitch: nose tip position relative to eye-chin midpoint
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const faceHeight = Math.abs(chin.y - eyeMidY);
  const nosePitchOffset = (noseTip.y - eyeMidY) / (faceHeight || 0.1);
  const pitch = (nosePitchOffset - 0.45) * 100; // rough degrees, 0 = straight

  // Mouth symmetry check (additional yaw signal)
  const mouthMidX = (leftMouth.x + rightMouth.x) / 2;
  const mouthOffset = Math.abs(mouthMidX - faceMidX) / (faceWidth || 0.1);

  const warnings: string[] = [];
  if (Math.abs(yaw) > 15) warnings.push(`Head turned ${yaw > 0 ? "right" : "left"} — face the camera directly`);
  if (Math.abs(pitch) > 15) warnings.push(`Head tilted ${pitch > 0 ? "down" : "up"} — look straight ahead`);
  if (Math.abs(roll) > 10) warnings.push(`Head tilted sideways — keep head upright`);

  return {
    yaw: Math.round(yaw),
    pitch: Math.round(pitch),
    roll: Math.round(roll),
    isAcceptable: warnings.length === 0,
    warnings,
  };
}

// Calculate per-zone confidence based on head pose + landmark coverage
export function calculateZoneConfidence(
  zoneId: string,
  zoneLandmarks: number[],
  lm: { x: number; y: number }[],
  headPose: HeadPose,
  lightingImbalance: number // 0-100
): ZoneConfidence {
  // Base confidence from landmark availability
  const available = zoneLandmarks.filter((i) => i < lm.length).length;
  const landmarkCoverage = available / zoneLandmarks.length;

  // Pose penalty: zones on the side most turned away lose confidence
  let posePenalty = 0;
  const isLeftZone = zoneId.endsWith("_left");
  const isRightZone = zoneId.endsWith("_right");

  if (isLeftZone && headPose.yaw < -10) posePenalty = Math.min(40, Math.abs(headPose.yaw) * 2);
  if (isRightZone && headPose.yaw > 10) posePenalty = Math.min(40, headPose.yaw * 2);
  if (Math.abs(headPose.pitch) > 15) posePenalty += 15;
  if (Math.abs(headPose.roll) > 10) posePenalty += 10;

  // Lighting penalty
  const lightingPenalty = lightingImbalance * 0.3;

  const confidence = Math.max(0, Math.min(100,
    landmarkCoverage * 100 - posePenalty - lightingPenalty
  ));

  const level: ZoneConfidence["level"] =
    confidence >= 70 ? "high" : confidence >= 45 ? "medium" : "low";

  let reason: string | undefined;
  if (posePenalty > 20) reason = "Head angle reduces accuracy";
  else if (lightingPenalty > 15) reason = "Uneven lighting reduces accuracy";
  else if (landmarkCoverage < 0.8) reason = "Partial landmark coverage";

  return { zoneId, confidence, level, reason };
}

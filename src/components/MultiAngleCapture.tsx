"use client";

import { useState } from "react";
import FaceCapture from "./FaceCapture";

export interface AnglePhotos {
  front: string;
  leftProfile: string;
  rightProfile: string;
}

interface MultiAngleCaptureProps {
  onComplete: (photos: AnglePhotos) => void;
  onBack: () => void;
}

const ANGLES = [
  {
    key: "front" as const,
    label: "Front",
    instruction: "Face the camera directly. Look straight ahead.",
    icon: "⬆",
    guide: "oval",
  },
  {
    key: "leftProfile" as const,
    label: "Left 45°",
    instruction: "Turn your head slightly to the left — about 45 degrees.",
    icon: "↖",
    guide: "left",
  },
  {
    key: "rightProfile" as const,
    label: "Right 45°",
    instruction: "Turn your head slightly to the right — about 45 degrees.",
    icon: "↗",
    guide: "right",
  },
];

export default function MultiAngleCapture({ onComplete, onBack }: MultiAngleCaptureProps) {
  const [photos, setPhotos] = useState<Partial<AnglePhotos>>({});
  const [currentAngleIdx, setCurrentAngleIdx] = useState(0);

  const current = ANGLES[currentAngleIdx];

  const handleCapture = (dataUrl: string) => {
    const updated = { ...photos, [current.key]: dataUrl };
    setPhotos(updated);

    if (currentAngleIdx < ANGLES.length - 1) {
      setCurrentAngleIdx((i) => i + 1);
    } else {
      onComplete(updated as AnglePhotos);
    }
  };

  const handleRetake = (idx: number) => {
    setCurrentAngleIdx(idx);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg">
      {/* Progress strip */}
      <div className="flex items-center gap-3 w-full">
        {ANGLES.map((angle, i) => {
          const done = !!photos[angle.key];
          const active = i === currentAngleIdx;
          return (
            <button
              key={angle.key}
              onClick={() => done && handleRetake(i)}
              disabled={!done && i !== currentAngleIdx}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border-2 transition-all ${
                active ? "border-rose-500 bg-rose-50" :
                done ? "border-green-400 bg-green-50 cursor-pointer" :
                "border-gray-200 bg-white opacity-50"
              }`}
            >
              <span className="text-lg">{done ? "✓" : angle.icon}</span>
              <span className={`text-xs font-medium ${active ? "text-rose-700" : done ? "text-green-700" : "text-gray-400"}`}>
                {angle.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Instruction */}
      <div className="text-center">
        <p className="text-xs text-rose-600 font-semibold uppercase tracking-wider mb-1">
          Photo {currentAngleIdx + 1} of {ANGLES.length}
        </p>
        <p className="text-gray-600 text-sm">{current.instruction}</p>
      </div>

      {/* Camera — key forces remount on angle change so camera restarts */}
      <FaceCapture key={currentAngleIdx} onCapture={handleCapture} />

      <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">
        Back to intake
      </button>
    </div>
  );
}

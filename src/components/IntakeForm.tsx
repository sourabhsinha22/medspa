"use client";

import { useState } from "react";
import { IntakeAnswers, SkinType } from "@/lib/scoring";

const CONCERNS = [
  { key: "forehead_lines", label: "Forehead Lines" },
  { key: "frown_lines", label: "Frown / 11 Lines" },
  { key: "between_brows", label: "Between Brows" },
  { key: "crows_feet", label: "Crow's Feet" },
  { key: "eye_wrinkles", label: "Eye Wrinkles" },
  { key: "bunny_lines", label: "Bunny Lines (Nose)" },
  { key: "smile_lines", label: "Smile Lines" },
  { key: "nasolabial", label: "Nasolabial Folds" },
  { key: "thin_lips", label: "Thin Lips" },
  { key: "lip_volume", label: "Lip Volume" },
  { key: "lip_border", label: "Lip Border" },
  { key: "marionette", label: "Marionette Lines" },
  { key: "mouth_corners", label: "Mouth Corners" },
  { key: "chin", label: "Chin" },
  { key: "jaw_slimming", label: "Jaw Slimming" },
  { key: "teeth_grinding", label: "Teeth Grinding / TMJ" },
  { key: "cheek_volume", label: "Cheek Volume" },
  { key: "hollow_cheeks", label: "Hollow Cheeks" },
  { key: "facial_volume", label: "Facial Volume Loss" },
  { key: "under_eye", label: "Under Eye Hollows" },
  { key: "dark_circles", label: "Dark Circles" },
  { key: "deep_lines", label: "Deep Lines / Folds" },
];

const SKIN_TYPES: { value: SkinType; label: string; description: string; color: string }[] = [
  { value: 1, label: "Type I", description: "Always burns, never tans", color: "bg-amber-50 border-amber-200" },
  { value: 2, label: "Type II", description: "Burns easily, tans minimally", color: "bg-amber-100 border-amber-300" },
  { value: 3, label: "Type III", description: "Burns moderately, tans gradually", color: "bg-amber-200 border-amber-400" },
  { value: 4, label: "Type IV", description: "Burns minimally, tans well", color: "bg-amber-300 border-amber-500" },
  { value: 5, label: "Type V", description: "Rarely burns, tans darkly", color: "bg-amber-500 border-amber-600" },
  { value: 6, label: "Type VI", description: "Never burns, deeply pigmented", color: "bg-amber-700 border-amber-800" },
];

interface IntakeFormProps {
  onSubmit: (answers: IntakeAnswers) => void;
}

export default function IntakeForm({ onSubmit }: IntakeFormProps) {
  const [age, setAge] = useState("");
  const [concerns, setConcerns] = useState<string[]>([]);
  const [previousInjectables, setPreviousInjectables] = useState(false);
  const [skinType, setSkinType] = useState<SkinType | null>(null);

  const toggleConcern = (key: string) => {
    setConcerns((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
    );
  };

  const canSubmit = age && !isNaN(Number(age)) && skinType !== null;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      age: Number(age),
      concerns,
      previousInjectables,
      skinType: skinType!,
    });
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-6 pb-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Patient Intake</h2>
        <p className="text-gray-500 mt-1 text-sm">
          Tell us about your concerns so we can personalise your treatment map.
        </p>
      </div>

      {/* Age */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Age</label>
        <input
          type="number"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="Enter your age"
          min={18}
          max={99}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
        />
      </div>

      {/* Skin type */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">
          Skin Type{" "}
          <span className="text-gray-400 font-normal">(Fitzpatrick scale)</span>
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SKIN_TYPES.map((st) => (
            <button
              key={st.value}
              onClick={() => setSkinType(st.value)}
              className={`flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all ${
                skinType === st.value
                  ? "border-rose-500 ring-2 ring-rose-200"
                  : `${st.color} hover:border-rose-300`
              }`}
            >
              <span className={`text-xs font-bold ${st.value >= 5 ? "text-white" : "text-gray-800"}`}>
                {st.label}
              </span>
              <span className={`text-xs mt-0.5 ${st.value >= 5 ? "text-white/80" : "text-gray-500"}`}>
                {st.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Concerns */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">
          Areas of concern{" "}
          <span className="text-gray-400 font-normal">(select all that apply)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {CONCERNS.map((c) => (
            <button
              key={c.key}
              onClick={() => toggleConcern(c.key)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                concerns.includes(c.key)
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-rose-300"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Previous injectables */}
      <button
        onClick={() => setPreviousInjectables(!previousInjectables)}
        className="flex items-center gap-3 w-fit"
      >
        <div className={`w-10 h-6 rounded-full transition-colors ${previousInjectables ? "bg-rose-600" : "bg-gray-200"}`}>
          <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 mt-1 ${previousInjectables ? "translate-x-4" : "translate-x-0"}`} />
        </div>
        <span className="text-sm text-gray-700">I have had injectables before</span>
      </button>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full py-3 bg-rose-600 text-white rounded-full font-medium
          hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Continue to Photo
      </button>
    </div>
  );
}

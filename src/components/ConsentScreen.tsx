"use client";

import { useState } from "react";

interface ConsentScreenProps {
  selectedZoneCount: number;
  onConsent: () => void;
}

export default function ConsentScreen({ selectedZoneCount, onConsent }: ConsentScreenProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6 py-8 px-4">
      <div className="text-center">
        <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900">Review & Consent</h2>
        <p className="text-gray-500 text-sm mt-1">
          Please read and agree before viewing your treatment plan
        </p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-sm text-gray-700 leading-relaxed flex flex-col gap-3">
        <p>
          Your clinician has reviewed and approved a treatment plan covering{" "}
          <strong>{selectedZoneCount} zone{selectedZoneCount !== 1 ? "s" : ""}</strong>. The visual
          map you are about to see is for educational and communication purposes only.
        </p>
        <p>
          <strong>Important:</strong> The areas highlighted and any dosage ranges shown are
          indicative suggestions based on facial analysis. They are not a guarantee of
          treatment outcome or a final clinical prescription.
        </p>
        <p>
          All treatment decisions are made by your licensed clinician. Results vary by
          individual. You may ask questions before any treatment begins.
        </p>
        <p>
          By proceeding you acknowledge that you have discussed this plan with your clinician
          and consent to viewing this information.
        </p>
      </div>

      <button
        onClick={() => setAgreed(!agreed)}
        className="flex items-start gap-3 text-left"
      >
        <div className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          agreed ? "bg-rose-600 border-rose-600" : "border-gray-400 bg-white"
        }`}>
          {agreed && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2 6l3 3 5-5" />
            </svg>
          )}
        </div>
        <span className="text-sm text-gray-700">
          I have read and understood the above. I consent to viewing my personalised treatment plan.
        </span>
      </button>

      <button
        onClick={onConsent}
        disabled={!agreed}
        className="w-full py-3 bg-rose-600 text-white rounded-full font-medium
          hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        View My Treatment Plan
      </button>
    </div>
  );
}

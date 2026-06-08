import jsPDF from "jspdf";
import { ZoneScore } from "./scoring";
import { ZONE_COLORS } from "./zones";

export async function exportTreatmentPDF({
  annotatedImageDataUrl,
  scores,
  selectedZoneIds,
  clinicianNotes,
  patientAge,
  sessionDate,
}: {
  annotatedImageDataUrl: string;
  scores: ZoneScore[];
  selectedZoneIds: string[];
  clinicianNotes: string;
  patientAge: number;
  sessionDate: string;
}) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const margin = 14;
  let y = margin;

  // Header
  pdf.setFillColor(225, 29, 72); // rose-600
  pdf.rect(0, 0, W, 18, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("MedSpa Treatment Plan", margin, 12);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text(sessionDate, W - margin, 12, { align: "right" });

  y = 26;
  pdf.setTextColor(50, 50, 50);
  pdf.setFontSize(10);
  pdf.text(`Patient Age: ${patientAge}`, margin, y);
  y += 8;

  // Annotated photo
  try {
    const imgProps = pdf.getImageProperties(annotatedImageDataUrl);
    const imgW = W - margin * 2;
    const imgH = (imgProps.height / imgProps.width) * imgW;
    pdf.addImage(annotatedImageDataUrl, "JPEG", margin, y, imgW, Math.min(imgH, 90));
    y += Math.min(imgH, 90) + 6;
  } catch {
    y += 4;
  }

  // Selected zones
  const selected = scores.filter((s) => selectedZoneIds.includes(s.zone.id));
  const botoxZones = selected.filter((s) => s.zone.treatment === "botox");
  const fillerZones = selected.filter((s) => s.zone.treatment === "filler");

  const drawZoneSection = (
    title: string,
    zones: ZoneScore[],
    color: [number, number, number]
  ) => {
    if (zones.length === 0) return;
    pdf.setFillColor(...color);
    pdf.roundedRect(margin, y, W - margin * 2, 7, 2, 2, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(title, margin + 3, y + 5);
    y += 10;

    pdf.setTextColor(50, 50, 50);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);

    for (const s of zones) {
      const dosage = `${s.zone.dosageRange.min}–${s.zone.dosageRange.max} ${s.zone.dosageRange.unit}`;
      pdf.text(`• ${s.zone.name}`, margin + 3, y);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Suggested: ${dosage}`, W - margin - 2, y, { align: "right" });
      pdf.setTextColor(50, 50, 50);
      y += 6;
    }
    y += 3;
  };

  drawZoneSection("BOTOX", botoxZones, [49, 130, 206]);
  drawZoneSection("FILLER", fillerZones, [100, 160, 40]);

  // Clinician notes
  if (clinicianNotes.trim()) {
    pdf.setFillColor(245, 245, 245);
    pdf.roundedRect(margin, y, W - margin * 2, 7, 2, 2, "F");
    pdf.setTextColor(80, 80, 80);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("CLINICIAN NOTES", margin + 3, y + 5);
    y += 10;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    const lines = pdf.splitTextToSize(clinicianNotes, W - margin * 2 - 6);
    pdf.text(lines, margin + 3, y);
    y += lines.length * 5 + 4;
  }

  // Disclaimer
  y = Math.max(y, 260);
  pdf.setFontSize(7);
  pdf.setTextColor(150, 150, 150);
  pdf.setFont("helvetica", "italic");
  pdf.text(
    "This document is a visual guide only. Dosage suggestions are indicative ranges and must be confirmed by a licensed clinician.\nResults are not guaranteed. All treatment decisions are the responsibility of the treating practitioner.",
    margin,
    y,
    { maxWidth: W - margin * 2 }
  );

  pdf.save(`medspa-treatment-${Date.now()}.pdf`);
}

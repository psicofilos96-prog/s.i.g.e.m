import { jsPDF } from "jspdf";
import { institution } from "@/config/institution";
import type { LogoImage } from "./school-logo-data";

export type LetterInput = {
  schoolName: string; studentName: string; from: string; to: string;
  present: number; absent: number; rate: number; limitPct: number; today: string;
};

const br = (d: string) => d.split("-").reverse().join("/");

/** Texto do ofício ao Conselho Tutelar (ECA art. 56). Modelo-base do sistema: rascunho não homologado, editável pela Direção antes de assinar. */
export function guardianshipLetterText(i: LetterInput): string[] {
  const total = i.present + i.absent;
  return [
    "Ao Conselho Tutelar do Município",
    "Assunto: comunicação de reiteração de faltas injustificadas (art. 56, II, da Lei nº 8.069/1990 — ECA).",
    `Comunicamos que o(a) estudante ${i.studentName}, matriculado(a) nesta unidade escolar, registrou ${i.absent} falta(s) em ${total} aula(s) com chamada no Diário, no período de ${br(i.from)} a ${br(i.to)}, o que corresponde a ${i.rate}% de frequência, abaixo do limite de ${i.limitPct}% definido pela escola.`,
    "Informamos que a escola adotou as providências ao seu alcance junto à família, conforme registros da unidade, e solicitamos as medidas cabíveis de proteção.",
    "Colocamo-nos à disposição para os esclarecimentos necessários.",
  ];
}

export function guardianshipLetterPdf(i: LetterInput, logo: LogoImage | null = null): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  if (logo) { try { doc.addImage(logo.dataUrl, logo.format, 15, 10, 18, 18); } catch { /* sem logo */ } }
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text(institution.documentGovernmentName.toUpperCase(), 105, 16, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.text(institution.departmentName, 105, 21, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.text(i.schoolName.toUpperCase(), 105, 26, { align: "center" });
  doc.setFontSize(12); doc.text("OFÍCIO AO CONSELHO TUTELAR", 105, 36, { align: "center" });
  doc.setFont("helvetica", "italic"); doc.setFontSize(8);
  doc.text("Modelo-base do sistema — rascunho não homologado; revise antes de assinar.", 105, 41, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  let y = 52;
  for (const p of guardianshipLetterText(i)) {
    for (const l of doc.splitTextToSize(p, 180) as string[]) { if (y > 260) { doc.addPage(); y = 20; } doc.text(l, 15, y); y += 6; }
    y += 4;
  }
  y = Math.max(y + 10, 230); if (y > 270) { doc.addPage(); y = 40; }
  doc.text(`Itaperuna, ${br(i.today)}.`, 15, y);
  doc.line(60, y + 22, 150, y + 22); doc.text("Direção da Unidade Escolar", 105, y + 27, { align: "center" });
  return doc.output("blob");
}

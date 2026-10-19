import { jsPDF } from "jspdf";
import { institution } from "@/config/institution";
import type { LogoImage } from "./school-logo-data";

export type VaccinationLetterInput = { schoolName: string; studentName: string; declaredOn: string; dueOn: string; today: string };
const br = (d: string) => d.split("-").reverse().join("/");

/** Modelo-base do sistema (rascunho não homologado): comunicação de declaração de vacinação vencida. */
export function vaccinationLetterText(i: VaccinationLetterInput): string[] {
  return [
    "Ao Conselho Tutelar do Município e ao Ministério Público",
    "Assunto: comunicação de pendência de comprovação vacinal (Portaria Conjunta SEMED/SMS nº 008/2024).",
    `Comunicamos que o(a) estudante ${i.studentName}, matriculado(a) nesta unidade escolar, teve a situação vacinal registrada como pendente em ${br(i.declaredOn)}, com prazo de apresentação do comprovante até ${br(i.dueOn)}, sem regularização registrada pela escola até a presente data.`,
    "Solicitamos as providências cabíveis para a proteção da saúde da criança ou do adolescente.",
    "Colocamo-nos à disposição para os esclarecimentos necessários.",
  ];
}

export function vaccinationLetterPdf(i: VaccinationLetterInput, logo: LogoImage | null = null): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  if (logo) { try { doc.addImage(logo.dataUrl, logo.format, 15, 10, 18, 18); } catch { /* sem logo */ } }
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text(institution.documentGovernmentName.toUpperCase(), 105, 16, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.text(institution.departmentName, 105, 21, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.text(i.schoolName.toUpperCase(), 105, 26, { align: "center" });
  doc.setFontSize(12); doc.text("OFÍCIO — PENDÊNCIA VACINAL", 105, 36, { align: "center" });
  doc.setFont("helvetica", "italic"); doc.setFontSize(8);
  doc.text("Modelo-base do sistema — rascunho não homologado; revise antes de assinar.", 105, 41, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  let y = 52;
  for (const p of vaccinationLetterText(i)) {
    for (const l of doc.splitTextToSize(p, 180) as string[]) { doc.text(l, 15, y); y += 6; }
    y += 4;
  }
  y = Math.max(y + 10, 230);
  doc.text(`Itaperuna, ${br(i.today)}.`, 15, y);
  doc.line(60, y + 22, 150, y + 22); doc.text("Direção da Unidade Escolar", 105, y + 27, { align: "center" });
  return doc.output("blob");
}

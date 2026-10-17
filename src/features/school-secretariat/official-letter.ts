/** Ofícios da escola: numeração anual pelo banco; PDF A4 direto (jsPDF) com quebra de página controlada. */
import { institution } from "@/config/institution";

export type OfficialLetter = { id: string; code: string; recipient: string; subject: string; body: string; signer: string; signer_role: string | null; recorded_at: string; cancelled?: string | null };

export async function officialLetterPdf(l: OfficialLetter, schoolName: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 25, W = 160, BOTTOM = 270; let y = 22;
  const header = () => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); y = 22;
    for (const h of [institution.governmentName, institution.departmentName, schoolName]) { doc.text(h, 105, y, { align: "center" }); y += 5; }
    y += 6;
  };
  header();
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(l.code, L, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(new Date(l.recorded_at).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }), L + W, y, { align: "right" }); y += 10;
  const block = (label: string, v: string) => {
    const ls = doc.splitTextToSize(`${label}${v}`, W) as string[]; doc.text(ls, L, y); y += 5.5 * ls.length + 2;
  };
  block("Ao(À) ", l.recipient);
  doc.setFont("helvetica", "bold"); block("Assunto: ", l.subject); doc.setFont("helvetica", "normal");
  y += 4; doc.setFontSize(11);
  for (const para of l.body.split(/\n+/)) {
    const ls = doc.splitTextToSize(para.trim(), W) as string[];
    for (const line of ls) { if (y > BOTTOM) { doc.addPage(); header(); doc.setFontSize(11); } doc.text(line, L, y); y += 6; }
    y += 3;
  }
  if (y > BOTTOM - 30) { doc.addPage(); header(); }
  y += 20; doc.line(65, y, 145, y); y += 5; doc.setFontSize(10);
  doc.text(l.signer, 105, y, { align: "center" });
  if (l.signer_role) doc.text(l.signer_role, 105, y + 5, { align: "center" });
  if (l.cancelled) { doc.setTextColor(180, 0, 0); doc.setFontSize(9); doc.text(`CANCELADO: ${l.cancelled}`, 105, 285, { align: "center" }); }
  return doc.output("blob");
}

export const LETTER_MESSAGES: Record<string, string> = {
  "letter:capability-missing": "Sua conta não pode emitir ofícios nesta escola.",
  "letter:recipient-required": "Informe o destinatário.",
  "letter:subject-required": "Informe o assunto.",
  "letter:body-required": "Escreva o texto do ofício.",
  "letter:signer-required": "Informe quem assina.",
  "letter:reason-required": "Explique o motivo do cancelamento.",
  "letter:already-cancelled": "Este ofício já foi cancelado.",
};

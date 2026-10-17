/** Termo A4 em PDF direto (jsPDF) para assinatura do responsável; mesmo texto versionado da tela. */
import { institution } from "@/config/institution";
import type { ConsentTerm } from "./consent-terms";

export async function consentTermPdf(t: ConsentTerm, ctx: { school: string; student: string; blank?: boolean }): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 20, W = 170; let y = 22;
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  for (const h of [institution.governmentName, institution.departmentName, ctx.school]) { doc.text(doc.splitTextToSize(h, W) as string[], 105, y, { align: "center" }); y += 5; }
  y += 6; doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(t.title.toUpperCase(), 105, y, { align: "center" }); y += 10;
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  const field = (k: string, v: string) => { doc.setFont("helvetica", "bold"); doc.text(`${k}:`, L, y); doc.setFont("helvetica", "normal");
    const s = doc.splitTextToSize(v, W - 40) as string[]; doc.text(s, L + 40, y); y += 6 * s.length + 1; };
  field("Estudante", ctx.student);
  field("Responsável", "_".repeat(60));
  field("Documento", "_".repeat(30));
  y += 4;
  for (const p of t.body) { const s = doc.splitTextToSize(p, W) as string[]; doc.text(s, L, y, { align: "justify", maxWidth: W }); y += 5 * s.length + 3; }
  y += 4; doc.setFont("helvetica", "bold"); doc.text("Manifestação do responsável:", L, y); y += 8; doc.setFont("helvetica", "normal");
  const opts = t.key === "ciencia-de-faltas" ? ["Estou ciente"] : ["Autorizo", "Não autorizo"];
  opts.forEach((o, i) => { const x = L + i * 60; doc.rect(x, y - 4, 4.5, 4.5); doc.text(o, x + 7, y); });
  y = Math.max(y + 30, 230);
  doc.text("Local e data: __________________________, ____/____/________", L, y - 14);
  doc.line(L + 35, y, L + W - 35, y);
  doc.setFontSize(9); doc.text("Assinatura do responsável legal", 105, y + 5, { align: "center" });
  doc.text(`Termo versão ${t.version} · SIGEM`, L, 285);
  return doc.output("blob");
}

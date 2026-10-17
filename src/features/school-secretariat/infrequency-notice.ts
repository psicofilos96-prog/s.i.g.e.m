/** Aviso de infrequência ao responsável: PDF A4 direto (jsPDF) a partir da apuração do banco. */
import { institution } from "@/config/institution";

export type InfrequencyRow = { student_id: string; student_name: string; present: number; absent: number; rate: number; threshold: number; last_notice: string | null };

const br = (d: string) => d.slice(0, 10).split("-").reverse().join("/");

export function noticeText(r: InfrequencyRow, from: string, to: string): string[] {
  return [
    `Comunicamos que o(a) estudante ${r.student_name} teve ${r.absent} falta(s) e ${r.present} presença(s) registradas entre ${br(from)} e ${br(to)}, o que corresponde a ${String(r.rate).replace(".", ",")}% de frequência.`,
    `A frequência mínima exigida é de ${String(r.threshold).replace(".", ",")}%. Pedimos que o responsável compareça à secretaria da escola para conversar sobre a situação e, se houver, entregar atestados ou justificativas das faltas.`,
    "Persistindo a infrequência, a escola seguirá os procedimentos previstos, inclusive a comunicação ao Conselho Tutelar.",
  ];
}

export async function infrequencyNoticePdf(r: InfrequencyRow, from: string, to: string, schoolName: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 20, W = 170; let y = 22;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  for (const h of [institution.governmentName, institution.departmentName, schoolName]) { doc.text(h, 105, y, { align: "center" }); y += 5; }
  y += 8; doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("AVISO DE INFREQUÊNCIA ESCOLAR", 105, y, { align: "center" }); y += 12;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text("Senhor(a) responsável,", L, y); y += 8;
  for (const p of noticeText(r, from, to)) { const ls = doc.splitTextToSize(p, W) as string[]; doc.text(ls, L, y); y += 6 * ls.length + 4; }
  y += 4; doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, L, y); y += 30;
  doc.line(L, y, L + 75, y); doc.line(L + 95, y, L + W, y); y += 5;
  doc.setFontSize(9); doc.text("Secretaria da escola", L + 37, y, { align: "center" }); doc.text("Ciência do responsável", L + 132, y, { align: "center" });
  doc.setFontSize(8); doc.setTextColor(110); doc.text("Modelo do sistema — substitua pelo texto oficial da rede quando houver.", 105, 285, { align: "center" });
  return doc.output("blob");
}

export const INFREQUENCY_MESSAGES: Record<string, string> = {
  "infrequency:capability-missing": "Sua conta não pode emitir avisos nesta escola.",
  "infrequency:period-invalid": "Confira as datas do período.",
  "infrequency:not-below-threshold": "Este aluno não está abaixo da frequência mínima no período.",
  "infrequency:already-today": "O aviso deste aluno já foi registrado hoje.",
};

/** Comprovante A4 do pedido de vaga: PDF direto (jsPDF), mesmo conteúdo da tela. Não é matrícula nem promessa de vaga. */
import { institution } from "@/config/institution";
import type { VacancyRequestRow } from "./vacancy-request-bank";

const br = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

export function receiptLines(r: VacancyRequestRow, schoolName: string): [string, string][] {
  return [
    ["Escola", schoolName],
    ["Protocolo", r.protocol_code],
    ["Data do pedido", br(r.recorded_at)],
    ["Estudante", r.student_name],
    ["Nascimento", br(r.student_birth_date)],
    ["Etapa pretendida", r.desired_stage],
    ["Turno de preferência", r.desired_shift ?? "Sem preferência"],
    ["Responsável", r.guardian_name],
    ["Telefone", r.guardian_phone ?? "Não informado"],
  ];
}

export async function vacancyReceiptPdf(r: VacancyRequestRow, schoolName: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 20, W = 170; let y = 22;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  for (const h of [institution.governmentName, institution.departmentName]) { doc.text(h, 105, y, { align: "center" }); y += 5; }
  y += 6; doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("COMPROVANTE DE SOLICITAÇÃO DE VAGA", 105, y, { align: "center" }); y += 10;
  doc.setFontSize(10);
  for (const [k, v] of receiptLines(r, schoolName)) {
    doc.setFont("helvetica", "bold"); doc.text(`${k}:`, L, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(v, W - 50) as string[];
    doc.text(lines, L + 50, y); y += 6 * lines.length + 1;
  }
  y += 6; doc.setDrawColor(150); doc.line(L, y, L + W, y); y += 8;
  const notes = [
    "Este comprovante registra o pedido de vaga. Ele não é matrícula e não garante vaga.",
    "A fila segue a ordem de protocolo da etapa pretendida. Quando houver vaga, a escola fará contato pelo telefone informado.",
    "Ao ser convocado, compareça à secretaria da escola dentro do prazo, com os documentos do estudante.",
    "Mantenha o telefone atualizado e guarde o número do protocolo para acompanhar o pedido.",
  ];
  for (const n of notes) { const t = doc.splitTextToSize(`• ${n}`, W) as string[]; doc.text(t, L, y); y += 5 * t.length + 2; }
  y = Math.max(y + 25, 230);
  doc.line(L, y, L + 75, y); doc.line(L + 95, y, L + W, y);
  doc.setFontSize(9);
  doc.text("Secretaria Escolar", L + 37.5, y + 5, { align: "center" });
  doc.text("Responsável pelo estudante", L + 132.5, y + 5, { align: "center" });
  doc.text(`Protocolo ${r.protocol_code}`, L, 285);
  return doc.output("blob");
}

import { jsPDF } from "jspdf";
import { institution } from "@/config/institution";
import { formatAcademicDateNumeric } from "@/lib/academic-date";
import { declarationNumberLabel } from "./movement-docs";
import type { DeclarationFacts } from "./movement-source";

const d = (s: string | null | undefined) => (s ? formatAcademicDateNumeric(s as never) : "—");
const BLUE: [number, number, number] = [31, 78, 145];

function header(doc: jsPDF, school: string | null, title: string) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text(institution.documentGovernmentName.toUpperCase(), 105, 18, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.text(institution.departmentName, 105, 23, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.text((school ?? "").toUpperCase(), 105, 28, { align: "center" });
  doc.setFillColor(...BLUE); doc.rect(12, 33, 186, 9, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.text(title, 105, 39, { align: "center" });
  doc.setTextColor(0, 0, 0); doc.setFontSize(10); doc.setFont("helvetica", "normal");
}
function footer(doc: jsPDF) {
  doc.setFontSize(7); doc.setTextColor(110, 110, 110);
  doc.text("Modelo do sistema — texto-base editável, ainda não adotado como modelo oficial pela rede.", 105, 288, { align: "center" });
  doc.setTextColor(0, 0, 0);
}
function sign(doc: jsPDF, y: number, label: string, x = 105) {
  doc.line(x - 40, y, x + 40, y); doc.setFontSize(9); doc.text(label, x, y + 5, { align: "center" });
}

export function transferDeclarationPdf(f: DeclarationFacts): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, f.school_name, "DECLARAÇÃO PROVISÓRIA DE TRANSFERÊNCIA");
  doc.setFontSize(9); doc.text(`Nº ${declarationNumberLabel(f.number, f.issue_year)}`, 198, 50, { align: "right" });
  doc.setFontSize(11);
  const body = `Declaramos, para os devidos fins, que ${f.student_name ?? "________________"}, nascido(a) em ${d(f.birth_date)}, ` +
    `esteve regularmente matriculado(a) nesta unidade escolar no ano letivo ${f.year_label ?? "____"}` +
    `${f.class_label ? `, na turma ${f.class_label}` : ""}, de ${d(f.opened_on)} a ${d(f.ended_on)}, ` +
    `tendo solicitado TRANSFERÊNCIA${f.destination ? ` para ${f.destination}` : ""}.\n\n` +
    `O Histórico Escolar será expedido no prazo regulamentar. Esta declaração é provisória e tem validade de ${f.validity_days} dias, ` +
    `até ${d(f.valid_until)}.`;
  doc.text(doc.splitTextToSize(body, 176), 17, 62, { lineHeightFactor: 1.6 });
  doc.text(`Emitida em ${d(f.issued_on)}.`, 193, 140, { align: "right" });
  sign(doc, 175, "Secretário(a) Escolar"); sign(doc, 205, "Diretor(a)");
  footer(doc);
  return doc.output("blob");
}

export type RenewalTerm = { studentName: string; yearLabel: string | null; grade: string | null; image: boolean | null; address: string | null };

/** Termo de Renovação: mesmos campos do quadro original da ficha. Um aluno por página. */
export function renewalTermPdf(school: string | null, terms: RenewalTerm[]): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  terms.forEach((t, i) => {
    if (i) doc.addPage();
    header(doc, school, "TERMO DE RENOVAÇÃO DE MATRÍCULA");
    doc.setFontSize(11);
    doc.text(doc.splitTextToSize(`Eu, responsável legal por ${t.studentName}, confirmo a renovação da matrícula para o ano letivo indicado abaixo.`, 176), 17, 55, { lineHeightFactor: 1.5 });
    const rows: [string, string][] = [
      ["Ano letivo", t.yearLabel ?? ""], ["Série/Ano", t.grade ?? ""],
      ["Autorização de imagem", t.image == null ? "(  ) Sim   (  ) Não" : t.image ? "(X) Sim   (  ) Não" : "(  ) Sim   (X) Não"],
      ["Mudança de endereço", t.address ?? ""], ["Assinatura do responsável", ""], ["Rubrica do servidor", ""],
    ];
    let y = 75;
    for (const [k, v] of rows) {
      doc.rect(17, y, 176, 12); doc.line(80, y, 80, y + 12);
      doc.setFont("helvetica", "bold"); doc.text(k, 20, y + 7.5);
      doc.setFont("helvetica", "normal"); doc.text(doc.splitTextToSize(v, 108)[0] ?? "", 83, y + 7.5);
      y += 12;
    }
    footer(doc);
  });
  return doc.output("blob");
}

export function downloadBlob(b: Blob, name: string) {
  const url = URL.createObjectURL(b); const a = document.createElement("a");
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

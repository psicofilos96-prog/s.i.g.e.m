import { jsPDF } from "jspdf";
import { institution } from "@/config/institution";
import { occurrenceNumber, type OccurrenceThread } from "./occurrences";
import type { LogoImage } from "./school-logo-data";

const dt = (s: string) => new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Folha A4 da ocorrência com adendos e campos de assinatura; quebra página sem cortar texto. */
export function occurrencePdf(t: OccurrenceThread, schoolName: string, logo: LogoImage | null = null): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 0;
  const head = () => {
    if (logo) { try { doc.addImage(logo.dataUrl, logo.format, 15, 10, 18, 18); } catch { /* logo ilegível: segue sem logo */ } }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(institution.documentGovernmentName.toUpperCase(), 105, 16, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.text(institution.departmentName, 105, 21, { align: "center" });
    doc.setFont("helvetica", "bold"); doc.text(schoolName.toUpperCase(), 105, 26, { align: "center" });
    doc.setFontSize(12); doc.text(`REGISTRO DE OCORRÊNCIA Nº ${occurrenceNumber(t.original)}`, 105, 35, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); y = 45;
  };
  const need = (h: number) => { if (y + h > 275) { doc.addPage(); head(); } };
  const para = (label: string, text: string) => {
    const lines = doc.splitTextToSize(text || "—", 180) as string[];
    need(6); doc.setFont("helvetica", "bold"); doc.text(label, 15, y); y += 5; doc.setFont("helvetica", "normal");
    for (const l of lines) { need(5); doc.text(l, 15, y); y += 5; }
    y += 2;
  };
  head();
  const o = t.original;
  para("Data e hora do fato", dt(o.occurred_at));
  para("Tipo e gravidade", `${o.kind} — ${o.severity}`);
  para("Envolvidos", o.parties.filter((p) => p.role === "envolvido").map((p) => `${p.label} (${p.kind})`).join("; "));
  para("Testemunhas", [...o.parties.filter((p) => p.role === "testemunha").map((p) => p.label), o.witnesses ?? ""].filter(Boolean).join("; "));
  para("Relato circunstanciado", o.narrative);
  para("Providências adotadas", o.measures.join("; "));
  for (const a of t.addenda) para(`Adendo nº ${occurrenceNumber(a)} — registrado em ${dt(a.created_at)}`, `${a.narrative}${a.measures.length ? `\nProvidências: ${a.measures.join("; ")}` : ""}`);
  need(60); y += 12;
  const sig = (x: number, label: string) => { doc.line(x - 38, y, x + 38, y); doc.setFontSize(9); doc.text(label, x, y + 5, { align: "center" }); };
  sig(55, "Direção Escolar"); sig(155, "Responsável legal"); y += 22;
  sig(55, "Estudante"); sig(155, "Testemunha"); doc.setFontSize(10);
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(110, 110, 110);
    doc.text(`Registro imutável do SIGEM — retificações só por adendo. Página ${i} de ${pages}.`, 105, 288, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }
  return doc.output("blob");
}

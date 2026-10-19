// Etiquetas da Cartilha (Anexos 10–13): folha A4 com etiquetas pré-preenchidas pela escola e pelo estoque.
// Campo desconhecido fica em branco para preencher à mão; nada é presumido (validade, conservação, assinatura).

export type LabelKind = "manipulado" | "estocavel" | "refil" | "amostra";
export const LABEL_KINDS: { id: LabelKind; title: string; anexo: string }[] = [
  { id: "manipulado", title: "Produtos manipulados / abertos", anexo: "Anexo 10" },
  { id: "estocavel", title: "Produtos estocáveis (PVPS)", anexo: "Anexo 11" },
  { id: "refil", title: "Refil de filtro de água", anexo: "Anexo 12" },
  { id: "amostra", title: "Coleta de amostras", anexo: "Anexo 13" },
];

export interface LabelProduct { name: string; expiresOn: string | null }
export interface LabelInput { kind: LabelKind; school: string; products: LabelProduct[]; copies: number; date: string | null }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const br = (iso: string | null) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : "____/____/______");
const line = (label: string, value?: string) => `<div class="f"><b>${esc(label)}:</b> ${value ? esc(value) : '<span class="blank"></span>'}</div>`;

/** Conteúdo de UMA etiqueta. */
export function labelBody(kind: LabelKind, school: string, p: LabelProduct | null, date: string | null): string {
  const head = `<div class="s">${esc(school)}</div>`;
  switch (kind) {
    case "manipulado":
      return head + line("Produto", p?.name) + line("Processado/aberto em", date ? br(date) : undefined) + line("Validade") +
        `<div class="f"><b>Conservação:</b> ☐ Resfriado ☐ Congelado ☐ Temp. ambiente</div>`;
    case "estocavel":
      return head + line("Produto", p?.name) + line("Validade", p?.expiresOn ? br(p.expiresOn) : undefined) + `<div class="f pv">PVPS — Primeiro que vence, primeiro que sai</div>`;
    case "refil":
      return head + line("Data da troca", date ? br(date) : undefined) + line("Próxima troca") + line("Assinatura");
    case "amostra":
      return head + line("Data", date ? br(date) : undefined) + `<div class="f"><b>Turno:</b> ☐ Manhã ☐ Tarde ☐ Noite</div>` + line("Preparação") + line("Assinatura");
  }
}

/** Lista de etiquetas: por produto (manipulado/estocável) ou cópias em branco. Limite de 200 por folha gerada. */
export function labelCells(i: LabelInput): string[] {
  const n = Math.max(1, Math.min(50, Math.floor(i.copies) || 1));
  const perProduct = (i.kind === "manipulado" || i.kind === "estocavel") && i.products.length > 0;
  const cells = perProduct ? i.products.flatMap((p) => Array.from({ length: n }, () => labelBody(i.kind, i.school, p, i.date)))
    : Array.from({ length: n }, () => labelBody(i.kind, i.school, null, i.date));
  return cells.slice(0, 200);
}

export function labelsSheetHtml(i: LabelInput): string {
  const meta = LABEL_KINDS.find((k) => k.id === i.kind)!;
  const cells = labelCells(i).map((c) => `<div class="l">${c}</div>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(meta.title)} — ${esc(meta.anexo)}</title><style>
@page{size:A4;margin:8mm}body{font-family:Arial,sans-serif;margin:0;color:#000}
h1{font-size:11pt;margin:0 0 4mm}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}
.l{border:1px dashed #000;padding:3mm;min-height:36mm;break-inside:avoid;font-size:9pt}
.s{font-weight:bold;font-size:8pt;border-bottom:1px solid #000;margin-bottom:2mm;padding-bottom:1mm}
.f{margin:1.5mm 0}.blank{display:inline-block;min-width:30mm;border-bottom:1px solid #000}.pv{font-size:7.5pt;font-style:italic}
</style></head><body><h1>${esc(meta.title)} (${esc(meta.anexo)} — Cartilha da Alimentação Escolar)</h1><div class="g">${cells}</div></body></html>`;
}

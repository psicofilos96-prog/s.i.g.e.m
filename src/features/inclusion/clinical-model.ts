/**
 * NINC.1 — registro clínico restrito (0243/0244) e relatório do estudante. Projeções puras; o banco decide acesso.
 * CID é guardado como escrito no documento de origem: o sistema não valida, não traduz e não deriva categoria dele.
 */
import type { InclusionRecord, RecordType } from "./inclusion-model";
import { RECORD_TYPES } from "./inclusion-model";

/** Catálogo das dimensões clínicas: só valores homologados aparecem; sem valores, o campo fica indisponível. */
export const CLINICAL_DIMENSION_SCHEME = "dimensao-clinica-inclusao";

export type ClinicalRow = {
  id: string; logical_id: string; version: number; event_kind: "registro" | "retificacao" | "encerramento";
  cid_as_written: string | null; source_document: string; dimension_scheme_id: string | null; dimension_value_id: string | null;
  note: string | null; attachment_id: string | null; valid_from: string; valid_to: string | null; reason: string | null; recorded_at: string; is_head: boolean;
};

/** Cabeça de cada registro lógico; encerrado continua visível no histórico, não como vigente. */
export function clinicalHeads(rows: readonly ClinicalRow[]): ClinicalRow[] {
  return rows.filter((r) => r.is_head && r.event_kind !== "encerramento");
}
export function clinicalHistory(rows: readonly ClinicalRow[], logicalId: string): ClinicalRow[] {
  return rows.filter((r) => r.logical_id === logicalId).sort((a, b) => a.version - b.version);
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const typeLabel = (t: string) => RECORD_TYPES.find((x) => x.id === t)?.label ?? "Tipo não reconhecido";
const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : "sem término");

/**
 * Relatório do estudante (PEI/PAEE/relatório pedagógico + clínico só se lido com permissão).
 * Sem modelo institucional homologado, o documento sai marcado como não oficial e sem campos de assinatura inventados.
 */
export function studentInclusionReportHtml(o: { school: string; student: string; records: readonly InclusionRecord[]; clinical: readonly ClinicalRow[] | null; generatedOn: string }): string {
  const rec = o.records.filter((r) => r.event_kind !== "encerramento");
  const rows = rec.map((r) => `<tr><td>${esc(typeLabel(r.record_type))}</td><td>v${esc(r.version)}</td><td>${esc(br(r.valid_from))} a ${esc(br(r.valid_to))}</td><td>${esc(r.educational_purpose)}</td><td>${esc(r.body)}</td></tr>`).join("");
  const cli = o.clinical === null ? "" : `<h2>Registro clínico restrito</h2>${clinicalHeads(o.clinical).length === 0 ? "<p>Nenhum registro clínico vigente visível.</p>" :
    `<table><thead><tr><th>CID como escrito</th><th>Documento de origem</th><th>Vigência</th><th>Versão</th></tr></thead><tbody>${clinicalHeads(o.clinical).map((c) => `<tr><td>${esc(c.cid_as_written ?? "não informado")}</td><td>${esc(c.source_document)}</td><td>${esc(br(c.valid_from))} a ${esc(br(c.valid_to))}</td><td>v${esc(c.version)}</td></tr>`).join("")}</tbody></table>`}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de inclusão</title><style>@page{size:A4;margin:14mm 12mm;@bottom-right{content:"Página " counter(page) " de " counter(pages);font:9px serif}}body{font:12px sans-serif;margin:0;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;table-layout:fixed}thead{display:table-header-group}tr{page-break-inside:avoid}td,th{border:1px solid #999;padding:4px;text-align:left;vertical-align:top;overflow-wrap:anywhere}.nao-oficial{border:1px solid;padding:6px}</style></head><body>
<h1>Relatório de inclusão do estudante</h1><p>Escola ${esc(o.school)} · estudante ${esc(o.student)} · gerado em ${esc(br(o.generatedOn))}</p>
<p class="nao-oficial">Documento de trabalho, não oficial: modelo institucional e assinaturas ainda não homologados.</p>
<h2>Registros pedagógicos vigentes</h2>${rec.length === 0 ? "<p>Nenhum registro visível. Isso não indica ausência de necessidade.</p>" : `<table><thead><tr><th>Tipo</th><th>Versão</th><th>Vigência</th><th>Finalidade</th><th>Registro</th></tr></thead><tbody>${rows}</tbody></table>`}
${cli}</body></html>`;
}

/**
 * N8.2.4 — Relatório evolutivo: registros pedagógicos (plano, relatório, atendimento) em ordem cronológica de vigência,
 * do jeito que foram escritos. Não calcula progresso, nota, taxa nem condição; nada clínico entra aqui.
 */
export const EVOLUTION_TYPES: readonly RecordType[] = ["plano-educacional", "relatorio-pedagogico", "atendimento-aee"];
export function evolutionEntries(records: readonly InclusionRecord[]): InclusionRecord[] {
  return records.filter((r) => EVOLUTION_TYPES.includes(r.record_type) && r.event_kind !== "encerramento")
    .slice().sort((a, b) => a.valid_from.localeCompare(b.valid_from) || a.recorded_at.localeCompare(b.recorded_at) || a.id.localeCompare(b.id));
}
export function evolutionReportHtml(o: { school: string; student: string; records: readonly InclusionRecord[]; generatedOn: string }): string {
  const e = evolutionEntries(o.records);
  const body = e.length === 0 ? "<p>Nenhum registro pedagógico visível. Isso não indica ausência de necessidade nem de acompanhamento.</p>"
    : `<table><thead><tr><th>Desde</th><th>Tipo</th><th>Versão</th><th>Finalidade</th><th>Registro</th></tr></thead><tbody>${e.map((r) => `<tr><td>${esc(br(r.valid_from))}</td><td>${esc(typeLabel(r.record_type))}</td><td>v${esc(r.version)}</td><td>${esc(r.educational_purpose)}</td><td>${esc(r.body)}</td></tr>`).join("")}</tbody></table>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório evolutivo</title><style>@page{size:A4;margin:14mm 12mm;@bottom-right{content:"Página " counter(page) " de " counter(pages);font:9px serif}}body{font:12px sans-serif;margin:0;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;table-layout:fixed}thead{display:table-header-group}tr{page-break-inside:avoid}td,th{border:1px solid #999;padding:4px;text-align:left;vertical-align:top;overflow-wrap:anywhere}.nao-oficial{border:1px solid;padding:6px}</style></head><body>
<h1>Relatório evolutivo do estudante</h1><p>Escola ${esc(o.school)} · estudante ${esc(o.student)} · gerado em ${esc(br(o.generatedOn))}</p>
<p class="nao-oficial">Documento de trabalho, não oficial: reúne os registros como foram escritos, em ordem de data. Não mede progresso nem indica condição ou diagnóstico.</p>
${body}</body></html>`;
}

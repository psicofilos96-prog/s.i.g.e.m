/**
 * PERFIL MEDIADOR — LOTE 15 Documentos e relatórios (núcleo puro).
 * Reaproveita cabeçalho/rodapé/assinatura/emissão do Docente (`teacher-reports.ts`),
 * GED (`ged-core`) e emissões auditadas (`report_emissions`, registro antes do download).
 * Relatórios só sobre fontes lidas com a sessão; sem fonte ⇒ bloqueio por extenso.
 */
import { validateHeader, pageFooter, nextEmission, type HeaderConfig, type SourceState } from "@/features/teacher-diary/teacher-reports";
export { validateHeader, pageFooter, nextEmission };

export type MediatorReportId = "diario" | "semanal" | "mensal" | "apoios" | "barreiras" | "participacao" | "ocorrencias" | "solicitacoes" | "autonomia" | "encaminhamentos";
export interface MediatorReportSpec { id: MediatorReportId; label: string; sources: readonly string[]; period: "dia" | "semana" | "mes" | "livre" }
export const MEDIATOR_REPORTS: readonly MediatorReportSpec[] = [
  { id: "diario", label: "Registro diário", sources: ["registro-diario"], period: "dia" },
  { id: "semanal", label: "Relatório semanal", sources: ["registro-diario", "participacao", "ocorrencias"], period: "semana" },
  { id: "mensal", label: "Relatório mensal", sources: ["registro-diario", "participacao", "ocorrencias", "solicitacoes"], period: "mes" },
  { id: "apoios", label: "Apoios prestados", sources: ["registro-diario"], period: "livre" },
  { id: "barreiras", label: "Barreiras observadas", sources: ["registro-diario", "ocorrencias"], period: "livre" },
  { id: "participacao", label: "Participação por contexto", sources: ["participacao"], period: "livre" },
  { id: "ocorrencias", label: "Ocorrências", sources: ["ocorrencias"], period: "livre" },
  { id: "solicitacoes", label: "Solicitações de orientação", sources: ["solicitacoes"], period: "livre" },
  { id: "autonomia", label: "Autonomia por atividade", sources: ["participacao"], period: "livre" },
  { id: "encaminhamentos", label: "Encaminhamentos", sources: ["ocorrencias", "solicitacoes"], period: "livre" },
];

export function mediatorReportReadiness(id: MediatorReportId, sources: Readonly<Record<string, SourceState>>, p: { from: string; to: string; designationActiveInPeriod: boolean }) {
  const spec = MEDIATOR_REPORTS.find((r) => r.id === id);
  if (!spec) return { ok: false as const, reasons: ["Relatório não catalogado."] };
  const r: string[] = [];
  for (const s of spec.sources) { const st = sources[s] ?? "nao-lida"; if (st !== "lida") r.push(st === "negada" ? `Sem permissão para ler ${s}.` : `Fonte ${s} não disponível.`); }
  if (p.from > p.to) r.push("Período inválido.");
  const days = (Date.parse(p.to) - Date.parse(p.from)) / 864e5 + 1;
  if (spec.period === "dia" && days !== 1) r.push("Relatório diário cobre um dia.");
  if (spec.period === "semana" && days > 7) r.push("Relatório semanal cobre no máximo 7 dias.");
  if (spec.period === "mes" && days > 31) r.push("Relatório mensal cobre no máximo 31 dias.");
  if (!p.designationActiveInPeriod) r.push("Sem designação no período: só relatórios dos próprios registros.");
  return r.length ? { ok: false as const, reasons: r } : { ok: true as const, notice: "Relatório de registros; não é laudo, diagnóstico nem avaliação." };
}

/** Linhas: só contagens de registros existentes; ausência ≠ zero; sem média/escore. */
export function summarize(rows: { kind: string; date: string; category: string | null }[] | null) {
  if (rows === null) return { state: "nao-disponivel" as const };
  const by = new Map<string, number>();
  for (const r of rows) { const k = `${r.kind}|${r.category ?? "sem-categoria"}`; by.set(k, (by.get(k) ?? 0) + 1); }
  return { state: "ok" as const, recorded: rows.length, groups: [...by].map(([k, n]) => ({ kind: k.split("|")[0]!, category: k.split("|")[1]!, records: n })) };
}

/** GED restrita: classes de documento do mediador; anexo só no prefixo da escola/designação; leitura por concessão. */
export const GED_CLASSES = ["orientacao", "acompanhamento", "relatorio", "comunicado", "material-acessibilidade"] as const;
export type GedClass = (typeof GED_CLASSES)[number];
const CLINICAL = /\b(cid|laudo|diagn[oó]stic|transtorno|psiqui|neurol|prontu[aá]rio)/i;

export function validateGedDoc(d: { cls: string; title: string; path: string; schoolId: string; designationId: string; authorPersonId: string | null }) {
  const r: string[] = [];
  if (!d.authorPersonId) r.push("Documento exige autor pessoa natural.");
  if (!GED_CLASSES.includes(d.cls as GedClass)) r.push("Classe de documento fora da GED do mediador.");
  if (!d.path.startsWith(`mediacao/${d.schoolId}/${d.designationId}/`) || d.path.includes("..")) r.push("Arquivo fora da pasta restrita da designação.");
  if (CLINICAL.test(d.title)) r.push("Laudo e prontuário não entram na GED do mediador.");
  return r;
}

export function canReadGed(doc: { schoolId: string; designationId: string; authorPersonId: string; sharedWith: string[] }, viewer: { personId: string; activeDesignationIds: string[]; capabilities: string[] }) {
  return doc.authorPersonId === viewer.personId || viewer.activeDesignationIds.includes(doc.designationId) || doc.sharedWith.includes(viewer.personId)
    || viewer.capabilities.includes("consultar-documentos-mediacao");
}

/** Exportação auditada: registra emissão ANTES do download; sem registro confirmado não há arquivo. */
export function exportPlan(p: { reportId: MediatorReportId; format: "pdf" | "csv" | "xlsx"; personId: string | null; purpose: string; header: HeaderConfig; hash: string; previous: { version: number; hash: string }[] }) {
  const r: string[] = [];
  if (!p.personId) r.push("Exportação exige pessoa natural.");
  if (p.purpose.trim().length < 5) r.push("Informe a finalidade da exportação.");
  if (p.format === "pdf") r.push(...validateHeader(p.header));
  if (r.length) return { ok: false as const, reasons: r };
  const e = nextEmission(p.previous, p.hash);
  return { ok: true as const, steps: ["registrar-emissao", "download"] as const, emission: { reportId: p.reportId, format: p.format, version: e.version, newVersion: e.changed, hash: p.hash, purpose: p.purpose.trim(), page: "A4" as const } };
}

export function downloadAllowed(emissionReply: unknown, hash: string): boolean {
  return !!emissionReply && typeof emissionReply === "object" && (emissionReply as { hash?: unknown; code?: unknown }).hash === hash && typeof (emissionReply as { code?: unknown }).code === "string";
}

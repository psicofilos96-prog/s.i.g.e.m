/** Lote 14 — resultados oficiais de avaliações externas (SAEB, IDEB, AVALIA RJ, CNCA/CAEd).
 * Espelha as validações de `ext_record_result` (0373) e decide comparabilidade. Nunca calcula proficiência. */
import type { ReportDefinition, CellValue } from "@/features/reports/report-engine";

export type ExtProgram = "saeb" | "ideb" | "avalia-rj" | "cnca-caed";
export const EXT_PROGRAMS: Record<ExtProgram, { label: string; scalePrefix: string }> = {
  saeb: { label: "SAEB (proficiência TRI)", scalePrefix: "saeb-" },
  ideb: { label: "IDEB (N × P, INEP)", scalePrefix: "ideb-inep" },
  "avalia-rj": { label: "AVALIA RJ", scalePrefix: "avalia-rj-" },
  "cnca-caed": { label: "CNCA/CAEd", scalePrefix: "caed-" },
};

export type ExtResult = {
  id: string; logical_id: string; version: number; program_key: ExtProgram; edition_year: number; stage: string; area: string;
  scope: "rede" | "escola"; school_id: string | null; sample_kind: "censitaria" | "amostral"; scale_key: string; matrix_ref: string;
  expected_count: number | null; present_count: number | null; proficiency: number | null; levels: unknown;
  flow_p: number | null; perf_n: number | null; ideb: number | null; target: number | null; source_ref: string; homologated?: boolean;
};

export type ExtInput = Omit<ExtResult, "id" | "logical_id" | "version" | "homologated">;

export function validateExtResult(r: ExtInput): string[] {
  const e: string[] = [];
  if ((r.source_ref ?? "").trim().length < 3) e.push("Fonte obrigatória.");
  if (!r.scale_key.trim() || !r.matrix_ref.trim()) e.push("Escala e matriz são obrigatórias.");
  if (/acerto/i.test(r.scale_key)) e.push("Acerto bruto não é proficiência: use a escala oficial do programa.");
  const p = EXT_PROGRAMS[r.program_key];
  if (r.program_key === "ideb" ? r.scale_key !== "ideb-inep" : !r.scale_key.startsWith(p.scalePrefix)) e.push(`Escala incompatível com ${p.label}.`);
  if (r.program_key !== "ideb" && (r.ideb != null || r.flow_p != null || r.perf_n != null)) e.push("IDEB, N e P só existem no programa IDEB.");
  if (r.program_key === "ideb" && r.proficiency != null) e.push("IDEB não registra proficiência.");
  if (r.flow_p != null && (r.flow_p <= 0 || r.flow_p > 1)) e.push("P (fluxo) deve estar entre 0 e 1.");
  if (r.perf_n != null && (r.perf_n < 0 || r.perf_n > 10)) e.push("N deve estar entre 0 e 10.");
  if (r.ideb != null && r.flow_p != null && r.perf_n != null && Math.abs(r.ideb - r.flow_p * r.perf_n) > 0.051) e.push("IDEB diverge de N × P.");
  if (r.expected_count != null && r.present_count != null && (r.present_count < 0 || r.present_count > r.expected_count)) e.push("Participação inválida.");
  if ((r.scope === "escola") !== (r.school_id != null && r.school_id !== "")) e.push("Escopo escola exige escola; rede não tem escola.");
  return e;
}

/** Taxa de participação; sem denominador é null (nunca zero). */
export const participationRate = (r: Pick<ExtResult, "expected_count" | "present_count">): number | null =>
  r.expected_count && r.present_count != null ? r.present_count / r.expected_count : null;

export function compareExt(a: ExtResult, b: ExtResult): { ok: true } | { ok: false; reason: string } {
  if (a.program_key !== b.program_key) return { ok: false, reason: "Programas diferentes." };
  if (a.scale_key !== b.scale_key) return { ok: false, reason: "Escalas diferentes." };
  if (a.matrix_ref !== b.matrix_ref) return { ok: false, reason: "Matrizes diferentes." };
  if (a.stage !== b.stage || a.area !== b.area) return { ok: false, reason: "Etapa ou área diferentes." };
  if (a.sample_kind !== b.sample_kind) return { ok: false, reason: "Amostra censitária × amostral." };
  if (a.scope !== b.scope) return { ok: false, reason: "Escopos diferentes (rede × escola)." };
  if (a.edition_year === b.edition_year && a.school_id === b.school_id) return { ok: false, reason: "Mesma edição e unidade." };
  return { ok: true };
}

/** Série histórica: só homologados, versão vigente por lógico, mesmo recorte; demais ficam fora com motivo. */
export function historicalSeries(rows: ExtResult[], base: ExtResult) {
  const latest = new Map<string, ExtResult>();
  for (const r of rows) { const c = latest.get(r.logical_id); if (!c || r.version > c.version) latest.set(r.logical_id, r); }
  const included: ExtResult[] = []; const excluded: { row: ExtResult; reason: string }[] = [];
  for (const r of latest.values()) {
    if (!r.homologated) { excluded.push({ row: r, reason: "Não homologado." }); continue; }
    if (r.id === base.id) { included.push(r); continue; }
    if (r.school_id !== base.school_id) continue;
    const c = compareExt(base, r);
    if (c.ok) included.push(r); else excluded.push({ row: r, reason: c.reason });
  }
  return { included: included.sort((x, y) => x.edition_year - y.edition_year), excluded };
}

export const EXT_REPORT: ReportDefinition = {
  id: "aa-avaliacoes-externas", version: 1, title: "Avaliações externas — resultados oficiais", description: "Projeção de ext_result_versions homologados.",
  source: "ext_result_versions", params: [],
  columns: [{ id: "programa", label: "Programa", kind: "text" }, { id: "edicao", label: "Edição", kind: "number" }, { id: "etapa", label: "Etapa", kind: "text" },
    { id: "area", label: "Área", kind: "text" }, { id: "unidade", label: "Unidade", kind: "text" }, { id: "escala", label: "Escala", kind: "text" },
    { id: "participacao", label: "Participação (%)", kind: "number" }, { id: "valor", label: "Proficiência / IDEB", kind: "number" },
    { id: "meta", label: "Meta", kind: "number" }, { id: "fonte", label: "Fonte", kind: "text" }],
  formats: ["xlsx", "pdf", "csv"], reproducible: false, syncRowLimit: 1000,
};
export const extReportRows = (rows: ExtResult[], names: Map<string, string>): Record<string, CellValue>[] =>
  rows.map((r) => {
    const pr = participationRate(r);
    return { programa: EXT_PROGRAMS[r.program_key].label, edicao: r.edition_year, etapa: r.stage, area: r.area,
      unidade: r.school_id ? names.get(r.school_id) ?? r.school_id : "Rede", escala: r.scale_key,
      participacao: pr == null ? null : Math.round(pr * 1000) / 10, valor: r.program_key === "ideb" ? r.ideb : r.proficiency, meta: r.target, fonte: r.source_ref };
  });

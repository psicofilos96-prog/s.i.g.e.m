/**
 * Lote 10 Supervisão — acervo (GED), relatórios e indicadores.
 * Acervo: documento lógico com versões append-only (autor humano, motivo, base esperada),
 * classificação de lista fechada e retenção só configurada (sem decisão ⇒ reter sempre).
 * Leitura só para quem tem acesso à escola; "restrito" exige nível conferir/coordenar.
 * Relatórios/indicadores são projeções puras com fórmula, denominador, período e fonte;
 * não informado ≠ zero; exportação passa pelo report-engine (não há exportador aqui).
 */
export type Res<T> = { ok: true; value: T } | { ok: false; code: string };
export const DOC_KINDS = ["relatorio-visita", "instrumento-preenchido", "parecer", "ata", "orientacao", "evidencia", "plano-adequacao"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export type Classification = "interno" | "restrito";

export interface DocVersion { docId: string; version: number; schoolId: string; kind: DocKind; classification: Classification; authorId: string; isHuman: boolean; reason: string | null; storagePath: string; sha256: string; at: string }

export function addVersion(chain: DocVersion[], v: Omit<DocVersion, "version">, expectedVersion: number): Res<DocVersion[]> {
  if (!v.isHuman) return { ok: false, code: "autor-nao-humano" };
  if (!DOC_KINDS.includes(v.kind)) return { ok: false, code: "tipo-desconhecido" };
  if (chain.length !== expectedVersion) return { ok: false, code: "base-alterada" };
  if (chain.length && !v.reason?.trim()) return { ok: false, code: "motivo-obrigatorio" };
  if (chain[0] && (chain[0].schoolId !== v.schoolId || chain[0].kind !== v.kind)) return { ok: false, code: "identidade-imutavel" };
  if (!v.storagePath.startsWith(`supervisao/${v.schoolId}/`)) return { ok: false, code: "fora-do-caminho-privado" };
  if (!/^[0-9a-f]{64}$/.test(v.sha256)) return { ok: false, code: "hash-invalido" };
  return { ok: true, value: [...chain, { ...v, version: chain.length + 1 }] };
}

export function canRead(d: DocVersion, level: string) {
  if (level === "nenhum") return false;
  return d.classification === "interno" || level === "conferir" || level === "coordenar";
}

export interface RetentionRule { kind: DocKind; years: number | null; destination: "eliminar" | "guarda-permanente" | null; approvedRef: string | null }
export function retentionAction(d: DocVersion, rules: RetentionRule[], today: string) {
  const r = rules.find((x) => x.kind === d.kind);
  if (!r || r.years == null || !r.destination || !r.approvedRef) return { action: "reter" as const, reason: "sem decisão de retenção" };
  const due = `${Number(d.at.slice(0, 4)) + r.years}${d.at.slice(4)}`;
  return due <= today ? { action: r.destination, reason: `prazo ${r.years} anos (${r.approvedRef})` } : { action: "reter" as const, reason: `até ${due}` };
}

// ---------- Indicadores ----------
export interface Indicator { key: string; label: string; formula: string; numerator: string; denominator: string; source: string; period: { from: string; to: string } }
export const INDICATORS: Indicator[] = [
  { key: "cobertura", label: "Cobertura de visitas", formula: "escolas visitadas ÷ escolas atribuídas", numerator: "escolas com visita concluída no período", denominator: "escolas com atribuição vigente", source: "supervision-visits + supervision-access", period: { from: "", to: "" } },
  { key: "regularizacao", label: "Regularização", formula: "casos regularizados ÷ casos confirmados", numerator: "não conformidades regularizadas", denominator: "não conformidades confirmadas", source: "supervision-nonconformity", period: { from: "", to: "" } },
  { key: "reincidencia", label: "Reincidência", formula: "casos com reincidência ÷ casos abertos", numerator: "casos com caso anterior regularizado na mesma área", denominator: "casos observados", source: "supervision-nonconformity", period: { from: "", to: "" } },
  { key: "pendencias-vencidas", label: "Providências vencidas", formula: "ações vencidas ÷ ações com prazo", numerator: "ações não concluídas com prazo passado", denominator: "ações com prazo declarado", source: "plano de adequação", period: { from: "", to: "" } },
];

export type IndValue = { state: "valor"; value: number; num: number; den: number } | { state: "nao-informado" | "denominador-zero"; value: null; num: number | null; den: number | null };
export function compute(key: string, num: number | null, den: number | null, from: string, to: string) {
  const def = INDICATORS.find((i) => i.key === key);
  if (!def) return null;
  const v: IndValue = num == null || den == null ? { state: "nao-informado", value: null, num, den }
    : den === 0 ? { state: "denominador-zero", value: null, num, den } : { state: "valor", value: num / den, num, den };
  return { ...def, period: { from, to }, ...v };
}

// ---------- Relatório por escola/supervisor/período ----------
export interface ReportRow { schoolId: string; supervisorId: string | null; visits: number | null; openPending: number | null; recurrences: number | null; regularized: number | null; functioningAttention: number | null; drill: string }
export function supervisionReport(rows: ReportRow[], schools: string[], f: { supervisorId?: string; schoolId?: string }) {
  const allowed = new Set(schools);
  const sel = rows.filter((r) => allowed.has(r.schoolId) && (!f.schoolId || r.schoolId === f.schoolId) && (!f.supervisorId || r.supervisorId === f.supervisorId));
  const total = (k: keyof ReportRow) => sel.some((r) => r[k] == null) ? null : sel.reduce((a, r) => a + (r[k] as number), 0);
  return {
    rows: sel.map((r) => ({ ...r, cells: (["visits", "openPending", "recurrences", "regularized", "functioningAttention"] as const).map((k) => r[k] == null ? "não informado" : String(r[k])) })),
    totals: { visits: total("visits"), openPending: total("openPending"), recurrences: total("recurrences"), regularized: total("regularized"), functioningAttention: total("functioningAttention") },
    exportVia: "report-engine",
  };
}

/** Série de gráfico: ausentes ficam fora e contados; cada ponto leva drill-down. */
export function chartSeries(rows: ReportRow[], k: "visits" | "openPending" | "regularized") {
  const pts = rows.filter((r) => r[k] != null).map((r) => ({ x: r.schoolId, y: r[k] as number, drill: r.drill }));
  return { points: pts, excludedMissing: rows.length - pts.length };
}

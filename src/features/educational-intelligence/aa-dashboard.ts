/**
 * Acompanhamento e Avaliação — Lote 02 SIGEM 2.0: painel gerencial e panorama (núcleo puro).
 * Reaproveita `aa-suppression.ts` (grupos pequenos só com limiar de política). Entradas são linhas
 * já lidas com a sessão (RLS) dos readers donos; nada é gravado nem estimado.
 * Elegível vem da enturmação; avaliado só de resultado registrado; desempenho só com regra homologada.
 */
import { suppressSmallGroups } from "./aa-suppression";

export type Read<T> = { state: "lido"; value: T; source: string; at: string } | { state: "nao-lido" | "sem-permissao" | "sem-regra"; reason: string };
export type Level = "rede" | "escola" | "etapa" | "ano" | "turma" | "componente" | "habilidade";
export const LEVEL_ORDER: Level[] = ["rede", "escola", "etapa", "ano", "turma", "componente", "habilidade"];

export type ResultRow = { studentId: string; schoolId: string; stage: string | null; year: string | null; classId: string; component: string | null; skill: string | null; editionId: string; score: number | null; band: string | null };
export type EligibleRow = { studentId: string; schoolId: string; classId: string; stage: string | null; year: string | null };

export type Tile = { key: string; label: string; display: string; read: Read<number> };
const show = (r: Read<number>) => (r.state === "lido" ? String(r.value) : { "nao-lido": "não apurado", "sem-permissao": "sem permissão", "sem-regra": "sem regra homologada" }[r.state]);
const tile = (key: string, label: string, read: Read<number>): Tile => ({ key, label, read, display: show(read) });

/** Painel: contagens sobre leituras; participação só com elegíveis e avaliados lidos e elegíveis > 0. */
export function managerialPanel(p: {
  eligible: Read<EligibleRow[]>; results: Read<ResultRow[]>; editions: Read<number>;
  interventions: Read<number>; reassessments: Read<number>; performanceRuleHomologated: boolean;
}): Tile[] {
  const cnt = (r: Read<unknown[]>, f: (x: any) => string): Read<number> => (r.state === "lido" ? { ...r, value: new Set(r.value.map(f)).size } : r);
  const elig = cnt(p.eligible, (e: EligibleRow) => e.studentId);
  const evald = p.results.state === "lido" ? { ...p.results, value: new Set(p.results.value.filter((x) => x.score !== null || x.band !== null).map((x) => x.studentId)).size } : p.results;
  const participation: Read<number> = elig.state !== "lido" || evald.state !== "lido" ? { state: "nao-lido", reason: "elegíveis ou avaliados não lidos" }
    : elig.value === 0 ? { state: "nao-lido", reason: "sem elegíveis: sem denominador" } : { state: "lido", value: Math.round((evald.value / elig.value) * 1000) / 10, source: "enturmação × resultados", at: elig.at };
  const performance: Read<number> = !p.performanceRuleHomologated ? { state: "sem-regra", reason: "faixa/escala sem regra homologada" }
    : p.results.state !== "lido" ? p.results : { state: "lido", value: p.results.value.filter((x) => x.band !== null).length, source: p.results.source, at: p.results.at };
  return [
    tile("escolas", "Escolas com elegíveis", cnt(p.eligible, (e: EligibleRow) => e.schoolId)),
    tile("turmas", "Turmas com elegíveis", cnt(p.eligible, (e: EligibleRow) => e.classId)),
    tile("elegiveis", "Estudantes elegíveis", elig),
    tile("avaliados", "Estudantes avaliados", evald),
    tile("participacao", "Participação (%)", participation),
    tile("avaliacoes", "Edições de avaliação", p.editions),
    tile("desempenho", "Resultados com faixa", performance),
    tile("intervencoes", "Intervenções", p.interventions),
    tile("reavaliacoes", "Reavaliações", p.reassessments),
  ];
}

/** Habilidades prioritárias: só com regra homologada de corte; ordem por código, nunca ranking de escolas. */
export function prioritySkills(rows: ResultRow[], cut: { threshold: number; ruleRef: string } | null) {
  if (!cut) return { state: "sem-regra" as const, skills: [] };
  const by = new Map<string, { n: number; below: number }>();
  for (const r of rows) if (r.skill && r.score !== null) { const s = by.get(r.skill) ?? { n: 0, below: 0 }; s.n++; if (r.score < cut.threshold) s.below++; by.set(r.skill, s); }
  return { state: "aplicada" as const, ruleRef: cut.ruleRef, skills: [...by].filter(([, s]) => s.below > s.n / 2).map(([skill, s]) => ({ skill, ...s })).sort((a, b) => a.skill.localeCompare(b.skill)) };
}

export type Filters = Partial<Record<Exclude<Level, "rede">, string>> & { editionId: string };
const keyOf = (r: ResultRow, l: Level) => (l === "rede" ? "rede" : l === "escola" ? r.schoolId : l === "etapa" ? r.stage : l === "ano" ? r.year : l === "turma" ? r.classId : l === "componente" ? r.component : r.skill);

/** Panorama: média só sobre valores observados de UMA edição; grupo pequeno só com limiar; ausentes contados à parte. */
export function panorama(rows: ResultRow[], level: Level, f: Filters, minN: number | null, scope: { network: boolean; schools: ReadonlySet<string> }) {
  const sc = rows.filter((r) => r.editionId === f.editionId && (scope.network || scope.schools.has(r.schoolId)));
  const filt = sc.filter((r) => (Object.entries(f) as [string, string][]).every(([k, v]) => k === "editionId" || keyOf(r, k as Level) === v));
  const groups = new Map<string, number[]>(); let missingKey = 0, missingScore = 0;
  for (const r of filt) {
    const k = keyOf(r, level); if (k == null) { missingKey++; continue; }
    if (r.score === null) { missingScore++; continue; }
    groups.set(k, [...(groups.get(k) ?? []), r.score]);
  }
  const sup = suppressSmallGroups([...groups].map(([key, v]) => ({ key, n: v.length })), minN);
  return {
    level, policy: sup.policy, missingKey, missingScore,
    rows: sup.rows.sort((a, b) => a.key.localeCompare(b.key)).map((g) => ({ key: g.key, n: g.suppressed ? null : g.n, mean: g.suppressed ? null : round(avg(groups.get(g.key)!)), suppressed: g.suppressed })),
    next: LEVEL_ORDER[LEVEL_ORDER.indexOf(level) + 1] ?? null,
  };
}
const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const round = (x: number) => Math.round(x * 10) / 10;

/** Drill-down seguro: desce um nível fixando o grupo; nominal nunca (o nível mais fino é habilidade). */
export function drill(f: Filters, level: Level, key: string): { filters: Filters; level: Level } | { refused: string } {
  const next = LEVEL_ORDER[LEVEL_ORDER.indexOf(level) + 1];
  if (!next) return { refused: "nivel-mais-fino-atingido" };
  return { filters: level === "rede" ? f : { ...f, [level]: key }, level: next };
}

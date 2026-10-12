// SIGEM 2.0 A&A Lote 10 — Mapa de Aprendizagem da Rede. Núcleo puro: só agrega linhas
// já lidas com a sessão (RLS). Sem ranking (ordem alfabética), sem zero presumido,
// tendência só entre edições comparáveis, nível estudante só com capability + finalidade.
import { suppressSmallGroups } from "./aa-suppression";

export const MAP_LEVELS = ["rede", "escola", "ano", "turma", "componente", "habilidade", "item", "estudante"] as const;
export type MapLevel = (typeof MAP_LEVELS)[number];
export type MapRow = { editionId: string; scaleKey: string; matrixRef: string; schoolId: string; year: string | null; classId: string; component: string | null; skill: string | null; itemId: string; studentId: string; correct: boolean | null; participated: boolean };
export type MapFilter = Partial<Record<Exclude<MapLevel, "rede">, string>>;
export type Access = { network: boolean; schools: ReadonlySet<string>; nominal: { capability: boolean; purpose: string | null } };

const KEY: Record<Exclude<MapLevel, "rede">, (r: MapRow) => string | null> = {
  escola: r => r.schoolId, ano: r => r.year, turma: r => r.classId, componente: r => r.component,
  habilidade: r => r.skill, item: r => r.itemId, estudante: r => r.studentId,
};

export function canOpen(level: MapLevel, f: MapFilter, a: Access): { ok: true } | { ok: false; reason: string } {
  if (level === "rede" && !a.network) return { ok: false, reason: "visão de rede exige alcance de rede" };
  if (level !== "rede" && !a.network && f.escola && !a.schools.has(f.escola)) return { ok: false, reason: "escola fora do alcance" };
  if (level !== "rede" && level !== "escola" && !a.network && !f.escola) return { ok: false, reason: "escola fora do alcance" };
  if (level === "estudante" && (!a.nominal.capability || !a.nominal.purpose?.trim())) return { ok: false, reason: "nível nominal exige capability e finalidade declarada" };
  return { ok: true };
}

function scoped(rows: MapRow[], f: MapFilter, a: Access) {
  return rows.filter(r => (a.network || a.schools.has(r.schoolId)) && (Object.keys(f) as (keyof MapFilter)[]).every(k => KEY[k](r) === f[k]));
}

export type Cell = { key: string; nStudents: number; nParticipants: number; nAnswers: number; rate: number | null; suppressed: boolean };

/** Células do próximo nível (ordem alfabética, nunca ranking). */
export function mapLevel(rows: MapRow[], level: Exclude<MapLevel, "rede">, f: MapFilter, a: Access, minN: number | null): { cells: Cell[]; notes: string[] } | { refused: string } {
  const g = canOpen(level, f, a); if (!g.ok) return { refused: g.reason };
  const editions = new Set(rows.map(r => r.editionId));
  if (editions.size > 1) return { refused: "mapa mistura edições: escolha uma edição" };
  const groups = new Map<string, MapRow[]>();
  let unknown = 0;
  for (const r of scoped(rows, f, a)) { const k = KEY[level](r); if (k === null) { unknown++; continue; } groups.set(k, [...(groups.get(k) ?? []), r]); }
  const raw = [...groups].map(([key, rs]) => {
    const part = rs.filter(r => r.participated);
    const ans = part.filter(r => r.correct !== null);
    return { key, nStudents: new Set(rs.map(r => r.studentId)).size, nParticipants: new Set(part.map(r => r.studentId)).size, nAnswers: ans.length, rate: ans.length ? ans.filter(r => r.correct).length / ans.length : null };
  });
  const sup = level === "estudante" ? null : suppressSmallGroups(raw.map(c => ({ key: c.key, n: c.nParticipants })), minN);
  const cells = raw.map(c => { const s = sup?.rows.find(x => x.key === c.key)?.suppressed ?? false; return s ? { ...c, nAnswers: 0, rate: null, suppressed: true } : { ...c, suppressed: false }; }).sort((x, y) => x.key.localeCompare(y.key));
  const notes = ["percentual = acerto bruto, não proficiência", "ordem alfabética: o mapa não ranqueia unidades"];
  if (unknown) notes.push(`${unknown} registro(s) sem ${level} declarado fora do mapa`);
  if (sup?.policy === "sem-politica") notes.push("sem política de divulgação: supressão de grupo pequeno não aplicada");
  return { cells, notes };
}

/** Heatmap linhas × habilidades, mesma regra de supressão por célula. */
export function heatmap(rows: MapRow[], rowLevel: "escola" | "ano" | "turma" | "componente", f: MapFilter, a: Access, minN: number | null) {
  const outer = mapLevel(rows, rowLevel, f, a, minN);
  if ("refused" in outer) return outer;
  const skills = [...new Set(scoped(rows, f, a).map(r => r.skill).filter((s): s is string => !!s))].sort();
  return { skills, rows: outer.cells.map(c => { const inner = mapLevel(rows, "habilidade", { ...f, [rowLevel]: c.key }, a, minN); const cells = "refused" in inner ? [] : inner.cells; return { key: c.key, cells: skills.map(s => cells.find(x => x.key === s) ?? null) }; }), notes: outer.notes };
}

/** Tendência só entre edições de mesma escala e matriz; demais ficam fora com motivo. */
export function trend(points: { editionId: string; date: string; scaleKey: string; matrixRef: string; rate: number | null }[], base: { scaleKey: string; matrixRef: string }) {
  const ok = points.filter(p => p.scaleKey === base.scaleKey && p.matrixRef === base.matrixRef).sort((a, b) => a.date.localeCompare(b.date));
  const excluded = points.filter(p => !ok.includes(p)).map(p => ({ editionId: p.editionId, reason: "escala ou matriz diferente: não comparável" }));
  return { series: ok.map(p => ({ editionId: p.editionId, date: p.date, rate: p.rate })), excluded };
}

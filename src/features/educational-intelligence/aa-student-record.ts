// SIGEM 2.0 A&A Lote 11 — Ficha individual e observatório longitudinal. Núcleo puro:
// compõe fatos já lidos com a sessão (resultados versionados, alocações, intervenções)
// numa linha do tempo; não grava, não rotula, não diagnostica. Leitura nominal só com
// capability + finalidade + escola no alcance na data do fato.

export type Allocation = { schoolId: string; classId: string; from: string; to: string | null };
export type ResultFact = { id: string; version: number; supersedes: string | null; date: string; editionId: string; instrumentVersion: string; matrixRef: string; curriculumRef: string; skill: string | null; rate: number | null; recordedAt: string; reason: string | null };
export type InterventionFact = { id: string; date: string; kind: "intervencao" | "reavaliacao"; skill: string | null; text: string; schoolId: string };
export type Viewer = { capability: boolean; purpose: string | null; schools: ReadonlySet<string>; network: boolean };

const FORBIDDEN = /\b(cid|laudo|tdah|autis|dislex|deficien|transtorno|diagn[oó]stic|fraco|lento|incapaz|problem[aá]tic)/i;

export function guardText(t: string): { ok: true } | { ok: false; reason: string } {
  return FORBIDDEN.test(t) ? { ok: false, reason: "texto com rótulo ou dado clínico recusado: registrar fato observável" } : { ok: true };
}

function allocationAt(allocs: Allocation[], date: string) {
  const hits = allocs.filter(a => a.from <= date && (a.to === null || date <= a.to));
  return hits.length === 1 ? hits[0]! : hits.length > 1 ? "conflito" as const : null;
}

export type TimelineEntry = {
  date: string; type: "resultado" | "intervencao" | "reavaliacao" | "mudanca-escola" | "mudanca-matriz" | "mudanca-curriculo" | "mudanca-instrumento";
  schoolId: string | null; classId: string | null; ref: string; detail: string; corrected: { fromVersion: number; reason: string } | null; allocationIssue: string | null;
};

export function buildStudentRecord(p: { viewer: Viewer; allocations: Allocation[]; results: ResultFact[]; interventions: InterventionFact[] }): { refused: string } | { timeline: TimelineEntry[]; corrections: { id: string; version: number; reason: string }[]; notes: string[] } {
  const v = p.viewer;
  if (!v.capability || !v.purpose?.trim()) return { refused: "ficha nominal exige capability e finalidade declarada" };
  const inScope = (s: string | null) => v.network || (s !== null && v.schools.has(s));
  // Só a versão vigente de cada resultado; versões anteriores ficam como trilha de correção.
  const superseded = new Set(p.results.map(r => r.supersedes).filter(Boolean) as string[]);
  const byId = new Map(p.results.map(r => [r.id, r]));
  const current = p.results.filter(r => !superseded.has(r.id));
  const corrections: { id: string; version: number; reason: string }[] = [];
  const tl: TimelineEntry[] = [];
  for (const r of current) {
    const a = allocationAt(p.allocations, r.date);
    const school = a && a !== "conflito" ? a.schoolId : null;
    if (!inScope(school)) continue; // fato de outra escola fora do alcance: omitido
    const prev = r.supersedes ? byId.get(r.supersedes) : undefined;
    if (prev) corrections.push({ id: r.id, version: r.version, reason: r.reason ?? "sem motivo registrado" });
    tl.push({ date: r.date, type: "resultado", schoolId: school, classId: a && a !== "conflito" ? a.classId : null, ref: `${r.id}@v${r.version}`, detail: `${r.skill ?? "geral"}: ${r.rate === null ? "não apurado" : `${Math.round(r.rate * 100)}% de acerto bruto`}`, corrected: prev ? { fromVersion: prev.version, reason: r.reason ?? "sem motivo registrado" } : null, allocationIssue: a === "conflito" ? "alocações sobrepostas na data: conferir" : a === null ? "sem alocação válida na data" : null });
  }
  for (const i of p.interventions) if (inScope(i.schoolId)) tl.push({ date: i.date, type: i.kind, schoolId: i.schoolId, classId: null, ref: i.id, detail: guardText(i.text).ok ? i.text : "[texto retido: continha rótulo ou dado clínico]", corrected: null, allocationIssue: null });
  const sortedA = [...p.allocations].sort((a, b) => a.from.localeCompare(b.from));
  for (let k = 1; k < sortedA.length; k++) if (sortedA[k]!.schoolId !== sortedA[k - 1]!.schoolId && inScope(sortedA[k]!.schoolId)) tl.push({ date: sortedA[k]!.from, type: "mudanca-escola", schoolId: sortedA[k]!.schoolId, classId: sortedA[k]!.classId, ref: `aloc:${sortedA[k]!.from}`, detail: "mudança de escola", corrected: null, allocationIssue: null });
  const sortedR = [...current].sort((a, b) => a.date.localeCompare(b.date));
  const keys = [["matrixRef", "mudanca-matriz"], ["curriculumRef", "mudanca-curriculo"], ["instrumentVersion", "mudanca-instrumento"]] as const;
  for (let k = 1; k < sortedR.length; k++) for (const [f, t] of keys) if (sortedR[k]![f] !== sortedR[k - 1]![f]) tl.push({ date: sortedR[k]!.date, type: t, schoolId: null, classId: null, ref: sortedR[k]!.id, detail: `${sortedR[k - 1]![f]} → ${sortedR[k]![f]}: resultados antes e depois não são diretamente comparáveis`, corrected: null, allocationIssue: null });
  tl.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
  return { timeline: tl, corrections, notes: ["ficha descreve fatos datados; não atribui rótulo permanente nem diagnóstico", "percentual é acerto bruto da edição, não proficiência", `finalidade da consulta: ${v.purpose}`] };
}

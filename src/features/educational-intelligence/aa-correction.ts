/**
 * SIGEM 2.0 — A&A Lote 07 (spec §13): respostas e correção.
 * Núcleo puro. Resposta por item × estudante; correção:
 *  - objetiva só por gabarito VALIDADO (item aprovado no banco, Lote 04);
 *  - discursiva por rubrica do item; produção textual por critérios do instrumento;
 *  - fluência só pelas medidas declaradas no protocolo (nada é calculado além delas).
 * Correção é versão append-only com autor e horário; dupla correção opcional
 * gera divergência explícita, resolvida só por terceiro. Percentual NUNCA vira
 * proficiência padronizada; consolidação só completa ou com limitação declarada.
 */
import type { RubricLevel } from "./aa-item-bank";

export type Response = { studentId: string; itemVersionId: string; answer: string | null; recordedBy: string; at: string };
export type ItemSpec =
  | { kind: "objetiva"; itemVersionId: string; key: string | null; keyValidated: boolean; points: number | null }
  | { kind: "discursiva"; itemVersionId: string; rubric: RubricLevel[] | null; points: number | null }
  | { kind: "producao"; itemVersionId: string; criteria: { id: string; max: number }[] | null }
  | { kind: "fluencia"; itemVersionId: string; protocol: { measures: { id: string; unit: string }[] } | null };

export type Score =
  | { status: "pontuada"; points: number; detail: Record<string, number | string> }
  | { status: "em-branco" | "anulada" }
  | { status: "nao-corrigivel"; reason: string };

export type Correction = { studentId: string; itemVersionId: string; round: 1 | 2 | 3; version: number; score: Score; correctorPersonId: string; at: string; reason: string | null };

/** Correção objetiva automática: só com gabarito validado e pontuação definida. */
export function scoreObjective(spec: Extract<ItemSpec, { kind: "objetiva" }>, r: Response | null): Score {
  if (!spec.keyValidated || spec.key == null) return { status: "nao-corrigivel", reason: "gabarito não validado" };
  if (spec.points == null) return { status: "nao-corrigivel", reason: "pontuação não definida" };
  if (!r || r.answer == null || r.answer === "") return { status: "em-branco" };
  return { status: "pontuada", points: r.answer.trim().toUpperCase() === spec.key.trim().toUpperCase() ? spec.points : 0, detail: { resposta: r.answer } };
}

/** Correção humana (discursiva/produção/fluência): valida o lançamento contra a especificação. */
export function scoreManual(spec: Exclude<ItemSpec, { kind: "objetiva" }>, input: Record<string, number | string>): Score {
  if (spec.kind === "discursiva") {
    if (!spec.rubric?.length) return { status: "nao-corrigivel", reason: "rubrica ausente" };
    const lvl = spec.rubric.find((l) => l.level === input["nivel"]);
    if (!lvl) return { status: "nao-corrigivel", reason: "nível fora da rubrica" };
    if (lvl.points == null) return { status: "nao-corrigivel", reason: "nível sem pontuação definida" };
    return { status: "pontuada", points: lvl.points, detail: { nivel: lvl.level } };
  }
  if (spec.kind === "producao") {
    if (!spec.criteria?.length) return { status: "nao-corrigivel", reason: "critérios do instrumento ausentes" };
    let sum = 0;
    for (const c of spec.criteria) {
      const v = input[c.id];
      if (typeof v !== "number") return { status: "nao-corrigivel", reason: `critério ${c.id} sem registro` };
      if (v < 0 || v > c.max) return { status: "nao-corrigivel", reason: `critério ${c.id} fora de 0–${c.max}` };
      sum += v;
    }
    return { status: "pontuada", points: sum, detail: { ...input } };
  }
  if (!spec.protocol?.measures.length) return { status: "nao-corrigivel", reason: "protocolo de fluência não definido" };
  for (const m of spec.protocol.measures) if (input[m.id] == null || input[m.id] === "") return { status: "nao-corrigivel", reason: `medida ${m.id} sem registro` };
  const extra = Object.keys(input).filter((k) => !spec.protocol!.measures.some((m) => m.id === k) && k !== "observacao");
  if (extra.length) return { status: "nao-corrigivel", reason: `medida fora do protocolo: ${extra.join(", ")}` };
  return { status: "pontuada", points: 0, detail: { ...input } }; // fluência registra medidas; pontos não se aplicam
}

/** Nova versão de correção: base esperada, autor humano, retificação exige motivo. */
export function recordCorrection(prior: readonly Correction[], c: Omit<Correction, "version">, expectedVersion: number) {
  if (!c.correctorPersonId) return { ok: false as const, reason: "corretor (pessoa natural) obrigatório" };
  const same = prior.filter((p) => p.studentId === c.studentId && p.itemVersionId === c.itemVersionId && p.round === c.round);
  const head = same.sort((a, b) => a.version - b.version).at(-1);
  if (head && JSON.stringify(head.score) === JSON.stringify(c.score) && head.correctorPersonId === c.correctorPersonId) return { ok: true as const, correction: head };
  if ((head?.version ?? 0) !== expectedVersion) return { ok: false as const, reason: "base esperada divergente" };
  if (head && !c.reason?.trim()) return { ok: false as const, reason: "retificação exige motivo" };
  if (c.round === 2 && prior.some((p) => p.round === 1 && p.studentId === c.studentId && p.itemVersionId === c.itemVersionId && p.correctorPersonId === c.correctorPersonId))
    return { ok: false as const, reason: "segunda correção por pessoa distinta" };
  if (c.round === 3 && prior.some((p) => p.round < 3 && p.studentId === c.studentId && p.itemVersionId === c.itemVersionId && p.correctorPersonId === c.correctorPersonId))
    return { ok: false as const, reason: "desempate por terceira pessoa" };
  return { ok: true as const, correction: { ...c, version: (head?.version ?? 0) + 1 } };
}

const headOf = (cs: readonly Correction[], s: string, i: string, round: number) =>
  cs.filter((c) => c.studentId === s && c.itemVersionId === i && c.round === round).sort((a, b) => a.version - b.version).at(-1) ?? null;

/** Correção vigente do item: rodada 3 decide; com dupla correção, divergência fica explícita até o desempate. */
export function effectiveScore(cs: readonly Correction[], s: string, i: string, doubleRequired: boolean, tolerance = 0):
  { state: "final"; score: Score } | { state: "divergente"; a: Score; b: Score } | { state: "aguardando"; missing: string } {
  const r3 = headOf(cs, s, i, 3); if (r3) return { state: "final", score: r3.score };
  const r1 = headOf(cs, s, i, 1); if (!r1) return { state: "aguardando", missing: "primeira correção" };
  if (!doubleRequired) return { state: "final", score: r1.score };
  const r2 = headOf(cs, s, i, 2); if (!r2) return { state: "aguardando", missing: "segunda correção" };
  const p = (x: Score) => (x.status === "pontuada" ? x.points : x.status);
  const a = p(r1.score), b = p(r2.score);
  const agree = typeof a === "number" && typeof b === "number" ? Math.abs(a - b) <= tolerance : a === b;
  return agree ? { state: "final", score: r1.score } : { state: "divergente", a: r1.score, b: r2.score };
}

/** Consolidação §13.6: soma só com tudo corrigido; senão incompleto com limitações listadas. Percentual é bruto, nunca proficiência. */
export function consolidate(studentId: string, specs: readonly ItemSpec[], cs: readonly Correction[], doubleRequired: boolean) {
  const limitations: string[] = []; let points = 0, max = 0;
  for (const sp of specs) {
    if (sp.kind === "fluencia") continue; // medidas não somam com acertos
    const e = effectiveScore(cs, studentId, sp.itemVersionId, doubleRequired);
    const itemMax = sp.kind === "producao" ? (sp.criteria?.reduce((a, c) => a + c.max, 0) ?? null) : sp.points;
    if (itemMax == null) { limitations.push(`${sp.itemVersionId}: pontuação máxima indefinida`); continue; }
    if (e.state !== "final") { limitations.push(`${sp.itemVersionId}: ${e.state === "divergente" ? "correções divergentes" : e.missing}`); continue; }
    if (e.score.status === "anulada") continue;
    if (e.score.status === "nao-corrigivel") { limitations.push(`${sp.itemVersionId}: ${e.score.reason}`); continue; }
    max += itemMax; if (e.score.status === "pontuada") points += e.score.points;
  }
  return limitations.length
    ? { studentId, complete: false as const, limitations, partialPoints: points, partialMax: max }
    : { studentId, complete: true as const, points, max, rawPercent: max > 0 ? (points / max) * 100 : null, measure: "acerto-bruto" as const };
}

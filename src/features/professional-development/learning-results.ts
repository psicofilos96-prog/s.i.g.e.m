/**
 * SIGEM Desenvolvimento L14 — resultados formativos por rubrica (projeção pura; banco = 0443).
 * Rubrica versionada e aprovada por pessoa ≠ autor; resultado = níveis por critério + desfecho declarado e justificado pelo avaliador.
 * Nenhuma nota é calculada; satisfação (questionário L13 `avaliacao-da-formacao`) nunca entra no resultado.
 */
export type Level = Readonly<{ key: string; label: string; description: string }>;
export type Criterion = Readonly<{ key: string; description: string; levels: readonly Level[] }>;
export type Rating = Readonly<{ level: string; justification: string }>;
export type Outcome = "atingiu" | "atingiu-parcialmente" | "nao-atingiu" | "nao-avaliavel";

/** Espelha `dev_rubric_valid`. */
export function rubricProblems(criteria: readonly Criterion[]): string[] {
  const p: string[] = [];
  if (criteria.length < 1 || criteria.length > 20) p.push("A rubrica precisa de 1 a 20 critérios.");
  const keys = new Set<string>();
  for (const c of criteria) {
    if (!/^[a-z0-9-]{2,40}$/.test(c.key)) p.push(`Critério "${c.key}": chave inválida.`);
    if (keys.has(c.key)) p.push(`Critério "${c.key}" repetido.`);
    keys.add(c.key);
    if (c.description.trim().length < 10) p.push(`Critério "${c.key}": descreva o critério.`);
    if (c.levels.length < 2) p.push(`Critério "${c.key}": ao menos dois níveis.`);
    if (new Set(c.levels.map((l) => l.key)).size !== c.levels.length) p.push(`Critério "${c.key}": níveis repetidos.`);
    if (c.levels.some((l) => l.label.trim().length < 2 || l.description.trim().length < 10)) p.push(`Critério "${c.key}": descreva cada nível.`);
  }
  return p;
}

export type ResultInput = Readonly<{ ratings: Readonly<Record<string, Rating>>; outcome: Outcome; justification: string;
  evaluator: string; participant: string; satisfaction?: unknown }>;

export function resultProblems(criteria: readonly Criterion[], r: ResultInput): string[] {
  const p: string[] = [];
  if (r.satisfaction !== undefined) p.push("Satisfação não compõe resultado de aprendizagem.");
  if (r.evaluator === r.participant) p.push("Ninguém avalia a si mesmo.");
  if (Object.keys(r.ratings).length !== criteria.length) p.push("Avalie todos os critérios.");
  for (const c of criteria) {
    const x = r.ratings[c.key];
    if (!x || !c.levels.some((l) => l.key === x.level)) p.push(`Critério "${c.key}": nível inválido.`);
    else if (x.justification.trim().length < 10) p.push(`Critério "${c.key}": justifique o nível.`);
  }
  if (r.justification.trim().length < 20) p.push("Justifique o desfecho (20+ caracteres).");
  return p;
}

/** Revisão: revisor ≠ avaliador contestado e ≠ participante; "revisto" só com nova versão gravada. */
export function reviewDecisionProblems(i: { reviewer: string; evaluator: string; requester: string; decision: "mantido" | "revisto"; newResultId: string | null; reason: string }): string[] {
  const p: string[] = [];
  if (i.reviewer === i.evaluator || i.reviewer === i.requester) p.push("Revisor precisa ser outra pessoa.");
  if (i.decision === "revisto" && !i.newResultId) p.push("Revisão que muda o resultado exige nova versão registrada.");
  if (i.reason.trim().length < 20) p.push("Fundamente a decisão (20+ caracteres).");
  return p;
}

/**
 * Agregado por turma (proteção individual): só com grupo ≥ limiar configurado; sem limiar ⇒ suprimido.
 * Desfechos 'nao-avaliavel' são contados à parte e não entram no denominador.
 */
export function aggregateOutcomes(outcomes: readonly Outcome[], threshold: number | null) {
  if (threshold == null || outcomes.length < threshold) return { suppressed: true as const, reason: threshold == null ? "limiar não configurado" : "grupo abaixo do limiar" };
  const count = (o: Outcome) => outcomes.filter((x) => x === o).length;
  return { suppressed: false as const, atingiu: count("atingiu"), parcial: count("atingiu-parcialmente"), naoAtingiu: count("nao-atingiu"), naoAvaliavel: count("nao-avaliavel") };
}

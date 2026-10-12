/**
 * Rede/Matrículas/Vagas L09 — Motor de propostas de distribuição de vagas.
 * Só ordena com critério HOMOLOGADO e versionado; cada regra é primitiva (verdadeiro-primeiro,
 * menor-primeiro, maior-primeiro) sobre um fato declarado com fundamento. Desempate só pelas
 * regras declaradas; empate remanescente NÃO é resolvido (sem sorteio, nome, ordem de chegada
 * implícita). Fato sem evidência ⇒ pedido indeterminado, fora da ordenação e listado.
 * O resultado é PROPOSTA (não grava nada); vira decisão só por revisão de pessoa competente ≠ gerador.
 */
export type Primitive = "verdadeiro-primeiro" | "menor-primeiro" | "maior-primeiro";
export interface CriterionRule { factKey: string; primitive: Primitive; basis: string }
export interface DistributionCriterion { criterionId: string; version: number; homologated: boolean; rules: readonly CriterionRule[]; tiebreaks: readonly CriterionRule[] }
export interface Fact { value: boolean | number | string; evidenceRef: string }
export interface RequestInput { protocol: string; preferences: readonly string[]; facts: Readonly<Record<string, Fact | undefined>> }
export interface CellSlots { cellKey: string; available: number | null }

export interface Explanation { factKey: string; value: Fact["value"]; evidenceRef: string; basis: string }
export interface ProposalItem { protocol: string; position: number; cellKey: string | null; preferenceIndex: number | null; explanation: Explanation[]; outcome: "contemplado" | "espera" }
export interface Proposal {
  criterionId: string; criterionVersion: number; inputHash: string; generatedBy: string; generatedAt: string;
  items: ProposalItem[]; indeterminate: { protocol: string; missing: string[] }[];
  unresolvedTies: string[][]; conflicts: string[]; writes: [];
}

const cmp = (r: CriterionRule, a: Fact["value"], b: Fact["value"]) => {
  if (r.primitive === "verdadeiro-primeiro") return (a === true ? 0 : 1) - (b === true ? 0 : 1);
  if (typeof a !== typeof b) return 0;
  const d = a < b ? -1 : a > b ? 1 : 0;
  return r.primitive === "menor-primeiro" ? d : -d;
};

async function sha(s: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }

export async function proposeDistribution(crit: DistributionCriterion, requests: readonly RequestInput[], cells: readonly CellSlots[], meta: { generatedBy: string; generatedAt: string; isTechnicalExecutor?: boolean }): Promise<{ ok: true; proposal: Proposal } | { ok: false; reason: string }> {
  if (!crit.homologated) return { ok: false, reason: "Critério não homologado: nenhuma classificação é produzida." };
  const all = [...crit.rules, ...crit.tiebreaks];
  if (all.length === 0) return { ok: false, reason: "Critério sem regras." };
  if (all.some((r) => !r.basis.trim())) return { ok: false, reason: "Regra sem fundamento." };
  const conflicts: string[] = [];
  for (const c of cells) if (c.available === null) conflicts.push(`Vagas da linha ${c.cellKey} não lidas.`);
  const seen = new Set<string>();
  for (const r of requests) { if (seen.has(r.protocol)) conflicts.push(`Protocolo duplicado: ${r.protocol}.`); seen.add(r.protocol); }
  if (conflicts.length) return { ok: false, reason: conflicts.join(" ") };

  const indeterminate: Proposal["indeterminate"] = [];
  const ranked = requests.filter((r) => {
    const missing = all.map((x) => x.factKey).filter((k) => !r.facts[k] || !r.facts[k]!.evidenceRef);
    if (missing.length) indeterminate.push({ protocol: r.protocol, missing });
    return missing.length === 0;
  });
  const order = (a: RequestInput, b: RequestInput) => { for (const r of all) { const d = cmp(r, a.facts[r.factKey]!.value, b.facts[r.factKey]!.value); if (d) return d; } return 0; };
  const sorted = [...ranked].sort((a, b) => order(a, b) || (a.protocol < b.protocol ? -1 : 1));
  // Grupos ainda empatados após todas as regras: ordem entre eles NÃO é decidida.
  const unresolvedTies: string[][] = [];
  for (let i = 0; i < sorted.length;) { let j = i + 1; while (j < sorted.length && order(sorted[i]!, sorted[j]!) === 0) j++; if (j - i > 1) unresolvedTies.push(sorted.slice(i, j).map((r) => r.protocol)); i = j; }
  const tieOf = new Map(unresolvedTies.flatMap((g) => g.map((p) => [p, g] as const)));

  const left = new Map(cells.map((c) => [c.cellKey, c.available as number]));
  const items: ProposalItem[] = [];
  let pos = 0; const blockedTie = new Set<string>();
  for (const r of sorted) {
    pos++;
    const explanation = all.map((x) => ({ factKey: x.factKey, value: r.facts[x.factKey]!.value, evidenceRef: r.facts[x.factKey]!.evidenceRef, basis: x.basis }));
    const tie = tieOf.get(r.protocol);
    // Se um grupo empatado disputa vagas insuficientes na mesma preferência, ninguém do grupo é contemplado pelo motor.
    if (tie && !blockedTie.has(tie.join())) {
      const firstPref = r.preferences.find((p) => (left.get(p) ?? 0) > 0);
      const competing = tie.filter((p) => requests.find((x) => x.protocol === p)!.preferences.find((q) => (left.get(q) ?? 0) > 0) === firstPref);
      if (firstPref && competing.length > (left.get(firstPref) ?? 0)) { blockedTie.add(tie.join()); conflicts.push(`Empate sem desempate fundamentado disputando ${firstPref}: ${competing.join(", ")}.`); }
    }
    const blocked = tie && blockedTie.has(tie.join());
    const idx = blocked ? -1 : r.preferences.findIndex((p) => (left.get(p) ?? 0) > 0);
    if (idx >= 0) { const k = r.preferences[idx]!; left.set(k, left.get(k)! - 1); items.push({ protocol: r.protocol, position: pos, cellKey: k, preferenceIndex: idx, explanation, outcome: "contemplado" }); }
    else items.push({ protocol: r.protocol, position: pos, cellKey: null, preferenceIndex: null, explanation, outcome: "espera" });
  }
  const inputHash = await sha(JSON.stringify({ c: [crit.criterionId, crit.version], r: requests, cells }));
  return { ok: true, proposal: { criterionId: crit.criterionId, criterionVersion: crit.version, inputHash, generatedBy: meta.generatedBy, generatedAt: meta.generatedAt, items, indeterminate, unresolvedTies, conflicts, writes: [] } };
}

export interface ReviewDecision { proposalHash: string; decision: "aprovada" | "devolvida"; personId: string; actRef: string | null; reason: string; at: string; tieResolutions: Readonly<Record<string, readonly string[]>> }

/** Revisão competente: pessoa natural ≠ gerador, com capacidade e ato; empates disputados exigem resolução explícita com motivo. */
export function reviewProposal(p: Proposal, reviewer: { personId: string | null; isHuman: boolean; isTechnicalExecutor?: boolean; capabilities: readonly string[] }, input: Omit<ReviewDecision, "proposalHash" | "personId">, requiredCapability: string | null, currentInputHash: string):
  { ok: true; decision: ReviewDecision } | { ok: false; reason: string } {
  if (!reviewer.isHuman || !reviewer.personId || reviewer.isTechnicalExecutor) return { ok: false, reason: "Revisão exige pessoa natural." };
  if (!requiredCapability || !reviewer.capabilities.includes(requiredCapability)) return { ok: false, reason: "Competência de revisão não configurada ou ausente." };
  if (reviewer.personId === p.generatedBy) return { ok: false, reason: "Quem gerou não revisa." };
  if (currentInputHash !== p.inputHash) return { ok: false, reason: "Dados mudaram desde a proposta: gerar de novo." };
  if (!input.reason.trim()) return { ok: false, reason: "Motivo obrigatório." };
  if (input.decision === "aprovada") {
    if (!input.actRef?.trim()) return { ok: false, reason: "Aprovação exige ato." };
    const disputed = p.conflicts.filter((c) => c.startsWith("Empate"));
    if (disputed.length && Object.keys(input.tieResolutions).length < disputed.length) return { ok: false, reason: "Há empates disputados sem resolução registrada." };
  }
  return { ok: true, decision: { ...input, proposalHash: p.inputHash, personId: reviewer.personId } };
}

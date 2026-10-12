// L21 Tecnologia (0494) — projeções puras. Banco é a garantia; aqui só leitura honesta.
export type InnovKind = "aprovacao" | "indeferimento" | "inicio" | "relato-de-uso" | "relato-de-percepcao" | "evidencia-de-aprendizagem" | "encerramento";
export interface InnovEvent { seq: number; kind: InnovKind; evidenceSource?: string | null; hasDoc?: boolean }

/** Resultados separados: USO e PERCEPÇÃO nunca são apresentados como melhoria de aprendizagem. */
export function projectOutcomes(ev: readonly InnovEvent[]) {
  const learning = ev.filter((e) => e.kind === "evidencia-de-aprendizagem" && e.evidenceSource && e.hasDoc);
  return {
    usageReports: ev.filter((e) => e.kind === "relato-de-uso").length,
    perceptionReports: ev.filter((e) => e.kind === "relato-de-percepcao").length,
    learningEvidence: learning.length,
    learningClaim: learning.length === 0
      ? "Sem evidência de aprendizagem registrada: uso e percepção não comprovam melhoria."
      : `Há ${learning.length} evidência(s) documentada(s); a interpretação cabe à análise pedagógica, não ao sistema.`,
  };
}

export interface LabDesignation { id: string; spaceId: string; action: "designar" | "retirar"; personId: string; createdAt: string }
/** Laboratório = ambiente canônico com último ato aprovado (por pessoa ≠ autor) = designar. */
export function activeLabs(ds: readonly LabDesignation[], approvals: readonly { designationId: string; personId: string }[]) {
  const ok = ds.filter((d) => approvals.some((a) => a.designationId === d.id && a.personId !== d.personId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const last = new Map<string, LabDesignation>();
  for (const d of ok) last.set(d.spaceId, d);
  return [...last.values()].filter((d) => d.action === "designar").map((d) => d.spaceId);
}

export interface Loan { id: string; assetId: string; dueOn: string; returnedOn: string | null }
export function loanSituation(l: Loan, today: string) {
  if (l.returnedOn) return l.returnedOn > l.dueOn ? "devolvido-com-atraso" : "devolvido";
  return today > l.dueOn ? "em-atraso" : "emprestado";
}

/** Acessibilidade: só recursos conferidos por outra pessoa contam; declarado sem conferência fica "declarado". */
export function accessibilityStatus(decl: { features: string[]; personId: string } | null, check: { confirmed: string[]; personId: string } | null) {
  if (!decl) return { state: "nao-informada" as const, confirmed: [] as string[] };
  if (!check || check.personId === decl.personId) return { state: "declarada" as const, confirmed: [] };
  return { state: "conferida" as const, confirmed: check.confirmed.filter((f) => decl.features.includes(f)) };
}

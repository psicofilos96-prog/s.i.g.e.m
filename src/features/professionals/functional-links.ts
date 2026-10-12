/**
 * Gestão de Pessoas L02 — Pessoa única × vínculos funcionais múltiplos.
 * Núcleo puro: vínculo = cadeia de versões append-only por logical_id
 * (mesma forma de `professional_functional_links`); regime, jornada e
 * documentos são atributos da versão, nunca inferidos. Duplicidade de pessoa
 * só vira CANDIDATA; fusão exige decisão humana com autor ≠ executor técnico.
 */

export type DocRef = Readonly<{ kind: string; ref: string }>;

export type FunctionalLinkVersion = Readonly<{
  id: string;
  logicalId: string;
  version: number;
  supersedesId: string | null;
  personId: string;
  functionalRegistration: string | null;
  positionId: string | null;
  regime: string | null; // código do catálogo configurado; null = não registrado
  weeklyHours: number | null; // jornada contratual; null = não registrada (nunca 0)
  validFrom: string; // YYYY-MM-DD
  validUntil: string | null;
  documents: readonly DocRef[];
  originatingActRef: string | null;
  correctionReason: string | null;
  authorUserId: string | null;
  technical: boolean; // gravado por executor técnico
  recordedAt: string;
}>;

export type LinkProblem =
  | "chain-gap"
  | "chain-fork"
  | "missing-author"
  | "technical-author"
  | "correction-without-reason"
  | "invalid-interval"
  | "invalid-hours"
  | "person-changed";

/** Valida cadeia de um logical_id (ordem por version). */
export function validateChain(versions: readonly FunctionalLinkVersion[]): LinkProblem[] {
  const out = new Set<LinkProblem>();
  const sorted = [...versions].sort((a, b) => a.version - b.version);
  const seen = new Set<number>();
  sorted.forEach((v, i) => {
    if (seen.has(v.version)) out.add("chain-fork");
    seen.add(v.version);
    if (v.version !== i + 1) out.add("chain-gap");
    const prev = sorted[i - 1];
    if (i === 0 ? v.supersedesId !== null : v.supersedesId !== prev?.id) out.add("chain-gap");
    if (i > 0 && !v.correctionReason?.trim()) out.add("correction-without-reason");
    if (i > 0 && prev && prev.personId !== v.personId) out.add("person-changed");
    if (!v.authorUserId) out.add("missing-author");
    if (v.technical) out.add("technical-author");
    if (v.validUntil && v.validUntil < v.validFrom) out.add("invalid-interval");
    if (v.weeklyHours !== null && !(v.weeklyHours > 0 && v.weeklyHours <= 168)) out.add("invalid-hours");
  });
  return [...out];
}

/** Versão vigente de cada vínculo conhecida até knownAt; cadeia inválida ⇒ ambígua (não escolhe). */
export function linksOf(
  personId: string,
  all: readonly FunctionalLinkVersion[],
  validOn: string,
  knownAt: string,
): { active: FunctionalLinkVersion[]; ambiguous: string[] } {
  const byLogical = new Map<string, FunctionalLinkVersion[]>();
  for (const v of all) {
    if (v.personId !== personId || v.recordedAt > knownAt) continue;
    byLogical.set(v.logicalId, [...(byLogical.get(v.logicalId) ?? []), v]);
  }
  const active: FunctionalLinkVersion[] = [];
  const ambiguous: string[] = [];
  for (const [lid, vs] of byLogical) {
    if (validateChain(vs).some((p) => p === "chain-gap" || p === "chain-fork")) { ambiguous.push(lid); continue; }
    const head = vs.reduce((a, b) => (b.version > a.version ? b : a));
    if (head.validFrom <= validOn && (head.validUntil === null || head.validUntil >= validOn)) active.push(head);
  }
  return { active, ambiguous };
}

/** Jornada total só se TODOS os vínculos ativos tiverem jornada registrada. */
export function totalWeeklyHours(active: readonly FunctionalLinkVersion[]): number | null {
  if (active.length === 0) return null;
  if (active.some((v) => v.weeklyHours === null)) return null;
  return active.reduce((s, v) => s + (v.weeklyHours as number), 0);
}

/** Uma matrícula funcional nunca pertence a duas pessoas. */
export function registrationConflicts(all: readonly FunctionalLinkVersion[]): string[] {
  const owner = new Map<string, Set<string>>();
  for (const v of all) {
    if (!v.functionalRegistration) continue;
    const k = v.functionalRegistration.trim();
    owner.set(k, (owner.get(k) ?? new Set()).add(v.personId));
  }
  return [...owner].filter(([, s]) => s.size > 1).map(([k]) => k);
}

// ---------------- Conciliação de duplicidades ----------------

export type PersonKeys = Readonly<{
  personId: string;
  cpf: string | null;
  qpMec: string | null;
  registrations: readonly string[];
  normalizedName: string; // só sinal fraco
  birthDate: string | null;
}>;

export type DuplicateBasis = "cpf" | "qp-mec" | "matricula" | "nome+nascimento";
export type DuplicateCandidate = Readonly<{ a: string; b: string; basis: DuplicateBasis[]; strength: "forte" | "fraca" }>;

const digits = (s: string | null) => (s ? s.replace(/\D/g, "") : "");

/** Gera candidatos; nome sozinho NUNCA gera candidato, e nada é fundido aqui. */
export function duplicateCandidates(people: readonly PersonKeys[]): DuplicateCandidate[] {
  const out: DuplicateCandidate[] = [];
  for (let i = 0; i < people.length; i++)
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i]!, b = people[j]!;
      const basis: DuplicateBasis[] = [];
      if (digits(a.cpf).length === 11 && digits(a.cpf) === digits(b.cpf)) basis.push("cpf");
      if (a.qpMec && a.qpMec.trim() === b.qpMec?.trim()) basis.push("qp-mec");
      if (a.registrations.some((r) => b.registrations.includes(r))) basis.push("matricula");
      if (a.birthDate && a.birthDate === b.birthDate && a.normalizedName && a.normalizedName === b.normalizedName)
        basis.push("nome+nascimento");
      if (basis.length === 0) continue;
      const strength = basis.some((x) => x !== "nome+nascimento") ? "forte" : "fraca";
      out.push({ a: a.personId, b: b.personId, basis, strength });
    }
  return out;
}

export type ReviewDecision = Readonly<{
  pairKey: string;
  seq: number;
  decision: "mesma-pessoa" | "pessoas-distintas" | "pendente-de-evidencia";
  survivorPersonId: string | null;
  evidence: string;
  deciderUserId: string | null;
  technical: boolean;
}>;

export const pairKey = (a: string, b: string) => [a, b].sort().join("|");

export type ReviewRefusal = "sem-autor" | "executor-tecnico" | "sem-evidencia" | "sobrevivente-invalido" | "seq-inesperado" | "nao-candidato";

/** Decisão humana append-only; seq esperado = último+1. "mesma-pessoa" só redireciona, nunca apaga histórico. */
export function checkReview(
  candidate: DuplicateCandidate | undefined,
  history: readonly ReviewDecision[],
  d: ReviewDecision,
): ReviewRefusal | null {
  if (!candidate || pairKey(candidate.a, candidate.b) !== d.pairKey) return "nao-candidato";
  if (d.technical) return "executor-tecnico";
  if (!d.deciderUserId) return "sem-autor";
  if (d.evidence.trim().length < 10) return "sem-evidencia";
  const last = history.filter((h) => h.pairKey === d.pairKey).reduce((m, h) => Math.max(m, h.seq), 0);
  if (d.seq !== last + 1) return "seq-inesperado";
  if (d.decision === "mesma-pessoa") {
    if (d.survivorPersonId !== candidate.a && d.survivorPersonId !== candidate.b) return "sobrevivente-invalido";
  } else if (d.survivorPersonId !== null) return "sobrevivente-invalido";
  return null;
}

/** Situação derivada do par: sem decisão ⇒ pendente; última decisão vale. */
export function reviewState(pk: string, history: readonly ReviewDecision[]): ReviewDecision["decision"] | "nao-revisado" {
  const hs = history.filter((h) => h.pairKey === pk).sort((a, b) => b.seq - a.seq);
  return hs[0]?.decision ?? "nao-revisado";
}

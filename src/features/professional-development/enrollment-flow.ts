/**
 * SIGEM Desenvolvimento L10 — inscrição (projeção pura; banco = 0438/0439).
 * Pedido (individual = a própria pessoa; institucional = escola com capacidade) → análise (≠ pedinte) →
 * colocação sob lock da turma: confirmação só com vaga relida; sem vaga ⇒ espera. Da espera sai só o primeiro pelo critério aprovado.
 */
export const WAITLIST_KEYS = ["prioridade-da-analise", "data-do-pedido", "pedido-institucional"] as const;
export type WaitlistKey = (typeof WAITLIST_KEYS)[number];

export type Request = Readonly<{ id: string; personId: string; authorPerson: string; mode: "individual" | "institucional";
  requestedAt: string; priority: number | null; reviewed: "deferida" | "indeferida" | null;
  placement: "confirmacao" | "espera" | null; ended: boolean }>;

export type Link = Readonly<{ id: string; validFrom: string; validUntil: string | null; superseded: boolean }>;

/** Elegibilidade por vínculo: cabeça da cadeia e vigente no início da turma. */
export function linkEligible(link: Link | null, classStartsOn: string): boolean {
  return !!link && !link.superseded && link.validFrom <= classStartsOn && (link.validUntil == null || link.validUntil >= classStartsOn);
}

export function requestProblems(r: { mode: "individual" | "institucional"; personId: string; sessionPerson: string; schoolCapability: boolean;
  classState: string | null; link: Link | null; classStartsOn: string; missingPrerequisites: number }): string[] {
  const p: string[] = [];
  if (r.mode === "individual" && r.personId !== r.sessionPerson) p.push("Inscrição individual é só da própria pessoa.");
  if (r.mode === "institucional" && !r.schoolCapability) p.push("Sem capacidade de indicar pela escola.");
  if (r.classState !== "inscricoes-abertas") p.push("A turma não está com inscrições abertas.");
  if (!linkEligible(r.link, r.classStartsOn)) p.push("Vínculo funcional não vigente no início da turma.");
  if (r.missingPrerequisites > 0) p.push("Pré-requisito do curso não concluído.");
  return p;
}

export function reviewProblems(reviewer: string, req: Request, reason: string): string[] {
  const p: string[] = [];
  if (reviewer === req.personId || reviewer === req.authorPerson) p.push("Quem pediu não analisa o próprio pedido.");
  if (req.placement) p.push("Pedido já colocado.");
  if (reason.trim().length < 10) p.push("Fundamente a análise (10+ caracteres).");
  return p;
}

const active = (r: Request) => !r.ended;
export function occupied(reqs: readonly Request[]) { return reqs.filter((r) => active(r) && r.placement === "confirmacao").length; }

/** Ordem da espera pelo critério aprovado (mesma do banco); sem critério ⇒ null (não ordena). */
export function waitlistOrder(reqs: readonly Request[], keys: readonly WaitlistKey[] | null): Request[] | null {
  if (!keys) return null;
  const w = reqs.filter((r) => active(r) && r.placement === "espera");
  const cmp = (a: Request, b: Request) => {
    for (const k of keys) {
      const d = k === "prioridade-da-analise" ? (b.priority ?? 0) - (a.priority ?? 0)
        : k === "pedido-institucional" ? Number(a.mode !== "institucional") - Number(b.mode !== "institucional")
        : a.requestedAt.localeCompare(b.requestedAt);
      if (d !== 0) return d;
    }
    return a.id.localeCompare(b.id);
  };
  return [...w].sort(cmp);
}

export type PlaceResult = { ok: true; kind: "confirmacao" | "espera" } | { ok: false; error: string };

/** Espelha `place_dev_enrollment` (executado sob lock: chamadas concorrentes viram sequenciais). */
export function place(reqs: readonly Request[], id: string, seats: number | null, keys: readonly WaitlistKey[] | null): PlaceResult {
  if (seats == null) return { ok: false, error: "dev:seats-not-configured" };
  const r = reqs.find((x) => x.id === id);
  if (!r || r.reviewed !== "deferida") return { ok: false, error: "dev:not-approved" };
  if (r.ended || r.placement === "confirmacao") return { ok: false, error: "dev:terminal" };
  const waiting = r.placement === "espera";
  if (occupied(reqs) >= seats) return waiting ? { ok: false, error: "dev:no-seats" } : { ok: true, kind: "espera" };
  const queue = reqs.filter((x) => active(x) && x.placement === "espera");
  if (queue.length === 0) return { ok: true, kind: "confirmacao" };
  const order = waitlistOrder(reqs, keys);
  if (!order) return { ok: false, error: "dev:waitlist-criteria-missing" };
  if (order[0]!.id !== id) return waiting ? { ok: false, error: "dev:not-first-in-waitlist" } : { ok: true, kind: "espera" };
  return { ok: true, kind: "confirmacao" };
}

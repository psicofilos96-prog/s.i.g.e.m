/**
 * Gestão de Pessoas L07 — Disponibilidade operacional por vínculo × data.
 * Composição pura de fatos já lidos (jornada L06 em minutos, exercício L04,
 * designações L05, atribuições, afastamentos, restrições). Nada é persistido.
 * Afastamento/restrição só alteram capacidade com regra de efeito homologada;
 * sem regra, aparecem como pendência e a capacidade livre fica indeterminada.
 */

type Win = Readonly<{ validFrom: string; validUntil: string | null }>;
const on = (w: Win, d: string) => w.validFrom <= d && (w.validUntil === null || w.validUntil >= d);

export type Commitment = Readonly<Win & { id: string; source: "atribuicao" | "designacao"; minutes: number | null; schoolId: string; slots?: readonly string[] }>;
export type Leave = Readonly<Win & { id: string; kind: string; actRef: string | null }>;
export type Restriction = Readonly<Win & { id: string; kind: string; actRef: string | null }>;
/** Efeito configurado: fração da capacidade retirada (1 = total). */
export type EffectRule = Readonly<{ kind: string; capacityFactor: number; homologated: boolean }>;

export type AvailabilityInput = Readonly<{
  linkLogicalId: string;
  contractualMinutes: number | null;
  exercising: boolean | null; // null = sem fonte de exercício
  commitments: readonly Commitment[];
  leaves: readonly Leave[];
  restrictions: readonly Restriction[];
  effectRules: readonly EffectRule[];
}>;

export type Conflict = Readonly<{ kind: "horario-sobreposto" | "excede-capacidade" | "compromisso-durante-afastamento" | "sem-exercicio"; refs: readonly string[] }>;

export type Availability = Readonly<{
  linkLogicalId: string; day: string;
  total: number | null; committed: number | null; free: number | null;
  conflicts: readonly Conflict[]; pending: readonly string[];
}>;

export function availabilityOn(i: AvailabilityInput, day: string): Availability {
  const pending: string[] = [];
  const conflicts: Conflict[] = [];
  const cs = i.commitments.filter((c) => on(c, day));
  const ls = [...i.leaves, ...i.restrictions].filter((l) => on(l, day));

  let total = i.contractualMinutes;
  if (total === null) pending.push("jornada contratual não registrada");
  for (const l of ls) {
    if (!l.actRef?.trim()) { pending.push(`${l.kind}: sem ato`); total = null; continue; }
    const r = i.effectRules.filter((e) => e.kind === l.kind && e.homologated);
    if (r.length !== 1) { pending.push(`${l.kind}: ${r.length ? "regra de efeito ambígua" : "sem regra de efeito homologada"}`); total = null; continue; }
    if (total !== null) total = Math.max(0, total * (1 - r[0]!.capacityFactor));
  }
  if (i.exercising === null) pending.push("exercício sem fonte");
  if (i.exercising === false && cs.length) conflicts.push({ kind: "sem-exercicio", refs: cs.map((c) => c.id) });
  if (ls.length && cs.length && ls.some((l) => i.effectRules.some((e) => e.kind === l.kind && e.homologated && e.capacityFactor >= 1)))
    conflicts.push({ kind: "compromisso-durante-afastamento", refs: cs.map((c) => c.id) });

  const slotOwner = new Map<string, string>();
  for (const c of cs) for (const s of c.slots ?? []) {
    const prev = slotOwner.get(s);
    if (prev) conflicts.push({ kind: "horario-sobreposto", refs: [prev, c.id] }); else slotOwner.set(s, c.id);
  }

  const committed = cs.some((c) => c.minutes === null) ? null : cs.reduce((a, c) => a + (c.minutes as number), 0);
  if (committed === null) pending.push("compromisso sem carga registrada");
  const free = total !== null && committed !== null ? total - committed : null;
  if (free !== null && free < 0) conflicts.push({ kind: "excede-capacidade", refs: cs.map((c) => c.id) });
  return { linkLogicalId: i.linkLogicalId, day, total, committed, free, conflicts, pending };
}

// ---------------- Elegibilidade ----------------

export type Qualification = Readonly<Win & { componentId: string; validatedBy: string | null }>;
export type Offer = Readonly<{ componentId: string; minutes: number; slots: readonly string[]; schoolId: string }>;
export type Ineligibility = "sem-habilitacao" | "habilitacao-nao-validada" | "sem-ato" | "capacidade-indeterminada" | "capacidade-insuficiente" | "conflito-de-horario" | "conflito-existente";

/** Elegível só com habilitação validada, ato, capacidade livre conhecida e sem conflito. Não atribui nada. */
export function eligibility(i: AvailabilityInput, day: string, offer: Offer, quals: readonly Qualification[], actRef: string | null): Ineligibility[] {
  const out: Ineligibility[] = [];
  const q = quals.filter((x) => x.componentId === offer.componentId && on(x, day));
  if (q.length === 0) out.push("sem-habilitacao");
  else if (!q.some((x) => x.validatedBy)) out.push("habilitacao-nao-validada");
  if (!actRef?.trim()) out.push("sem-ato");
  const a = availabilityOn(i, day);
  if (a.free === null) out.push("capacidade-indeterminada");
  else if (a.free < offer.minutes) out.push("capacidade-insuficiente");
  if (a.conflicts.length) out.push("conflito-existente");
  const used = new Set(i.commitments.filter((c) => on(c, day)).flatMap((c) => c.slots ?? []));
  if (offer.slots.some((s) => used.has(s))) out.push("conflito-de-horario");
  return out;
}

/**
 * Rede — L17 Educação Infantil (creche, pré-escola, grupos, turnos, jornadas, capacidade, demanda, espera).
 * Agrupamento etário só por regra homologada versionada (data de corte + faixas em meses + segmento),
 * com ato oficial verificado; sem regra ⇒ "indeterminado" (nunca faixa presumida); faixas sobrepostas
 * ⇒ ambiguidade. Jornada (parcial/integral/...) e turno só se declarados na oferta. Capacidade do grupo
 * vem da autorização L03 (nunca razão adulto/criança inventada). Demanda e fila são por grupo, reusando L11.
 */
export interface AgeBand { groupId: string; segment: string; minMonths: number; maxMonths: number } // inclusivo em min, exclusivo em max
export interface EiGroupingRule { version: number; cutoff: string; bands: readonly AgeBand[]; actRef: string; actVerified: boolean; homologatedBy: string | null; validFrom: string; validTo: string | null }

export type GroupResult = { status: "ok"; groupId: string; segment: string; ruleVersion: number; ageMonthsAtCutoff: number } | { status: "indeterminado" | "ambiguo" | "fora-das-faixas"; reason: string };

const monthsBetween = (birth: string, ref: string) => {
  const [by, bm, bd] = birth.split("-").map(Number); const [ry, rm, rd] = ref.split("-").map(Number);
  return (ry! - by!) * 12 + (rm! - bm!) - (rd! < bd! ? 1 : 0);
};

export function applicableRule(rules: readonly EiGroupingRule[], cycleStart: string): EiGroupingRule | GroupResult {
  const ok = rules.filter((r) => r.actVerified && r.homologatedBy && r.validFrom <= cycleStart && (r.validTo === null || cycleStart <= r.validTo));
  if (ok.length === 0) return { status: "indeterminado", reason: "Sem regra de agrupamento homologada com ato verificado." };
  if (ok.length > 1) return { status: "ambiguo", reason: "Mais de uma regra vigente." };
  return ok[0]!;
}

export function classifyChild(birthDate: string | null, rules: readonly EiGroupingRule[], cycleStart: string): GroupResult {
  if (!birthDate) return { status: "indeterminado", reason: "Data de nascimento não registrada." };
  const rule = applicableRule(rules, cycleStart);
  if ("status" in rule) return rule;
  const m = monthsBetween(birthDate, rule.cutoff);
  const hits = rule.bands.filter((b) => m >= b.minMonths && m < b.maxMonths);
  if (hits.length > 1) return { status: "ambiguo", reason: "Faixas da regra se sobrepõem." };
  if (!hits.length) return { status: "fora-das-faixas", reason: `Idade ${m} meses na data de corte fora das faixas da EI.` };
  return { status: "ok", groupId: hits[0]!.groupId, segment: hits[0]!.segment, ruleVersion: rule.version, ageMonthsAtCutoff: m };
}

export interface EiOffer { offerId: string; schoolId: string; groupId: string; shifts: readonly string[]; journeys: readonly string[] }
/** Pedido só é compatível com turno e jornada declarados na oferta. */
export function offerAccepts(o: EiOffer, req: { groupId: string; shift: string; journey: string }) {
  const r: string[] = [];
  if (o.groupId !== req.groupId) r.push("Grupo da criança diferente do grupo da oferta.");
  if (!o.shifts.includes(req.shift)) r.push("Turno não ofertado.");
  if (!o.journeys.includes(req.journey)) r.push("Jornada não ofertada.");
  return r.length ? { ok: false as const, reasons: r } : { ok: true as const };
}

/** Demanda por escola×grupo×jornada: só crianças classificadas; indeterminadas contadas à parte, nunca encaixadas. */
export function demandByGroup(requests: readonly { schoolId: string; journey: string; result: GroupResult }[], capacity: ReadonlyMap<string, number | null>) {
  const cells = new Map<string, number>(); let unclassified = 0;
  for (const q of requests) {
    if (q.result.status !== "ok") { unclassified++; continue; }
    const k = `${q.schoolId}|${q.result.groupId}|${q.journey}`; cells.set(k, (cells.get(k) ?? 0) + 1);
  }
  const rows = [...cells].sort(([a], [b]) => a.localeCompare(b)).map(([key, demand]) => {
    const cap = capacity.has(key) ? capacity.get(key)! : null;
    return { key, demand, authorized: cap, excess: cap === null ? null : Math.max(0, demand - cap) };
  });
  return { rows, unclassified };
}

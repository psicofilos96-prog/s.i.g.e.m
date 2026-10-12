/**
 * Centro de Operações — L07: preventiva × corretiva, periodicidade, histórico, disponibilidade e alertas (migration 0410).
 * Preventiva = ordem L05 vinculada a plano aprovado (pessoa ≠ autor) cuja periodicidade tem FONTE declarada
 * (norma, fabricante, manual técnico, decisão técnica); sem vínculo é corretiva. Próxima data conta só a partir
 * de serviço CONFIRMADO (L06 "executada"); declaração não reinicia o ciclo. Alertas são projeção (vencida,
 * a vencer em janela configurada, reincidência acima de limiar configurado) — sem configuração, nada é afirmado.
 * Certificado de segurança só existe como referência a documento juntado; nunca é gerado, inferido de vistoria
 * ou de serviço, e ausência é "sem certificado registrado", nunca "regular".
 */
export interface PlanVersion { id: string; planKey: string; version: number; spaceId: string | null; activity: string; periodicityDays: number;
  basisKind: "norma" | "fabricante" | "manual-tecnico" | "decisao-tecnica"; basisRef: string; startsOn: string; active: boolean;
  authorPerson: string; approval: { approverPerson: string; decisionRef: string } | null }

export function planUsable(all: readonly PlanVersion[], id: string): PlanVersion | null {
  const p = all.find((x) => x.id === id);
  if (!p?.approval || p.approval.approverPerson === p.authorPerson || !p.basisRef.trim() || !p.active) return null;
  return p.version === Math.max(...all.filter((x) => x.planKey === p.planKey).map((x) => x.version)) ? p : null;
}

const addDays = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

export interface ConfirmedService { maintenanceOrderId: string; confirmedOn: string }
export interface PlanStatus { planKey: string; lastDone: string | null; nextDue: string; state: "em-dia" | "a-vencer" | "vencida"; basis: string }

/** Próxima data a partir do último serviço confirmado vinculado (ou do início do plano). Janela "a vencer" só se configurada. */
export function planStatus(plan: PlanVersion, linkedConfirmed: readonly ConfirmedService[], today: string, warnDays: number | null): PlanStatus {
  const lastDone = [...linkedConfirmed].map((s) => s.confirmedOn).sort().pop() ?? null;
  const nextDue = addDays(lastDone ?? plan.startsOn, lastDone ? plan.periodicityDays : 0);
  const state = nextDue < today ? "vencida" : warnDays !== null && addDays(today, warnDays) >= nextDue ? "a-vencer" : "em-dia";
  return { planKey: plan.planKey, lastDone, nextDue, state, basis: `${plan.basisKind}: ${plan.basisRef}` };
}

export const nature = (orderId: string, links: ReadonlySet<string>) => (links.has(orderId) ? "preventiva" : "corretiva") as "preventiva" | "corretiva";

export interface ProblemEntry { orderId: string; spaceId: string | null; category: string | null; openedOn: string; nature: "preventiva" | "corretiva" }
/** Histórico por espaço e reincidência: só com limiar e janela configurados; sem eles ⇒ null (não afirmado). */
export function problemHistory(entries: readonly ProblemEntry[], spaceId: string, today: string, recurrence: { count: number; windowDays: number } | null) {
  const mine = entries.filter((e) => e.spaceId === spaceId).sort((a, b) => b.openedOn.localeCompare(a.openedOn));
  let recurring: { category: string; count: number }[] | null = null;
  if (recurrence) {
    const since = addDays(today, -recurrence.windowDays);
    const by = new Map<string, number>();
    for (const e of mine) if (e.nature === "corretiva" && e.category && e.openedOn >= since) by.set(e.category, (by.get(e.category) ?? 0) + 1);
    recurring = [...by].filter(([, n]) => n >= recurrence.count).map(([category, count]) => ({ category, count }));
  }
  return { entries: mine, corrective: mine.filter((e) => e.nature === "corretiva").length, preventive: mine.filter((e) => e.nature === "preventiva").length, recurring };
}

export interface AvailabilityEvent { seq: number; status: "disponivel" | "restrito" | "indisponivel"; effectiveFrom: string; reason: string }
/** Disponibilidade na data; sem evento ⇒ "não informada" (nunca presumida disponível). */
export const availabilityOn = (events: readonly AvailabilityEvent[], date: string) =>
  [...events].filter((e) => e.effectiveFrom <= date).sort((a, b) => b.seq - a.seq)[0]?.status ?? "nao-informada";

export interface CertificateRef { kind: string; issuer: string; issuedOn: string; validUntil: string | null; spaceId: string | null }
export type CertificateState = "vigente" | "vencido" | "sem-validade-no-documento" | "sem-certificado-registrado";
export function certificateState(refs: readonly CertificateRef[], kind: string, today: string): { state: CertificateState; ref: CertificateRef | null } {
  const ref = refs.filter((r) => r.kind === kind).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))[0] ?? null;
  if (!ref) return { state: "sem-certificado-registrado", ref: null };
  if (!ref.validUntil) return { state: "sem-validade-no-documento", ref };
  return { state: ref.validUntil >= today ? "vigente" : "vencido", ref };
}

export type OpsAlert = { kind: "preventiva-vencida" | "preventiva-a-vencer" | "certificado-vencido" | "reincidencia" | "espaco-indisponivel"; ref: string; detail: string };
export function alerts(input: { plans: PlanStatus[]; certificates: { kind: string; state: CertificateState }[];
  recurring: { spaceId: string; items: { category: string; count: number }[] | null }[]; unavailable: { spaceId: string; since: string }[] }): OpsAlert[] {
  const a: OpsAlert[] = [];
  for (const p of input.plans) if (p.state !== "em-dia") a.push({ kind: p.state === "vencida" ? "preventiva-vencida" : "preventiva-a-vencer", ref: p.planKey, detail: `prevista para ${p.nextDue} (${p.basis})` });
  for (const c of input.certificates) if (c.state === "vencido") a.push({ kind: "certificado-vencido", ref: c.kind, detail: "documento registrado com validade expirada" });
  for (const r of input.recurring) for (const it of r.items ?? []) a.push({ kind: "reincidencia", ref: r.spaceId, detail: `${it.count} ocorrências corretivas de ${it.category}` });
  for (const u of input.unavailable) a.push({ kind: "espaco-indisponivel", ref: u.spaceId, detail: `indisponível desde ${u.since}` });
  return a;
}

/** Texto proibido em qualquer projeção: o sistema nunca atesta regularidade de segurança. */
export const claimsSafetyCertification = (text: string) => /\b(regular(izad[oa])?|certificad[oa]|seguro|aprovad[oa]) (pelos bombeiros|para uso|em seguran[çc]a)\b|\bAVCB (v[aá]lido|emitido)\b/i.test(text);

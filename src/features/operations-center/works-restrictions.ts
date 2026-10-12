/**
 * Centro de Operações — L08: obras, acessibilidade e segurança (migrations 0412/0413).
 * Obra = `ops_works` + eventos append-only (responsável técnico = atuação vigente + registro profissional declarado,
 * contrato só como documento juntado no SIGEM Documentos, marcos previstos/realizados, início→suspensão/retomada→
 * conclusão declarada→recebimento por pessoa ≠ responsável e ≠ quem declarou). Restrição de uso por espaço é evento
 * append-only (impor/levantar, interdição ou uso restrito com limite, turnos, período, motivo).
 * Capacidade APTA (para a Organização da Rede) = capacidade com fonte − restrições vigentes; sala existente sem
 * capacidade com fonte, disponibilidade não informada ou restrição sem limite ⇒ indeterminada, nunca "apta".
 */
import type { OperationalRestriction } from "../enrollments/capacity-model";

export type WorkEventKind = "responsavel-tecnico" | "contrato" | "marco-previsto" | "marco-realizado" | "inicio" | "suspensao" | "retomada" | "conclusao-declarada" | "recebimento" | "cancelamento";
export interface WorkEvent { seq: number; kind: WorkEventKind; actorPerson: string; responsiblePerson?: string; registry?: string; hasDoc?: boolean; milestoneKey?: string; milestoneLabel?: string; onDate?: string; note?: string }
export type WorkState = "planejada" | "em-execucao" | "suspensa" | "conclusao-declarada" | "recebida" | "cancelada";

const STATE_OF: Partial<Record<WorkEventKind, WorkState>> = { inicio: "em-execucao", retomada: "em-execucao", suspensao: "suspensa", "conclusao-declarada": "conclusao-declarada", recebimento: "recebida", cancelamento: "cancelada" };
export const workState = (ev: readonly WorkEvent[]): WorkState => [...ev].sort((a, b) => b.seq - a.seq).map((e) => STATE_OF[e.kind]).find(Boolean) ?? "planejada";

/** Espelha `record_ops_work_event` (o banco é a garantia). */
export function canRecord(ev: readonly WorkEvent[], kind: WorkEventKind, actor: string, draft: Partial<WorkEvent> = {}): { ok: true } | { ok: false; reason: string } {
  const st = workState(ev);
  if (st === "recebida" || st === "cancelada") return { ok: false, reason: "Obra encerrada." };
  const need: Partial<Record<WorkEventKind, WorkState>> = { inicio: "planejada", suspensao: "em-execucao", retomada: "suspensa", "conclusao-declarada": "em-execucao", recebimento: "conclusao-declarada" };
  if (need[kind] && need[kind] !== st) return { ok: false, reason: `Transição inválida a partir de ${st}.` };
  if (kind === "responsavel-tecnico" && (!draft.responsiblePerson || (draft.registry ?? "").trim().length < 3)) return { ok: false, reason: "Responsável técnico exige atuação vigente e registro profissional." };
  if ((kind === "contrato" || kind === "recebimento") && !draft.hasDoc) return { ok: false, reason: "Exige documento juntado no SIGEM Documentos." };
  if ((kind === "suspensao" || kind === "cancelamento") && (draft.note ?? "").trim().length < 10) return { ok: false, reason: "Justificativa obrigatória." };
  const resp = [...ev].filter((e) => e.kind === "responsavel-tecnico").sort((a, b) => b.seq - a.seq)[0];
  if (kind === "inicio" && !resp) return { ok: false, reason: "Sem responsável técnico registrado." };
  if (kind === "recebimento" && (resp?.responsiblePerson === actor || ev.some((e) => e.kind === "conclusao-declarada" && e.actorPerson === actor)))
    return { ok: false, reason: "Recebimento por pessoa distinta do responsável técnico e de quem declarou a conclusão." };
  return { ok: true };
}

export interface MilestoneStatus { key: string; label: string; planned: string; done: string | null; state: "realizado" | "previsto" | "atrasado" }
/** Cronograma: último previsto por marco (replanejamento é novo evento); sem marco ⇒ cronograma "não informado". */
export function schedule(ev: readonly WorkEvent[], today: string): MilestoneStatus[] | "nao-informado" {
  const planned = new Map<string, WorkEvent>(); const done = new Map<string, string>();
  for (const e of [...ev].sort((a, b) => a.seq - b.seq)) {
    if (e.kind === "marco-previsto" && e.milestoneKey && e.onDate) planned.set(e.milestoneKey, e);
    if (e.kind === "marco-realizado" && e.milestoneKey && e.onDate) done.set(e.milestoneKey, e.onDate);
  }
  if (!planned.size) return "nao-informado";
  return [...planned.values()].map((p) => {
    const d = done.get(p.milestoneKey!) ?? null;
    return { key: p.milestoneKey!, label: p.milestoneLabel ?? p.milestoneKey!, planned: p.onDate!, done: d, state: d ? "realizado" : p.onDate! < today ? "atrasado" : "previsto" };
  });
}

export interface UseRestrictionEvent { seq: number; action: "impor" | "levantar"; key: string; severity: "interdicao" | "uso-restrito" | null; capacityLimit: number | null; shiftIds: string[]; from: string; to: string | null; reason: string }
/** Restrições vigentes na data: última ação por chave; "levantar" com início ≤ data encerra. */
export function activeRestrictions(ev: readonly UseRestrictionEvent[], on: string): UseRestrictionEvent[] {
  const last = new Map<string, UseRestrictionEvent>();
  for (const e of [...ev].filter((x) => x.from <= on).sort((a, b) => a.seq - b.seq)) last.set(e.key, e);
  return [...last.values()].filter((e) => e.action === "impor" && (e.to === null || on <= e.to));
}

export type AptCapacity = { value: number; basis: string[] } | { value: null; reason: string };
/** Capacidade apta do espaço no turno/data. Interdição ⇒ 0; uso restrito sem limite ⇒ indeterminada. */
export function aptCapacity(space: { capacity: number | null; capacitySource: string | null; availability: "disponivel" | "restrito" | "indisponivel" | "nao-informada" },
  restrictions: readonly UseRestrictionEvent[], shiftId: string, on: string): AptCapacity {
  if (space.capacity === null || !space.capacitySource) return { value: null, reason: "Capacidade não informada com fonte; sala existente não basta." };
  if (space.availability === "nao-informada") return { value: null, reason: "Disponibilidade não informada." };
  if (space.availability === "indisponivel") return { value: 0, basis: ["indisponivel"] };
  let v = space.capacity; const basis = [`fonte: ${space.capacitySource}`];
  for (const r of activeRestrictions(restrictions, on)) {
    if (r.shiftIds.length && !r.shiftIds.includes(shiftId)) continue;
    if (r.severity === "interdicao") return { value: 0, basis: [...basis, `interdição: ${r.reason}`] };
    if (r.capacityLimit === null) return { value: null, reason: `Uso restrito sem limite declarado: ${r.reason}` };
    v = Math.min(v, r.capacityLimit); basis.push(`restrição: ${r.reason}`);
  }
  if (space.availability === "restrito" && basis.length === 1) return { value: null, reason: "Espaço restrito sem restrição quantificada." };
  return { value: v, basis };
}

/** Ponte com a Organização da Rede: restrições viram `OperationalRestriction` (redução), sem gravar nada lá. */
export function toNetworkRestrictions(envId: string, installed: number, ev: readonly UseRestrictionEvent[], on: string): OperationalRestriction[] {
  return activeRestrictions(ev, on).flatMap((r) => (r.shiftIds.length ? r.shiftIds : [null]).map((shiftId) => ({
    envId, shiftId, from: r.from, to: r.to, reason: r.reason,
    reduction: r.severity === "interdicao" ? installed : r.capacityLimit === null ? null : Math.max(0, installed - r.capacityLimit),
  })));
}
export const WORKS_BRIDGE_WRITES: readonly string[] = [];

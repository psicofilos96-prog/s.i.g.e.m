// Tecnologia L07 — fila de suporte (migration 0481). Grupo por escola; membros = atuações vigentes por eventos
// incluir/retirar; encaminhamento ao grupo é ato com motivo; atribuição individual é o evento 'atribuicao' canônico.
// Fila, carga e histórico de responsabilidade são projeção; nenhuma distribuição automática é presumida.
import { projectRequest, type OpsEvent } from "@/features/operations-center/shared-requests";
import type { Clock } from "./sla";

export interface MemberEvent { seq: number; action: "incluir" | "retirar"; engagementId: string }
export interface Routing { seq: number; groupId: string; personId: string; at: string; reason: string }
export interface QueueTicket { id: string; createdAt: string; events: OpsEvent[]; routings: Routing[]; clock: Clock }

export function activeMembers(ev: readonly MemberEvent[], vigentes: ReadonlySet<string>): string[] {
  const st = new Map<string, string>();
  for (const e of [...ev].sort((a, b) => a.seq - b.seq)) st.set(e.engagementId, e.action);
  return [...st].filter(([id, a]) => a === "incluir" && vigentes.has(id)).map(([id]) => id);
}

export const currentGroup = (rs: readonly Routing[]) => [...rs].sort((a, b) => b.seq - a.seq)[0]?.groupId ?? null;

const ALERT_RANK = (c: Clock) => c.status !== "ok" ? 3 : c.resolution.alert === "vencido" ? 0 : c.resolution.alert === "nenhum" ? 2 : 1;

/** Fila do grupo: chamados abertos do grupo; ordem = situação do prazo (vencido, em alerta, demais, sem avaliação) e depois antiguidade. */
export function groupQueue(groupId: string, ts: readonly QueueTicket[]) {
  return ts.filter((t) => currentGroup(t.routings) === groupId)
    .map((t) => ({ t, p: projectRequest(t.events) }))
    .filter(({ p }) => p.state !== "concluida" && p.state !== "cancelada")
    .sort((a, b) => ALERT_RANK(a.t.clock) - ALERT_RANK(b.t.clock) || a.t.createdAt.localeCompare(b.t.createdAt) || a.t.id.localeCompare(b.t.id))
    .map(({ t, p }) => ({ id: t.id, state: p.state, responsible: p.responsible, unassigned: p.responsible === null, clock: t.clock }));
}

/** Carga por membro ativo (chamados abertos atribuídos); responsável fora do grupo aparece como divergência. */
export function workload(groupId: string, ts: readonly QueueTicket[], members: readonly string[]) {
  const q = groupQueue(groupId, ts);
  const load = Object.fromEntries(members.map((m) => [m, 0])) as Record<string, number>;
  const outside: string[] = [];
  for (const x of q) if (x.responsible) { if (x.responsible in load) load[x.responsible]!++; else outside.push(x.id); }
  return { load, unassigned: q.filter((x) => x.unassigned).length, responsibleOutsideGroup: outside };
}

/** Histórico de responsabilidade: encaminhamentos a grupos + atribuições individuais, em ordem temporal. */
export function responsibilityHistory(t: QueueTicket) {
  return [
    ...t.routings.map((r) => ({ at: r.at, kind: "grupo" as const, ref: r.groupId, by: r.personId, reason: r.reason as string | null })),
    ...t.events.filter((e) => e.kind === "atribuicao").map((e) => ({ at: e.at, kind: "responsavel" as const, ref: e.responsibleEngagement ?? "", by: e.actorPerson, reason: e.note ?? null })),
  ].sort((a, b) => a.at.localeCompare(b.at));
}

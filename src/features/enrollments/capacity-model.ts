/**
 * Rede/Matrículas/Vagas L03 — Capacidade.
 * Três grandezas distintas, nunca deduzidas uma da outra:
 *  - instalada: o que o ambiente físico comporta (medição/registro de infraestrutura);
 *  - operacional: instalada menos restrições declaradas (turno, acessibilidade, interdição);
 *  - autorizada: número decidido por ato competente com critério, fundamento, validade e responsável.
 * Só a autorizada gera vaga. Sala física nunca vira vaga automaticamente.
 * Capacidade de turma continua em `class_capacity_records` (fonte única); este núcleo só decide.
 */
export interface Environment { envId: string; schoolId: string; kind: string; installed: number | null; accessible: boolean | null; shiftIds: readonly string[] }
export interface OperationalRestriction { envId: string; shiftId: string | null; reduction: number | null; reason: string; from: string; to: string | null }
export interface CapacityCriterion { criterionId: string; version: number; basis: string; homologated: boolean; /** pessoas por m², por ambiente etc. — só texto descritivo da regra */ description: string }
export interface CapacityAuthorization {
  authId: string; seq: number; schoolId: string; envId: string; shiftId: string;
  authorized: number; criterionId: string; criterionVersion: number;
  actRef: string; responsiblePersonId: string; validFrom: string; validTo: string | null;
  kind: "registro" | "retificacao" | "revogacao"; reason: string;
}

const inRange = (on: string, from: string, to: string | null) => from <= on && (to === null || on <= to);

export type Value = { value: number; refs: string[] } | { value: null; reason: string };

export function installedCapacity(env: Environment): Value {
  return env.installed === null ? { value: null, reason: "Capacidade instalada não registrada." } : { value: env.installed, refs: [env.envId] };
}

export function operationalCapacity(env: Environment, shiftId: string, restrictions: readonly OperationalRestriction[], on: string): Value {
  if (!env.shiftIds.includes(shiftId)) return { value: null, reason: "Ambiente não funciona neste turno." };
  const inst = installedCapacity(env);
  if (inst.value === null) return inst;
  let v = inst.value; const refs = [...inst.refs];
  for (const r of restrictions) {
    if (r.envId !== env.envId || (r.shiftId && r.shiftId !== shiftId) || !inRange(on, r.from, r.to)) continue;
    if (r.reduction === null) return { value: null, reason: `Restrição sem quantitativo: ${r.reason}` };
    v -= r.reduction; refs.push(`restricao:${r.reason}`);
  }
  return { value: Math.max(0, v), refs };
}

export type AuthDecision = { ok: true; record: CapacityAuthorization } | { ok: false; reason: string };
export interface AuthActor { personId: string | null; isHuman: boolean; isTechnicalExecutor?: boolean; capabilities: readonly string[]; schoolIds: readonly string[] | "rede" }

/** Registra/retifica/revoga autorização. Capacidade exigida vem de configuração; ausente ⇒ recusa. */
export function recordAuthorization(
  chain: readonly CapacityAuthorization[], draft: Omit<CapacityAuthorization, "seq" | "responsiblePersonId">,
  actor: AuthActor, ctx: { requiredCapability: string | null; criteria: readonly CapacityCriterion[]; env: Environment; restrictions: readonly OperationalRestriction[]; expectedSeq: number },
): AuthDecision {
  if (!actor.isHuman || !actor.personId || actor.isTechnicalExecutor) return { ok: false, reason: "Autorização exige pessoa natural responsável; executor técnico não autoriza." };
  if (!ctx.requiredCapability) return { ok: false, reason: "Competência para autorizar capacidade não configurada." };
  if (!actor.capabilities.includes(ctx.requiredCapability)) return { ok: false, reason: `Falta a capacidade ${ctx.requiredCapability}.` };
  if (actor.schoolIds !== "rede" && !actor.schoolIds.includes(draft.schoolId)) return { ok: false, reason: "Fora do escopo da escola." };
  const mine = chain.filter((c) => c.authId === draft.authId);
  const last = mine.at(-1);
  if ((last?.seq ?? 0) !== ctx.expectedSeq) return { ok: false, reason: "Base desatualizada." };
  if (draft.kind === "registro" && last) return { ok: false, reason: "Autorização já existe; use retificação." };
  if (draft.kind !== "registro" && (!last || last.kind === "revogacao")) return { ok: false, reason: "Nada vigente para retificar/revogar." };
  if (!draft.actRef.trim()) return { ok: false, reason: "Exige referência ao ato." };
  if (!draft.reason.trim()) return { ok: false, reason: "Motivo obrigatório." };
  if (draft.validTo && draft.validTo < draft.validFrom) return { ok: false, reason: "Validade inválida." };
  if (draft.envId !== ctx.env.envId || draft.schoolId !== ctx.env.schoolId) return { ok: false, reason: "Ambiente não pertence à escola." };
  if (draft.kind !== "revogacao") {
    const crit = ctx.criteria.find((c) => c.criterionId === draft.criterionId && c.version === draft.criterionVersion);
    if (!crit) return { ok: false, reason: "Critério não encontrado." };
    if (!crit.homologated) return { ok: false, reason: "Critério não homologado." };
    if (!crit.basis.trim()) return { ok: false, reason: "Critério sem fundamento." };
    if (!Number.isInteger(draft.authorized) || draft.authorized < 0) return { ok: false, reason: "Quantitativo inválido." };
    const op = operationalCapacity(ctx.env, draft.shiftId, ctx.restrictions, draft.validFrom);
    if (op.value === null) return { ok: false, reason: `Capacidade operacional indeterminada: ${op.reason}` };
    if (draft.authorized > op.value) return { ok: false, reason: `Autorizada (${draft.authorized}) excede a operacional (${op.value}).` };
  }
  return { ok: true, record: { ...draft, seq: (last?.seq ?? 0) + 1, responsiblePersonId: actor.personId } };
}

/** Capacidade autorizada vigente: último registro da cadeia que cobre a data; revogada ⇒ nada. */
export function authorizedOn(chain: readonly CapacityAuthorization[], envId: string, shiftId: string, on: string): Value {
  const ids = [...new Set(chain.filter((c) => c.envId === envId && c.shiftId === shiftId).map((c) => c.authId))];
  const live = ids.map((id) => chain.filter((c) => c.authId === id).sort((a, b) => a.seq - b.seq).at(-1)!)
    .filter((c) => c.kind !== "revogacao" && inRange(on, c.validFrom, c.validTo));
  if (live.length === 0) return { value: null, reason: "Sem capacidade autorizada vigente: nenhuma vaga é gerada." };
  if (live.length > 1) return { value: null, reason: "Mais de uma autorização vigente: ambígua." };
  return { value: live[0]!.authorized, refs: [`${live[0]!.authId}#${live[0]!.seq}`, live[0]!.actRef] };
}

/** Vagas só da capacidade autorizada; ocupação desconhecida ⇒ null, nunca zero. */
export function vacanciesFrom(authorized: Value, occupied: number | null): Value {
  if (authorized.value === null) return authorized;
  if (occupied === null) return { value: null, reason: "Ocupação não lida." };
  return { value: Math.max(0, authorized.value - occupied), refs: authorized.refs };
}

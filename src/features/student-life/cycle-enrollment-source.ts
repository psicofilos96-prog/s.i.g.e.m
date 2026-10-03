/**
 * B3 — Fonte institucional da cadeia canônica 13B/13C:
 * estudante → inscrição letiva (AcademicCycleEnrollment, `school_enrollments`)
 * → participação educacional (CycleParticipation, `cycle_participations`)
 * → alocação em turma (ClassAllocation, `class_enrollment_episodes`).
 *
 * Leitura SÓ pelos readers bitemporais (`*_at(validOn, knownAt)`); nunca
 * "última versão" local. Escrita SÓ pelos escritores do banco, que fazem a
 * autorização final. Capacidade é registro temporal próprio; ocupação é
 * derivada das alocações vigentes e nunca persistida. Nenhuma norma é
 * presumida: sem valor homologado a operação fica indisponível.
 */
import { supabase } from "@/integrations/supabase/client";
import type { BitemporalContext } from "@/features/classes/class-offering-shift-projection";

export const PARTICIPATION_NATURE_SCHEME = "natureza-da-participacao-educacional" as const;
export const BOND_STATUS_SCHEME = "situacao-do-vinculo" as const;
export const ENROLLMENT_CAPABILITY = "manter-matricula-e-enturmacao" as const;
export const MOVEMENT_CAPABILITY = "registrar-movimentacao-escolar" as const;
export const CONSULT_CAPABILITY = "consultar-matricula-e-movimentacao" as const;
export const LOCATE_CAPABILITY = "localizar-estudante-para-matricula" as const;
export const CAPACITY_CAPABILITY = "manter-cadastro-de-turmas" as const;

type RpcResult = { data: unknown; error: { message: string } | null };
const rpc = (client: typeof supabase, fn: string, args: Record<string, unknown>): Promise<RpcResult> =>
  (client.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<RpcResult>)(fn, args);

export type CycleEnrollmentAtRow = {
  id: string; logical_id: string; student_id: string; school_id: string; academic_year_id: string | null;
  opened_on: string | null; institutional_number: string | null; originating_act_ref: string | null; created_at: string;
  ending_version_id: string | null; ended_on: string | null; bond_status_value_id: string | null;
  bond_status_version: number | null; ending_reason: string | null;
};
export type CycleParticipationRow = {
  id: string; logical_id: string; version: number; supersedes_id: string | null; enrollment_logical_id: string;
  student_id: string; school_id: string; nature_scheme_id: string; nature_value_id: string; nature_version: number;
  valid_from: string; valid_until: string | null; annulled: boolean; change_reason: string | null;
  originating_act_ref: string | null; recorded_by: string; created_at: string;
};
export type ClassAllocationAtRow = {
  id: string; logical_id: string; participation_logical_id: string | null; enrollment_id: string; student_id: string;
  school_id: string; class_id: string; valid_from: string; ended_on: string | null; ending_version_id: string | null;
  ending_reason: string | null; originating_act_ref: string | null; class_label_snapshot: string | null; created_at: string;
};
export type CapacityRow = {
  id: string; logical_id: string; version: number; class_id: string; school_id: string; reference_limit: number | null;
  valid_from: string; valid_until: string | null; basis_text: string | null; originating_act_ref: string | null; created_at: string;
};

/** Contexto obrigatório; "histórico" (validOn nulo) só é aceito quando o consumidor o declara. */
export type EnrollmentTemporalQuery = { validOn: string | null; knownAt?: string | null };
const temporalArgs = (t: EnrollmentTemporalQuery) => ({ _valid_on: t.validOn, _known_at: t.knownAt ?? null });
export const fromBitemporal = (t: BitemporalContext, history = false): EnrollmentTemporalQuery =>
  ({ validOn: history ? null : t.validOn, knownAt: t.knownAt ?? null });

export class SourceInconsistency extends Error {
  constructor(public readonly code: string) { super(code); }
}
function unwrap<T>(r: RpcResult): T {
  if (r.error) {
    if (/ambiguous-temporal-state/.test(r.error.message)) throw new SourceInconsistency(r.error.message);
    throw new Error(r.error.message);
  }
  return (r.data ?? []) as T;
}

export async function readCycleEnrollments(school: string, t: EnrollmentTemporalQuery, client = supabase) {
  return unwrap<CycleEnrollmentAtRow[]>(await rpc(client, "cycle_enrollments_at", { _school: school, ...temporalArgs(t) }));
}
export async function readCycleParticipations(school: string, t: EnrollmentTemporalQuery, client = supabase) {
  return unwrap<CycleParticipationRow[]>(await rpc(client, "cycle_participations_at", { _school: school, ...temporalArgs(t) }));
}
export async function readClassAllocations(scope: { school?: string; classId?: string }, t: EnrollmentTemporalQuery, client = supabase) {
  return unwrap<ClassAllocationAtRow[]>(
    await rpc(client, "class_allocations_at", { _school: scope.school ?? null, _class: scope.classId ?? null, ...temporalArgs(t) }),
  );
}
export async function readMovementsKnown(school: string, knownAt: string | null, client = supabase) {
  return unwrap<Record<string, unknown>[]>(await rpc(client, "student_movements_known", { _school: school, _known_at: knownAt }));
}

/** Capacidade e ocupação: duas leituras independentes; nunca campo da turma. */
export type CapacityOccupancy = {
  capacity: { status: "nao-registrada" } | { status: "registrada"; referenceLimit: number; record: CapacityRow };
  occupancy: number;
};
export function capacityOccupancy(capacity: readonly CapacityRow[], allocationsOnDate: readonly ClassAllocationAtRow[]): CapacityOccupancy {
  if (capacity.length > 1) throw new SourceInconsistency("capacity:ambiguous-temporal-state");
  const rec = capacity[0];
  return {
    capacity: rec && rec.reference_limit !== null ? { status: "registrada", referenceLimit: rec.reference_limit, record: rec } : { status: "nao-registrada" },
    // Ocupação é contagem das alocações vigentes; nenhum efeito ("turma cheia") é derivado aqui.
    occupancy: allocationsOnDate.length,
  };
}
export async function readCapacityOccupancy(classId: string, t: BitemporalContext, client = supabase): Promise<CapacityOccupancy> {
  const args = { _class: classId, _valid_on: t.validOn, _known_at: t.knownAt ?? null };
  const [cap, alloc] = await Promise.all([
    rpc(client, "class_capacity_at", args),
    readClassAllocations({ classId }, { validOn: t.validOn, knownAt: t.knownAt ?? null }, client),
  ]);
  return capacityOccupancy(unwrap<CapacityRow[]>(cap), alloc);
}

// ------------------------- catálogos (sem valores semeados) -------------------------

export type CatalogValue = { valueId: string; version: number; label: string };
export async function homologatedValues(scheme: string, on: string, client = supabase): Promise<CatalogValue[]> {
  const rows = unwrap<{ value_id: string; version: number; label: string }[]>(
    await rpc(client, "homologated_attribute_values", { _scheme: scheme, _on: on }),
  );
  return rows.map((r) => ({ valueId: r.value_id, version: r.version, label: r.label }));
}
/**
 * B3.1 — tipos de movimentação vigentes só pelo reader canônico `movement_types_at`
 * (por tipo, a maior versão homologada com valid_from <= on, conhecida em knownAt).
 * Nunca lê a tabela: leitura direta devolveria versões substituídas ou futuras.
 */
export async function homologatedMovementTypes(on: string, knownAt: string | null = null, client = supabase): Promise<CatalogValue[]> {
  const rows = unwrap<{ id: string; version: number; label: string }[]>(
    await rpc(client, "movement_types_at", { _on: on, _known_at: knownAt }),
  );
  return rows.map((r) => ({ valueId: r.id, version: r.version, label: r.label }));
}

/** Versão aplicável do ano na data: mesma regra de `class_record_context` (maior versão com valid_from <= data). */
export type AcademicYearVersionRow = { academic_year_id: string; official_name: string; version: number; valid_from: string; is_active: boolean };
export function academicYearsOn(rows: readonly AcademicYearVersionRow[], on: string): { id: string; name: string }[] {
  const best = new Map<string, AcademicYearVersionRow>();
  for (const r of rows) {
    if (r.valid_from > on) continue;
    const cur = best.get(r.academic_year_id);
    if (!cur || r.version > cur.version) best.set(r.academic_year_id, r);
  }
  return [...best.values()].filter((r) => r.is_active).map((r) => ({ id: r.academic_year_id, name: r.official_name }));
}

/** Rótulo e estado da turma na data pelo reader `class_at`; turma sem registro ativo na data não é oferecida. */
export async function activeClassesOn(classes: readonly { id: string; academic_year_id: string }[], on: string, client = supabase) {
  const rows = await Promise.all(classes.map(async (c) => {
    const r = unwrap<{ name: string; administrative_status: string }[]>(await rpc(client, "class_at", { _class_id: c.id, _valid_on: on, _known_at: null }));
    const rec = r[0];
    return rec && rec.administrative_status === "ativa" ? { ...c, name: rec.name } : null;
  }));
  return rows.filter((x): x is { id: string; academic_year_id: string; name: string } => x !== null);
}

/** Política temporal declarativa 13C para movimentação entre alocações: ainda não institucionalizada. */
export const ALLOCATION_MOVE_BOUNDARY_POLICY: null = null;
export function allocationMoveAvailability(): { available: false; reason: string } {
  return { available: false, reason: "Nenhuma política temporal homologada (activeBoundaryDefinitionId) define o fim da origem; a movimentação atômica fica indisponível e a alocação de origem é preservada." };
}

// ------------------------- escritores -------------------------

const call = async (fn: string, args: Record<string, unknown>) => {
  const r = await rpc(supabase, fn, args);
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
export const constituteCycleEnrollment = (a: {
  id: string; studentId: string; schoolId: string; academicYearId: string; openedOn: string;
  institutionalNumber?: string | null; actRef?: string | null; supersedes?: string | null; correctionReason?: string | null;
}) => call("constitute_cycle_enrollment", {
  _id: a.id, _student: a.studentId, _school: a.schoolId, _academic_year: a.academicYearId, _opened_on: a.openedOn,
  _institutional_number: a.institutionalNumber ?? null, _act_ref: a.actRef ?? null, _supersedes: a.supersedes ?? null,
  _correction_reason: a.correctionReason ?? null, _offer_value: null,
});
export const recordCycleEnrollmentEnding = (a: {
  enrollmentLogicalId: string; baseVersionId: string | null; endedOn: string | null; bondStatus: CatalogValue | null;
  reason?: string | null; actRef?: string | null; correctionReason?: string | null; annul?: boolean;
}) => call("record_cycle_enrollment_ending", {
  _enrollment_logical: a.enrollmentLogicalId, _base_version_id: a.baseVersionId, _ended_on: a.endedOn,
  _bond_status_value: a.bondStatus?.valueId ?? null, _bond_status_version: a.bondStatus?.version ?? null,
  _reason: a.reason ?? null, _act_ref: a.actRef ?? null, _correction_reason: a.correctionReason ?? null, _annul: a.annul ?? false,
});
export const declareCycleParticipation = (a: {
  logicalId: string; baseVersionId: string | null; enrollmentLogicalId: string; nature: CatalogValue;
  validFrom: string; validUntil?: string | null; actRef?: string | null; changeReason?: string | null; annul?: boolean;
}) => call("declare_cycle_participation", {
  _logical: a.logicalId, _base_version_id: a.baseVersionId, _enrollment_logical: a.enrollmentLogicalId,
  _nature_value: a.nature.valueId, _nature_version: a.nature.version, _valid_from: a.validFrom, _valid_until: a.validUntil ?? null,
  _act_ref: a.actRef ?? null, _change_reason: a.changeReason ?? null, _annul: a.annul ?? false,
});
export const recordClassAllocation = (a: {
  id: string; participationLogicalId: string; classId: string; validFrom: string; actRef?: string | null;
  supersedes?: string | null; correctionReason?: string | null;
  /** B3.2 — término explícito opcional, gravado na mesma transação; nunca inferido. */
  endedOn?: string | null; endingReason?: string | null;
}) => call("record_class_allocation", {
  _id: a.id, _participation_logical: a.participationLogicalId, _class: a.classId, _valid_from: a.validFrom,
  _act_ref: a.actRef ?? null, _supersedes: a.supersedes ?? null, _correction_reason: a.correctionReason ?? null,
  _ended_on: a.endedOn ?? null, _ending_reason: a.endingReason ?? null,
});
export const recordClassAllocationEnding = (a: {
  allocationLogicalId: string; baseVersionId: string | null; endedOn: string | null; reason?: string | null;
  actRef?: string | null; correctionReason?: string | null; annul?: boolean;
}) => call("record_class_allocation_ending", {
  _allocation_logical: a.allocationLogicalId, _base_version_id: a.baseVersionId, _ended_on: a.endedOn,
  _reason: a.reason ?? null, _act_ref: a.actRef ?? null, _correction_reason: a.correctionReason ?? null, _annul: a.annul ?? false,
});
export const recordClassCapacity = (a: {
  logicalId: string; baseVersionId: string | null; classId: string; referenceLimit: number | null; validFrom: string;
  validUntil?: string | null; basis?: string | null; actRef?: string | null; changeReason?: string | null; annul?: boolean;
}) => call("record_class_capacity", {
  _logical: a.logicalId, _base_version_id: a.baseVersionId, _class: a.classId, _reference_limit: a.referenceLimit,
  _valid_from: a.validFrom, _valid_until: a.validUntil ?? null, _basis: a.basis ?? null, _act_ref: a.actRef ?? null,
  _change_reason: a.changeReason ?? null, _annul: a.annul ?? false,
});
export const recordMovementTypeDefinition = (a: {
  id: string; baseVersion: number | null; label: string; status: "rascunho" | "homologada"; validFrom: string | null; actRef: string | null;
}) => call("record_movement_type_definition", {
  _id: a.id, _base_version: a.baseVersion, _label: a.label, _status: a.status, _valid_from: a.validFrom, _act_ref: a.actRef,
});

/** Mensagem humana para os códigos estruturados do banco (apresentação apenas). */
const MESSAGES: Record<string, string> = {
  "capability-missing": "Sua atuação não tem a capacidade exigida nesta escola.",
  "offer-designation-not-homologated": "Não há definição homologada de qual eixo representa a oferta educacional.",
  "coexistence-policy-absent": "Já existe registro vigente e nenhuma política homologada define a coexistência.",
  "cardinality-policy-absent": "A participação já tem alocação vigente e nenhuma política homologada define a cardinalidade.",
  "nature-not-homologated": "A natureza da participação não está homologada.",
  "bond-status-not-homologated": "A situação do vínculo não está homologada.",
  "before-start": "O término não pode ser anterior ao início.",
  "class-other-school": "A turma pertence a outra escola.",
  "academic-year-mismatch": "A turma é de outro ano letivo.",
  "class-inactive-on-date": "A turma não está ativa na data.",
  "outside-participation": "A data está fora da vigência da participação.",
  "outside-enrollment": "A data está fora da vigência da inscrição.",
  "school-inactive-on-date": "A escola não está ativa na data.",
  "academic-year-inactive-on-date": "O ano letivo não está ativo na data.",
  "base-superseded": "O registro foi alterado por outra pessoa; recarregue.",
  "correction-reason-required": "Correção exige motivo.",
  "identity-immutable": "Correção não muda estudante, escola ou ano.",
  "ambiguous-temporal-state": "A fonte tem estado temporal ambíguo; nada foi escolhido.",
  // B3.1 — integridade pai→filho (sem cascata) e vigência canônica.
  "child-participation-outside": "Há participação vigente fora da nova janela da inscrição; ajuste a participação antes.",
  "child-allocation-outside": "Há alocação vigente fora da nova janela da participação; encerre a alocação antes.",
  "has-allocations": "A participação tem alocação registrada e não pode ser anulada.",
  "open-beyond-participation": "A alocação ficaria aberta além do fim da participação.",
  "ending-before-start": "O término registrado ficaria anterior ao novo início.",
  "class-inactive-in-interval": "A turma não está ativa em todo o intervalo da alocação.",
  "class-immutable-after-ending": "Com término registrado, a correção não troca a turma.",
  "type-not-current": "O tipo de movimentação não é a versão homologada vigente na data.",
  "ends-before-start": "O fim não pode ser anterior ao início.",
  "ending-on-correction-unsupported": "Na correção da alocação, o término é registrado à parte.",
};
export function b3Message(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const key = Object.keys(MESSAGES).find((k) => text.includes(k));
  return key ? MESSAGES[key]! : text;
}

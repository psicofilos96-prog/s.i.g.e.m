/**
 * B3.3 — Posição curricular individual da alocação (etapa/ano/fase como eixos abertos).
 *
 * Fato filho da alocação, nunca da turma: em turma multietapas cada estudante tem a sua.
 * Leitura SÓ por `allocation_curricular_positions_at(validOn, knownAt)`, que devolve TODA
 * alocação vigente — sem posição ⇒ `position: null` (ausência explícita, nunca inferida pelo
 * nome/código/etapa agregada da turma). Escrita SÓ por `record_allocation_curricular_position`.
 * Os eixos são pares esquema/valor homologado; qual esquema é "etapa" ou "ano/fase" é
 * configuração pendente (D1), não constante deste módulo. Natureza da participação/turma
 * (AEE, atividade complementar) NÃO é eixo de posição.
 */
import { supabase } from "@/integrations/supabase/client";
import { SourceInconsistency } from "./cycle-enrollment-source";

export type PositionAxis = { scheme: string; value: string; version: number };
export type CurricularPosition = {
  versionId: string; logicalId: string; version: number; validFrom: string; validUntil: string | null;
  axes: PositionAxis[]; actRef: string | null; changeReason: string | null; recordedAt: string;
};
export type AllocationPositionRow = {
  allocationId: string; allocationLogicalId: string; studentId: string; schoolId: string; classId: string;
  position: CurricularPosition | null;
};

type RawRow = {
  allocation_id: string; allocation_logical_id: string; student_id: string; school_id: string; class_id: string;
  position_version_id: string | null; position_logical_id: string | null; position_version: number | null;
  valid_from: string | null; valid_until: string | null; axes: PositionAxis[] | null;
  originating_act_ref: string | null; change_reason: string | null; recorded_at: string | null;
};
type RpcResult = { data: unknown; error: { message: string } | null };
const rpc = (client: typeof supabase, fn: string, args: Record<string, unknown>): Promise<RpcResult> =>
  (client.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<RpcResult>)(fn, args);

/** Projeção pura da linha do reader; ausência de posição permanece `null`. */
export function mapPositionRow(r: RawRow): AllocationPositionRow {
  return {
    allocationId: r.allocation_id, allocationLogicalId: r.allocation_logical_id, studentId: r.student_id,
    schoolId: r.school_id, classId: r.class_id,
    position: r.position_version_id === null ? null : {
      versionId: r.position_version_id, logicalId: r.position_logical_id!, version: r.position_version!,
      validFrom: r.valid_from!, validUntil: r.valid_until, axes: r.axes ?? [], actRef: r.originating_act_ref,
      changeReason: r.change_reason, recordedAt: r.recorded_at!,
    },
  };
}

export async function readAllocationPositions(
  scope: { school?: string; classId?: string }, t: { validOn: string; knownAt?: string | null }, client = supabase,
): Promise<AllocationPositionRow[]> {
  const r = await rpc(client, "allocation_curricular_positions_at", {
    _school: scope.school ?? null, _class: scope.classId ?? null, _valid_on: t.validOn, _known_at: t.knownAt ?? null,
  });
  if (r.error) {
    if (/ambiguous-temporal-state/.test(r.error.message)) throw new SourceInconsistency(r.error.message);
    throw new Error(r.error.message);
  }
  return ((r.data ?? []) as RawRow[]).map(mapPositionRow);
}

/** Validação local de forma (apresentação); a garantia é o banco. */
export function positionDraftProblems(d: { validFrom: string; validUntil: string | null; axes: readonly PositionAxis[]; baseVersionId: string | null; reason: string }): string[] {
  const p: string[] = [];
  if (!d.validFrom) p.push("Informe o início da posição.");
  if (d.validUntil && d.validFrom && d.validUntil < d.validFrom) p.push("O fim não pode ser anterior ao início.");
  if (d.axes.length === 0) p.push("Informe ao menos um eixo com valor homologado.");
  const schemes = d.axes.map((a) => a.scheme);
  if (new Set(schemes).size !== schemes.length) p.push("Cada esquema aparece uma única vez.");
  if (d.baseVersionId && !d.reason.trim()) p.push("Correção exige motivo.");
  return p;
}

export function positionWriterArgs(a: {
  logicalId: string; baseVersionId: string | null; allocationLogicalId: string; validFrom: string | null;
  validUntil: string | null; axes: readonly PositionAxis[] | null; actRef: string | null; reason: string | null; annul?: boolean;
}) {
  return {
    _position_logical: a.logicalId, _base_version_id: a.baseVersionId, _allocation_logical: a.allocationLogicalId,
    _valid_from: a.annul ? null : a.validFrom, _valid_until: a.annul ? null : a.validUntil,
    _axes: a.annul ? null : (a.axes ?? []).map((x) => ({ scheme: x.scheme, value: x.value, version: x.version })),
    _act_ref: a.actRef, _reason: a.reason, _annul: a.annul ?? false,
  };
}

export async function recordAllocationPosition(a: Parameters<typeof positionWriterArgs>[0], client = supabase): Promise<string> {
  const r = await rpc(client, "record_allocation_curricular_position", positionWriterArgs(a));
  if (r.error) throw new Error(r.error.message);
  return r.data as string;
}

const MESSAGES: Record<string, string> = {
  "position:capability-missing": "Sua atuação não pode registrar posição curricular nesta escola.",
  "position:value-not-homologated": "Há valor sem homologação em toda a vigência informada.",
  "position:outside-allocation": "A posição precisa caber na vigência da alocação.",
  "position:overlap": "Já existe outra posição vigente nesse intervalo; encerre-a antes.",
  "position:axes-required": "Informe ao menos um eixo.",
  "position:axis-duplicated": "Cada esquema aparece uma única vez.",
  "position:base-superseded": "A posição foi alterada por outra pessoa; recarregue.",
  "position:correction-reason-required": "Correção exige motivo.",
  "position:allocation-immutable": "Correção não troca a alocação.",
  "position:ambiguous-temporal-state": "A fonte tem estado temporal ambíguo; nada foi escolhido.",
  "position:session-required": "É preciso estar com sessão institucional.",
};
export function positionMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const key = Object.keys(MESSAGES).find((k) => text.includes(k));
  return key ? MESSAGES[key]! : text;
}

/**
 * Persistência real dos resultados oficiais da Pauta (Lovable Cloud).
 *
 * Mesmo padrão vertical do parecer: sessão → pessoa → atuação vigente →
 * política homologada → capacidade → função transacional → versão imutável.
 * O domínio continua decidindo o plano (`commitAssessmentEntryBatch`,
 * `rectifyAssessmentEntry`); o banco REVALIDA capacidade, versão-base de cada
 * resultado, natureza do valor e idempotência, e grava tudo ou nada.
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AssessmentEntryBatchAct } from "./assessment-entry-batch";
import type { AssessmentEntryVersion, AssessmentRectificationAct } from "./assessment-entry-versions";
import type { AssessmentInstrument, EntryValue } from "./assessment-types";
import type { AssessmentCorrectionPolicy } from "./assessment-correction";
import type { PeriodClosingRecord } from "./period-closing-types";
import { useInstitutionalRequest } from "./institutional-request";

export const REGISTER_RESULT_CAPABILITY = "registrar-resultado-avaliativo";
export const CONSULT_RESULT_CAPABILITY = "consultar-resultado-avaliativo";

export type ResultVersionRow = {
  id: string;
  logical_entry_id: string;
  version_number: number;
  supersedes_version_id: string | null;
  instrument_id: string;
  student_id: string;
  placement: unknown;
  value: unknown;
  value_label: string | null;
  origin: string;
  origin_metadata: unknown;
  rectification: unknown;
  batch_plan_id: string;
  authorizing_engagement_id: string;
  recorded_at: string;
};

export type BatchActRow = {
  id: string;
  plan_id: string;
  instrument_id: string;
  configuration_id: string | null;
  configuration_version: number | null;
  version_ids: string[];
  author_person_id: string;
  committed_at: string;
};

export function rowToVersion(r: ResultVersionRow): AssessmentEntryVersion {
  const meta = (r.origin_metadata ?? {}) as Record<string, string>;
  return {
    id: r.id,
    logicalEntryId: r.logical_entry_id,
    version: r.version_number,
    ...(r.supersedes_version_id ? { supersedesVersionId: r.supersedes_version_id } : {}),
    instrumentId: r.instrument_id,
    studentId: r.student_id,
    placement: (r.placement ?? {}) as AssessmentEntryVersion["placement"],
    value: r.value as EntryValue,
    ...(r.value_label ? { valueLabel: r.value_label } : {}),
    status: "registrado",
    recordedAt: r.recorded_at,
    recordedByAssignmentId: r.authorizing_engagement_id,
    origin: r.origin as AssessmentEntryVersion["origin"] & string,
    originMetadata: { ...meta, batchPlanId: r.batch_plan_id },
    ...(r.rectification ? { rectification: r.rectification as AssessmentRectificationAct } : {}),
  };
}

export function rowToAct(r: BatchActRow): AssessmentEntryBatchAct {
  return {
    planId: r.plan_id,
    instrumentId: r.instrument_id,
    committedAt: r.committed_at,
    agentId: r.author_person_id,
    configurationId: r.configuration_id ?? "",
    configurationVersion: r.configuration_version ?? 0,
    versionIds: r.version_ids,
  };
}

/** Operação enviada ao banco: a base esperada vem de `supersedesVersionId`. */
export function versionsToOperations(versions: readonly AssessmentEntryVersion[]) {
  return versions.map((v) => ({
    studentId: v.studentId,
    expectedBaseVersionId: v.supersedesVersionId ?? null,
    value: v.value,
    valueLabel: v.valueLabel ?? null,
    placement: v.placement,
    origin: v.origin ?? "diario",
    originMetadata: v.originMetadata ?? {},
    rectification: v.rectification ?? null,
  }));
}

const MESSAGES: Record<string, string> = {
  "not-authenticated": "Entre no SIGEM para registrar.",
  "capability-missing":
    "Sua atuação vigente não concede, pela política homologada, esta operação nesta turma. Nada foi gravado.",
  "facts-changed": "Um fato oficial usado na conferência mudou depois dela. Nada foi gravado; confira novamente.",
  "source-not-canonical": "Uma referência do retrato não é fato oficial da base institucional. Nada foi gravado.",
  "period-closed": "A frequência deste período está fechada oficialmente; mudança exige correção formal. Nada foi gravado.",
  "lesson-not-registered": "A aula ainda não tem registro oficial; conclua o registro antes da chamada. Nada foi gravado.",
  "invalid-mark": "Há marcação diferente de Presente ou Ausente. Nada foi gravado.",
  "empty-attendance": "Não há marcação a registrar. Nada foi gravado.",
  "mark-removal-not-admissible": "A correção não pode apagar marcação já registrada. Nada foi gravado.",
  "attendance-missing": "Há aula do período sem chamada oficial registrada. Nada foi gravado.",
  "record-required": "Falta o retrato do fechamento. Nada foi gravado.",
  "nothing-to-reopen": "Não há fechamento oficial a reabrir. Nada foi gravado.",
  "policy-not-homologated": "A política usada não está homologada na base institucional. Nada foi gravado.",
  "authority-not-declared": "A política homologada não declara quem pode realizar esta operação; ninguém a realiza. Nada foi gravado.",
  "change-not-admissible": "A regra homologada não admite alterar um dos aspectos modificados. Nada foi gravado.",
  "lesson-required": "Falta o registro de aula vinculado. Nada foi gravado.",
  "objective-not-in-matrix": "Um objetivo citado não existe na Matriz curricular. Nada foi gravado.",
  "plan-required": "Operação sem identificador de plano. Nada foi gravado.",
  "concurrent-change": "Um resultado mudou depois da conferência. Nada foi gravado; confira novamente.",
  "no-change": "Um resultado não mudou em relação à versão vigente. Nada foi gravado.",
  "missing-reason-required": "“Não registrado” exige motivo declarado. Nada foi gravado.",
  "rectification-act-required": "Correção sem ato de retificação. Nada foi gravado.",
  "invalid-value": "Um resultado tem valor inválido. Nada foi gravado.",
  "empty-batch": "Não há lançamentos a registrar.",
  "closing-changed": "O fechamento do período mudou depois da conferência. Nada foi gravado; confira novamente.",
  "closing-scope-ambiguous": "Há mais de um fechamento possível para este instrumento. Nada foi gravado.",
  "instrument-not-found": "Este instrumento não está cadastrado na base institucional. Nada foi gravado.",
  "correction-policy-missing": "Não há política de correção homologada aplicável. Nada foi gravado.",
  "correction-policy-ambiguous": "Mais de uma política de correção se aplica. Nada foi gravado.",
  "correction-policy-changed": "A política de correção mudou depois da conferência. Nada foi gravado; confira novamente.",
  "correction-forbidden": "A política homologada impede esta correção. Nada foi gravado.",
  "value-kind-not-admissible": "A política não admite esta natureza de resultado na correção. Nada foi gravado.",
  "requirement-unsatisfied": "Uma exigência da política de correção não foi atendida. Nada foi gravado.",
  "justification-required": "A política exige justificativa. Nada foi gravado.",
  "session-concluded": "Esta sessão já tem ata encerrada; a ata encerrada é imutável. Nada foi gravado.",
  "session-not-found": "Sessão não encontrada na base institucional. Nada foi gravado.",
  "minute-changed": "A ata mudou depois da conferência. Nada foi gravado; confira novamente.",
  "deliberation-changed": "As deliberações mudaram depois da conferência. Nada foi gravado; confira novamente.",
  "agenda-item-not-found": "O item de pauta não existe nesta sessão. Nada foi gravado.",
  "configuration-not-homologated": "O colegiado não tem configuração homologada nesta versão. Nada foi gravado.",
  "conduct-capability-undeclared": "A configuração homologada do colegiado não declara quem conduz a sessão. Nada foi gravado.",
  "standing-already-registered": "Já existe situação oficial registrada; mudança exige retificação justificada. Nada foi gravado.",
  "transition-not-admissible": "Esta operação não é admissível no estado atual. Nada foi gravado.",
  "rule-required": "Sem regra homologada e situação determinada não há registro. Nada foi gravado.",
  "scope-mismatch": "O escopo informado não corresponde ao registro. Nada foi gravado.",
  "aa:assignment-required": "O instrumento precisa nascer de uma atribuição docente sua. Nada foi gravado.",
  "aa:date-required": "Informe a data em que o instrumento foi aplicado. Nada foi gravado.",
  "aa:instrument-not-aa": "Instrumento antigo, sem atribuição docente: não recebe novos lançamentos. Nada foi gravado.",
  "aa:instrument-not-applied": "Registre a aplicação do instrumento antes de lançar resultados. Nada foi gravado.",
  "aa:student-not-allocated-on-date": "Há estudante que não estava na turma na data da aplicação. Nada foi gravado.",
  "aa:period-mismatch": "A data não pertence ao período informado do ano da turma. Nada foi gravado.",
  "aa:applied-outside-period": "A data de aplicação sai do período do instrumento. Nada foi gravado.",
  "aa:already-applied": "Este instrumento já foi aplicado. Nada foi gravado.",
  "aa:stale-head": "Outra pessoa alterou o instrumento; recarregue. Nada foi gravado.",
  "aa:reference-unknown": "Referência curricular inexistente. Nada foi gravado.",
  "diary:year-not-operational": "O ano letivo desta turma não está em operação. Nada foi gravado.",
  "diary:not-assignment-holder": "Esta turma não é da sua atribuição. Nada foi gravado.",
  "diary:assignment-not-effective": "Sua atribuição não está vigente nessa data. Nada foi gravado.",
  "diary:natural-person-required": "Só uma pessoa natural vinculada à conta pode lançar. Nada foi gravado.",
};

export function refusalMessage(raw: string): string {
  const code = Object.keys(MESSAGES).find((c) => raw.includes(c));
  return code ? MESSAGES[code]! : "Não foi possível registrar; nada foi gravado.";
}

export async function registerResultsInCloud(input: {
  instrumentId: string;
  planId: string;
  /** Fechamento vigente consultado na conferência; o banco relê e recusa se mudou. */
  expectedClosingId: string | null;
  configurationId?: string;
  configurationVersion?: number;
  versions: readonly AssessmentEntryVersion[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("register_assessment_results_v2", {
    _instrument: input.instrumentId,
    _expected_closing_id: input.expectedClosingId as string,
    _plan_id: input.planId,
    _configuration_id: input.configurationId ?? "",
    _configuration_version: input.configurationVersion ?? 0,
    _operations: versionsToOperations(input.versions) as never,
  });
  return error ? { ok: false, message: refusalMessage(error.message) } : { ok: true };
}

/** Aplicação do instrumento como ato registrado no banco, com data institucional explícita (AA). */
export async function applyInstrumentInCloud(instrumentId: string, expectedLastEventId: string | null, appliedOn?: string) {
  if (!appliedOn) return { ok: false as const, message: MESSAGES["aa:date-required"]! };
  const { error } = await supabase.rpc("apply_assessment_instrument_v2", {
    _instrument: instrumentId,
    _expected_last_event_id: expectedLastEventId as string,
    _applied_on: appliedOn,
  });
  return error ? { ok: false as const, message: refusalMessage(error.message) } : { ok: true as const };
}

/** AA: instrumento nasce só na própria atribuição canônica, com data prevista e referências Y opcionais. */
export async function createInstrumentInCloud(instrument: AssessmentInstrument, ctx?: { assignmentId: string; plannedOn: string; referenceItemIds?: readonly string[] }) {
  if (!ctx) return { ok: false as const, message: MESSAGES["aa:assignment-required"]! };
  const { error } = await supabase.rpc("create_assessment_instrument_v2", {
    _id: instrument.id,
    _assignment: ctx.assignmentId,
    _period: instrument.periodId,
    _instrument_type: instrument.instrumentTypeId,
    _definition: instrument as never,
    _planned_on: ctx.plannedOn,
    _references: [...(ctx.referenceItemIds ?? [])],
  });
  return error ? { ok: false as const, message: refusalMessage(error.message) } : { ok: true as const };
}

type ClosingRow = { id: string; preceding_closing_id: string | null; version_number: number; record: unknown };

/** Versão persistida → `PeriodClosingRecord` com a identidade do banco. */
export function rowToClosing(r: ClosingRow): PeriodClosingRecord {
  const record = r.record as PeriodClosingRecord;
  return {
    ...record,
    id: r.id,
    version: r.version_number,
    ...(r.preceding_closing_id ? { precedingClosingId: r.preceding_closing_id } : {}),
  };
}

type PolicyRow = { logical_policy_id: string; version: number; definition: unknown };
export function rowToCorrectionPolicy(r: PolicyRow): AssessmentCorrectionPolicy {
  return { ...(r.definition as AssessmentCorrectionPolicy), id: r.logical_policy_id, version: r.version, homologated: true };
}

/** Fatos da Pauta lidos do banco: instrumento, versões, atos, fechamentos e políticas. */
export function useCloudPautaFacts(instrumentId: string, classId: string, enabled: boolean) {
  const key = JSON.stringify([enabled, classId, instrumentId]);
  const load = useCallback(async () => {
    const [i, c, p, st, v, a] = await Promise.all([
      supabase.from("assessment_instruments").select("id, class_id, definition").eq("id", instrumentId).maybeSingle(),
      supabase.from("period_closing_versions").select("id, preceding_closing_id, version_number, record").eq("class_id", classId),
      supabase.from("assessment_correction_policies").select("logical_policy_id, version, definition"),
      supabase
        .from("assessment_instrument_status_events")
        .select("id, status")
        .eq("instrument_id", instrumentId)
        .order("sequence", { ascending: false })
        .limit(1),
      supabase.from("assessment_entry_versions").select("*").eq("instrument_id", instrumentId).order("version_number"),
      supabase.from("assessment_entry_batch_acts").select("*").eq("instrument_id", instrumentId),
    ]);
    const error = i.error ?? c.error ?? p.error ?? st.error ?? v.error ?? a.error;
    if (error) throw new Error(error.message);
    const definition = i.data?.definition as AssessmentInstrument | undefined;
    if (i.data && (i.data.id !== instrumentId || i.data.class_id !== classId ||
        definition?.id !== instrumentId || definition.classId !== classId))
      throw new Error("O instrumento retornado não pertence ao contexto solicitado.");
    if (((v.data ?? []) as ResultVersionRow[]).some((row) => row.instrument_id !== instrumentId) ||
        ((a.data ?? []) as BatchActRow[]).some((row) => row.instrument_id !== instrumentId))
      throw new Error("Os resultados retornados não pertencem ao instrumento solicitado.");
    // Status vigente = último ato registrado; a definição é só o cadastro.
    const lastStatus = st.data?.[0];
    return {
      lastStatusEventId: lastStatus?.id ?? null,
      ...(definition
        ? {
            instrument: {
              ...definition,
              status: (lastStatus?.status === "aplicado" ? "aplicado" : "planejado") as NonNullable<AssessmentInstrument["status"]>,
            },
          }
        : {}),
      closings: ((c.data ?? []) as ClosingRow[]).map(rowToClosing),
      policies: ((p.data ?? []) as PolicyRow[]).map(rowToCorrectionPolicy),
      versions: ((v.data ?? []) as ResultVersionRow[]).map(rowToVersion),
      acts: ((a.data ?? []) as BatchActRow[]).map(rowToAct),
    };
  }, [instrumentId, classId]);
  const request = useInstitutionalRequest(key, enabled, load);
  return {
    ready: request.ready,
    ...(request.error ? { error: request.error } : {}),
    instrument: request.value?.instrument,
    lastStatusEventId: request.value?.lastStatusEventId ?? null,
    closings: request.value?.closings ?? [],
    policies: request.value?.policies ?? [],
    versions: request.value?.versions ?? [],
    acts: request.value?.acts ?? [],
    refresh: request.refresh,
  };
}

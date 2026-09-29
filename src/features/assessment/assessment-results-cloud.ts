/**
 * Persistência real dos resultados oficiais da Pauta (Lovable Cloud).
 *
 * Mesmo padrão vertical do parecer: sessão → pessoa → atuação vigente →
 * política homologada → capacidade → função transacional → versão imutável.
 * O domínio continua decidindo o plano (`commitAssessmentEntryBatch`,
 * `rectifyAssessmentEntry`); o banco REVALIDA capacidade, versão-base de cada
 * resultado, natureza do valor e idempotência, e grava tudo ou nada.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AssessmentEntryBatchAct } from "./assessment-entry-batch";
import type { AssessmentEntryVersion, AssessmentRectificationAct } from "./assessment-entry-versions";
import type { AssessmentInstrument, EntryValue } from "./assessment-types";
import type { AssessmentCorrectionPolicy } from "./assessment-correction";
import type { PeriodClosingRecord } from "./period-closing-types";

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
    "Sua atuação vigente não concede, pela política homologada, o registro de resultados nesta turma. Nada foi gravado.",
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
  const { error } = await supabase.rpc("register_assessment_results", {
    _instrument: input.instrumentId,
    _expected_closing_id: input.expectedClosingId as string,
    _plan_id: input.planId,
    _configuration_id: input.configurationId ?? "",
    _configuration_version: input.configurationVersion ?? 0,
    _operations: versionsToOperations(input.versions) as never,
  });
  return error ? { ok: false, message: refusalMessage(error.message) } : { ok: true };
}

export async function createInstrumentInCloud(instrument: AssessmentInstrument) {
  const { error } = await supabase.rpc("create_assessment_instrument", {
    _id: instrument.id,
    _class: instrument.classId,
    _period: instrument.periodId,
    _instrument_type: instrument.instrumentTypeId,
    _definition: instrument as never,
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
  const facts = useCloudInstrumentFacts(instrumentId, enabled);
  const [extra, setExtra] = useState<{
    ready: boolean;
    instrument?: AssessmentInstrument;
    closings: PeriodClosingRecord[];
    policies: AssessmentCorrectionPolicy[];
  }>({ ready: false, closings: [], policies: [] });
  const refreshExtra = useCallback(async () => {
    if (!enabled) return;
    const [i, c, p] = await Promise.all([
      supabase.from("assessment_instruments").select("definition").eq("id", instrumentId).maybeSingle(),
      supabase.from("period_closing_versions").select("id, preceding_closing_id, version_number, record").eq("class_id", classId),
      supabase.from("assessment_correction_policies").select("logical_policy_id, version, definition"),
    ]);
    setExtra({
      ready: true,
      ...(i.data ? { instrument: i.data.definition as unknown as AssessmentInstrument } : {}),
      closings: ((c.data ?? []) as ClosingRow[]).map(rowToClosing),
      policies: ((p.data ?? []) as PolicyRow[]).map(rowToCorrectionPolicy),
    });
  }, [instrumentId, classId, enabled]);
  useEffect(() => {
    void refreshExtra();
  }, [refreshExtra]);
  const refresh = useCallback(async () => {
    await Promise.all([facts.refresh(), refreshExtra()]);
  }, [facts, refreshExtra]);
  return { ...facts, ...extra, ready: facts.ready && extra.ready, refresh };
}

/**
 * Fatos oficiais do instrumento lidos do banco. Quando ativa, esta é a ÚNICA
 * fonte: a tela não consulta cópia local concorrente.
 */
export function useCloudInstrumentFacts(instrumentId: string, enabled: boolean) {
  const [state, setState] = useState<{
    ready: boolean;
    versions: AssessmentEntryVersion[];
    acts: AssessmentEntryBatchAct[];
    error?: string;
  }>({ ready: false, versions: [], acts: [] });

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const [v, a] = await Promise.all([
      supabase.from("assessment_entry_versions").select("*").eq("instrument_id", instrumentId).order("version_number"),
      supabase.from("assessment_entry_batch_acts").select("*").eq("instrument_id", instrumentId),
    ]);
    if (v.error || a.error) {
      setState((s) => ({ ...s, ready: true, error: (v.error ?? a.error)!.message }));
      return;
    }
    setState({
      ready: true,
      versions: (v.data as ResultVersionRow[]).map(rowToVersion),
      acts: (a.data as BatchActRow[]).map(rowToAct),
    });
  }, [instrumentId, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}

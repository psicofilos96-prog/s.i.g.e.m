/**
 * 6D.FINAL.1 — Fonte ÚNICA de regra e configuração avaliativa.
 *
 * Pauta, Mesa, Fechamento, Consolidação e Situação leem regra/configuração
 * apenas por aqui:
 * - com sessão: `assessment_norm_versions` (append-only, homologada por ato,
 *   versão encadeada, vigência explícita) + linha institucional B2.4 da turma;
 * - sem sessão: o laboratório em memória, explicitamente separado.
 *
 * Com sessão, ausência de norma homologada = indisponibilidade. Nunca há queda
 * para fixture, store do navegador ou regra de laboratório.
 */
import { isCivilDate } from "@/features/academic/academic-reference-date";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionAuthority, type SessionAuthority } from "@/features/authority/session-authority";
import { teachingClass } from "@/features/diary/institutional-teaching";
import { loadOfficialTimelineForClass, type OfficialTimelineResult } from "@/features/academic/institutional-period-source";
import type { AcademicYear } from "@/features/academic/academic-structure";
import { classConfigurationState, configurationState, type ConfigurationState } from "./assessment-configuration";
import { adoptCycleNomenclature } from "./assessment-rule-model";
import { useAssessmentRules } from "./assessment-rule-store";
import type { InstitutionalAssessmentRule } from "./assessment-rule-types";
import type { AssessmentConfiguration, AssessmentPeriodStructure } from "./assessment-types";
import { useInstitutionalRequest } from "./institutional-request";

export type NormVersionRow = {
  id: string;
  norm_kind: "regra-avaliativa" | "configuracao-avaliativa" | string;
  logical_id: string;
  version: number;
  supersedes_id: string | null;
  academic_year_id: string;
  stage_ids: string[];
  class_ids: string[];
  valid_from: string | null;
  valid_until: string | null;
  definition: unknown;
  homologation_act_ref: string;
  recorded_at: string;
};
export type NormativeSource = {
  /** "sessao-pendente": autenticação ainda incerta — nem laboratório nem banco (B4.6.2b.1). */
  origin: "banco" | "laboratorio" | "sessao-pendente";
  ready: boolean;
  error?: string;
  state: ConfigurationState;
  /** Regras disponíveis (com sessão: só versões homologadas persistidas). */
  rules: InstitutionalAssessmentRule[];
  /** Arquivo histórico: todas as versões (identidade + versão exatas do ato). */
  ruleVersions: InstitutionalAssessmentRule[];
  /** 6D.FINAL.5 — regras de situação acadêmica homologadas vigentes (definição do domínio). */
  standingRuleSets: unknown[];
};

const inForce = (r: NormVersionRow, date: string | undefined) =>
  !date || ((!r.valid_from || r.valid_from <= date) && (!r.valid_until || r.valid_until >= date));

/** Cadeia → versão vigente de cada identidade lógica (maior versão). Nada persistido. */
export function currentNormVersions(rows: readonly NormVersionRow[], kind: string): NormVersionRow[] {
  const byLogical = new Map<string, NormVersionRow>();
  for (const r of rows) {
    if (r.norm_kind !== kind) continue;
    const prev = byLogical.get(r.logical_id);
    if (!prev || r.version > prev.version) byLogical.set(r.logical_id, r);
  }
  return [...byLogical.values()];
}

/** Regra persistida → regra do domínio; status vem do fato de estar homologada no banco. */
export function ruleFromNormRow(r: NormVersionRow): InstitutionalAssessmentRule {
  const def = adoptCycleNomenclature(r.definition as InstitutionalAssessmentRule);
  return {
    ...def,
    id: r.logical_id,
    version: r.version,
    status: "homologada",
    scope: { ...def.scope, academicYearId: r.academic_year_id, stageIds: r.stage_ids, ...(r.class_ids.length ? { classIds: r.class_ids } : {}) },
    ...(r.valid_from ? { validFrom: r.valid_from } : {}),
    ...(r.valid_until ? { validUntil: r.valid_until } : {}),
  };
}

/**
 * Monta o estado de configuração a partir SOMENTE das linhas do banco.
 * Configuração por turma prevalece; por etapa só se única; nada ⇒ inexistente.
 */
export function normativeStateFromRows(args: {
  classId: string;
  stageId: string | undefined;
  academicYearId: string | undefined;
  rows: readonly NormVersionRow[];
  timeline: OfficialTimelineResult;
  date?: string;
}): { state: ConfigurationState; rules: InstitutionalAssessmentRule[]; ruleVersions: InstitutionalAssessmentRule[] } {
  const { classId, stageId, academicYearId } = args;
  const inYear = args.rows.filter((r) => r.academic_year_id === academicYearId);
  const rules = currentNormVersions(inYear, "regra-avaliativa").filter((r) => inForce(r, args.date)).map(ruleFromNormRow);
  const ruleVersions = inYear.filter((r) => r.norm_kind === "regra-avaliativa").map(ruleFromNormRow);
  if (!academicYearId) return { state: { kind: "erro", reason: "Turma sem ano letivo identificado." }, rules, ruleVersions };
  const configs = currentNormVersions(inYear, "configuracao-avaliativa").filter((r) => inForce(r, args.date));
  const byClass = configs.filter((c) => c.class_ids.includes(classId));
  const byStage = stageId ? configs.filter((c) => c.class_ids.length === 0 && c.stage_ids.includes(stageId)) : [];
  const chosen = byClass.length === 1 ? byClass[0] : byClass.length === 0 && byStage.length === 1 ? byStage[0] : undefined;
  if (!chosen)
    return {
      state: {
        kind: "inexistente",
        reason:
          byClass.length > 1 || byStage.length > 1
            ? "Mais de uma configuração avaliativa homologada é aplicável; decisão institucional necessária."
            : "Não existe configuração avaliativa homologada registrada para esta turma.",
      },
      rules,
      ruleVersions,
    };
  if (args.timeline.kind !== "ready")
    return { state: { kind: "inexistente", reason: args.timeline.reason }, rules, ruleVersions };
  const { year: officialYear, organization, periods } = args.timeline;
  if (officialYear.id !== academicYearId || periods.length === 0)
    return { state: { kind: "inexistente", reason: "Organização ou períodos oficiais indisponíveis para esta turma." }, rules, ruleVersions };
  const structureId = organization.id;
  const def = chosen.definition as AssessmentConfiguration;
  const configuration: AssessmentConfiguration = {
    ...def,
    id: chosen.logical_id,
    version: chosen.version,
    academicYearId,
    periodStructureId: structureId,
    normativeStatus: "homologado",
  };
  const structure: AssessmentPeriodStructure = {
    id: structureId,
    academicYearId,
    label: organization.label,
    normativeStatus: "homologado",
    provenance: args.timeline.provenance,
    periods: periods.map((p, i) => ({
      id: p.id, structureId, academicYearId, sequence: i + 1, label: p.label, start: p.starts_on, end: p.ends_on,
    })),
  };
  const year: AcademicYear = {
    id: academicYearId,
    label: officialYear.label,
    validity: { start: officialYear.startsOn, end: officialYear.endsOn },
    calendarId: "",
    normativeStatus: "homologado",
  };
  return { state: configurationState({ configuration, structures: [structure], years: [year] }), rules, ruleVersions };
}

const LOADING: ConfigurationState = { kind: "inexistente", reason: "Carregando normas avaliativas homologadas." };
/** Estado de carregamento da sessão: nunca configuração do laboratório. */
export const SESSION_PENDING_STATE: ConfigurationState = { kind: "inexistente", reason: "Verificando sessão. Nenhuma configuração é exibida antes da confirmação." };

/** Hook único. `cloud` vem de `useSessionAuthority().status === "signed-in"`. */
export function useAssessmentNormativeSource(args: {
  classId: string;
  cloud: boolean;
  stageId?: string | undefined;
  academicYearId?: string | undefined;
  academicYearLabel?: string | undefined;
  academicDate?: string | undefined;
  /** Sessão ainda incerta: devolve carregamento, sem laboratório e sem requisição. */
  pending?: boolean;
  /** Identidade da sessão na chave: troca de conta nunca reaproveita resultado anterior. */
  userId?: string | undefined;
}): NormativeSource {
  const { classId, cloud, stageId, academicYearId, academicDate, pending, userId } = args;
  const labRules = useAssessmentRules();
  const key = JSON.stringify([cloud, userId ?? null, classId, academicYearId, academicDate]);
  const load = useCallback(async () => {
    const [n, timeline] = await Promise.all([
      academicYearId
        ? supabase.from("assessment_norm_versions").select("*").eq("academic_year_id", academicYearId)
        : Promise.resolve({ data: [], error: null }),
      loadOfficialTimelineForClass(classId, academicYearId, academicDate),
    ]);
    return { error: n.error?.message, rows: (n.data ?? []) as NormVersionRow[], timeline };
  }, [classId, academicYearId, academicDate]);
  const request = useInstitutionalRequest(key, cloud && !pending, load);

  if (pending) return { origin: "sessao-pendente", ready: false, state: SESSION_PENDING_STATE, rules: [], ruleVersions: [], standingRuleSets: [] };

  if (!cloud) return { origin: "laboratorio", ready: true, state: classConfigurationState(classId), rules: labRules, ruleVersions: labRules, standingRuleSets: [] };
  if (!request.ready) return { origin: "banco", ready: false, state: LOADING, rules: [], ruleVersions: [], standingRuleSets: [] };
  const db = request.value;
  const error = request.error ?? db?.error;
  if (error) return { origin: "banco", ready: true, error, state: { kind: "erro", reason: "Não foi possível ler as normas avaliativas homologadas." }, rules: [], ruleVersions: [], standingRuleSets: [] };
  if (!db) return { origin: "banco", ready: false, state: LOADING, rules: [], ruleVersions: [], standingRuleSets: [] };
  const built = normativeStateFromRows({
    classId, stageId, academicYearId, rows: db.rows, timeline: db.timeline,
    ...(academicDate ? { date: academicDate } : {}),
  });
  return { origin: "banco", ready: true, ...built, standingRuleSets: standingRuleSetsFromRows(db.rows, academicYearId, academicDate) };
}

/**
 * Patch 4b — argumentos de sessão da fonte normativa a partir do MESMO snapshot de autoridade que
 * a tela usa. `loading` ⇒ pending (nem laboratório nem requisição); só `signed-out` confirmado escolhe
 * laboratório; `signed-in` leva `userId` à chave.
 */
export function normativeSessionArgs(a: SessionAuthority): { cloud: boolean; pending: boolean; userId?: string } {
  if (a.status === "signed-in") return { cloud: true, pending: false, userId: a.user.id };
  return { cloud: false, pending: a.status === "loading" };
}

/** Conveniência: estado da configuração da turma pela fonte única (sessão decide). */
export function useClassConfigurationState(classId: string, academicDate?: string): ConfigurationState {
  const authority = useSessionAuthority();
  const { cloud, pending, userId } = normativeSessionArgs(authority);
  // Sessão incerta: não consulta a turma (laboratório) nem escolhe configuração; ordem dos hooks preservada.
  const klass = pending ? undefined : teachingClass(classId);
  return useAssessmentNormativeSource({ classId, cloud, pending, userId, stageId: klass?.stageId ?? undefined, academicYearId: klass?.academicYearId, academicDate }).state;
}

/** Regra de situação persistida → definição do domínio, com identidade/versão da cadeia. */
export function standingRuleSetsFromRows(rows: readonly NormVersionRow[], academicYearId: string | undefined, date?: string) {
  return currentNormVersions(rows.filter((r) => r.academic_year_id === academicYearId), "regra-de-situacao-academica")
    .filter((r) => inForce(r, date))
    .map((r) => ({ ...(r.definition as object), id: r.logical_id, version: r.version, status: "homologada" }));
}

export type AttendancePolicyRow = {
  id: string; version: number; status: string; definition: unknown;
  homologation_act_ref: string | null; valid_from: string | null; valid_until: string | null;
};

/** Política de frequência aplicável: homologada, vigente, versão mais recente; nenhuma ou várias ⇒ indisponível. */
export function applicableAttendancePolicies(rows: readonly AttendancePolicyRow[], date?: string) {
  const latest = new Map<string, AttendancePolicyRow>();
  for (const r of rows) {
    if (r.status !== "homologada" || !r.homologation_act_ref) continue;
    const prev = latest.get(r.id);
    if (!prev || r.version > prev.version) latest.set(r.id, r);
  }
  return [...latest.values()]
    .filter((r) => !date || ((!r.valid_from || r.valid_from <= date) && (!r.valid_until || r.valid_until >= date)))
    .map((r) => ({ ...(r.definition as object), id: r.id, version: r.version, status: "homologada" }));
}

/**
 * B4.6.2b.3 — fonte da política de frequência com o MESMO contexto de autoridade da tela.
 * Chave = sessão (cloud/pending/userId) + data de referência; resposta antiga (troca de conta, data,
 * unmount) é descartada por `useInstitutionalRequest`; erro de leitura é erro, nunca "sem política".
 * Sessão pendente ou data ausente com sessão ⇒ nenhuma requisição e não pronto.
 */
export function useAttendancePolicySource<T>(args: {
  cloud: boolean;
  pending?: boolean;
  userId?: string | undefined;
  date: string | undefined;
}): { ready: boolean; error?: string; policies: T[] } {
  const { cloud, pending, userId, date } = args;
  const enabled = cloud && !pending && isCivilDate(date);
  const key = JSON.stringify(["attendance-policies", userId ?? null, date ?? null]);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("attendance_calculation_policies").select("*");
    if (error) throw new Error(error.message);
    return (data ?? []) as AttendancePolicyRow[];
  }, []);
  const request = useInstitutionalRequest(key, enabled, load);
  if (!enabled) return { ready: false, policies: [] };
  if (!request.ready) return { ready: false, policies: [] };
  if (request.error) return { ready: true, error: request.error, policies: [] };
  return { ready: true, policies: applicableAttendancePolicies(request.value ?? [], date) as T[] };
}

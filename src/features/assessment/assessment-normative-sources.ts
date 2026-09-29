/**
 * 6D.FINAL.1 — Fonte ÚNICA de regra e configuração avaliativa.
 *
 * Pauta, Mesa, Fechamento, Consolidação e Situação leem regra/configuração
 * apenas por aqui:
 * - com sessão: `assessment_norm_versions` (append-only, homologada por ato,
 *   versão encadeada, vigência explícita) + `institutional_academic_periods`;
 * - sem sessão: o laboratório em memória, explicitamente separado.
 *
 * Com sessão, ausência de norma homologada = indisponibilidade. Nunca há queda
 * para fixture, store do navegador ou regra de laboratório.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AcademicYear } from "@/features/academic/academic-structure";
import { classConfigurationState, configurationState, type ConfigurationState } from "./assessment-configuration";
import { adoptCycleNomenclature } from "./assessment-rule-model";
import { useAssessmentRules } from "./assessment-rule-store";
import type { InstitutionalAssessmentRule } from "./assessment-rule-types";
import type { AssessmentConfiguration, AssessmentPeriodStructure } from "./assessment-types";

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
export type PeriodRow = { id: string; label: string; starts_on: string; ends_on: string };

export type NormativeSource = {
  origin: "banco" | "laboratorio";
  ready: boolean;
  error?: string;
  state: ConfigurationState;
  /** Regras disponíveis (com sessão: só versões homologadas persistidas). */
  rules: InstitutionalAssessmentRule[];
  /** Arquivo histórico: todas as versões (identidade + versão exatas do ato). */
  ruleVersions: InstitutionalAssessmentRule[];
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
  academicYearLabel?: string;
  rows: readonly NormVersionRow[];
  periods: readonly PeriodRow[];
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
  const periods = [...args.periods].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  if (periods.length === 0)
    return { state: { kind: "inexistente", reason: "Não há períodos oficiais registrados para o ano letivo desta turma." }, rules, ruleVersions };
  const structureId = `estrutura-institucional-${academicYearId}`;
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
    label: "Períodos oficiais",
    normativeStatus: "homologado",
    periods: periods.map((p, i) => ({
      id: p.id, structureId, academicYearId, sequence: i + 1, label: p.label, start: p.starts_on, end: p.ends_on,
    })),
  };
  const year: AcademicYear = {
    id: academicYearId,
    label: args.academicYearLabel ?? academicYearId,
    civilYear: Number(periods[0]!.starts_on.slice(0, 4)),
    validity: { start: periods[0]!.starts_on, end: periods[periods.length - 1]!.ends_on },
    calendarId: "",
    normativeStatus: "homologado",
  };
  return { state: configurationState({ configuration, structures: [structure], years: [year] }), rules, ruleVersions };
}

const LOADING: ConfigurationState = { kind: "inexistente", reason: "Carregando normas avaliativas homologadas." };

/** Hook único. `cloud` vem de `useSessionAuthority().status === "signed-in"`. */
export function useAssessmentNormativeSource(args: {
  classId: string;
  cloud: boolean;
  stageId?: string | undefined;
  academicYearId?: string | undefined;
  academicYearLabel?: string | undefined;
}): NormativeSource {
  const { classId, cloud, stageId, academicYearId, academicYearLabel } = args;
  const labRules = useAssessmentRules();
  const [db, setDb] = useState<{ ready: boolean; error?: string; rows: NormVersionRow[]; periods: PeriodRow[] }>({ ready: false, rows: [], periods: [] });
  const load = useCallback(async () => {
    if (!cloud) return;
    const ruleVersions = inYear.filter((r) => r.norm_kind === "regra-avaliativa").map(ruleFromNormRow);
  if (!academicYearId) return setDb({ ready: true, rows: [], periods: [] });
    const [n, p] = await Promise.all([
      supabase.from("assessment_norm_versions").select("*").eq("academic_year_id", academicYearId),
      supabase.from("institutional_academic_periods").select("id, label, starts_on, ends_on").eq("academic_year_id", academicYearId),
    ]);
    const err = n.error ?? p.error;
    if (err) return setDb({ ready: true, error: err.message, rows: [], periods: [] });
    setDb({ ready: true, rows: (n.data ?? []) as NormVersionRow[], periods: (p.data ?? []) as PeriodRow[] });
  }, [cloud, academicYearId]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!cloud) return { origin: "laboratorio", ready: true, state: classConfigurationState(classId), rules: labRules, ruleVersions: labRules };
  if (!db.ready) return { origin: "banco", ready: false, state: LOADING, rules: [], ruleVersions: [] };
  if (db.error) return { origin: "banco", ready: true, error: db.error, state: { kind: "erro", reason: "Não foi possível ler as normas avaliativas homologadas." }, rules: [], ruleVersions: [] };
  const built = normativeStateFromRows({
    classId, stageId, academicYearId, rows: db.rows, periods: db.periods,
    ...(academicYearLabel ? { academicYearLabel } : {}),
  });
  return { origin: "banco", ready: true, ...built };
}

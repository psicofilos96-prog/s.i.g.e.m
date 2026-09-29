import { teachingClass } from "@/features/diary/institutional-teaching";
/**
 * 6D.3.3.6/7 — Página da Mesa Avaliativa do Período.
 * Só composição: fontes, regra, modelo e períodos vêm de `assessment-period-sources`
 * (as mesmas da Pauta e do Fechamento); ações vêm das capacidades da atuação.
 * A Mesa NÃO grava nada: corrigir é sempre o rito oficial da Pauta.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/sigem/patterns";
import { classStage } from "@/features/academic/academic-structure";
import { DiaryHeader } from "@/features/diary/diary-context";
import { DEFAULT_DIARY_PROFESSIONAL_ID, diaryContext, diarySearch, type DiarySearch } from "@/features/diary/diary-data";
import { sessionActor, useSessionAuthority } from "@/features/authority/session-authority";
import { formatAcademicDate } from "@/lib/academic-date";
import { classConfigurationState } from "./assessment-configuration";
import { usePeriodClosingStore } from "./period-closing-store";
import { useInstrumentStore } from "./assessment-instrument-store";
import { useAssessmentRules } from "./assessment-rule-store";
import { curriculumRefOf } from "./assessment-rules";
import { FIELD_MISSING_ENTRY_POLICY, fieldVersionStore, useFieldVersionTick } from "./assessment-entry-field-config";
import { CONSULT_RESULT_CAPABILITY, REGISTER_RESULT_CAPABILITY } from "./assessment-results-cloud";
import { projectAssessmentPeriod, type PeriodActionDefinition } from "./assessment-period-projection";
import { AssessmentPeriodWorkspace } from "./assessment-period-workspace";
import {
  applicableAssessmentRule,
  assessmentDeskApplicability,
  classEntryRoster,
  isFieldLabInstrument,
  periodModelFromRule,
  periodRuleReference,
  useCloudPeriodFacts,
  type OfficialPeriod,
} from "./assessment-period-sources";

/** Estado de navegação: chaves sem valor saem da URL. */
export function withoutUndefined(s: Record<string, string | undefined>): DiarySearch {
  return Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as DiarySearch;
}

/**
 * Ações declaradas com capacidade exigida; o projetor não conhece verbos.
 * "Corrigir na pauta" só ENCAMINHA ao rito oficial da Pauta (nenhuma gravação aqui).
 */
export const PERIOD_ACTIONS: readonly PeriodActionDefinition[] = [
  { actionId: "abrir-pauta", label: "Abrir pauta", target: "instrument", requiredCapabilities: [REGISTER_RESULT_CAPABILITY] },
  {
    actionId: "corrigir",
    label: "Corrigir na pauta",
    target: "result",
    requiredCapabilities: [REGISTER_RESULT_CAPABILITY],
    admissibleCellStates: ["recorded", "explicitly-unrecorded"],
  },
];
/** Sem sessão: perfil demonstrativo declarado, nunca usado com login. */
export const LAB_DEMO_CAPABILITIES = [REGISTER_RESULT_CAPABILITY, CONSULT_RESULT_CAPABILITY] as const;

export function AssessmentPeriodPage({ classId, search }: { classId: string; search: DiarySearch }) {
  const store = useInstrumentStore();
  usePeriodClosingStore();
  const tick = useFieldVersionTick();
  const rules = useAssessmentRules();
  const authority = useSessionAuthority();
  const cloud = authority.status === "signed-in";
  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data);
  const item = context.assignments.find((a) => a.classId === classId);
  const classSearch = diarySearch(search, {
    professor: context.professionalId,
    turma: classId,
    ...(item ? { unidade: item.unitId, componente: item.field } : {}),
  });
  const klass = teachingClass(classId);
  const state = classConfigurationState(classId);
  const configuration = "configuration" in state ? state.configuration : undefined;
  const academicYearId = "year" in state ? state.year.id : klass?.academicYearId;
  const cloudFacts = useCloudPeriodFacts(classId, klass?.academicYearId, cloud);

  // Instrumentos e períodos: banco com sessão; laboratório sem sessão.
  const all = cloud ? cloudFacts.instruments : store.instrumentsForClass(classId);
  const periods: OfficialPeriod[] = cloud
    ? cloudFacts.periods
    : "structure" in state
      ? state.structure.periods.slice().sort((a, b) => a.sequence - b.sequence).map((p) => ({ id: p.id, label: p.label, start: p.start, end: p.end }))
      : [];
  const navigate = useNavigate();
  const periodId = search.periodo && periods.some((p) => p.id === search.periodo) ? search.periodo : (periods[0]?.id ?? "");
  const period = periods.find((p) => p.id === periodId);
  const query = search.periodo === periodId ? (search.q ?? "") : "";
  const setNav = (changes: { periodo?: string; q?: string | undefined }) =>
    void navigate({
      to: "/diario/turmas/$turmaId/avaliacao/periodo",
      params: { turmaId: classId },
      search: withoutUndefined({ ...search, ...changes }),
      replace: true,
    });
  const [correcting, setCorrecting] = useState<{ studentId: string; instrumentId: string } | null>(null);
  const periodInstruments = all.filter((i) => i.periodId === periodId);
  const isLab = !cloud && all.some((i) => isFieldLabInstrument(i.id));
  const students = useMemo(() => classEntryRoster(classId, isLab), [classId, isLab]);

  // Regra/modelo: mesmo caminho do Fechamento. Com sessão não há regra na base
  // institucional ⇒ resultado indisponível (nunca fixture do laboratório).
  const rule = cloud || !academicYearId ? undefined : applicableAssessmentRule(rules, academicYearId, classStage(classId)?.id, classId);
  const model = periodModelFromRule(rule);
  const ruleRef = periodRuleReference(rule);

  const actor = cloud ? sessionActor(authority, periodId ? { classId, periodId } : { classId }) : null;
  const capabilities: readonly string[] = cloud ? (actor?.capabilities ?? []) : LAB_DEMO_CAPABILITIES;
  const agent = { agentId: actor?.id ?? context.professionalId, capabilities };
  const canRead = capabilities.includes(CONSULT_RESULT_CAPABILITY) || capabilities.includes(REGISTER_RESULT_CAPABILITY);
  const versions = cloud
    ? cloudFacts.versions.filter((v) => periodInstruments.some((i) => i.id === v.instrumentId))
    : periodInstruments.flatMap((i) => fieldVersionStore.versions(i.id));
  const componentId = item ? (curriculumRefOf(item.record) as { componentId?: string }).componentId : undefined;

  const projection = useMemo(
    () =>
      projectAssessmentPeriod({
        context: {
          classId,
          ...(klass ? { classLabel: klass.name } : {}),
          ...(item?.field ? { componentLabel: item.field } : {}),
          ...(componentId ? { componentId } : {}),
        },
        period: period ? { id: period.id, label: period.label } : undefined,
        configuration,
        compositionModel: model,
        instruments: all,
        students,
        versions,
        missingEntryPolicy: FIELD_MISSING_ENTRY_POLICY,
        agent,
        actionDefinitions: PERIOD_ACTIONS,
        valueReadCapability: CONSULT_RESULT_CAPABILITY,
        ...(ruleRef ? { rule: ruleRef } : {}),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, periodId, configuration, students, all, versions.length, model, capabilities.join(",")],
  );

  const back = (
    <Button asChild variant="outline" size="sm">
      <Link to="/diario/turmas/$turmaId/avaliacao" params={{ turmaId: classId }} search={classSearch}>
        <ArrowLeft /> Avaliação da turma
      </Link>
    </Button>
  );
  const header = (
    <DiaryHeader title="Avaliação do período" description={[klass?.name, item?.field, period?.label].filter(Boolean).join(" · ")} context={context}>
      {back}
    </DiaryHeader>
  );
  const pautaLink = (instrumentId: string, label: string, q?: string) => (
    <Button asChild size="sm">
      <Link
        to="/diario/turmas/$turmaId/avaliacao/pauta/$instrumentoId"
        params={{ turmaId: classId, instrumentoId: instrumentId }}
        search={withoutUndefined({ ...classSearch, periodo: periodId, q: q || undefined })}
      >
        {label}
      </Link>
    </Button>
  );

  if (!klass) return <StatePanel tone="danger" title="Turma não encontrada" description="Esta turma não está disponível para você." />;
  const applicability = assessmentDeskApplicability(klass);
  if (!applicability.applicable)
    return <div className="space-y-6">{header}<StatePanel tone="info" title="Avaliação do período não se aplica" description={applicability.reason} /></div>;
  if (cloud && !canRead)
    return <div className="space-y-6">{header}<StatePanel tone="warning" title="Consulta não autorizada" description="Sua atuação vigente não concede, pela política homologada, consulta aos resultados desta turma neste período." /></div>;
  if (cloud && !cloudFacts.ready)
    return <div className="space-y-6">{header}<StatePanel tone="info" title="Carregando" description="Lendo os registros oficiais da turma." /></div>;
  if (cloud && cloudFacts.error)
    return <div className="space-y-6">{header}<StatePanel tone="danger" title="Registros indisponíveis" description="Não foi possível ler os registros oficiais agora. Nada foi alterado." /></div>;

  return (
    <div className="space-y-6">
      {header}
      <p className="text-sm text-muted-foreground">
        Acompanhe os registros da turma. Lançamentos e correções acontecem sempre na pauta do instrumento.
      </p>
      {cloud && !rule && (
        <StatePanel tone="info" title="Resultado do período indisponível" description="Não há regra de avaliação homologada disponível na base institucional para esta turma. Os registros aparecem, mas nenhuma composição é calculada." />
      )}
      {periods.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span>Período:</span>
          <select className="min-h-11 rounded-md border border-input bg-background px-2" value={periodId} onChange={(e) => { setCorrecting(null); setNav({ periodo: e.target.value, q: undefined }); }}>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
      )}

      {projection.state === "period-unavailable" ? (
        <StatePanel tone="info" title="Mesa indisponível" description={projection.disclosableReasons.join(" ")} />
      ) : (
        <AssessmentPeriodWorkspace
          projection={projection}
          formatDate={formatAcademicDate}
          query={query}
          onQueryChange={(q) => setNav({ periodo: periodId, q: q || undefined })}
          renderOpenPauta={(instrumentId, label) => pautaLink(instrumentId, label, query)}
          correcting={correcting}
          onRequestCorrection={(studentId, instrumentId) =>
            setCorrecting((c) => (c && c.studentId === studentId && c.instrumentId === instrumentId ? null : { studentId, instrumentId }))
          }
          renderCorrection={(student, cell) => (
            <div className="space-y-2 rounded-md border border-border p-3 text-sm">
              <p>A correção de {student.displayName} é feita na pauta do instrumento, com as mesmas regras, autorização, justificativa e histórico de versões.</p>
              <div className="flex flex-wrap gap-2">
                {pautaLink(cell.instrumentId, "Abrir a pauta para corrigir", student.displayName)}
                <Button variant="ghost" className="min-h-11" onClick={() => setCorrecting(null)}>Fechar</Button>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}

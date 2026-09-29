import { teachingClass, teachingUnitName, teachingAssignments, teachingPersonName } from "@/features/diary/institutional-teaching";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Eye,
  FlaskConical,
  Lock,
  MinusCircle,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import {
  classAcademicYear,
  classStage,
  getSchoolCalendar,
} from "@/features/academic/academic-structure";
import { RULE_STATUS_LABEL } from "./assessment-rule-governance";
import { resolveApplicableRule } from "./assessment-rule-model";
import { aggregationLabel } from "./assessment-rule-preview";
import { RECOVERY_PREVALENCE_LABEL } from "./assessment-rule-types";
import { useAssessmentRules } from "./assessment-rule-store";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { InstrumentsSection } from "./assessment-instrument-pages";
import { DiaryHeader } from "@/features/diary/diary-context";
import {
  DEFAULT_DIARY_PROFESSIONAL_ID,
  diaryContext,
  diarySearch,
  type DiarySearch,
} from "@/features/diary/diary-data";
import { daysBetween, formatAcademicDate } from "@/lib/academic-date";
import {
  assessmentPermissions,
  classConfigurationState,
  classStageLabel,
  NORMATIVE_STATUS_LABEL,
  strategyCapabilities,
  type AssessmentViewer,
  type ConfigurationState,
} from "./assessment-configuration";
import type {
  AssessmentPeriodStructure,
  AssessmentStrategyKind,
  NormativeStatus,
  ScaleDefinition,
} from "./assessment-types";

const STRATEGY_LABEL: Record<AssessmentStrategyKind, { title: string; description: string }> = {
  quantitativa: {
    title: "Quantitativa",
    description: "Registros numéricos em escala configurada.",
  },
  conceitual: { title: "Conceitual", description: "Registros por conceitos configurados." },
  descritiva: { title: "Descritiva", description: "Registros textuais, sem escala." },
  hibrida: { title: "Híbrida", description: "Mais de uma forma de registro admitida." },
  acompanhamento: {
    title: "Acompanhamento do desenvolvimento",
    description: "Trabalha com registros pedagógicos já feitos no Diário, sem nota.",
  },
};

const STATE_COPY: Record<
  ConfigurationState["kind"],
  { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral"; icon: typeof Eye }
> = {
  inexistente: { label: "Sem configuração", tone: "neutral", icon: CircleDashed },
  erro: { label: "Configuração inconsistente", tone: "danger", icon: XCircle },
  incompleta: { label: "Configuração incompleta", tone: "warning", icon: AlertTriangle },
  demonstrativa: { label: "Configuração demonstrativa", tone: "info", icon: FlaskConical },
  pendencias: { label: "Com pendências normativas", tone: "warning", icon: AlertTriangle },
  "estruturalmente-pronta": {
    label: "Estruturalmente pronta",
    tone: "success",
    icon: CheckCircle2,
  },
  homologada: { label: "Homologada", tone: "success", icon: CheckCircle2 },
};

/**
 * 12F — Regra avaliativa institucional aplicável à turma. Professor e escola
 * apenas consultam; sem regra homologada, o motor permanece bloqueado.
 */
function ApplicableRulePanel({ classId }: { classId: string }) {
  const rules = useAssessmentRules();
  const year = classAcademicYear(classId);
  const resolution = resolveApplicableRule({
    academicYearId: year?.id ?? "",
    stageId: classStage(classId)?.id,
    classId,
    rules,
  });
  if (resolution.status !== "resolvida")
    return (
      <Section step="0 · Regra avaliativa" title="Regra avaliativa aplicável">
        <StatePanel
          tone="warning"
          title="Não existe regra avaliativa homologada aplicável a esta turma."
          description={`${resolution.reason} Enquanto isso, nenhum resultado é calculado: a consolidação permanece bloqueada.`}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          As regras avaliativas são definidas exclusivamente pela Supervisão de Ensino. Professores
          e escolas apenas consultam.
        </p>
      </Section>
    );
  const rule = resolution.rule;
  const calendar = resolution.calendar;
  return (
    <Section
      step="0 · Regra avaliativa"
      title="Regra avaliativa aplicável"
      aside={<StatusBadge tone="success">{RULE_STATUS_LABEL[rule.status]}</StatusBadge>}
    >
      <p className="break-words text-sm font-medium text-foreground">
        {rule.name} · versão {rule.version}
      </p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <Fact label="Ano letivo">{year?.label ?? rule.scope.academicYearId}</Fact>
        <Fact label="Períodos oficiais">
          {calendar
            ? `${calendar.title} · ${calendar.periods.length} período(s)`
            : "Calendário não localizado"}
        </Fact>
        <Fact label="Estratégia">{rule.strategy}</Fact>
        <Fact label="Categorias">
          {rule.categories.length ? rule.categories.map((c) => c.label).join(", ") : "Nenhuma"}
        </Fact>
        <Fact label="Recuperação">
          {!rule.periodicRecovery?.enabled
            ? "Não prevista"
            : rule.periodicRecovery.prevalence
              ? RECOVERY_PREVALENCE_LABEL[rule.periodicRecovery.prevalence]
              : "Prevalência pendente de definição"}
        </Fact>
        <Fact label="Consolidação">
          {rule.cycleAggregation
            ? aggregationLabel(rule.cycleAggregation)
            : "Pendente de definição normativa"}
        </Fact>
        <Fact label="Arredondamento">
          {rule.rounding.mode === "sem-arredondamento"
            ? "Nenhum"
            : `${rule.rounding.mode} · ${rule.rounding.applyAt.join(", ") || "sem momento"}`}
        </Fact>
        <Fact label="Origem institucional">
          Supervisão de Ensino — homologada em{" "}
          {rule.audit.homologatedAt
            ? formatAcademicDate(rule.audit.homologatedAt.slice(0, 10))
            : "—"}
        </Fact>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        Consulta apenas: a regra é definida pela Supervisão de Ensino e é imutável após a
        homologação.
      </p>
    </Section>
  );
}

function statusTone(status: NormativeStatus) {
  return status === "homologado" ? "success" : status === "pendente" ? "warning" : "info";
}

export function NormativeBadge({ status }: { status: NormativeStatus }) {
  return <StatusBadge tone={statusTone(status)}>{NORMATIVE_STATUS_LABEL[status]}</StatusBadge>;
}

function Section({
  step,
  title,
  aside,
  children,
}: {
  step: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const id = `sec-${step}`;
  return (
    <section
      aria-labelledby={id}
      className="grid min-w-0 gap-3 border-t border-border/70 py-5 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8"
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{step}</p>
        <h2 id={id} className="font-display text-lg font-semibold text-foreground">
          {title}
        </h2>
        {aside ? <div className="mt-2">{aside}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function PeriodSequence({
  structure,
  yearLabel,
}: {
  structure: AssessmentPeriodStructure;
  yearLabel: string;
}) {
  const periods = [...structure.periods].sort((a, b) => a.sequence - b.sequence);
  return (
    <ol
      aria-label={`Períodos avaliativos de ${yearLabel}`}
      className="flex min-w-0 flex-col gap-2 md:flex-row md:gap-1"
    >
      {periods.map((period) => {
        const days = daysBetween(period.start, period.end);
        return (
          <li
            key={period.id}
            style={{ flexGrow: days, flexBasis: 0 }}
            className="min-w-0 border-l-4 border-primary/70 bg-secondary/50 px-3 py-2.5 md:border-l-0 md:border-t-4"
          >
            <p className="text-xs text-muted-foreground">{period.sequence}º na sequência</p>
            <p className="break-words font-semibold text-foreground">{period.label}</p>
            <p className="text-xs text-muted-foreground">
              {formatAcademicDate(period.start)} — {formatAcademicDate(period.end)} · {days} dias
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function Admits({ yes, children }: { yes: boolean; children: ReactNode }) {
  const Icon = yes ? CheckCircle2 : MinusCircle;
  return (
    <li className="flex min-w-0 items-start gap-2 text-sm">
      <Icon
        aria-hidden
        className={
          yes
            ? "mt-0.5 size-4 shrink-0 text-primary"
            : "mt-0.5 size-4 shrink-0 text-muted-foreground"
        }
      />
      <span className="min-w-0 break-words">
        <span className="sr-only">{yes ? "Admite: " : "Não se aplica: "}</span>
        {children}
      </span>
    </li>
  );
}

function ScaleDescription({ scale }: { scale: ScaleDefinition }) {
  if (scale.kind === "numerica")
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">Numérica</span>
        <span>
          de {scale.min} a {scale.max}, passo {scale.step}
        </span>
        <NormativeBadge status={scale.normativeStatus} />
      </div>
    );
  if (scale.kind === "conceitual")
    return (
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Conceitual</span>
          <span className="text-muted-foreground">
            {scale.ordered ? "valores ordenados" : "valores não ordenados"}
          </span>
          <NormativeBadge status={scale.normativeStatus} />
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {scale.options.map((o) => (
            <li key={o.id} className="rounded border border-border px-2 py-0.5 break-words">
              {o.label}
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <p className="text-sm">
      <span className="font-semibold">Descritiva</span> — registro textual, sem valores.
    </p>
  );
}

export function AssessmentStructureView({
  classId,
  state,
  viewer,
  recordsLink,
  calendarLink,
}: {
  classId: string;
  state: ConfigurationState;
  viewer: AssessmentViewer;
  recordsLink?: ReactNode;
  calendarLink?: ReactNode;
}) {
  const copy = STATE_COPY[state.kind];
  const permissions = assessmentPermissions(viewer);
  const StateIcon = copy.icon;
  if (state.kind === "inexistente" || state.kind === "erro")
    return (
      <StatePanel
        tone={state.kind === "erro" ? "danger" : "neutral"}
        title={copy.label}
        description={`${state.reason} Nenhuma estrutura avaliativa é presumida para ${classStageLabel(classId)}.`}
      />
    );
  const { configuration, year, structure, issues, missing, pendingRules, homologated } = state;
  const caps = strategyCapabilities(configuration);
  const strategy = STRATEGY_LABEL[configuration.strategy];
  const calendar = getSchoolCalendar(year.calendarId);
  return (
    <div className="min-w-0">
      <div
        role="status"
        className="grid min-w-0 gap-3 border-y border-border/70 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
      >
        <div className="flex min-w-0 items-start gap-3">
          <StateIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{copy.label}</p>
            <p className="text-sm text-muted-foreground">
              {homologated
                ? "Estrutura homologada pela rede."
                : "Estrutura configurada para demonstração. Não é regra oficial da rede e não produz resultado acadêmico."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={homologated ? "success" : "warning"}>
            {homologated ? "Oficial" : "Não oficial"}
          </StatusBadge>
          <StatusBadge tone="neutral">
            <Eye aria-hidden className="mr-1 size-3.5" /> Acesso de consulta
          </StatusBadge>
        </div>
      </div>

      <ApplicableRulePanel classId={classId} />

      <Section
        step="1 · Ano letivo"
        title={year.label}
        aside={<NormativeBadge status={year.normativeStatus} />}
      >
        <dl className="grid gap-3 sm:grid-cols-3">
          <Fact label="Vigência">
            {formatAcademicDate(year.validity.start)} — {formatAcademicDate(year.validity.end)}
          </Fact>
          <Fact label="Ano civil predominante">{year.civilYear}</Fact>
          <Fact label="Calendário escolar">
            {!calendar || calendar.state === "nao-cadastrado" ? (
              "Ainda não cadastrado no SIGEM"
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                {calendarLink ?? calendar.label}
                <NormativeBadge status={calendar.normativeStatus} />
              </span>
            )}
          </Fact>
        </dl>
      </Section>

      <Section
        step="2 · Períodos avaliativos"
        title={structure.label}
        aside={<NormativeBadge status={structure.normativeStatus} />}
      >
        <PeriodSequence structure={structure} yearLabel={year.label} />
        <p className="mt-2 text-xs text-muted-foreground">
          {structure.periods.length === 1
            ? "Um único período cobre o ano letivo."
            : `${structure.periods.length} períodos; nomes, quantidade e durações vêm da configuração.`}
        </p>
        {issues.length ? (
          <ul className="mt-3 space-y-1 text-sm" aria-label="Inconsistências dos períodos">
            {issues.map((i) => (
              <li key={`${i.periodId}-${i.message}`} className="flex gap-2">
                <AlertTriangle aria-hidden className="size-4 shrink-0 text-destructive" />
                {i.message}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section
        step="3 · Modelo de acompanhamento"
        title={strategy.title}
        aside={<NormativeBadge status={configuration.normativeStatus} />}
      >
        <p className="text-sm text-muted-foreground">{strategy.description}</p>
        <p className="mt-1 text-sm break-words">
          {configuration.label} · {classStageLabel(classId)} · versão {configuration.version}
        </p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2" aria-label="O que este modelo admite">
          {caps.grades ? <Admits yes>Registro por nota ou conceito</Admits> : null}
          {caps.pedagogicalRecords ? (
            <Admits yes>Registros pedagógicos e observações do Diário</Admits>
          ) : null}
          {caps.promotionDecision ? (
            <Admits yes={false}>Situação acadêmica — aguardando regra homologada</Admits>
          ) : null}
          <Admits yes={false}>Média ou resultado consolidado — não calculado</Admits>
        </ul>
        {missing.length ? (
          <p className="mt-3 text-sm">
            <AlertTriangle aria-hidden className="mr-1 inline size-4 text-destructive" />
            Falta configurar: {missing.join(", ")}.
          </p>
        ) : null}
      </Section>

      {caps.scales.length ? (
        <Section step="4 · Escala" title={caps.scales.length > 1 ? "Escalas admitidas" : "Escala"}>
          <ul className="space-y-3">
            {caps.scales.map((scale, index) => (
              <li key={`${scale.kind}-${index}`}>
                <ScaleDescription scale={scale} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {caps.instruments.length ? (
        <Section step="5 · Instrumentos" title="Tipos permitidos">
          <ul className="flex flex-wrap gap-1.5" aria-label="Tipos de instrumento permitidos">
            {caps.instruments.map((t) => (
              <li key={t.id} className="rounded border border-border px-2 py-0.5 text-sm">
                {t.label}
              </li>
            ))}
          </ul>
        </Section>
      ) : caps.pedagogicalRecords ? (
        <Section step="5 · Registros" title="Evidências do desenvolvimento">
          <p className="text-sm text-muted-foreground">
            O acompanhamento referencia as experiências e observações já registradas no Diário. Nada
            é copiado nem convertido em nota.
          </p>
          {recordsLink ? <div className="mt-2">{recordsLink}</div> : null}
        </Section>
      ) : null}

      <Section
        step="6 · Pendências normativas"
        title={
          pendingRules.length ? `${pendingRules.length} definições da rede` : "Nenhuma pendência"
        }
        aside={<Lock aria-hidden className="size-4 text-muted-foreground" />}
      >
        <p className="text-sm text-muted-foreground">
          Enquanto estas definições não forem homologadas, o sistema não calcula nem decide.
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-medium underline-offset-4 hover:underline focus-visible:underline">
            Ver pendências
          </summary>
          <dl className="mt-2 divide-y divide-border/60">
            {pendingRules.map((rule) => (
              <div key={rule.id} className="grid gap-1 py-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
                <dt className="text-sm font-medium">{rule.topic}</dt>
                <dd className="text-sm break-words text-muted-foreground">{rule.description}</dd>
              </div>
            ))}
          </dl>
        </details>
      </Section>

      <section
        className="border-t border-border/70 pt-4 text-sm text-muted-foreground"
        aria-label="Acesso"
      >
        <p>{permissions.configure.reason}</p>
        <p>{permissions.homologate.reason}</p>
      </section>
    </div>
  );
}

export function AssessmentStructureSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando estrutura avaliativa">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

export function AssessmentStructurePage({
  classId,
  search,
}: {
  classId: string;
  search: DiarySearch;
}) {
  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data);
  const klass = teachingClass(classId);
  const item = context.assignments.find((a) => a.classId === classId);
  const classSearch = diarySearch(search, {
    professor: context.professionalId,
    turma: classId,
    ...(item ? { unidade: item.unitId, componente: item.field } : {}),
  });
  if (!klass)
    return (
      <StatePanel
        tone="danger"
        title="Turma não encontrada"
        description="O identificador informado não corresponde a uma turma fictícia disponível."
      />
    );
  const state = classConfigurationState(classId);
  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Estrutura avaliativa"
        description={`${klass.name} · como esta turma é acompanhada academicamente no ano letivo.`}
        context={context}
      >
        <Button asChild variant="outline" size="sm">
          <Link to="/diario/turmas/$turmaId" params={{ turmaId: classId }} search={classSearch}>
            Voltar à turma
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/diario/turmas/$turmaId/avaliacao/periodo" params={{ turmaId: classId }} search={classSearch}>
            Avaliação do período
          </Link>
        </Button>
      </DiaryHeader>
      <AssessmentStructureView
        classId={classId}
        state={state}
        viewer="professor"
        calendarLink={
          <Link
            to="/calendario-escolar"
            search={{ perfil: "professor" }}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Abrir calendário escolar
          </Link>
        }
        recordsLink={
          <Button asChild variant="ghost" size="sm">
            <Link to="/diario/aulas" search={classSearch}>
              Ver registros da turma <ArrowRight />
            </Link>
          </Button>
        }
      />
      <InstrumentsSection classId={classId} search={search} />
    </div>
  );
}

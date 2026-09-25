/**
 * Etapa 12G — telas do ciclo de fechamento do período.
 *
 * A tela nunca calcula: tudo vem do motor (12E) e do domínio de fechamento.
 * Impedimentos são exibidos por extenso — nunca apenas um botão desabilitado.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, History, Lock, ShieldAlert, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { classAcademicYear, classStage } from "@/features/academic/academic-structure";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { DiaryHeader } from "@/features/diary/diary-context";
import {
  DEFAULT_DIARY_PROFESSIONAL_ID,
  diaryContext,
  diarySearch,
  type DiarySearch,
} from "@/features/diary/diary-data";
import { demonstrationStudents } from "@/features/students/students-data";
import { formatAcademicDate, formatDateTime } from "@/lib/academic-date";
import { cn } from "@/lib/utils";
import { classConfigurationState, type ConfigurationState } from "./assessment-configuration";
import { resolveInstrumentPeriod } from "./assessment-instruments";
import { useInstrumentStore } from "./assessment-instrument-store";
import { curriculumRefOf } from "./assessment-rules";
import { useAssessmentRules } from "./assessment-rule-store";
import type { InstitutionalAssessmentRule } from "./assessment-rule-types";
import type { AssessmentConfiguration, AssessmentPeriodStructure } from "./assessment-types";
import {
  advisories,
  blocking,
  can,
  CLOSING_DEMONSTRATION_PROFILES,
  composeScope,
  CONSOLIDATED_PERIOD_RESULT_LABEL,
  CONSOLIDATED_PERIOD_RESULT_NOTE,
  deliveryPendencies,
  demonstrationActor,
  instrumentsInScope,
  officialClosingPendencies,
  officialModel,
  previewModel,
  specialPendencies,
  transitionAllowed,
  type ClosingContext,
} from "./period-closing";
import { usePeriodClosingStore } from "./period-closing-store";
import {
  CLOSING_ACTION_LABEL,
  CLOSING_STAGE_LABEL,
  CLOSING_STAGE_TONE,
  type ClosingAction,
  type ClosingPendency,
  type ClosingScope,
} from "./period-closing-types";

const inputCls =
  "h-9 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring";

type Resolved = Extract<ConfigurationState, { configuration: AssessmentConfiguration }>;
const resolved = (state: ConfigurationState): state is Resolved =>
  "configuration" in state && "structure" in state;

function applicableRule(
  rules: readonly InstitutionalAssessmentRule[],
  academicYearId: string,
  stageId: string | undefined,
  classId: string,
) {
  const candidates = rules.filter(
    (r) =>
      r.status !== "arquivada" &&
      r.scope.academicYearId === academicYearId &&
      (r.scope.classIds?.includes(classId) || (stageId ? r.scope.stageIds.includes(stageId) : false)),
  );
  return candidates.find((r) => r.status === "homologada") ?? candidates[0];
}

export function PeriodClosingPage({
  classId,
  search,
}: {
  classId: string;
  search: DiarySearch;
}) {
  const instruments = useInstrumentStore();
  const closings = usePeriodClosingStore();
  const rules = useAssessmentRules();
  const [profileId, setProfileId] = useState(CLOSING_DEMONSTRATION_PROFILES[0]!.id);
  const actor = useMemo(() => demonstrationActor(profileId), [profileId]);

  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data);
  const item = context.assignments.find((a) => a.classId === classId);
  const klass = getDemonstrationClass(classId);
  const state = classConfigurationState(classId);
  const classSearch = diarySearch(search, { professor: context.professionalId, turma: classId });

  const back = (
    <Button asChild variant="outline" size="sm">
      <Link
        to="/diario/turmas/$turmaId/avaliacao"
        params={{ turmaId: classId }}
        search={classSearch}
      >
        <ArrowLeft /> Avaliação da turma
      </Link>
    </Button>
  );

  if (!klass || !resolved(state) || !item)
    return (
      <StatePanel
        tone="warning"
        title="Fechamento indisponível"
        description="Turma, atuação pedagógica ou configuração avaliativa não encontradas para este contexto."
      />
    );

  const { configuration, structure, year } = state;
  const stage = classStage(classId);
  const rule = applicableRule(rules, year.id, stage?.id, classId);
  const curriculumRef = curriculumRefOf(item.record);

  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Fechamento do período"
        description={`${klass.name} · ${item.field} · ${year.label}`}
        context={context}
      >
        {back}
      </DiaryHeader>

      <StatePanel
        tone="info"
        title={CONSOLIDATED_PERIOD_RESULT_LABEL}
        description={CONSOLIDATED_PERIOD_RESULT_NOTE}
      />

      <section
        aria-label="Perfil institucional demonstrativo"
        className="grid min-w-0 gap-2 rounded-md border border-border/70 p-4 sm:max-w-md"
      >
        <label className="text-xs font-semibold uppercase text-muted-foreground" htmlFor="perfil">
          Perfil institucional (demonstração)
        </label>
        <select
          id="perfil"
          className={inputCls}
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {CLOSING_DEMONSTRATION_PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Cada operação depende de uma capacidade, não de um cargo fixado no sistema. A atribuição
          definitiva de cada capacidade pertence à governança institucional e exigirá autorização
          real.
        </p>
      </section>

      <div className="space-y-5">
        {structure.periods
          .slice()
          .sort((a, b) => a.sequence - b.sequence)
          .map((period) => {
            const resolution = resolveInstrumentPeriod(structure, period.start);
            const official = resolution.ok && resolution.official;
            const scope: ClosingScope = {
              classId,
              academicYearId: year.id,
              periodId: period.id,
              ...(period.calendarPeriodId ? { calendarPeriodId: period.calendarPeriodId } : {}),
              curriculumRef,
            };
            const ctx: ClosingContext = {
              scope,
              configuration,
              period: {
                id: period.id,
                label: resolution.ok ? resolution.period.label : period.label,
                start: period.start,
                end: period.end,
              },
              officialPeriod: official,
              ...(structure.calendarId ? { calendarId: structure.calendarId } : {}),
              ...(rule ? { rule } : {}),
              assignment: item.record,
              instruments: instrumentsInScope(
                instruments.snapshot().instruments,
                scope,
                period.id,
              ),
              entries: instruments.snapshot().entries,
              students: demonstrationStudents,
              stage: closings.stage(scope),
            };
            return (
              <ClosingCard
                key={period.id}
                ctx={ctx}
                actor={actor}
                store={closings}
                structure={structure}
              />
            );
          })}
      </div>
    </div>
  );
}

function ClosingCard({
  ctx,
  actor,
  store,
  structure,
}: {
  ctx: ClosingContext;
  actor: ReturnType<typeof demonstrationActor>;
  store: ReturnType<typeof usePeriodClosingStore>;
  structure: AssessmentPeriodStructure;
}) {
  const [justification, setJustification] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState("");
  const stage = ctx.stage;
  const delivery = deliveryPendencies(ctx);
  const officialList = officialClosingPendencies(ctx);
  const chain = store.chain(ctx.scope);
  const current = store.current(ctx.scope);
  const model = officialModel(ctx) ?? previewModel(ctx);
  const preview = model ? composeScope(ctx, model) : [];
  const isOfficialModel = Boolean(officialModel(ctx));

  const run = (action: ClosingAction) => {
    setErrors([]);
    setDone("");
    const r = store.act({ ctx, actor, action, justification });
    if (!r.ok) return setErrors(r.reasons);
    setJustification("");
    setDone(`${CLOSING_ACTION_LABEL[action]} registrada.`);
  };

  const actionButton = (action: ClosingAction, label: string, variant?: "outline" | "default") => {
    if (!can(actor, (
      {
        "entrega-docente": "entregar-pauta-docente",
        "inicio-conferencia": "realizar-conferencia-escolar",
        "devolucao-com-apontamentos": "devolver-pauta-com-apontamentos",
        "fechamento-oficial": "homologar-fechamento-oficial",
        "retificacao-pontual": "executar-retificacao-pos-fechamento",
        "reabertura-integral": "reabrir-periodo-fechado",
      } as const
    )[action]))
      return null;
    if (!transitionAllowed(action, stage)) return null;
    return (
      <Button key={action} size="sm" variant={variant ?? "default"} onClick={() => run(action)}>
        {label}
      </Button>
    );
  };

  return (
    <section
      aria-label={`Fechamento — ${ctx.period.label}`}
      className="min-w-0 rounded-md border border-border/70 p-4"
    >
      <header className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-foreground">{ctx.period.label}</h2>
          <p className="text-sm text-muted-foreground">
            {formatAcademicDate(ctx.period.start)} — {formatAcademicDate(ctx.period.end)} ·{" "}
            {structure.label}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <StatusBadge tone={CLOSING_STAGE_TONE[stage]}>{CLOSING_STAGE_LABEL[stage]}</StatusBadge>
          <StatusBadge tone={ctx.officialPeriod ? "success" : "warning"}>
            {ctx.officialPeriod ? "Período oficial do calendário" : "Período não oficial"}
          </StatusBadge>
        </div>
      </header>

      <PendencyList
        title="Impedem a entrega dos registros"
        icon={ShieldAlert}
        items={blocking(delivery)}
        tone="danger"
      />
      <PendencyList
        title="Impedem o fechamento oficial"
        icon={Lock}
        items={blocking(officialList).filter((p) => !blocking(delivery).includes(p))}
        tone="warning"
      />
      <PendencyList
        title="Pendências especiais — exigem decisão humana"
        icon={ShieldAlert}
        items={specialPendencies(delivery)}
        tone="warning"
      />
      <PendencyList
        title="Avisos"
        icon={History}
        items={advisories(delivery)}
        tone="neutral"
      />

      {preview.length > 0 ? (
        <div className="mt-4 min-w-0 overflow-x-auto">
          <p className="mb-2 text-sm font-semibold text-foreground">
            {isOfficialModel
              ? CONSOLIDATED_PERIOD_RESULT_LABEL
              : "Prévia não oficial — simulação sobre regra não homologada"}
          </p>
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <caption className="sr-only">
              Resultado por aluno derivado pelo motor de composição
            </caption>
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase text-muted-foreground">
                <th scope="col" className="py-1.5 pr-3">
                  Aluno
                </th>
                <th scope="col" className="py-1.5 pr-3">
                  Situação dos dados
                </th>
                <th scope="col" className="py-1.5 text-right">
                  Resultado do período
                </th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={row.studentId} className="border-b border-border/40">
                  <td className="py-1.5 pr-3">{row.studentName}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">
                    {row.composition.complete
                      ? "Dados completos conforme a regra"
                      : "Acumulado parcial — não é resultado do período"}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {row.composition.stage && row.composition.complete
                      ? String(row.composition.stage.value).replace(".", ",")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isOfficialModel ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Simulação identificada como não oficial: não produz fechamento nem resultado
              institucional.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid min-w-0 gap-3">
        <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">
          Justificativa (obrigatória em devolução, retificação e reabertura)
          <textarea
            rows={2}
            className={cn(inputCls, "h-auto py-2 font-normal normal-case")}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {actionButton("entrega-docente", "Entregar registros")}
          {actionButton("inicio-conferencia", "Iniciar conferência", "outline")}
          {actionButton("devolucao-com-apontamentos", "Devolver com apontamentos", "outline")}
          {actionButton("fechamento-oficial", "Fechar oficialmente")}
          {actionButton("retificacao-pontual", "Registrar retificação", "outline")}
          {actionButton("reabertura-integral", "Reabrir período", "outline")}
        </div>
        {errors.length ? (
          <ul aria-live="polite" className="space-y-1 text-sm text-destructive">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
        {done ? (
          <p aria-live="polite" className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 aria-hidden className="size-4 text-primary" /> {done}
          </p>
        ) : null}
      </div>

      {chain.length ? (
        <div className="mt-4 border-t border-border/60 pt-3">
          <p className="mb-2 text-sm font-semibold text-foreground">Versões do fechamento</p>
          <ul className="space-y-1.5 text-sm">
            {chain.map((record) => (
              <li key={record.id} className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={record.id === current?.id ? "success" : "neutral"}>
                  Versão {record.version}
                  {record.id === current?.id ? " · vigente" : " · histórica"}
                </StatusBadge>
                <span className="text-muted-foreground">
                  {formatDateTime(record.closedAt)} · {record.closedBy.actorName} ·{" "}
                  {record.results.length} aluno(s)
                </span>
                {record.revision ? (
                  <span className="text-xs text-muted-foreground">
                    {record.revision.kind === "retificacao-pontual"
                      ? "Retificação pontual"
                      : "Após reabertura"}
                    : {record.revision.justification}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {store.events(ctx.scope).length ? (
        <div className="mt-4 border-t border-border/60 pt-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Undo2 aria-hidden className="size-4 text-primary" /> Histórico do ciclo
          </p>
          <ol className="space-y-1.5 text-sm text-muted-foreground">
            {store.events(ctx.scope).map((event, index) => (
              <li key={`${event.at}-${index}`}>
                {formatDateTime(event.at)} · {event.detail} · {event.actor.actorName} (
                {event.actor.profileLabel})
                {event.justification ? ` · "${event.justification}"` : ""}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function PendencyList({
  title,
  items,
  tone,
  icon: Icon,
}: {
  title: string;
  items: ClosingPendency[];
  tone: "danger" | "warning" | "neutral";
  icon: typeof Lock;
}) {
  if (!items.length) return null;
  return (
    <div className="mt-4 min-w-0">
      <p
        className={cn(
          "mb-1.5 flex items-center gap-2 text-sm font-semibold",
          tone === "danger" ? "text-destructive" : "text-foreground",
        )}
      >
        <Icon aria-hidden className="size-4" /> {title} ({items.length})
      </p>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {items.map((p, index) => (
          <li key={`${p.code}-${p.studentId ?? p.instrumentId ?? index}`}>
            {p.studentName ? <b className="text-foreground">{p.studentName}: </b> : null}
            {p.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

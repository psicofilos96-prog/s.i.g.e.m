import { teachingClass, teachingUnitName, teachingAssignments, teachingPersonName } from "@/features/diary/institutional-teaching";
import { rosterStudents } from "@/features/students/institutional-roster";
/**
 * 6D.3.4.4 — Closing Workspace 2.0.
 *
 * CONTEXTO → SITUAÇÃO → O QUE SERÁ OFICIALIZADO → AÇÃO. A tela só apresenta
 * `projectClosingWorkspace` (composição de projeções canônicas) e executa atos
 * pelo `periodClosingStore`; nenhuma regra, requisito ou cálculo nasce aqui.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, CircleAlert, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatePanel } from "@/components/sigem/patterns";
import { classStage } from "@/features/academic/academic-structure";
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
import type { AssessmentConfiguration } from "./assessment-types";
import {
  can,
  CLOSING_ACTION_CAPABILITY,
  CLOSING_DEMONSTRATION_PROFILES,
  demonstrationActor,
  instrumentsInScope,
  transitionAllowed,
  type ClosingContext,
} from "./period-closing";
import type { ClosingRegularizationPolicy, HistoricalNormativeArchive } from "./period-closing-divergence";
import { usePeriodClosingStore, type PeriodClosingStore } from "./period-closing-store";
import { fieldVersionStore, useFieldVersionTick } from "./assessment-entry-field-config";
import {
  AFTER_CLOSING_TEXT,
  CANNOT_CLOSE_TITLE,
  CLOSE_CONFIRM_TEXT,
  CLOSE_CONFIRM_TITLE,
  DIVERGENCE_TITLE,
  projectClosingWorkspace,
  type ClosingWorkspaceView,
  type ConferenceRow,
  type UnmetAction,
} from "./closing-workspace-presentation";
import { recordClosingActInCloud, useCloudClosingSync } from "./period-closing-cloud";
import { periodClosingStore as canonicalClosingStore } from "./period-closing-store";
import { CLOSING_ACTION_LABEL, type ClosingAction, type ClosingActor, type ClosingCapability, type ClosingScope } from "./period-closing-types";
import { sessionActor, useSessionAuthority, type SessionAuthority } from "@/features/authority/session-authority";
import { useAcademicReferenceDate, referenceDateValue } from "@/features/academic/academic-reference-date";
import { applicableAssessmentRule, useCloudPeriodFacts } from "./assessment-period-sources";
import { useAssessmentNormativeSource, normativeSessionArgs } from "./assessment-normative-sources";

const inputCls =
  "h-9 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring";

type Resolved = Extract<ConfigurationState, { configuration: AssessmentConfiguration }>;
const resolved = (state: ConfigurationState): state is Resolved =>
  "configuration" in state && "structure" in state;

/** Nenhuma política de regularização está homologada na demonstração. */
const REGULARIZATION_POLICIES: readonly ClosingRegularizationPolicy[] = [];

/**
 * B4.6.2b.3 — fronteira de sessão: sessão incerta não monta o corpo (nem stores/fixtures do laboratório);
 * o corpo recebe o MESMO snapshot de autoridade e é remontado por conta.
 */
export function PeriodClosingPage({ classId, search }: { classId: string; search: DiarySearch }) {
  const authority = useSessionAuthority();
  if (authority.status === "loading")
    return <StatePanel tone="neutral" title="Verificando sessão…" description="O fechamento aparece depois que a sessão for confirmada." />;
  return (
    <PeriodClosingBody
      key={authority.status === "signed-in" ? authority.user.id : "laboratorio"}
      classId={classId}
      search={search}
      authority={authority}
    />
  );
}

function PeriodClosingBody({ classId, search, authority }: { classId: string; search: DiarySearch; authority: SessionAuthority }) {
  const instruments = useInstrumentStore();
  useFieldVersionTick();
  const closings = usePeriodClosingStore();
  const [profileId, setProfileId] = useState(CLOSING_DEMONSTRATION_PROFILES[0]!.id);
  const [periodId, setPeriodId] = useState(search.periodo);
  const cloud = authority.status === "signed-in";
  // Com sessão, a disponibilidade dos botões vem das capacidades reais; o banco revalida.
  const actor = useMemo<ClosingActor>(
    () =>
      cloud
        ? (sessionActor<ClosingCapability>(authority, periodId ? { classId, periodId } : { classId }) ??
          { ...demonstrationActor(profileId), capabilities: [] })
        : demonstrationActor(profileId),
    [cloud, authority, classId, periodId, profileId],
  );

  const referenceDate = useAcademicReferenceDate(search.data, cloud);
  const academicDate = referenceDateValue(referenceDate);
  const klass = teachingClass(classId);
  // 6D.FINAL.2 — regra, configuração, períodos, instrumentos e versões: banco com sessão.
  const norms = useAssessmentNormativeSource({
    classId, ...normativeSessionArgs(authority), ...(referenceDate.kind === "invalid" ? { pending: true } : {}),
    stageId: klass?.stageId ?? classStage(classId)?.id, academicYearId: klass?.academicYearId,
    academicDate,
  });
  const cloudFacts = useCloudPeriodFacts(classId, klass?.academicYearId, cloud && Boolean(academicDate), academicDate);
  const rules = norms.rules;
  const state = norms.state;
  if (referenceDate.kind === "invalid")
    return <StatePanel tone="warning" title="Fechamento indisponível" description={referenceDate.reason} />;
  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, referenceDate.date);
  const item = context.assignments.find((a) => a.classId === classId);
  const classSearch = diarySearch(search, { professor: context.professionalId, turma: classId });

  if (cloud && (!norms.ready || !cloudFacts.ready))
    return <StatePanel tone="info" title="Carregando" description="Lendo os fatos oficiais do período." />;
  if (cloud && cloudFacts.error)
    return <StatePanel tone="warning" title="Fechamento indisponível" description={cloudFacts.error} />;
  if (!klass || !resolved(state) || !item)
    return (
      <StatePanel
        tone="warning"
        title="Fechamento indisponível"
        description={
          "reason" in state
            ? state.reason
            : "Turma, atuação pedagógica ou configuração avaliativa não encontradas para este contexto."
        }
      />
    );

  const { configuration, structure, year } = state;
  const rule = applicableAssessmentRule(rules, year.id, klass.stageId ?? classStage(classId)?.id, classId);
  const curriculumRef = curriculumRefOf(item.record);
  const periods = structure.periods.slice().sort((a, b) => a.sequence - b.sequence);
  const period = periods.find((p) => p.id === periodId) ?? periods[0];
  if (!period)
    return <StatePanel tone="warning" title="Fechamento indisponível" description="Não há períodos avaliativos configurados." />;

  // B4.6.2b.3 — B2.4 (proveniência explícita) nunca consulta o calendário do laboratório.
  const resolution = resolveInstrumentPeriod(structure, period.start);
  const calendarUnavailable = cloud || (resolution.ok && resolution.calendarDependency === "indisponivel");
  const scope: ClosingScope = {
    classId,
    academicYearId: year.id,
    periodId: period.id,
    ...(period.calendarPeriodId ? { calendarPeriodId: period.calendarPeriodId } : {}),
    curriculumRef,
  };
  const scoped = instrumentsInScope(cloud ? cloudFacts.instruments : instruments.snapshot().instruments, scope, period.id);
  const ctx: ClosingContext = {
    scope,
    configuration,
    period: {
      id: period.id,
      label: resolution.ok ? resolution.period.label : period.label,
      start: period.start,
      end: period.end,
    },
    // Nunca forçado: B2.4 sem calendário lido ⇒ não oficial por dependência indisponível (não "não homologado").
    officialPeriod: resolution.ok && resolution.official,
    ...(structure.calendarId ? { calendarId: structure.calendarId } : {}),
    ...(calendarUnavailable ? { calendarDependency: "indisponivel" as const } : {}),
    ...(rule ? { rule } : {}),
    assignment: item.record,
    instruments: scoped,
    versions: cloud
      ? cloudFacts.versions.filter((v) => scoped.some((i) => i.id === v.instrumentId))
      : scoped.flatMap((i) => fieldVersionStore.versions(i.id)),
    students: rosterStudents(),
    stage: closings.stage(scope),
    events: closings.events(scope),
  };
  // Arquivo histórico: devolve SOMENTE a identidade + versão exatas do ato.
  const archive: HistoricalNormativeArchive = {
    rule: (id, version) => norms.ruleVersions.find((r) => r.id === id && r.version === version),
    configuration: (id, version) =>
      configuration.id === id && configuration.version === version ? configuration : undefined,
  };

  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Fechamento do período"
        description={`${klass.name} · ${item.field} · ${year.label}`}
        context={context}
      >
        <Button asChild variant="outline" size="sm">
          <Link to="/diario/turmas/$turmaId/avaliacao" params={{ turmaId: classId }} search={classSearch}>
            <ArrowLeft /> Avaliação da turma
          </Link>
        </Button>
      </DiaryHeader>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 sm:max-w-2xl">
        <label className="grid min-w-0 gap-1 text-sm font-medium text-foreground">
          Período
          <select className={inputCls} value={period.id} onChange={(e) => setPeriodId(e.target.value)}>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {!cloud && <label className="grid min-w-0 gap-1 text-sm font-medium text-foreground">
          Perfil (demonstração)
          <select className={inputCls} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            {CLOSING_DEMONSTRATION_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>}
      </div>

      <ClosingWorkspace
        key={`${period.id}-${profileId}`}
        ctx={ctx}
        actor={actor}
        store={closings}
        archive={archive}
        policies={REGULARIZATION_POLICIES}
        heading={`${klass.name} · ${item.field}`}
        classId={classId}
        classSearch={{ ...classSearch, periodo: period.id }}
        userId={authority.status === "signed-in" ? authority.user.id : null}
        sessionRevision={authority.status === "signed-in" ? authority.sessionRevision : null}
      />
    </div>
  );
}

export function ClosingWorkspace({
  ctx,
  actor,
  store,
  archive,
  policies,
  heading,
  classId,
  classSearch,
  valueReadCapability,
  now,
  userId,
}: {
  ctx: ClosingContext;
  actor: ClosingActor;
  store: PeriodClosingStore;
  archive: HistoricalNormativeArchive;
  policies: readonly ClosingRegularizationPolicy[];
  heading: string;
  classId: string;
  classSearch: DiarySearch;
  valueReadCapability?: string;
  now?: () => string;
  /** Identidade do MESMO snapshot de sessão da tela; sem ela o espelho não é consultado. */
  userId?: string | null;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Só o store canônico espelha o banco; stores de teste/laboratório seguem em memória.
  const sync = useCloudClosingSync(store === canonicalClosingStore, { userId: userId ?? null });
  const { cloud, capabilitiesFor } = sync;
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  // B4.10.0a — com sessão, nada do espelho/capacidades é lido antes da leitura deste contexto.
  if (cloud && !sync.ready)
    return <StatePanel tone="info" title="Carregando" description="Lendo os fechamentos oficiais e as capacidades desta sessão." />;
  if (cloud && sync.error)
    return <StatePanel tone="danger" title="Fechamento indisponível" description="Não foi possível ler os fechamentos oficiais ou as capacidades. Isto não significa que não existam; nada é concluído." />;
  const liveCtx: ClosingContext = { ...ctx, stage: store.stage(ctx.scope), events: store.events(ctx.scope) };
  const current = store.current(ctx.scope);
  const view = projectClosingWorkspace({
    ctx: liveCtx,
    actor,
    current,
    archive,
    regularizationPolicies: policies,
    ...(valueReadCapability ? { valueReadCapability } : {}),
  });

  const act = async (action: ClosingAction, justification?: string) => {
    setErrors([]);
    setNotice("");
    if (cloud && store.isMirror()) {
      // Sessão institucional: o domínio prepara; o banco revalida e grava tudo ou nada.
      const cloudActor: ClosingActor = {
        ...actor,
        capabilities: capabilitiesFor(classId, ctx.scope.periodId) as ClosingActor["capabilities"],
      };
      const planned = store.prepare({
        ctx: liveCtx,
        actor: cloudActor,
        action,
        ...(justification ? { justification } : {}),
      });
      if (!planned.ok) {
        setErrors(planned.reasons);
        return false;
      }
      const saved = await recordClosingActInCloud({
        scope: ctx.scope,
        action,
        event: planned.value.event,
        ...(planned.value.record ? { record: planned.value.record } : {}),
        ...(justification ? { justification } : {}),
        context: sync.context,
      });
      if (!saved.ok) {
        setErrors([saved.message]);
        return false;
      }
      setNotice(`${CLOSING_ACTION_LABEL[action]} registrada.`);
      return true;
    }
    const r = store.act({
      ctx: liveCtx,
      actor,
      action,
      ...(justification ? { justification } : {}),
      ...(now ? { now: now() } : {}),
    });
    if (!r.ok) {
      setErrors(r.reasons);
      return false;
    }
    setNotice(`${CLOSING_ACTION_LABEL[action]} registrada.`);
    return true;
  };

  return (
    <section aria-label={`Fechamento — ${ctx.period.label}`} className="min-w-0 rounded-md border border-border/70">
      <header className="border-b border-border/70 p-4">
        <p className="font-display text-lg font-semibold text-foreground">{heading}</p>
        <p className="text-sm text-muted-foreground">
          {ctx.period.label} · {formatAcademicDate(ctx.period.start)} — {formatAcademicDate(ctx.period.end)}
        </p>
      </header>

      {view.phase === "open" ? (
        <OpenState view={view} classId={classId} classSearch={classSearch} onAct={(a) => act(a)} />
      ) : (
        <ClosedState view={view} />
      )}

      {errors.length ? (
        <ul aria-live="polite" className="space-y-1 border-t border-border/70 p-4 text-sm text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {notice && view.phase === "open" ? (
        <p aria-live="polite" className="border-t border-border/70 p-4 text-sm text-foreground">
          {notice}
        </p>
      ) : null}

      {view.phase === "open" ? (
        <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-border/70 p-4">
          {!view.canClose ? (
            <p className="mr-auto text-sm text-muted-foreground">O fechamento fica disponível quando os itens acima forem resolvidos.</p>
          ) : null}
          <Button disabled={!view.canClose} onClick={() => setConfirmOpen(true)}>
            <Lock aria-hidden /> Fechar período
          </Button>
        </footer>
      ) : null}

      <OtherOperations actor={actor} ctx={liveCtx} onAct={act} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{CLOSE_CONFIRM_TITLE}</AlertDialogTitle>
            <AlertDialogDescription>{CLOSE_CONFIRM_TEXT}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => act("fechamento-oficial")}>Fechar período</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function OpenState({
  view,
  classId,
  classSearch,
  onAct,
}: {
  view: Extract<ClosingWorkspaceView, { phase: "open" }>;
  classId: string;
  classSearch: DiarySearch;
  onAct: (a: ClosingAction) => void;
}) {
  return (
    <>
      <div className="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-foreground">Situação do período</h2>
        {view.unmet.length ? (
          <div role="status" className="space-y-2">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <CircleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
              {CANNOT_CLOSE_TITLE}
            </p>
            <ul aria-label="O que falta para fechar" className="space-y-2">
              {view.unmet.map((u) => (
                <li key={u.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="min-w-0 flex-1 basis-60">
                    <span className="sr-only">Falta: </span>
                    {u.text}
                  </span>
                  {u.action ? <UnmetActionButton action={u.action} classId={classId} classSearch={classSearch} onAct={onAct} /> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckCircle2 aria-hidden className="size-4 shrink-0 text-primary" />
            {view.direct
              ? "A regra deste período não declara requisitos: o fechamento pode ser realizado agora."
              : "Todos os requisitos deste período foram atendidos."}
          </p>
        )}
        {view.satisfied.length ? (
          <ul aria-label="Requisitos atendidos" className="space-y-1 text-sm text-muted-foreground">
            {view.satisfied.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <CheckCircle2 aria-hidden className="size-3.5 shrink-0" />
                <span className="sr-only">Atendido: </span>
                {s}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-border/70 p-4">
        <h2 className="text-sm font-semibold text-foreground">
          {view.previewOnly ? "Prévia do que seria oficializado" : "O que será oficializado"}
        </h2>
        {view.previewOnly ? (
          <p className="text-sm text-muted-foreground">
            A regra aplicável ainda não foi homologada: esta prévia não é resultado oficial e não produz fechamento.
          </p>
        ) : null}
        <ul className="text-sm text-foreground">
          {view.summary.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <Conference rows={view.conference} />
      </div>

      <div className="border-t border-border/70 p-4">
        <h2 className="text-sm font-semibold text-foreground">Depois do fechamento</h2>
        <p className="mt-1 text-sm text-muted-foreground">{AFTER_CLOSING_TEXT}</p>
      </div>
    </>
  );
}

function UnmetActionButton({
  action,
  classId,
  classSearch,
  onAct,
}: {
  action: UnmetAction;
  classId: string;
  classSearch: DiarySearch;
  onAct: (a: ClosingAction) => void;
}) {
  if (action.kind === "cycle-act")
    return (
      <Button size="sm" variant="outline" onClick={() => onAct(action.action)}>
        {action.label}
      </Button>
    );
  if (action.kind === "open-instrument")
    return (
      <Button asChild size="sm" variant="outline">
        <Link
          to="/diario/turmas/$turmaId/avaliacao/instrumentos/$instrumentoId"
          params={{ turmaId: classId, instrumentoId: action.instrumentId }}
          search={classSearch}
        >
          {action.label}
        </Link>
      </Button>
    );
  return (
    <Button asChild size="sm" variant="outline">
      <Link to="/diario/turmas/$turmaId/avaliacao/periodo" params={{ turmaId: classId }} search={classSearch}>
        {action.label}
      </Link>
    </Button>
  );
}

function Conference({ rows, title = "Ver conferência" }: { rows: ConferenceRow[]; title?: string }) {
  if (!rows.length) return null;
  return (
    <details className="group min-w-0">
      <summary className="cursor-pointer text-sm font-medium text-primary underline-offset-4 hover:underline">
        {title}
      </summary>
      <ul aria-label="Conferência por estudante" className="mt-2 divide-y divide-border/60">
        {rows.map((r) => (
          <li key={r.studentId} className="min-w-0 py-2 text-sm">
            <p className="font-medium text-foreground">{r.studentName}</p>
            <p className={cn(r.valueDisclosure === "suppressed" && "text-muted-foreground")}>{r.resultLine}</p>
            {r.notes.map((n) => (
              <p key={n} className="text-xs text-muted-foreground">
                {n}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </details>
  );
}

function ClosedState({ view }: { view: Extract<ClosingWorkspaceView, { phase: "closed" }> }) {
  const d = view.divergence;
  return (
    <>
      <div className="space-y-2 p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Lock aria-hidden className="size-4 text-primary" /> Período fechado
        </h2>
        <p className="text-sm text-foreground">
          {formatDateTime(view.record.closedAt)} · {view.closedLine}
        </p>
        <ul className="text-sm text-muted-foreground">
          {view.summary.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{AFTER_CLOSING_TEXT}</p>
        <Conference rows={view.conference} title="Ver o que foi oficializado" />
      </div>

      {d.kind === "divergent" ? (
        <div role="status" className="space-y-2 border-t border-border/70 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CircleAlert aria-hidden className="size-4 shrink-0" /> {DIVERGENCE_TITLE}
          </h2>
          <p className="text-xs text-muted-foreground">
            O fechamento histórico permanece como foi registrado; a situação atual é mostrada à parte.
          </p>
          <p className="text-sm">{d.impactLine}</p>
          {d.affectedStudentNames.length ? (
            <p className="text-sm text-muted-foreground">{d.affectedStudentNames.join(", ")}</p>
          ) : null}
          <p className="text-sm font-medium">{d.regularization.text}</p>
          {d.regularization.kind === "required" ? (
            <>
              <ul aria-label="Exigências da regularização" className="list-disc pl-5 text-sm">
                {d.regularization.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              {d.regularization.blockedText ? (
                <p className="text-sm text-muted-foreground">{d.regularization.blockedText}</p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <details className="border-t border-border/70 p-4">
        <summary className="cursor-pointer text-xs text-muted-foreground">Detalhes técnicos</summary>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {view.technical.map((t) => (
            <li key={t} className="break-words">
              {t}
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

/** Operações de exceção (devolução, retificação, reabertura): só quando o perfil e a etapa as admitem. */
const EXCEPTION_ACTIONS: readonly ClosingAction[] = [
  "devolucao-com-apontamentos",
  "retificacao-pontual",
  "reabertura-integral",
];

function OtherOperations({
  actor,
  ctx,
  onAct,
}: {
  actor: ClosingActor;
  ctx: ClosingContext;
  onAct: (a: ClosingAction, justification: string) => boolean | Promise<boolean>;
}) {
  const [justification, setJustification] = useState("");
  const available = EXCEPTION_ACTIONS.filter(
    (a) => can(actor, CLOSING_ACTION_CAPABILITY[a]) && transitionAllowed(a, ctx.stage),
  );
  if (!available.length) return null;
  return (
    <details className="border-t border-border/70 p-4">
      <summary className="cursor-pointer text-sm text-muted-foreground">Outras operações institucionais</summary>
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1 text-sm text-foreground">
          Justificativa
          <textarea
            rows={2}
            className={cn(inputCls, "h-auto py-2")}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {available.map((a) => (
            <Button
              key={a}
              size="sm"
              variant="outline"
              onClick={() => {
                void Promise.resolve(onAct(a, justification)).then((ok) => ok && setJustification(""));
              }}
            >
              {CLOSING_ACTION_LABEL[a]}
            </Button>
          ))}
        </div>
      </div>
    </details>
  );
}

import { useAttendancePolicySource, useAssessmentNormativeSource, normativeSessionArgs } from "@/features/assessment/assessment-normative-sources";
import { useAcademicReferenceDate, referenceDateValue } from "@/features/academic/academic-reference-date";
import { teachingClass, teachingUnitName, teachingAssignments, teachingPersonName } from "@/features/diary/institutional-teaching";
import { rosterChainDiagnostics, rosterStudents } from "@/features/students/institutional-roster";
/**
 * Etapa 12H.1 — tela do fechamento oficial da frequência.
 *
 * A tela nunca calcula: os fatos vêm do motor de frequência, que consome
 * calendário homologado (12B), grade (10A–10D), registro de aula (11A),
 * chamada (11C), vigência do vínculo (8A–8G) e o prontuário do aluno.
 * Impedimentos são exibidos por extenso — nunca apenas um botão desabilitado.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, ClipboardList, History, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { classConfigurationState, type ConfigurationState } from "@/features/assessment/assessment-configuration";
import { curriculumKey, curriculumRefOf } from "@/features/assessment/assessment-rules";
import { resolveAttendanceAccountingUnit } from "./attendance-scope-dimensions";
import type { AssessmentConfiguration } from "@/features/assessment/assessment-types";
import { isPublished, temporalQueries } from "@/features/calendar/calendar-queries";
import { calendarRepository, useNetworkCalendars } from "@/features/calendar/calendar-store";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { demonstrationStudents } from "@/features/students/students-data";
import { formatAcademicDate, formatDateTime } from "@/lib/academic-date";
import { cn } from "@/lib/utils";
import { DiaryHeader } from "./diary-context";
import {
  DEFAULT_DIARY_PROFESSIONAL_ID,
  diaryContext,
  diarySearch,
  type DiarySearch,
} from "./diary-data";
import { lessonEntries, useLocalLessonRecords } from "./lesson-records";
import { useLocalAttendance } from "./attendance";
import {
  attendanceAdvisories,
  attendanceBlocking,
  attendanceClosingPendencies,
  attendanceDeliveryPendencies,
  attendanceDemonstrationActor,
  attendanceSpecial,
  attendanceTransitionAllowed,
  canAttendance,
  plannedUnits,
  scopeTotals,
  studentAttendanceFacts,
  ATTENDANCE_ACTION_CAPABILITY,
  ATTENDANCE_DEMONSTRATION_PROFILES,
  type AttendanceClosingContext,
} from "./attendance-closing";
import {
  ATTENDANCE_POLICY_PENDING_NOTE,
  demonstrationAttendancePolicies,
  demonstrationOccurrences,
  demonstrationOccurrenceTypes,
} from "./attendance-closing-fixtures";
import { createAttendanceClosingStore, useAttendanceClosingStore } from "./attendance-closing-store";
import { isDiaryCloud } from "./diary-persistence-mode";
import { recordAttendanceClosingActInCloud } from "./diary-cloud";
import { sessionActor, useSessionAuthority, type SessionAuthority } from "@/features/authority/session-authority";
import { useCloudAttendanceOccurrences } from "./attendance-occurrences-cloud";
import { AttendanceOccurrencesSection } from "./attendance-occurrences-section";
import {
  ATTENDANCE_ACTION_LABEL,
  ATTENDANCE_CLOSING_LABEL,
  ATTENDANCE_CLOSING_NOTE,
  ATTENDANCE_POLICY_STATUS_LABEL,
  attendanceScopeLabel,
  ATTENDANCE_STAGE_LABEL,
  ATTENDANCE_STAGE_TONE,
  attendanceUnitLabel,
  type AttendanceClosingAction,
  type AttendanceClosingScope,
  type AttendancePendency,
} from "./attendance-closing-types";

const inputCls =
  "h-9 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring";

type Resolved = Extract<ConfigurationState, { configuration: AssessmentConfiguration }>;
const resolved = (state: ConfigurationState): state is Resolved =>
  "configuration" in state && "structure" in state;

const units = (value: number | null) => (value === null ? "—" : String(value));
const minutes = (value: number | null) =>
  value === null ? "duração não informada" : `${value} min`;

type AttendanceOrigin =
  | { kind: "laboratorio" }
  | { kind: "institucional"; authority: Extract<SessionAuthority, { status: "signed-in" }> };

/**
 * B4.6.2b.3 — fronteira de sessão: incerta ⇒ só verificação (sem calendário, stores ou rascunhos locais);
 * sem sessão ⇒ laboratório (assina calendários do lab); com sessão ⇒ corpo institucional sem calendário local.
 */
export function AttendanceClosingPage({ classId, search }: { classId: string; search: DiarySearch }) {
  const authority = useSessionAuthority();
  if (authority.status === "loading")
    return <StatePanel tone="neutral" title="Verificando sessão…" description="O fechamento aparece depois que a sessão for confirmada." />;
  if (authority.status === "signed-out") return <LabAttendanceClosing classId={classId} search={search} />;
  return <AttendanceClosingBody key={authority.user.id} classId={classId} search={search} origin={{ kind: "institucional", authority }} />;
}

function LabAttendanceClosing({ classId, search }: { classId: string; search: DiarySearch }) {
  useNetworkCalendars();
  return <AttendanceClosingBody classId={classId} search={search} origin={{ kind: "laboratorio" }} />;
}

function AttendanceClosingBody({
  classId,
  search,
  origin,
}: {
  classId: string;
  search: DiarySearch;
  origin: AttendanceOrigin;
}) {
  const store = useAttendanceClosingStore();
  const localLessons = useLocalLessonRecords();
  const localAttendance = useLocalAttendance();
  const [profileId, setProfileId] = useState(ATTENDANCE_DEMONSTRATION_PROFILES[0]!.id);
  const [policyId, setPolicyId] = useState(demonstrationAttendancePolicies[0]!.id);
  const authority: SessionAuthority = origin.kind === "institucional" ? origin.authority : { status: "signed-out" };
  const cloud = origin.kind === "institucional";
  const demoActor = useMemo(() => attendanceDemonstrationActor(profileId), [profileId]);
  // Com sessão, botões vêm só das capacidades efetivas; perfis demonstrativos somem.
  // Com sessão sem atuação: nenhuma capacidade (nunca o perfil demonstrativo).
  const actor = cloud
    ? ((sessionActor(authority, { classId }) as typeof demoActor | null) ?? { ...demoActor, capabilities: [] })
    : demoActor;
  // 6D.FINAL.5 — com sessão, só políticas homologadas persistidas; nunca a demonstrativa.
  const referenceDate = useAcademicReferenceDate(search.data, cloud);
  const academicDate = referenceDateValue(referenceDate);
  const invalidDate = referenceDate.kind === "invalid" ? { pending: true } : {};
  const cloudPolicies = useAttendancePolicySource<(typeof demonstrationAttendancePolicies)[number]>({
    ...normativeSessionArgs(authority), ...invalidDate, date: academicDate,
  });
  const availablePolicies = cloud ? cloudPolicies.policies : demonstrationAttendancePolicies;
  const policy = availablePolicies.find((item) => item.id === policyId) ?? (cloud ? (availablePolicies.length === 1 ? availablePolicies[0] : undefined) : demonstrationAttendancePolicies[0]!);

  const occurrenceSource = useCloudAttendanceOccurrences(classId, cloud && Boolean(academicDate), academicDate ?? "");

  const klass = teachingClass(classId);
  const norms = useAssessmentNormativeSource({
    classId, ...normativeSessionArgs(authority), ...invalidDate,
    stageId: klass?.stageId ?? undefined, academicYearId: klass?.academicYearId, academicDate,
  });
  const state = norms.state;

  if (referenceDate.kind === "invalid")
    return <StatePanel tone="warning" title="Fechamento de frequência indisponível" description={referenceDate.reason} />;
  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, referenceDate.date);
  const item = context.assignments.find((a) => a.classId === classId);
  const classSearch = diarySearch(search, { professor: context.professionalId, turma: classId });

  if (cloud && (!cloudPolicies.ready || !norms.ready))
    return <StatePanel tone="info" title="Carregando" description="Lendo a política de frequência e a configuração homologadas." />;
  if (cloud && cloudPolicies.error)
    return (
      <StatePanel
        tone="danger"
        title="Fechamento de frequência indisponível"
        description="Não foi possível ler a política de frequência homologada. Isto não significa que ela não exista; nada é concluído."
      />
    );
  if (!policy)
    return (
      <StatePanel
        tone="warning"
        title="Fechamento de frequência indisponível"
        description={
          availablePolicies.length > 1
            ? "Mais de uma política de frequência homologada está vigente; a definição depende de decisão institucional."
            : "Não existe política de frequência homologada e vigente registrada. Nenhuma política demonstrativa é usada no lugar."
        }
      />
    );
  if (!klass || !resolved(state) || !item)
    return (
      <StatePanel
        tone="warning"
        title="Fechamento de frequência indisponível"
        description="Turma, atuação pedagógica ou estrutura de períodos não encontradas para este contexto."
      />
    );

  const { structure, year } = state;
  // Com sessão o calendário do laboratório nunca é consultado: dependência institucional indisponível.
  const calendar = !cloud && structure.calendarId ? calendarRepository.get(structure.calendarId) : undefined;
  const official = calendar && isPublished(calendar) ? temporalQueries(calendar) : null;
  const entries = lessonEntries(context.professionalId, localLessons).filter(
    (entry) => entry.classId === classId,
  );
  const accountingUnit = resolveAttendanceAccountingUnit({
    scopeKind: policy.scopeKind,
    context: {
      classId,
      classLabel: klass.name,
      curriculumUnitId: curriculumKey(curriculumRefOf(item.record)),
      curriculumUnitLabel: item.field,
    },
  });

  if (!accountingUnit)
    return (
      <StatePanel
        tone="warning"
        title="Dimensão de apuração não resolvível neste contexto"
        description={`A política declara apuração "${attendanceScopeLabel(policy.scopeKind)}", e este contexto não oferece essa identidade. Nenhuma outra dimensão é presumida em seu lugar.`}
      />
    );


  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Fechamento da frequência"
        description={`${klass.name} · ${accountingUnit.label} · ${year.label}`}
        context={context}
      >
        <Button asChild variant="outline" size="sm">
          <Link to="/diario/turmas/$turmaId" params={{ turmaId: classId }} search={classSearch}>
            <ArrowLeft /> Turma no Diário
          </Link>
        </Button>
      </DiaryHeader>

      <StatePanel tone="info" title={ATTENDANCE_CLOSING_LABEL} description={ATTENDANCE_CLOSING_NOTE} />
      <StatePanel
        tone="warning"
        title="Política de apuração pendente de homologação"
        description={ATTENDANCE_POLICY_PENDING_NOTE}
      />

      <section
        aria-label="Configuração demonstrativa"
        className="grid min-w-0 gap-3 rounded-md border border-border/70 p-4 sm:grid-cols-2"
      >
        <label hidden={cloud} className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">
          Perfil institucional (demonstração)
          <select
            className={cn(inputCls, "font-normal normal-case")}
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
          >
            {ATTENDANCE_DEMONSTRATION_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">
          Política de unidade/apuração
          <select
            className={cn(inputCls, "font-normal normal-case")}
            value={policyId}
            onChange={(e) => setPolicyId(e.target.value)}
          >
            {availablePolicies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          {attendanceScopeLabel(policy.scopeKind)} · unidade contada:{" "}
          {attendanceUnitLabel(policy.unitKind)} ·{" "}
          {ATTENDANCE_POLICY_STATUS_LABEL[policy.status]}
          {policy.note ? ` · ${policy.note}` : ""}
        </p>
      </section>

      {cloud ? (
        <AttendanceOccurrencesSection
          source={occurrenceSource}
          students={rosterStudents().map((s) => ({ id: s.id, name: s.personName }))}
          canRegister={(actor.capabilities as readonly string[]).includes("registrar-ocorrencia-no-prontuario")}
        />
      ) : null}

      <div className="space-y-5">
        {structure.periods
          .slice()
          .sort((a, b) => a.sequence - b.sequence)
          .map((period) => {
            const scope: AttendanceClosingScope = {
              classId,
              academicYearId: year.id,
              periodId: period.id,
              ...(period.calendarPeriodId ? { calendarPeriodId: period.calendarPeriodId } : {}),
              accountingUnit,
            };
            const periodLessons = entries.filter(
              (entry) =>
                entry.date >= period.start &&
                entry.date <= period.end &&
                // Restringe por identidade resolvida, não por tipo de dimensão.
                (accountingUnit.id !== curriculumKey(curriculumRefOf(item.record)) ||
                  entry.assignmentId === item.record.id),

            );
            const ctx: AttendanceClosingContext = {
              scope,
              policy,
              period: {
                id: period.id,
                label: period.label,
                start: period.start,
                end: period.end,
              },
              officialPeriod: Boolean(official && period.calendarPeriodId),
              ...(cloud ? { calendarDependency: "indisponivel" as const } : {}),
              ...(official ? { calendarId: official.calendarId } : {}),
              lessons: periodLessons,
              attendance: localAttendance,
              planned: plannedUnits({
                professionalId: context.professionalId,
                assignmentId: item.record.id,
                start: period.start,
                end: period.end,
                lessons: periodLessons,
                ...(official ? { isSchoolDay: (date) => official.isSchoolDay(date) } : {}),
              }),
              students: rosterStudents(),
              rosterChainDiagnostics: rosterChainDiagnostics(),
              // Com sessão: só a fonte institucional (6D.FINAL.6); nunca o laboratório.
              occurrences: cloud ? occurrenceSource.occurrences : demonstrationOccurrences,
              occurrenceTypes: cloud ? occurrenceSource.types : demonstrationOccurrenceTypes,
              stage: store.stage(scope),
              ...(official ? { isSchoolDay: (date) => official.isSchoolDay(date) } : {}),
            };
            return <AttendanceClosingCard key={period.id} ctx={ctx} actor={actor} store={store} />;
          })}
      </div>
    </div>
  );
}

function AttendanceClosingCard({
  ctx,
  actor,
  store,
}: {
  ctx: AttendanceClosingContext;
  actor: ReturnType<typeof attendanceDemonstrationActor>;
  store: ReturnType<typeof useAttendanceClosingStore>;
}) {
  const [justification, setJustification] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState("");

  const delivery = attendanceDeliveryPendencies(ctx);
  const officialList = attendanceClosingPendencies(ctx);
  const totals = scopeTotals(ctx);
  const facts = studentAttendanceFacts(ctx);
  const chain = store.chain(ctx.scope);
  const current = store.current(ctx.scope);

  const available = (Object.keys(ATTENDANCE_ACTION_CAPABILITY) as AttendanceClosingAction[]).filter(
    (action) =>
      canAttendance(actor, ATTENDANCE_ACTION_CAPABILITY[action]) &&
      attendanceTransitionAllowed(action, ctx.stage),
  );

  const run = (action: AttendanceClosingAction) => {
    setErrors([]);
    setDone("");
    if (isDiaryCloud()) {
      // Domínio valida num clone; o banco revalida tudo e grava ato + versão.
      const clone = createAttendanceClosingStore(structuredClone(store.snapshot()));
      const trial = clone.act({ ctx, actor, action, justification });
      if (!trial.ok) return setErrors(trial.reasons);
      const before = store.current(ctx.scope);
      const after = clone.current(ctx.scope);
      const record = after && after.id !== before?.id ? after : undefined;
      void recordAttendanceClosingActInCloud({
        scope: ctx.scope,
        action,
        detail: ATTENDANCE_ACTION_LABEL[action],
        justification,
        ...(record ? { record } : {}),
      }).then((saved) => {
        if (!saved.ok) return setErrors([saved.message]);
        setJustification("");
        setDone(`${ATTENDANCE_ACTION_LABEL[action]} registrada na base institucional.`);
      });
      return;
    }
    const result = store.act({ ctx, actor, action, justification });
    if (!result.ok) return setErrors(result.reasons);
    setJustification("");
    setDone(`${ATTENDANCE_ACTION_LABEL[action]} registrada.`);
  };

  const button = (action: AttendanceClosingAction, label: string, variant?: "outline") => {
    if (!available.includes(action)) return null;
    return (
      <Button key={action} size="sm" variant={variant ?? "default"} onClick={() => run(action)}>
        {label}
      </Button>
    );
  };

  return (
    <section
      aria-label={`Frequência — ${ctx.period.label}`}
      className="min-w-0 rounded-md border border-border/70 p-4"
    >
      <header className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-foreground">{ctx.period.label}</h2>
          <p className="text-sm text-muted-foreground">
            {formatAcademicDate(ctx.period.start)} — {formatAcademicDate(ctx.period.end)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <StatusBadge tone={ATTENDANCE_STAGE_TONE[ctx.stage]}>
            {ATTENDANCE_STAGE_LABEL[ctx.stage]}
          </StatusBadge>
          <StatusBadge tone={ctx.officialPeriod ? "success" : "warning"}>
            {ctx.officialPeriod
              ? "Período oficial do calendário"
              : ctx.calendarDependency === "indisponivel"
                ? "Calendário institucional indisponível para consulta"
                : "Período não oficial"}
          </StatusBadge>
        </div>
      </header>

      <dl className="mt-3 grid min-w-0 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {ctx.planned === null ? (
          <Total label="Unidades previstas" value="Informação indisponível" hint="Sem fonte de dias letivos consultável" />
        ) : (
          <Total label="Unidades previstas" value={units(totals.plannedUnits)} hint={minutes(totals.plannedMinutes)} />
        )}
        <Total label="Unidades ministradas" value={units(totals.taughtUnits)} hint={minutes(totals.taughtMinutes)} />
        <Total
          label="Previstas sem execução"
          value={ctx.planned === null ? "Informação indisponível" : units(totals.plannedWithoutExecutionUnits)}
          hint="Não geram presença nem ausência"
        />
        <Total
          label="Ministradas sem chamada"
          value={units(totals.taughtWithoutAttendanceUnits)}
          hint="Pendência de registro, nunca falta do aluno"
        />
      </dl>

      <PendencyList
        title="Impedem a entrega da pauta de frequência"
        icon={ShieldAlert}
        items={attendanceBlocking(delivery)}
        tone="danger"
      />
      <PendencyList
        title="Impedem o fechamento oficial"
        icon={Lock}
        items={attendanceBlocking(officialList).filter(
          (p) => !attendanceBlocking(delivery).some((d) => d.code === p.code),
        )}
        tone="warning"
      />
      <PendencyList
        title="Pendências especiais — exigem conferência humana"
        icon={ShieldAlert}
        items={attendanceSpecial(delivery)}
        tone="warning"
      />
      <PendencyList
        title="Avisos"
        icon={History}
        items={attendanceAdvisories(delivery)}
        tone="neutral"
        collapseAfter={6}
      />


      {facts.length ? (
        <div className="mt-4 min-w-0 overflow-x-auto">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <ClipboardList aria-hidden className="size-4 text-primary" /> Fatos de frequência por
            aluno
          </p>
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <caption className="sr-only">
              Unidades aplicáveis, presenças e ausências neutras por aluno
            </caption>
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase text-muted-foreground">
                <th scope="col" className="py-1.5 pr-3">Aluno</th>
                <th scope="col" className="py-1.5 pr-3">Vínculo no período</th>
                <th scope="col" className="py-1.5 pr-3 text-right">Aplicáveis</th>
                <th scope="col" className="py-1.5 pr-3 text-right">Presenças</th>
                <th scope="col" className="py-1.5 pr-3 text-right">Ausências c/ ocorrência</th>
                <th scope="col" className="py-1.5 pr-3 text-right">Ausências s/ ocorrência</th>
                <th scope="col" className="py-1.5 text-right">Sem registro de chamada</th>
              </tr>
            </thead>
            <tbody>
              {facts.map((row) => (
                <tr key={row.studentId} className="border-b border-border/40">
                  <td className="py-1.5 pr-3">{row.studentName}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{row.coverage}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {row.applicableUnits}
                    <span className="block text-xs text-muted-foreground">
                      {minutes(row.applicableMinutes)}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{row.presences}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {row.absencesWithRegisteredOccurrence}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {row.absencesWithoutRegisteredOccurrence}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {row.unitsWithoutAttendanceRecord}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            Ausência com ocorrência apenas indica que existe registro no prontuário do aluno, na
            Secretaria Escolar. Nenhum abono, compensação ou efeito é aplicado nesta etapa.
          </p>
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
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma operação deste ciclo está disponível para este perfil com a frequência em
              “{ATTENDANCE_STAGE_LABEL[ctx.stage]}”. As operações seguintes dependem de outra
              capacidade institucional.
            </p>
          ) : null}
          {button("entrega-docente", "Entregar pauta de frequência")}
          {button("inicio-conferencia", "Iniciar conferência", "outline")}
          {button("devolucao-com-apontamentos", "Devolver com apontamentos", "outline")}
          {button("fechamento-oficial", "Fechar frequência oficialmente")}
          {button("retificacao-pontual", "Registrar retificação", "outline")}
          {button("reabertura-integral", "Reabrir frequência", "outline")}
        </div>
        {errors.length ? (
          <ul aria-live="polite" className="space-y-1 text-sm text-destructive">
            {errors.map((reason) => (
              <li key={reason}>{reason}</li>
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
          <p className="mb-2 text-sm font-semibold text-foreground">
            Versões do fechamento da frequência
          </p>
          <ul className="space-y-1.5 text-sm">
            {chain.map((record) => (
              <li key={record.id} className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={record.id === current?.id ? "success" : "neutral"}>
                  Versão {record.version}
                  {record.id === current?.id ? " · vigente" : " · histórica"}
                </StatusBadge>
                <span className="text-muted-foreground">
                  {formatDateTime(record.closedAt)} · {record.closedBy.actorName} ·{" "}
                  {record.students.length} aluno(s) · {record.totals.taughtUnits} unidade(s)
                  ministrada(s)
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
          <p className="mb-2 text-sm font-semibold text-foreground">Histórico do ciclo</p>
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

function Total({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border/60 p-3">
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="font-display text-xl font-semibold tabular-nums text-foreground">{value}</dd>
      <dd className="text-xs text-muted-foreground">{hint}</dd>
    </div>
  );
}

function PendencyList({
  title,
  items,
  tone,
  icon: Icon,
  collapseAfter,
}: {
  title: string;
  items: AttendancePendency[];
  tone: "danger" | "warning" | "neutral";
  icon: typeof Lock;
  collapseAfter?: number;
}) {
  if (!items.length) return null;
  const limit = collapseAfter ?? items.length;
  const visible = items.slice(0, limit);
  const rest = items.slice(limit);
  const row = (p: AttendancePendency, index: number) => (
    <li key={`${p.code}-${p.studentId ?? p.lessonEntryId ?? index}`}>
      {p.studentName ? <b className="text-foreground">{p.studentName}: </b> : null}
      {p.message}
    </li>
  );
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
      <ul className="space-y-1 text-sm text-muted-foreground">{visible.map(row)}</ul>
      {rest.length ? (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-sm font-medium text-primary">
            Ver os outros {rest.length} registro(s)
          </summary>
          <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">{rest.map(row)}</ul>
        </details>
      ) : null}
    </div>
  );
}


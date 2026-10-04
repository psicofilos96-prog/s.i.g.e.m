import { diaryClassCalendar, useComposedCalendarRefresh } from "@/features/diary/diary-calendar";
import { diaryReference } from "@/features/diary/diary-session-state";
import { useCloudClosingSync } from "@/features/assessment/period-closing-cloud";
import { useCloudStanding } from "@/features/assessment/academic-standing-cloud";
import { useCloudCollegial } from "@/features/collegial/collegial-cloud";
import { academicStandingStore as standingStoreSingleton } from "@/features/assessment/academic-standing-store";
import { collegialStore as collegialStoreSingleton } from "@/features/collegial/collegial-store";
import { normativeSessionArgs, useAssessmentNormativeSource } from "@/features/assessment/assessment-normative-sources";
import { teachingClass, teachingUnitName, teachingAssignments, teachingPersonName } from "@/features/diary/institutional-teaching";
import { rosterStudents } from "@/features/students/institutional-roster";
/**
 * Etapa 12K — tela do encerramento oficial do ciclo e da turma.
 *
 * A tela não calcula nada: mostra cada exigência da política configurada com o
 * seu estado por extenso (satisfeito, não satisfeito, não aplicável,
 * inconclusivo, erro de configuração), lista os impedimentos, permite lavrar o
 * ato quando tudo o que é obrigatório e aplicável está satisfeito e exibe a
 * cadeia de versões com o retrato imutável das fontes utilizadas.
 *
 * Datas na interface: DD/MM/AAAA.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, FileCheck2, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { useAttendanceClosingStore } from "@/features/diary/attendance-closing-store";
import { DiaryHeader } from "@/features/diary/diary-context";
import {
  DEFAULT_DIARY_PROFESSIONAL_ID,
  diaryContext,
  diarySearch,
  type DiarySearch,
} from "@/features/diary/diary-data";
import { useNetworkCalendars } from "@/features/calendar/calendar-store";
import { useCollegialStore } from "@/features/collegial/collegial-store";
import { classConfigurationState } from "@/features/assessment/assessment-configuration";
import { studentPlacements, eligibilityInPeriod } from "@/features/assessment/assessment-rules";
import { resolveCyclesForOrigin } from "@/features/assessment/cycle-configuration";
import { useAcademicReferenceDate, referenceDateValue } from "@/features/academic/academic-reference-date";
import type { SourceAvailability } from "./cycle-closing-evaluators";
import { usePeriodClosingStore } from "@/features/assessment/period-closing-store";
import { useAcademicStandingStore } from "@/features/assessment/academic-standing-store";
import { demonstrationStudents } from "@/features/students/students-data";
import { formatAcademicDate, formatDateTime } from "@/lib/academic-date";
import { inspectCycleClosing } from "./cycle-closing-inspector";
import { closingAnalyticRows } from "./cycle-closing-analytics";
import { useCycleClosingStore } from "./cycle-closing-store";
import { useCloudCycleClosing } from "./cycle-closing-cloud";
import { sessionActor, useSessionAuthority, type SessionAuthority } from "@/features/authority/session-authority";
import {
  assessmentClosingObservations,
  attendanceClosingObservations,
  calendarObservations,
  deliberationObservations,
  periodExpectations,
  standingObservations,
  studentsWithOfficialStanding,
  studentExpectations,
  SOURCE_KIND,
} from "./cycle-closing-sources";
import {
  closingDemonstrationActor,
  closingDemonstrationProfiles,
  CLOSING_DEMONSTRATION_NOTE,
  demonstrationClosingPolicies,
  demonstrationClosingTerminology,
} from "./cycle-closing-fixtures";
import {
  ADMISSIBILITY_LABEL,
  CLOSING_POLICY_STATUS_LABEL,
  CYCLE_CLOSING_MODULE_LABEL,
  CYCLE_CLOSING_MODULE_NOTE,
  REQUIREMENT_STATUS_LABEL,
  terminologyStateLabel,
  type ClosingActor,
  type ClosingDiagnosis,
  type RequirementDiagnosis,
  type RequirementDiagnosisStatus,
} from "./cycle-closing-types";

const TONE: Record<RequirementDiagnosisStatus, "success" | "danger" | "neutral" | "warning"> = {
  satisfeito: "success",
  "nao-satisfeito": "danger",
  "nao-aplicavel": "neutral",
  inconclusivo: "warning",
  "erro-configuracao": "danger",
};

/** Operações do LABORATÓRIO; com sessão vêm só da matriz da política. */
const LAB_OPERATIONS = [
  "registrar-lancamento-avaliativo",
  "abrir-sessao-colegiada",
  "operacao-de-modulo-futuro",
];

/** Texto único da indisponibilidade do calendário institucional (mesmo da B4.6.2a). */
export const INSTITUTIONAL_CALENDAR_UNAVAILABLE =
  "Calendário institucional indisponível: a consulta ao calendário institucional ainda não foi autorizada. Nada é concluído sobre ele.";

/**
 * B4.6.3c — motivo real (adaptador central) sobre o intervalo dos períodos B2.4 do ciclo, com o knownAt
 * do controlador do Diário. Só é consumido pelo requisito que a política homologada declarar.
 */
function cycleCalendarReason(
  classId: string,
  cyclePeriods: readonly { periodId: string }[],
  periods: readonly { id: string; start: string; end: string }[],
): string {
  const hits = cyclePeriods.map((c) => periods.find((p) => p.id === c.periodId));
  const range = hits.length && hits.every(Boolean)
    ? { start: hits.map((p) => p!.start).sort()[0]!, end: hits.map((p) => p!.end).sort().at(-1)! }
    : null;
  const { reason } = diaryClassCalendar(classId, range);
  return reason ? `${INSTITUTIONAL_CALENDAR_UNAVAILABLE} ${reason}` : INSTITUTIONAL_CALENDAR_UNAVAILABLE;
}

type SignedInAuthority = Extract<SessionAuthority, { status: "signed-in" }>;

/**
 * Origem explícita da execução (B4.6.2b.1.1): laboratório (sem sessão, com calendário local) ou
 * institucional com o MESMO snapshot de autoridade confirmado pela fronteira — o corpo nunca
 * consulta outra instância de sessão nem deriva origem de um booleano.
 */
export type ClosingOrigin =
  | { kind: "laboratorio"; calendars: readonly { id: string; year: number; status: string; label?: string }[] }
  | { kind: "institucional"; authority: SignedInAuthority };

/**
 * B4.6.2b.1 — fronteira de sessão do encerramento. Sessão incerta: só carregamento (nenhum
 * hook de calendário/storage, nenhum motor). Sem sessão: laboratório. Com sessão: execução
 * institucional, remontada por usuário, sem calendário do laboratório.
 */
export function CycleClosingPage({ classId, search }: { classId: string; search: DiarySearch }) {
  const authority = useSessionAuthority();
  if (authority.status === "loading")
    return <StatePanel tone="neutral" title="Verificando sessão…" description="O encerramento aparece depois que a sessão for confirmada." />;
  if (authority.status === "signed-out") return <LabCycleClosing classId={classId} search={search} />;
  return (
    <CycleClosingBody
      key={authority.user.id}
      classId={classId}
      search={search}
      origin={{ kind: "institucional", authority }}
    />
  );
}

function LabCycleClosing({ classId, search }: { classId: string; search: DiarySearch }) {
  const calendars = useNetworkCalendars();
  return <CycleClosingBody classId={classId} search={search} origin={{ kind: "laboratorio", calendars }} />;
}

function CycleClosingBody({
  classId,
  search,
  origin,
}: {
  classId: string;
  search: DiarySearch;
  origin: ClosingOrigin;
}) {
  const store = useCycleClosingStore();
  const authority: SessionAuthority = origin.kind === "institucional" ? origin.authority : { status: "signed-out" };
  const cloud = origin.kind === "institucional";
  useComposedCalendarRefresh();
  const cloudClosing = useCloudCycleClosing(classId, cloud, {
    userId: origin.kind === "institucional" ? origin.authority.user.id : null,
    sessionRevision: origin.kind === "institucional" ? origin.authority.sessionRevision : null,
  });
  const closings = usePeriodClosingStore();
  const attendance = useAttendanceClosingStore();
  const standings = useAcademicStandingStore();
  const collegial = useCollegialStore();
  // 6D.FINAL.5 — com sessão, fechamentos, situações e atas são hidratados do banco.
  const sessionUserId = origin.kind === "institucional" ? origin.authority.user.id : null;
  const sessionRevision = origin.kind === "institucional" ? origin.authority.sessionRevision : null;
  const closingSync = useCloudClosingSync(cloud, { userId: sessionUserId, sessionRevision });
  const standingSync = useCloudStanding(standingStoreSingleton, classId, cloud, { userId: sessionUserId, sessionRevision });
  const collegialSync = useCloudCollegial(collegialStoreSingleton, classId, cloud, { userId: sessionUserId, sessionRevision });
  // B4.10.0a — espelhos globais só são lidos depois de aceitos para ESTE contexto.
  const mirrorsReady = closingSync.ready && standingSync.ready && collegialSync.ready;
  const mirrorError = closingSync.error ?? (standingSync.error || collegialSync.error || undefined);

  const [policyId, setPolicyId] = useState(demonstrationClosingPolicies[0]!.id);
  const [profileId, setProfileId] = useState(closingDemonstrationProfiles[1]!.id);
  const [justification, setJustification] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; lines: string[] } | null>(
    null,
  );

  // B4.6.2b.2 — data acadêmica explícita, capturada uma vez; com sessão nunca a data fixa do laboratório.
  const referenceDate = useAcademicReferenceDate(search.data, cloud);
  const academicDate = referenceDateValue(referenceDate);
  const klass = teachingClass(classId);
  // Mesmo snapshot de autoridade da fronteira (nunca segunda instância de sessão).
  const norms = useAssessmentNormativeSource({
    classId, ...normativeSessionArgs(authority), ...(referenceDate.kind === "invalid" ? { pending: true } : {}),
    stageId: klass?.stageId ?? undefined, academicYearId: klass?.academicYearId, academicDate,
  });
  const state = norms.state;

  if (referenceDate.kind === "invalid")
    return <StatePanel tone="warning" title="Encerramento indisponível" description={referenceDate.reason} />;
  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, referenceDate.date);
  const item = context.assignments.find((assignment) => assignment.classId === classId);

  if (cloud && (!norms.ready || !cloudClosing.ready || !mirrorsReady))
    return <StatePanel tone="info" title="Carregando" description="Lendo configuração e política de encerramento homologadas." />;
  if (cloud && cloudClosing.error)
    return <StatePanel tone="danger" title="Encerramento indisponível" description="Não foi possível ler as políticas de encerramento homologadas. Nada é concluído." />;
  if (cloud && mirrorError)
    return <StatePanel tone="danger" title="Encerramento indisponível" description="Não foi possível ler fechamentos, situações ou atas oficiais. Isto não significa que não existam; nada é concluído." />;

  if (!klass || !item || !("configuration" in state) || !("structure" in state))
    return (
      <StatePanel
        tone="warning"
        title="Encerramento indisponível"
        description="Turma, atuação pedagógica ou configuração avaliativa não encontradas para este contexto."
      />
    );

  const { configuration, structure, year } = state;
  // B4.6.2b.2 (A6) — com sessão, sem fonte homologada de ciclos ⇒ indisponível (nunca fallback/calendário local).
  const cycleResolution = resolveCyclesForOrigin(origin.kind, { configuration, structure });
  if (cycleResolution.kind === "unavailable")
    return <StatePanel tone="warning" title="Encerramento indisponível" description={cycleResolution.reason} />;
  // Laboratório: legado demonstrativo (primeiro ciclo do fallback declarado).
  const cycle = cycleResolution.cycles[0];
  const classSearch = diarySearch(search, { professor: context.professionalId, turma: classId });

  const students = rosterStudents()
    .filter((student) => {
      const placements = studentPlacements(student);
      return structure.periods.some(
        (period) => eligibilityInPeriod(placements, classId, period).coverage !== "sem-vinculo",
      );
    })
    .map((student) => ({ id: student.id, name: student.personName }));

  // Com sessão: política só da base (homologada) e ator só das capacidades efetivas.
  const policy = cloud
    ? (cloudClosing.policies.find((item) => item.id === policyId) ?? cloudClosing.policies[0])
    : demonstrationClosingPolicies.find((item) => item.id === policyId)!;
  // Com sessão, nunca perfil demonstrativo: sem ator resolvido ⇒ conta da sessão sem capacidades.
  const actor: ClosingActor =
    origin.kind === "institucional"
      ? ((sessionActor(origin.authority, { classId }) as ClosingActor | null) ?? {
          id: origin.authority.user.id,
          name: origin.authority.person?.displayName ?? "Conta sem vínculo institucional",
          profileLabel: "Sessão institucional",
          capabilities: [],
        })
      : closingDemonstrationActor(profileId);
  if (!policy)
    return (
      <StatePanel
        tone="warning"
        title="Encerramento indisponível"
        description="Não existe política de encerramento homologada registrada. Nenhuma política demonstrativa é usada no lugar."
      />
    );
  // 6D.FINAL.6 — terminologia normativa só da política; com sessão, nunca a demonstrativa.
  const terminology = policy.institutionalTerminology ?? (cloud ? undefined : demonstrationClosingTerminology);
  if (!terminology)
    return (
      <StatePanel
        tone="warning"
        title="Encerramento indisponível"
        description="A política de encerramento homologada não declara os estados e as naturezas de ato do encerramento. Nenhuma terminologia demonstrativa é usada no lugar."
      />
    );
  const operations = cloud
    ? [...new Map((policy.admissibilityPolicy?.rules ?? []).map((r) => [r.operationId, r.label])).entries()]
    : LAB_OPERATIONS.map((id) => [id, id] as const);

  if (!cycle)
    return (
      <div className="space-y-5">
        <DiaryHeader
          title={CYCLE_CLOSING_MODULE_LABEL}
          description={`${klass.name} · ${year.label}`}
          context={context}
        />
        <StatePanel
          tone="warning"
          title="Nenhum ciclo configurado para esta turma"
          description="O encerramento recebe o ciclo já resolvido pela configuração. Sem ciclo configurado nada é encerrado, e nenhuma duração é presumida."
        />
      </div>
    );

  const observations = [
    ...(origin.kind === "laboratorio" ? calendarObservations(origin.calendars, year.id) : []),
    ...assessmentClosingObservations(closings.allRecords(), classId),
    ...attendanceClosingObservations(attendance.allRecords(), classId),
    ...standingObservations(standings.records(), { classId, cycleId: cycle.id }),
    ...deliberationObservations(collegial.minutes(), { classId, cycleId: cycle.id }),
  ];

  const expectations = [
    ...periodExpectations({
      sourceKind: SOURCE_KIND.assessmentPeriodClosing,
      classId,
      academicYearId: year.id,
      periods: cycle.periods.map((period) => ({ id: period.periodId, label: period.label })),
    }),
    ...periodExpectations({
      sourceKind: SOURCE_KIND.attendancePeriodClosing,
      classId,
      academicYearId: year.id,
      periods: cycle.periods.map((period) => ({ id: period.periodId, label: period.label })),
    }),
    ...studentExpectations({
      sourceKind: SOURCE_KIND.academicStanding,
      classId,
      cycleId: cycle.id,
      students,
    }),
  ];

  const diagnosis = inspectCycleClosing({
    policy,
    context: {
      classId,
      cycleId: cycle.id,
      academicYearId: year.id,
      students: studentsWithOfficialStanding(students, standings.records(), cycle.id),
      observations,
      expectations,
      now: new Date().toISOString(),
      ...(origin.kind === "institucional"
        ? { sourceAvailability: [{ sourceKind: SOURCE_KIND.calendar, state: "indisponivel", reason: cycleCalendarReason(classId, cycle.periods, structure.periods) } satisfies SourceAvailability] }
        : {}),
    },
  });

  const chain = store.chain({ classId, cycleId: cycle.id });
  const current = store.current({ classId, cycleId: cycle.id });
  const institutionalState = store.institutionalState(
    { classId, cycleId: cycle.id },
    terminology.states.open.id,
  );

  const studentRecords = diagnosis.students.map((student) => ({
    studentId: student.studentId,
    ...(student.studentName ? { studentName: student.studentName } : {}),
    cycleId: cycle.id,
    ...(student.terminalStandingId ? { terminalStandingId: student.terminalStandingId } : {}),
    completeness: student.status,
    reason: student.reason,
    diagnoses: student.diagnoses,
    facts: [],
    sources: student.diagnoses.flatMap((entry) => entry.evidence ?? []),
  }));

  const sources = diagnosis.classRequirements.flatMap((entry) => entry.evidence ?? []);

  const handle = (kind: "encerrar" | "retificar" | "reabrir") => {
    if (cloud) {
      if (!cloudClosing.policies.length) {
        setFeedback({ tone: "danger", lines: ["Não há política de encerramento homologada na base institucional. Nada foi gravado."] });
        return;
      }
      const operation = kind === "encerrar" ? "lavratura" : kind === "retificar" ? "retificacao" : "reabertura";
      void cloudClosing
        .commit(operation, { classId, cycleId: cycle.id }, justification, (clone) => run(clone, kind))
        .then((result) =>
          setFeedback(
            result.ok
              ? { tone: "success", lines: ["Ato registrado na base institucional com retrato versionado."] }
              : { tone: "danger", lines: result.reasons },
          ),
        );
      return;
    }
    const result = run(store, kind);
    setFeedback(
      result.ok
        ? { tone: "success", lines: ["Ato registrado e versionado como demonstração."] }
        : { tone: "danger", lines: result.reasons },
    );
  };

  const run = (target: typeof store, kind: "encerrar" | "retificar" | "reabrir") => {
    const base = {
      actor,
      policy,
      classId,
      cycleId: cycle.id,
      academicYearId: year.id,
      diagnosis,
      students: studentRecords,
      sources,
      facts: [],
      institutionalState: terminology.states.closed.id,
    };
    const result =
      kind === "encerrar"
        ? target.close({
            ...base,
            actKindId: terminology.acts.closing.id,
            actKindLabel: terminology.acts.closing.label,
          })
        : kind === "retificar"
          ? target.rectify({
              ...base,
              actKindId: terminology.acts.rectification.id,
              actKindLabel: terminology.acts.rectification.label,
              justification,
            })
          : target.reopen({
              actor,
              policy,
              classId,
              cycleId: cycle.id,
              justification,
              institutionalState: terminology.states.underRectification.id,
              actKindLabel: terminology.acts.reopening.label,
            });
    return result;
  };

  return (
    <div className="space-y-5">
      <DiaryHeader
        title={CYCLE_CLOSING_MODULE_LABEL}
        description={`${klass.name} · ${cycle.label} · ${year.label}`}
        context={context}
      >
        <Button asChild variant="outline" size="sm">
          <Link
            to="/diario/turmas/$turmaId/avaliacao/situacao"
            params={{ turmaId: classId }}
            search={classSearch}
          >
            <ArrowLeft /> Situação acadêmica
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link
            to="/diario/turmas/$turmaId/projecao"
            params={{ turmaId: classId }}
            search={classSearch}
          >
            Projeção canônica
          </Link>
        </Button>
      </DiaryHeader>

      <StatePanel
        tone="info"
        title="O encerramento confere a cadeia; ele não recalcula nada"
        description={CYCLE_CLOSING_MODULE_NOTE}
      />
      {cloud ? null : <StatePanel tone="warning" title="Demonstração" description={CLOSING_DEMONSTRATION_NOTE} />}

      <section aria-label="Cadeia institucional do encerramento" className="min-w-0 rounded-md border border-border/70 p-4">
        <ol className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {["Períodos fechados", "Consolidação do ciclo", "Recuperação final, quando aplicável", "Situação acadêmica", "Conselho, quando aplicável", "Encerramento oficial"].map((step, i, all) => (
            <li key={step} className="text-foreground">{step}{i < all.length - 1 ? <span aria-hidden className="text-muted-foreground"> →</span> : null}</li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-muted-foreground">
          {diagnosis.students.filter((s) => s.status === "satisfeito" || s.status === "nao-aplicavel").length} percurso(s) apto(s) ·{" "}
          {policy.terminalStandingRequirement?.required
            ? `${diagnosis.students.filter((s) => !s.terminalStandingId).length} sem situação acadêmica oficial · `
            : ""}
          {diagnosis.students.filter((s) => s.status === "inconclusivo").length} indeterminado(s) ·{" "}
          {diagnosis.impediments.length} requisito(s) ainda não satisfeito(s)
        </p>
        {current ? <p className="mt-1 text-sm font-medium text-foreground">Ciclo/ano oficialmente encerrado.</p> : null}
      </section>

      <section
        aria-label="Política de encerramento e perfil em uso"
        className="min-w-0 rounded-md border border-border/70 p-4"
      >
        <h2 className="font-display text-lg font-semibold text-foreground">
          Política configurada e perfil em uso
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="enc-politica">Política de encerramento</Label>
            <select
              id="enc-politica"
              value={policyId}
              onChange={(event) => setPolicyId(event.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {(cloud ? cloudClosing.policies : demonstrationClosingPolicies).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div hidden={cloud}>
            <Label htmlFor="enc-perfil">Perfil institucional</Label>
            <select
              id="enc-perfil"
              value={profileId}
              onChange={(event) => setProfileId(event.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {closingDemonstrationProfiles.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.profileLabel}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{policy.description}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusBadge tone="neutral">{CLOSING_POLICY_STATUS_LABEL[policy.status]}</StatusBadge>
          <StatusBadge tone="neutral">
            Estado institucional: {terminologyStateLabel(terminology, institutionalState)}
          </StatusBadge>
          <StatusBadge tone="neutral">
            Situação terminal exigida: {policy.terminalStandingRequirement?.required ? "sim" : "não"}
          </StatusBadge>
        </div>
      </section>

      <DiagnosisPanel diagnosis={diagnosis} />

      <section
        aria-label="Ato de encerramento"
        className="min-w-0 rounded-md border border-border/70 p-4"
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <FileCheck2 aria-hidden className="size-4 text-primary" /> Ato de encerramento
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A lavratura só avança com todos os requisitos obrigatórios e aplicáveis satisfeitos.
          Alterar encerramento lavrado é exceção formal: exige justificativa e capacidade cadastrada.
        </p>
        <div className="mt-3">
          <Label htmlFor="enc-justificativa">Justificativa (retificação ou reabertura)</Label>
          <Textarea
            id="enc-justificativa"
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            placeholder="Fundamente a exceção formal."
            className="mt-1"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => handle("encerrar")} disabled={!diagnosis.closable}>
            Lavrar encerramento
          </Button>
          <Button size="sm" variant="outline" onClick={() => handle("retificar")}>
            Retificar encerramento
          </Button>
          <Button size="sm" variant="outline" onClick={() => handle("reabrir")}>
            Reabrir para retificação
          </Button>
        </div>
        {feedback ? (
          <div className="mt-3">
            <StatePanel
              tone={feedback.tone === "success" ? "success" : "danger"}
              title={feedback.tone === "success" ? "Ato registrado" : "Ato não realizado"}
              description={feedback.lines.join(" ")}
            />
          </div>
        ) : null}
      </section>

      <section
        aria-label="Operações admitidas após o encerramento"
        className="min-w-0 rounded-md border border-border/70 p-4"
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <Lock aria-hidden className="size-4 text-primary" /> Operações no estado atual
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {operations.length === 0 ? (
            <li className="text-muted-foreground">A política não cadastra operações na matriz de admissibilidade.</li>
          ) : null}
          {operations.map(([operationId, operationLabel]) => {
            const decision = store.admissibility({
              policy,
              classId,
              cycleId: cycle.id,
              operationId,
              initialState: terminology.states.open.id,
            });
            return (
              <li key={operationId} className="min-w-0">
                <StatusBadge tone={decision.admissibility === "permitida" ? "success" : "warning"}>
                  {ADMISSIBILITY_LABEL[decision.admissibility]}
                </StatusBadge>
                <span className="ml-2 font-medium text-foreground">{operationLabel}</span>
                <p className="text-muted-foreground">{decision.reason}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-label="Cadeia de versões do encerramento"
        className="min-w-0 rounded-md border border-border/70 p-4"
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <ShieldAlert aria-hidden className="size-4 text-primary" /> Cadeia de versões
        </h2>
        {chain.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhum encerramento lavrado para esta turma e ciclo.
          </p>
        ) : (
          <ul className="mt-3 space-y-3 text-sm">
            {chain.map((snapshot) => (
              <li key={snapshot.id} className="min-w-0 rounded-md border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={snapshot.id === current?.id ? "success" : "neutral"}>
                    Versão {snapshot.version}
                    {snapshot.id === current?.id ? " · vigente" : ""}
                  </StatusBadge>
                  <StatusBadge tone="neutral">{snapshot.act.kindLabel}</StatusBadge>
                  <StatusBadge tone="neutral">
                    {terminologyStateLabel(terminology, snapshot.institutionalState)}
                  </StatusBadge>
                </div>
                <p className="mt-2 text-muted-foreground">
                  Lavrado por {snapshot.act.declaredBy.actorName} (
                  {snapshot.act.declaredBy.profileLabel}) em{" "}
                  {formatDateTime(snapshot.act.declaredAt)}.
                </p>
                {snapshot.act.justification ? (
                  <p className="text-muted-foreground">
                    Justificativa: {snapshot.act.justification}
                  </p>
                ) : null}
                <p className="mt-1 text-muted-foreground">
                  {snapshot.students.length} percurso(s), {snapshot.sources.length} fonte(s)
                  referenciada(s) e {snapshot.facts.length} fato(s) materializado(s). Retrato de{" "}
                  {formatAcademicDate(snapshot.materializedAt)}.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StatePanel
        tone="neutral"
        title="Fatos atômicos disponíveis ao CIECE"
        description={`${closingAnalyticRows(store.snapshots()).length} linha(s) de proveniência estruturada, sem taxa ou indicador calculado nesta etapa.`}
      />
    </div>
  );
}

function DiagnosisPanel({ diagnosis }: { diagnosis: ClosingDiagnosis }) {
  return (
    <section
      aria-label="Diagnóstico da cadeia de encerramento"
      className="min-w-0 rounded-md border border-border/70 p-4"
    >
      <h2 className="font-display text-lg font-semibold text-foreground">
        Diagnóstico da cadeia
      </h2>
      <div className="mt-2 flex flex-wrap gap-2">
        <StatusBadge tone={diagnosis.closable ? "success" : "warning"}>
          {diagnosis.satisfiedMandatory} de {diagnosis.applicableMandatory} requisito(s)
          obrigatório(s) e aplicável(is) satisfeito(s)
        </StatusBadge>
        <StatusBadge tone={diagnosis.closable ? "success" : "danger"}>
          {diagnosis.closable ? "Encerramento admissível" : "Encerramento bloqueado"}
        </StatusBadge>
      </div>

      <RequirementList
        title="Exigências da turma e do ciclo"
        items={diagnosis.classRequirements}
      />

      <h3 className="mt-4 font-medium text-foreground">Percursos</h3>
      <ul className="mt-2 space-y-3 text-sm">
        {diagnosis.students.map((student) => (
          <li key={student.studentId} className="min-w-0 rounded-md border border-border/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">
                {student.studentName ?? student.studentId}
              </span>
              <StatusBadge tone={TONE[student.status]}>
                {REQUIREMENT_STATUS_LABEL[student.status]}
              </StatusBadge>
              <StatusBadge tone="neutral">
                Situação terminal: {student.terminalStandingId ?? "não determinada"}
              </StatusBadge>
            </div>
            <p className="mt-1 text-muted-foreground">{student.reason}</p>
            {student.diagnoses.length ? (
              <RequirementList title="Exigências individuais" items={student.diagnoses} />
            ) : null}
          </li>
        ))}
      </ul>

      {diagnosis.impediments.length ? (
        <div className="mt-4">
          <h3 className="font-medium text-foreground">Impedimentos por extenso</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {diagnosis.impediments.map((impediment) => (
              <li key={impediment}>{impediment}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function RequirementList({
  title,
  items,
}: {
  title: string;
  items: readonly RequirementDiagnosis[];
}) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <h3 className="font-medium text-foreground">{title}</h3>
      <ul className="mt-2 space-y-2 text-sm">
        {items.map((item) => (
          <li key={`${item.requirementId}-${item.studentId ?? "turma"}`} className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={TONE[item.status]}>
                {REQUIREMENT_STATUS_LABEL[item.status]}
              </StatusBadge>
              <span className="font-medium text-foreground">{item.label}</span>
            </div>
            <p className="text-muted-foreground">{item.reason}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

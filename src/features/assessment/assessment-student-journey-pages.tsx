/**
 * Etapa 12D — tela de percurso avaliativo do aluno. Somente leitura.
 * Nenhum valor consolidado (média, soma, resultado, situação) é exibido.
 */
import { Link } from "@tanstack/react-router";
import { ChevronDown, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { DiaryHeader } from "@/features/diary/diary-context";
import {
  DEFAULT_DIARY_PROFESSIONAL_ID,
  diaryContext,
  type DiarySearch,
} from "@/features/diary/diary-data";
import {
  fieldLabel,
  infantExperienceFixtures,
  useLocalInfantExperiences,
} from "@/features/diary/infant-experiences";
import { getDemonstrationStudent } from "@/features/students/students-data";
import { formatAcademicDate } from "@/lib/academic-date";
import { cn } from "@/lib/utils";
import { entryValueLabel } from "./assessment-instruments";
import { useInstrumentStore } from "./assessment-instrument-store";
import {
  buildStudentJourney,
  classLabel,
  type JourneyItem,
  type JourneyPeriod,
  type PeriodCounts,
} from "./assessment-student-journey";
import type { AssessmentConfiguration } from "./assessment-types";

const STATE_LABEL: Record<JourneyItem["state"], string> = {
  registrado: "Registrado",
  "nao-registrado": "Não registrado (com motivo)",
  pendente: "Pendente",
  planejado: "Planejado",
  "nao-elegivel": "Não elegível na data",
};
const STATE_TONE = {
  registrado: "success",
  "nao-registrado": "neutral",
  pendente: "warning",
  planejado: "info",
  "nao-elegivel": "neutral",
} as const;

export function StudentAssessmentJourneyPage({
  classId,
  studentId,
  search,
}: {
  classId: string;
  studentId: string;
  search: DiarySearch;
}) {
  const store = useInstrumentStore();
  const localInfant = useLocalInfantExperiences();
  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data);
  const student = getDemonstrationStudent(studentId);
  if (!student)
    return (
      <StatePanel
        tone="danger"
        title="Aluno não encontrado"
        description="O identificador não corresponde a um registro fictício."
      />
    );
  const snap = store.snapshot();
  const journey = buildStudentJourney({
    student,
    contextClassId: classId,
    referenceDate: context.referenceDate,
    source: {
      instruments: snap.instruments,
      entries: snap.entries,
      typeLabel: store.typeLabel,
      periodLabel: store.periodLabel,
      infantRecords: [...infantExperienceFixtures, ...localInfant],
    },
  });

  return (
    <div className="space-y-6">
      <DiaryHeader
        title={student.personName}
        description={`${student.sigemId} · percurso avaliativo no contexto de ${classLabel(classId)}`}
        context={context}
      >
        <Button asChild variant="outline" size="sm">
          <Link to="/diario/turmas/$turmaId/avaliacao" params={{ turmaId: classId }} search={search}>
            Avaliação da turma
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/alunos/$id" params={{ id: studentId }}>
            Ficha do aluno
          </Link>
        </Button>
      </DiaryHeader>

      {journey.kind === "sem-configuracao" ? (
        <StatePanel tone="warning" title="Sem configuração avaliativa" description={journey.reason} />
      ) : (
        <>
          <Placement journey={journey} />
          {journey.kind === "acompanhamento" ? (
            <InfantTimeline items={journey.timeline} />
          ) : (
            <section aria-labelledby="regua" className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="regua" className="font-display text-xl font-semibold text-foreground">
                  Percurso por período
                </h2>
                <Counts counts={journey.totals} />
              </div>
              {journey.lastPlacementEnd && (
                <p className="text-sm text-muted-foreground">
                  Percurso encerrado em {formatAcademicDate(journey.lastPlacementEnd)}. Instrumentos
                  posteriores não geram pendência.
                </p>
              )}
              <div className="divide-y divide-border/70 border-y border-border/70">
                {journey.periods.map((p) => (
                  <PeriodBand key={p.periodId} period={p} configuration={journey.configuration} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Contagens de instrumentos por situação. Nenhuma média, soma, peso ou resultado é
                calculado — não há regra homologada.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Placement({
  journey,
}: {
  journey: Extract<ReturnType<typeof buildStudentJourney>, { placements: unknown }>;
}) {
  const at = journey.placementAtReference;
  return (
    <section aria-label="Colocação acadêmica" className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Ano letivo" value={journey.academicYearId.replace("ano-", "")} />
      <Field
        label="Turma na data consultada"
        value={at?.classId ? classLabel(at.classId) : "Sem alocação na data"}
      />
      <Field
        label="Turmas no ano"
        value={journey.classIds.map(classLabel).join(" · ") || "Nenhuma"}
      />
      <Field label="Configuração" value={journey.configuration.label} />
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function Counts({ counts }: { counts: PeriodCounts }) {
  const parts: Array<[string, number]> = [
    ["registrados", counts.registrado],
    ["pendentes", counts.pendente],
    ["não registrados", counts["nao-registrado"]],
    ["corrigidos", counts.corrigido],
    ["não elegíveis", counts["nao-elegivel"]],
  ];
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Contagem de instrumentos">
      {parts.map(([l, n]) => (
        <span key={l}>
          <span className="font-semibold tabular-nums text-foreground">{n}</span> {l}
        </span>
      ))}
    </p>
  );
}

function PeriodBand({
  period,
  configuration,
}: {
  period: JourneyPeriod;
  configuration: AssessmentConfiguration;
}) {
  const counted = period.items.filter((i) => i.state !== "nao-elegivel");
  const informative = period.items.filter((i) => i.state === "nao-elegivel");
  return (
    <details open={period.current} className="group py-3">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
        <span className="flex min-w-0 items-center gap-2">
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
          <span className="font-semibold text-foreground">{period.label}</span>
          {period.start && period.end && (
            <span className="text-xs text-muted-foreground">
              {formatAcademicDate(period.start)} — {formatAcademicDate(period.end)}
            </span>
          )}
          {period.current && <StatusBadge tone="info">Período corrente</StatusBadge>}
        </span>
        <Counts counts={period.counts} />
      </summary>
      <div className="mt-3 space-y-3 pl-6">
        <p className="text-xs font-medium text-muted-foreground">Resultado ainda não consolidado</p>
        {period.pathClosed ? (
          <p className="text-sm text-muted-foreground">
            Encerramento de percurso: o vínculo terminou antes deste período.
          </p>
        ) : counted.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum instrumento aplicado ao aluno.</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {counted.map((i) => (
              <ItemRow key={i.instrumentId} item={i} configuration={configuration} />
            ))}
          </ul>
        )}
        {informative.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground">
              Informativo · fora do vínculo na data (não entra na contagem de pendências)
            </p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {informative.map((i) => (
                <li key={i.instrumentId}>
                  {i.historical.title} · {formatAcademicDate(i.appliedOn)} ·{" "}
                  {i.ineligibility?.reason === "ingresso-posterior"
                    ? `ingresso posterior (${formatAcademicDate(i.ineligibility.date)})`
                    : i.ineligibility?.reason === "saida-anterior"
                      ? `saída anterior (${formatAcademicDate(i.ineligibility.date)})`
                      : "sem vínculo na data"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function ItemRow({ item, configuration }: { item: JourneyItem; configuration: AssessmentConfiguration }) {
  const e = item.entry;
  const renamed =
    item.current.typeLabel !== item.historical.typeLabel ||
    item.current.periodLabel !== item.historical.periodLabel;
  return (
    <li className="py-2">
      <details className="group/item">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
          <span className="min-w-0">
            <span className="block break-words text-sm font-medium text-foreground">
              {item.historical.title}
            </span>
            <span className="block text-xs text-muted-foreground">
              {item.historical.typeLabel} · {formatAcademicDate(item.appliedOn)} ·{" "}
              {item.historical.classLabel}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            {e?.status === "registrado" && item.state === "registrado" && (
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {entryValueLabel(e.value, configuration)}
              </span>
            )}
            <StatusBadge tone={STATE_TONE[item.state]}>
              {item.draft ? "Pendente · rascunho" : STATE_LABEL[item.state]}
            </StatusBadge>
            {item.corrected && <StatusBadge tone="info">Corrigido</StatusBadge>}
          </span>
        </summary>
        <dl className="mt-2 grid gap-x-6 gap-y-2 border-l-2 border-border/70 pl-3 text-xs sm:grid-cols-2">
          <Detail label="Componente (na época)" value={item.historical.field || "—"} />
          <Detail label="Período (na época)" value={item.historical.periodLabel} />
          {renamed && (
            <Detail
              label="Rótulo atual (referência)"
              value={`${item.current.typeLabel} · ${item.current.periodLabel}`}
            />
          )}
          <Detail
            label="Origem do período"
            value={
              item.periodSource === "calendario-homologado"
                ? "Calendário homologado"
                : "Não oficial · cenário demonstrativo"
            }
          />
          {e ? (
            <>
              <Detail label="Valor" value={entryValueLabel(e.value, configuration)} />
              <Detail label="Registrado em" value={formatAcademicDate(e.recordedAt.slice(0, 10))} />
              <Detail label="Atuação responsável" value={e.recordedByAssignmentId} />
            </>
          ) : (
            <Detail label="Lançamento" value="Ainda não lançado" />
          )}
        </dl>
        {e?.history?.length ? (
          <div className="mt-2 pl-3">
            <p className="flex items-center gap-1 text-xs font-semibold text-foreground">
              <History className="size-3.5" /> Versões anteriores
            </p>
            <ol className="mt-1 space-y-1 text-xs text-muted-foreground">
              {e.history.map((h, n) => (
                <li key={n} className="break-words">
                  <span className="font-medium text-foreground">{entryValueLabel(h.value, configuration)}</span>{" "}
                  · registrado {formatAcademicDate(h.recordedAt.slice(0, 10))} · substituído{" "}
                  {formatAcademicDate(h.replacedAt.slice(0, 10))} · “{h.justification}”
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </details>
    </li>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("break-words font-medium text-foreground")}>{value}</dd>
    </div>
  );
}

function InfantTimeline({
  items,
}: {
  items: Extract<ReturnType<typeof buildStudentJourney>, { kind: "acompanhamento" }>["timeline"];
}) {
  return (
    <section aria-labelledby="ei" className="space-y-3">
      <h2 id="ei" className="font-display text-xl font-semibold text-foreground">
        Acompanhamento pedagógico
      </h2>
      <p className="text-sm text-muted-foreground">
        Experiências e observações já registradas no Diário. Esta configuração não utiliza
        instrumentos, notas nem conceitos.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma experiência no período de vínculo.</p>
      ) : (
        <ol className="divide-y divide-border/70 border-y border-border/70">
          {items.map((i) => (
            <li key={i.experienceId} className="py-3">
              <p className="text-xs text-muted-foreground">
                {formatAcademicDate(i.date)} · {classLabel(i.classId)}
              </p>
              <p className="break-words font-medium text-foreground">{i.title}</p>
              <p className="text-xs text-muted-foreground">{i.fieldIds.map(fieldLabel).join(" · ")}</p>
              {i.individualObservation && (
                <p className="mt-1 break-words border-l-2 border-primary/40 pl-2 text-sm text-foreground">
                  {i.individualObservation}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

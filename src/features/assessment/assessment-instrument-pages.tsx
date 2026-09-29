/**
 * Etapa 12C — telas de instrumentos e lançamentos no Diário.
 * Nenhuma média, soma, peso, resultado ou situação é exibido ou calculado.
 */
import { useMemo, useState, type ReactNode } from "react";
import { DateInput } from "@/components/sigem/date-input";
import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ClipboardList, History, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { DiaryHeader } from "@/features/diary/diary-context";
import {
  DEFAULT_DIARY_PROFESSIONAL_ID,
  diaryContext,
  diarySearch,
  type DiarySearch,
} from "@/features/diary/diary-data";
import { demonstrationStudents } from "@/features/students/students-data";
import { formatAcademicDate } from "@/lib/academic-date";
import { cn } from "@/lib/utils";
import { classConfigurationState, type ConfigurationState } from "./assessment-configuration";
import {
  allowedTypes,
  entryValueLabel,
  instrumentFlowAvailable,
  instrumentRoster,
  resolveInstrumentPeriod,
  rosterProgress,
  type RosterEligible,
} from "./assessment-instruments";
import { useInstrumentStore } from "./assessment-instrument-store";
import { fieldVersionStore, useFieldVersionTick } from "./assessment-entry-field-config";
import { currentAssessmentEntryVersion } from "./assessment-entry-versions";

/** Registrados = fatos oficiais vigentes da pauta canônica (sem estado paralelo). */
function registeredOfficialCount(instrumentId: string): number {
  const versions = fieldVersionStore.versions(instrumentId);
  const logical = new Set(versions.map((v) => v.logicalEntryId));
  let n = 0;
  for (const id of logical) if (currentAssessmentEntryVersion(versions, id)?.status === "registrado") n++;
  return n;
}
import type {
  AssessmentConfiguration,
  AssessmentEntry,
  AssessmentInstrument,
  AssessmentPeriodStructure,
  EntryValue,
  ScaleDefinition,
} from "./assessment-types";

const inputCls =
  "h-9 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring";

type Resolved = Extract<ConfigurationState, { configuration: AssessmentConfiguration }>;
function resolved(state: ConfigurationState): state is Resolved {
  return "configuration" in state && "structure" in state;
}

function useDiaryClass(classId: string, search: DiarySearch) {
  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data);
  const item = context.assignments.find((a) => a.classId === classId);
  const classSearch = diarySearch(search, {
    professor: context.professionalId,
    turma: classId,
    ...(item ? { unidade: item.unitId, componente: item.field } : {}),
  });
  return { context, item, classSearch, klass: getDemonstrationClass(classId) };
}

function OfficialityNote({ source }: { source: AssessmentInstrument["periodSource"] }) {
  return source === "calendario-homologado" ? (
    <StatusBadge tone="success">Período oficial do calendário homologado</StatusBadge>
  ) : (
    <StatusBadge tone="warning">
      Não oficial · cenário demonstrativo sem calendário homologado
    </StatusBadge>
  );
}

// ------------------------------------------------------------ Lista

export function InstrumentsSection({ classId, search }: { classId: string; search: DiarySearch }) {
  const store = useInstrumentStore();
  useFieldVersionTick();
  const { classSearch } = useDiaryClass(classId, search);
  const state = classConfigurationState(classId);
  if (!resolved(state)) return null;
  const { configuration, structure } = state;
  if (!instrumentFlowAvailable(configuration))
    return (
      <SectionShell title="Instrumentos e lançamentos">
        <p className="text-sm text-muted-foreground">
          A configuração avaliativa desta turma não utiliza instrumentos nem lançamentos. O
          acompanhamento acontece pelos registros pedagógicos do Diário.
        </p>
      </SectionShell>
    );
  const instruments = store.instrumentsForClass(classId);
  return (
    <SectionShell
      title="Instrumentos e lançamentos"
      action={
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link
              to="/diario/turmas/$turmaId/avaliacao/fechamento"
              params={{ turmaId: classId }}
              search={classSearch}
            >
              Fechamento do período
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link
              to="/diario/turmas/$turmaId/frequencia/fechamento"
              params={{ turmaId: classId }}
              search={classSearch}
            >
              Fechamento da frequência
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline">
            <Link
              to="/diario/turmas/$turmaId/avaliacao/consolidacao"
              params={{ turmaId: classId }}
              search={classSearch}
            >
              Consolidação do ciclo
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link
              to="/diario/turmas/$turmaId/avaliacao/situacao"
              params={{ turmaId: classId }}
              search={classSearch}
            >
              Situação acadêmica do ciclo
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link
              to="/diario/turmas/$turmaId/avaliacao/conselho"
              params={{ turmaId: classId }}
              search={classSearch}
            >
              Colegiados e deliberações
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline">
            <Link
              to="/diario/turmas/$turmaId/encerramento"
              params={{ turmaId: classId }}
              search={classSearch}
            >
              Encerramento do ciclo e da turma
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline">
            <Link
              to="/diario/turmas/$turmaId/projecao"
              params={{ turmaId: classId }}
              search={classSearch}
            >
              Projeção canônica do percurso
            </Link>
          </Button>


          <Button asChild size="sm">
            <Link
              to="/diario/turmas/$turmaId/avaliacao/instrumentos/novo"
              params={{ turmaId: classId }}
              search={classSearch}
            >
              <Plus /> Novo instrumento
            </Link>
          </Button>
        </div>
      }

    >
      <p className="mb-3 text-xs text-muted-foreground">
        Registros individuais por instrumento. Nenhuma média, soma ou resultado é calculado — não há
        regra homologada.
      </p>
      <div className="space-y-5">
        {structure.periods.map((period) => {
          const list = instruments.filter((i) => i.periodId === period.id);
          const label = periodLabelFor(structure, period.id, list[0]?.appliedOn);
          return (
            <div key={period.id} className="min-w-0">
              <p className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-semibold text-foreground">{label}</span>
                <span className="text-xs text-muted-foreground">
                  {list.length} {list.length === 1 ? "instrumento" : "instrumentos"}
                </span>
              </p>
              {list.length === 0 ? (
                <p className="border-y border-border/60 py-2.5 text-sm text-muted-foreground">
                  Nenhum instrumento neste período.
                </p>
              ) : (
                <ul className="divide-y divide-border/60 border-y border-border/60">
                  {list.map((i) => {
                    // 6D.3.3.5 — contagem lida dos fatos oficiais da pauta canônica.
                    const registered = registeredOfficialCount(i.id);
                    const applied = i.status === "aplicado";
                    return (
                      <li key={i.id} className="min-w-0 py-2.5">
                        <Link
                          to={
                            applied
                              ? "/diario/turmas/$turmaId/avaliacao/pauta/$instrumentoId"
                              : "/diario/turmas/$turmaId/avaliacao/instrumentos/$instrumentoId"
                          }
                          params={{ turmaId: classId, instrumentoId: i.id }}
                          search={classSearch}
                          aria-label={`${applied ? "Abrir pauta" : "Ver instrumento"}: ${i.title}`}
                          data-testid={`instrument-open-${i.id}`}
                          className="grid min-w-0 gap-1 rounded-sm focus-visible:outline-2 focus-visible:outline-ring md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-4"
                        >
                          <span className="min-w-0">
                            <span className="block break-words font-medium text-foreground">
                              {i.title}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {store.typeLabel(i.instrumentTypeId)} · aplicado em{" "}
                              {formatAcademicDate(i.appliedOn)}
                            </span>
                          </span>
                          <span className="flex flex-wrap items-center gap-2 text-xs">
                            <StatusBadge tone={applied ? "info" : "neutral"}>
                              {applied ? "Abrir pauta" : "Planejado"}
                            </StatusBadge>
                            <span className="tabular-nums text-muted-foreground">
                              {registered} {registered === 1 ? "registrado" : "registrados"}
                            </span>
                          </span>
                        </Link>

                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

function periodLabelFor(
  structure: AssessmentPeriodStructure,
  periodId: string,
  sampleDate?: string,
) {
  const p = structure.periods.find((x) => x.id === periodId);
  if (!p) return periodId;
  const r = resolveInstrumentPeriod(structure, sampleDate ?? p.start);
  return r.ok && r.period.id === periodId ? r.period.label : p.label;
}

function SectionShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="min-w-0 border-t border-border/70 pt-5">
      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <ClipboardList className="size-4 text-primary" /> {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// ------------------------------------------------------ Novo instrumento

export function NewInstrumentPage({ classId, search }: { classId: string; search: DiarySearch }) {
  const store = useInstrumentStore();
  const navigate = useNavigate();
  const { context, item, classSearch, klass } = useDiaryClass(classId, search);
  const state = classConfigurationState(classId);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const dirty = Boolean(title || type || date || description);
  const [saved, setSaved] = useState(false);
  useBlocker({
    shouldBlockFn: () =>
      dirty && !saved && !window.confirm("O instrumento não foi salvo. Deseja sair e perdê-lo?"),
    enableBeforeUnload: dirty && !saved,
  });
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
        title="Instrumento indisponível"
        description="Turma, atuação pedagógica vigente ou configuração avaliativa não encontradas."
      />
    );
  const { configuration, structure } = state;
  if (!instrumentFlowAvailable(configuration))
    return (
      <div className="space-y-5">
        <DiaryHeader title="Novo instrumento" description={klass.name} context={context}>
          {back}
        </DiaryHeader>
        <StatePanel
          tone="info"
          title="Esta configuração não utiliza instrumentos"
          description="O acompanhamento desta turma acontece pelos registros pedagógicos do Diário."
        />
      </div>
    );
  const types = allowedTypes(configuration);
  const period = date ? resolveInstrumentPeriod(structure, date) : null;
  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Novo instrumento"
        description={`${klass.name} · ${item.field}`}
        context={context}
      >
        {back}
      </DiaryHeader>
      <form
        className="grid max-w-3xl min-w-0 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const r = store.create({
            input: { title, instrumentTypeId: type, appliedOn: date, description },
            configuration,
            structureId: structure.id,
            assignmentId: item.record.id,
            professionalId: context.professionalId,
            classId,
          });
          if (!r.ok) return setErrors(r.reasons);
          setSaved(true);
          void navigate({
            to: "/diario/turmas/$turmaId/avaliacao/instrumentos/$instrumentoId",
            params: { turmaId: classId, instrumentoId: r.value.id },
            search: classSearch,
          });
        }}
      >
        <Field label="Título">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field label="Tipo" hint="Somente os tipos admitidos pela configuração avaliativa.">
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Selecione</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data de aplicação">
            <DateInput
              className={inputCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <div aria-live="polite" className="min-w-0 text-sm">
          {period ? (
            period.ok ? (
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Período derivado da data:</span>
                <b className="text-foreground">{period.period.label}</b>
                <OfficialityNote source={period.source} />
              </p>
            ) : (
              <p className="text-destructive">{period.reason}</p>
            )
          ) : (
            <p className="text-muted-foreground">O período é definido automaticamente pela data.</p>
          )}
        </div>
        <Field label="Descrição (opcional)">
          <textarea
            rows={3}
            className={cn(inputCls, "h-auto py-2")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        {errors.length ? (
          <ul role="alert" className="list-disc space-y-0.5 pl-5 text-sm text-destructive">
            {errors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : null}
        <div>
          <Button type="submit">Salvar instrumento</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-medium text-foreground">
      {label}
      {children}
      {hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function InstrumentPage({
  classId,
  instrumentId,
  search,
}: {
  classId: string;
  instrumentId: string;
  search: DiarySearch;
}) {
  const store = useInstrumentStore();
  useFieldVersionTick();
  const navigate = useNavigate();
  const { context, classSearch, klass } = useDiaryClass(classId, search);
  const state = classConfigurationState(classId);
  const instrument = store.get(instrumentId);
  const roster = useMemo(
    () => (instrument ? instrumentRoster(instrument, demonstrationStudents) : null),
    [instrument],
  );
  if (!klass || !instrument || instrument.classId !== classId || !resolved(state) || !roster)
    return (
      <StatePanel
        tone="danger"
        title="Instrumento não encontrado"
        description="O instrumento não existe nesta turma ou foi criado em outra aba (estado temporário)."
      />
    );
  const scales = state.configuration.scales;

  return (
    <div className="space-y-5">
      <DiaryHeader
        title={instrument.title}
        description={`${store.typeLabel(instrument.instrumentTypeId)} · ${klass.name} · ${instrument.snapshot.fieldLabel}`}
        context={context}
      >
        <Button asChild variant="outline" size="sm">
          <Link
            to="/diario/turmas/$turmaId/avaliacao"
            params={{ turmaId: classId }}
            search={classSearch}
          >
            <ArrowLeft /> Avaliação da turma
          </Link>
        </Button>
        {instrument.status === "aplicado" && (
          <Button asChild size="sm">
            <Link
              to="/diario/turmas/$turmaId/avaliacao/pauta/$instrumentoId"
              params={{ turmaId: classId, instrumentoId: instrument.id }}
              search={classSearch}
            >
              Abrir pauta
            </Link>
          </Button>
        )}
      </DiaryHeader>

      <dl className="grid min-w-0 gap-x-6 gap-y-3 border-b border-border/70 pb-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Aplicado em">{formatAcademicDate(instrument.appliedOn)}</Fact>
        <Fact label="Período">{store.periodLabel(instrument)}</Fact>
        <Fact label="Escala">{scales.map(scaleLabel).join(" · ") || "—"}</Fact>
        <Fact label="Registrados">
          <span className="tabular-nums">{registeredOfficialCount(instrument.id)}</span>
        </Fact>
        <div className="sm:col-span-2 lg:col-span-4">
          <OfficialityNote source={instrument.periodSource} />
        </div>
        {instrument.description ? (
          <p className="text-muted-foreground sm:col-span-2 lg:col-span-4">
            {instrument.description}
          </p>
        ) : null}
      </dl>

      {/* 6D.3.3.5 — esta página não lança mais resultados: somente leitura. */}
      {instrument.status !== "aplicado" ? (
        <StatePanel
          tone="info"
          title="Instrumento planejado"
          description="Aplique o instrumento para abrir a pauta de lançamento dos alunos elegíveis na data."
          action={
            <Button
              size="sm"
              onClick={() => {
                store.apply(instrument.id);
                void navigate({
                  to: "/diario/turmas/$turmaId/avaliacao/pauta/$instrumentoId",
                  params: { turmaId: classId, instrumentoId: instrument.id },
                  search: classSearch,
                });
              }}
            >
              Aplicar e abrir pauta
            </Button>
          }
        />
      ) : (
        <StatePanel
          tone="info"
          title="Os resultados são lançados na pauta de lançamento"
          description="Esta página mostra os dados do instrumento. Para lançar, conferir, registrar ou corrigir resultados, abra a pauta."
          action={
            <Button asChild size="sm">
              <Link
                to="/diario/turmas/$turmaId/avaliacao/pauta/$instrumentoId"
                params={{ turmaId: classId, instrumentoId: instrument.id }}
                search={classSearch}
                data-testid="legacy-open-pauta"
              >
                Abrir pauta
              </Link>
            </Button>
          }
        />
      )}

      {roster.informative.length ? (
        <section
          aria-label="Alunos fora da pauta nesta data"
          className="min-w-0 border-t border-border/70 pt-4"
        >
          <h2 className="text-sm font-semibold text-foreground">
            Fora da pauta nesta data (informativo)
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {roster.informative.map((i) => (
              <li key={i.student.id} className="break-words">
                {i.student.personName} —{" "}
                {i.reason === "ingresso-posterior"
                  ? `ingressou na turma em ${formatAcademicDate(i.date)}, depois da aplicação`
                  : `saiu da turma em ${formatAcademicDate(i.date)}, antes da aplicação`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function scaleLabel(s: ScaleDefinition) {
  if (s.kind === "numerica") return `Numérica ${s.min}–${s.max}`;
  if (s.kind === "conceitual") return `Conceitual (${s.options.length} opções)`;
  return "Descritiva";
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-foreground">{children}</dd>
    </div>
  );
}

const KIND_LABEL: Record<EntryValue["kind"], string> = {
  numerica: "Nota",
  conceitual: "Conceito",
  descritiva: "Registro descritivo",
  "nao-registrado": "Não registrado",
};


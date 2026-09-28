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
                    const eligible = instrumentRoster(i, demonstrationStudents).eligible.length;
                    const p = rosterProgress(eligible, store.entries(i.id));
                    return (
                      <li key={i.id} className="min-w-0 py-2.5">
                        <Link
                          to="/diario/turmas/$turmaId/avaliacao/instrumentos/$instrumentoId"
                          params={{ turmaId: classId, instrumentoId: i.id }}
                          search={classSearch}
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
                            <StatusBadge tone={i.status === "aplicado" ? "info" : "neutral"}>
                              {i.status === "aplicado" ? "Pauta aberta" : "Planejado"}
                            </StatusBadge>
                            <span className="tabular-nums text-muted-foreground">
                              {p.registered} registrados · {p.drafts} rascunhos · {p.pending} sem
                              lançamento
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

// ------------------------------------------------------ Pauta

type RowDraft = {
  kind: EntryValue["kind"];
  num: string;
  option: string;
  text: string;
  reason: string;
};

function toDraft(value: EntryValue | undefined, scales: ScaleDefinition[]): RowDraft {
  const base: RowDraft = {
    kind: (scales[0]?.kind ?? "descritiva") as EntryValue["kind"],
    num: "",
    option: "",
    text: "",
    reason: "",
  };
  if (!value) return base;
  if (value.kind === "numerica") return { ...base, kind: "numerica", num: String(value.value) };
  if (value.kind === "conceitual") return { ...base, kind: "conceitual", option: value.optionId };
  if (value.kind === "descritiva") return { ...base, kind: "descritiva", text: value.text };
  return { ...base, kind: "nao-registrado", reason: value.reason };
}
function fromDraft(d: RowDraft): EntryValue | null {
  if (d.kind === "numerica")
    return d.num.trim() === ""
      ? null
      : { kind: "numerica", value: Number(d.num.replace(",", ".")) };
  if (d.kind === "conceitual") return d.option ? { kind: "conceitual", optionId: d.option } : null;
  if (d.kind === "descritiva") return d.text.trim() ? { kind: "descritiva", text: d.text } : null;
  return { kind: "nao-registrado", reason: d.reason };
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
  const { context, classSearch, klass } = useDiaryClass(classId, search);
  const state = classConfigurationState(classId);
  const instrument = store.get(instrumentId);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [correcting, setCorrecting] = useState<string | null>(null);
  const dirty = Object.keys(drafts).length > 0;
  useBlocker({
    shouldBlockFn: () =>
      dirty && !window.confirm("Há lançamentos não salvos nesta pauta. Deseja sair e perdê-los?"),
    enableBeforeUnload: dirty,
  });
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
  const { configuration } = state;
  const scales = configuration.scales;
  const entries = store.entries(instrument.id);
  const entryOf = (studentId: string) => entries.find((e) => e.studentId === studentId);
  const progress = rosterProgress(roster.eligible.length, entries);
  const draftOf = (studentId: string) =>
    drafts[studentId] ?? toDraft(entryOf(studentId)?.value, scales);
  const setDraft = (studentId: string, patch: Partial<RowDraft>) =>
    setDrafts((d) => ({ ...d, [studentId]: { ...draftOf(studentId), ...patch } }));

  const saveDrafts = () => {
    const nextErrors: Record<string, string[]> = {};
    const remaining: Record<string, RowDraft> = {};
    let saved = 0;
    for (const [studentId, d] of Object.entries(drafts)) {
      const value = fromDraft(d);
      if (!value) {
        const existing = entryOf(studentId);
        if (existing && existing.status !== "registrado") store.discardDraft(existing.id);
        continue;
      }
      const r = store.saveDraft({ instrumentId: instrument.id, studentId, value, configuration });
      if (r.ok) saved++;
      else {
        nextErrors[studentId] = r.reasons;
        remaining[studentId] = d;
      }
    }
    setErrors(nextErrors);
    setDrafts(remaining);
    setMessage(
      Object.keys(nextErrors).length
        ? `${saved} rascunho(s) salvo(s). Corrija os campos indicados.`
        : `${saved} rascunho(s) salvo(s).`,
    );
  };

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
        <Button asChild size="sm">
          <Link
            to="/diario/turmas/$turmaId/avaliacao/pauta/$instrumentoId"
            params={{ turmaId: classId, instrumentoId: instrument.id }}
            search={classSearch}
          >
            Abrir pauta 2.0 (laboratório)
          </Link>
        </Button>
      </DiaryHeader>

      <dl className="grid min-w-0 gap-x-6 gap-y-3 border-b border-border/70 pb-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Aplicado em">{formatAcademicDate(instrument.appliedOn)}</Fact>
        <Fact label="Período">{store.periodLabel(instrument)}</Fact>
        <Fact label="Escala">{scales.map(scaleLabel).join(" · ") || "—"}</Fact>
        <Fact label="Pauta">
          <span className="tabular-nums">
            {progress.registered}/{progress.eligible} registrados · {progress.drafts} rascunhos
          </span>
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

      {instrument.status !== "aplicado" ? (
        <StatePanel
          tone="info"
          title="Instrumento planejado"
          description="Aplique o instrumento para abrir a pauta de lançamentos dos alunos elegíveis na data."
          action={
            <Button size="sm" onClick={() => store.apply(instrument.id)}>
              Aplicar e abrir pauta
            </Button>
          }
        />
      ) : (
        <section aria-label="Pauta de lançamentos" className="min-w-0 space-y-3">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Alunos elegíveis em {formatAcademicDate(instrument.appliedOn)}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!dirty} onClick={saveDrafts}>
                Salvar rascunhos
              </Button>
              <Button
                size="sm"
                disabled={dirty || progress.drafts === 0}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Registrar ${progress.drafts} lançamento(s)? Depois de registrado, só é possível alterar por correção justificada.`,
                    )
                  )
                    return;
                  const n = store.register(instrument.id);
                  setMessage(`${n} lançamento(s) registrado(s).`);
                }}
              >
                Registrar rascunhos
              </Button>
            </div>
          </div>
          <p aria-live="polite" className="min-h-5 text-sm text-foreground">
            {message}
          </p>
          {roster.eligible.length === 0 ? (
            <StatePanel
              tone="neutral"
              title="Nenhum aluno elegível"
              description="Não há alunos alocados na turma na data de aplicação."
            />
          ) : (
            <ul className="divide-y divide-border/60 border-y border-border/60">
              {roster.eligible.map((row) => (
                <EntryRow
                  key={row.student.id}
                  row={row}
                  entry={entryOf(row.student.id)}
                  draft={draftOf(row.student.id)}
                  dirty={Boolean(drafts[row.student.id])}
                  errors={errors[row.student.id] ?? []}
                  scales={scales}
                  configuration={configuration}
                  onChange={(patch) => setDraft(row.student.id, patch)}
                  correcting={correcting === row.student.id}
                  onCorrect={(open) => setCorrecting(open ? row.student.id : null)}
                  onSubmitCorrection={(value, justification) => {
                    const e = entryOf(row.student.id)!;
                    const r = store.correct({ entryId: e.id, value, justification, configuration });
                    if (!r.ok) return r.reasons;
                    setCorrecting(null);
                    setMessage(`Correção registrada para ${row.student.personName}.`);
                    return [];
                  }}
                />
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            “Não registrado” não equivale a zero, falta, ausência ou recuperação e não tem
            consequência automática.
          </p>
        </section>
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

function ValueEditor({
  label,
  draft,
  scales,
  onChange,
}: {
  label: string;
  draft: RowDraft;
  scales: ScaleDefinition[];
  onChange: (p: Partial<RowDraft>) => void;
}) {
  const kinds = [...scales.map((s) => s.kind), "nao-registrado"] as EntryValue["kind"][];
  const scale = scales.find((s) => s.kind === draft.kind);
  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <select
        aria-label={`Tipo de registro — ${label}`}
        className={inputCls}
        value={draft.kind}
        onChange={(e) => onChange({ kind: e.target.value as EntryValue["kind"] })}
      >
        {kinds.map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </select>
      {draft.kind === "numerica" && scale?.kind === "numerica" ? (
        <input
          aria-label={`Nota — ${label}`}
          type="number"
          inputMode="decimal"
          min={scale.min}
          max={scale.max}
          step={scale.step}
          className={cn(inputCls, "max-w-32 tabular-nums")}
          value={draft.num}
          onChange={(e) => onChange({ num: e.target.value })}
        />
      ) : draft.kind === "conceitual" && scale?.kind === "conceitual" ? (
        <select
          aria-label={`Conceito — ${label}`}
          className={inputCls}
          value={draft.option}
          onChange={(e) => onChange({ option: e.target.value })}
        >
          <option value="">Selecione</option>
          {scale.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      ) : draft.kind === "descritiva" ? (
        <textarea
          aria-label={`Registro descritivo — ${label}`}
          rows={2}
          className={cn(inputCls, "h-auto py-2")}
          value={draft.text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      ) : (
        <input
          aria-label={`Motivo do não registro — ${label}`}
          placeholder="Motivo (texto livre)"
          className={inputCls}
          value={draft.reason}
          onChange={(e) => onChange({ reason: e.target.value })}
        />
      )}
    </div>
  );
}

function EntryRow({
  row,
  entry,
  draft,
  dirty,
  errors,
  scales,
  configuration,
  onChange,
  correcting,
  onCorrect,
  onSubmitCorrection,
}: {
  row: RosterEligible;
  entry: AssessmentEntry | undefined;
  draft: RowDraft;
  dirty: boolean;
  errors: string[];
  scales: ScaleDefinition[];
  configuration: AssessmentConfiguration;
  onChange: (p: Partial<RowDraft>) => void;
  correcting: boolean;
  onCorrect: (open: boolean) => void;
  onSubmitCorrection: (value: EntryValue, justification: string) => string[];
}) {
  const name = row.student.personName;
  const registered = entry?.status === "registrado";
  const [fix, setFix] = useState<RowDraft>(() => toDraft(entry?.value, scales));
  const [why, setWhy] = useState("");
  const [fixErrors, setFixErrors] = useState<string[]>([]);
  return (
    <li className="grid min-w-0 gap-2 py-3 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] md:items-start md:gap-4">
      <div className="min-w-0">
        <p className="break-words font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{row.student.sigemId}</p>
      </div>
      <div className="min-w-0">
        {registered && !correcting ? (
          <p className="break-words text-sm text-foreground">
            {entryValueLabel(entry.value, configuration)}
          </p>
        ) : registered && correcting ? (
          <div className="grid gap-2">
            <ValueEditor
              label={`${name} (correção)`}
              draft={fix}
              scales={scales}
              onChange={(p) => setFix((f) => ({ ...f, ...p }))}
            />
            <input
              aria-label={`Justificativa da correção — ${name}`}
              placeholder="Justificativa da correção"
              className={inputCls}
              value={why}
              onChange={(e) => setWhy(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const v = fromDraft(fix);
                  setFixErrors(v ? onSubmitCorrection(v, why) : ["Informe o novo valor."]);
                }}
              >
                Registrar correção
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onCorrect(false)}>
                Cancelar
              </Button>
            </div>
            {fixErrors.map((m) => (
              <p key={m} role="alert" className="text-xs text-destructive">
                {m}
              </p>
            ))}
          </div>
        ) : (
          <ValueEditor label={name} draft={draft} scales={scales} onChange={onChange} />
        )}
        {errors.map((m) => (
          <p key={m} role="alert" className="mt-1 text-xs text-destructive">
            {m}
          </p>
        ))}
        {entry?.history?.length ? (
          <details className="mt-1.5 text-xs text-muted-foreground">
            <summary className="flex cursor-pointer items-center gap-1">
              <History className="size-3" /> {entry.history.length} correção(ões)
            </summary>
            <ul className="mt-1 space-y-0.5 pl-4">
              {entry.history.map((h) => (
                <li key={h.replacedAt}>
                  Antes: {entryValueLabel(h.value, configuration)} · {h.justification}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {dirty ? (
          <StatusBadge tone="warning">Não salvo</StatusBadge>
        ) : registered ? (
          <StatusBadge tone="success">Registrado</StatusBadge>
        ) : entry ? (
          <StatusBadge tone="info">Rascunho</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Sem lançamento</StatusBadge>
        )}
        {registered && !correcting ? (
          <Button size="sm" variant="ghost" onClick={() => onCorrect(true)}>
            Corrigir
          </Button>
        ) : null}
      </div>
    </li>
  );
}

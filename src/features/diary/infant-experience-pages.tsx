import { useMemo, useRef, useState } from "react";
import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Baby,
  BookOpenCheck,
  Check,
  History,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DefinitionList, InformationPair } from "@/components/sigem/operational";
import { EmptyState, SectionHeader, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { cn } from "@/lib/utils";
import { AttendanceSummaryCard } from "./attendance-pages";
import { DiaryHeader } from "./diary-context";
import {
  DEFAULT_DIARY_PROFESSIONAL_ID,
  DIARY_PRIVACY_NOTE,
  diaryContext,
  type DiarySearch,
} from "./diary-data";
import {
  eligibleChildren,
  emptyInfantExperience,
  experienceFields,
  fieldLabel,
  infantAssignment,
  infantExperienceContext,
  infantExperienceRecords,
  infantExperienceStore,
  objectiveById,
  objectivesFor,
  unavailableChildren,
  useLocalInfantExperiences,
  validateInfantExperience,
  type ExperienceFieldId,
  type InfantExperienceInput,
  type InfantExperienceRecord,
} from "./infant-experiences";
import {
  emptyLessonInput,
  findLessonEntry,
  localLessonStore,
  plannedLessonsFor,
} from "./lesson-records";

export type InfantExperienceSearch = DiarySearch & { atuacao?: string; registro?: string };

function toggle<T>(items: T[], item: T) {
  return items.includes(item) ? items.filter((current) => current !== item) : [...items, item];
}

function FieldSelector({
  value,
  onChange,
}: {
  value: ExperienceFieldId[];
  onChange: (next: ExperienceFieldId[]) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-foreground">Campos de experiência</legend>
      <p className="mt-1 text-xs text-muted-foreground">
        Selecione um ou mais campos mobilizados na experiência. Nenhum é preenchido automaticamente.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {experienceFields.map((field) => (
          <label
            key={field.id}
            className={cn(
              "flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              value.includes(field.id)
                ? "border-primary/40 bg-primary/[.04]"
                : "border-border bg-card hover:bg-muted/30",
            )}
          >
            <Checkbox
              checked={value.includes(field.id)}
              onCheckedChange={() => onChange(toggle(value, field.id))}
              aria-label={field.label}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-snug text-foreground">
                {field.label}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {field.description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ObjectiveSelector({
  selected,
  fields,
  onChange,
}: {
  selected: string[];
  fields: ExperienceFieldId[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [field, setField] = useState("all");
  const options = objectivesFor(query, field === "all" ? undefined : field);
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-foreground">
        Objetivos de aprendizagem e desenvolvimento
      </legend>
      <p className="mt-1 text-xs text-muted-foreground">
        Referências pedagógicas fictícias para demonstrar a interface; códigos e textos não
        constituem catálogo oficial.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,.55fr)]">
        <label className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar objetivos"
            placeholder="Buscar por código ou descrição"
            className="pl-9"
          />
        </label>
        <Select value={field} onValueChange={setField}>
          <SelectTrigger aria-label="Filtrar objetivos por campo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os campos</SelectItem>
            {experienceFields.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="mt-2 text-xs font-medium text-primary" role="status">
        {selected.length} objetivo(s) selecionado(s)
      </p>
      <div className="mt-2 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
        {options.map((objective) => (
          <label
            key={objective.id}
            className="flex min-w-0 cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/40"
          >
            <Checkbox
              checked={selected.includes(objective.id)}
              onCheckedChange={() => onChange(toggle(selected, objective.id))}
              aria-label={`${objective.code} ${objective.description}`}
            />
            <span className="min-w-0 text-sm leading-relaxed">
              <span className="mr-2 font-semibold text-primary">{objective.code}</span>
              {objective.description}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {fieldLabel(objective.fieldId)} · conteúdo demonstrativo
              </span>
            </span>
          </label>
        ))}
        {!options.length ? (
          <EmptyState
            title="Nenhum objetivo encontrado"
            description="Revise a busca ou o filtro de campo."
            compact
          />
        ) : null}
      </div>
      {fields.length &&
      selected.some((id) => {
        const item = objectiveById(id);
        return item && !fields.includes(item.fieldId);
      }) ? (
        <p className="mt-2 text-xs text-warning-foreground">
          Há objetivo associado a campo ainda não selecionado. Revise antes de concluir.
        </p>
      ) : null}
    </fieldset>
  );
}

function IndividualObservations({
  value,
  input,
  onChange,
}: {
  value: InfantExperienceInput["individualObservations"];
  input: InfantExperienceInput;
  onChange: (next: InfantExperienceInput["individualObservations"]) => void;
}) {
  const eligible = eligibleChildren(input);
  const unavailable = unavailableChildren(input);
  const available = eligible.filter(
    (item) => !value.some((observation) => observation.studentId === item.student.id),
  );
  const [studentId, setStudentId] = useState("");
  const selectTrigger = useRef<HTMLButtonElement>(null);
  const [announcement, setAnnouncement] = useState("");
  const add = () => {
    if (!studentId) return;
    onChange([
      ...value,
      { id: `obs-${studentId}-${Date.now()}`, studentId, text: "", fieldIds: [], objectiveIds: [] },
    ]);
    const child = eligible.find((item) => item.student.id === studentId);
    setAnnouncement(`Observação adicionada para ${child?.student.personName ?? "a criança"}.`);
    setStudentId("");
  };
  return (
    <div>
      <SectionHeader
        title="Observações individuais"
        description="Registre somente quando necessário. A lista respeita a participação da criança na turma e na data."
      />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Select value={studentId} onValueChange={setStudentId}>
          <SelectTrigger ref={selectTrigger} className="min-h-11 min-w-0 flex-1" aria-label="Selecionar criança elegível">
            <SelectValue placeholder="Selecionar criança" />
          </SelectTrigger>
          <SelectContent>
            {available.map((entry) => (
              <SelectItem key={entry.student.id} value={entry.student.id}>
                {entry.student.personName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={add} disabled={!studentId}>
          <Plus /> Adicionar observação
        </Button>
      </div>
      <p className="sr-only" aria-live="polite">{announcement}</p>
      {eligible.length && !available.length ? <p className="mt-2 text-sm text-muted-foreground">Todas as crianças elegíveis já possuem uma observação nesta experiência.</p> : null}
      {!eligible.length ? (
        <StatePanel
          tone="warning"
          title="Nenhuma criança elegível"
          description="Não há participação válida nesta turma na data selecionada. Nenhuma observação individual pode ser criada."
        />
      ) : null}
      <div className="mt-3 space-y-3">
        {value.map((observation) => {
          const child = eligible.find((item) => item.student.id === observation.studentId);
          return (
            <article key={observation.id} className="rounded-lg border border-border bg-card p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:flex sm:flex-wrap sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">
                    {child?.student.personName ?? observation.studentId}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Observação pedagógica individual · acesso discreto
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (observation.text.trim() && !window.confirm("Remover esta observação em elaboração? O texto será perdido.")) return;
                    onChange(value.filter((item) => item.id !== observation.id));
                    setAnnouncement("Observação removida. A criança voltou à lista de elegíveis.");
                    requestAnimationFrame(() => selectTrigger.current?.focus());
                  }}
                >
                  <Trash2 /> Remover
                </Button>
              </div>
              <Textarea
                className="mt-3 min-h-24"
                aria-label={`Observação de ${child?.student.personName ?? observation.studentId}`}
                value={observation.text}
                onChange={(event) =>
                  onChange(
                    value.map((item) =>
                      item.id === observation.id ? { ...item, text: event.target.value } : item,
                    ),
                  )
                }
                placeholder="Descreva evidências observadas, sem classificação numérica."
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {input.fieldIds.map((fieldId) => (
                  <label
                    key={fieldId}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs"
                  >
                    <Checkbox
                      checked={observation.fieldIds.includes(fieldId)}
                      onCheckedChange={() =>
                        onChange(
                          value.map((item) =>
                            item.id === observation.id
                              ? { ...item, fieldIds: toggle(item.fieldIds, fieldId) }
                              : item,
                          ),
                        )
                      }
                    />
                    {fieldLabel(fieldId)}
                  </label>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      {unavailable.length ? (
        <details className="mt-3 rounded-lg border border-border p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Crianças fora do contexto desta data ({unavailable.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {unavailable.map((item) => (
              <li key={item.id}>
                <strong>{item.name}:</strong> {item.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">{DIARY_PRIVACY_NOTE}</p>
    </div>
  );
}

export function InfantExperienceRegisterPage({
  search,
  initialAssignmentId,
  initialDate,
}: {
  search: InfantExperienceSearch;
  initialAssignmentId?: string | undefined;
  initialDate?: string | undefined;
}) {
  const professionalId = search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID;
  const local = useLocalInfantExperiences();
  const existing = search.registro ? local.find((item) => item.id === search.registro) : undefined;
  const date = initialDate ?? diaryContext(professionalId, search.data).referenceDate;
  const initial = useMemo(
    () =>
      existing
        ? (({
            id: _id,
            status: _status,
            origin: _origin,
            createdAt: _created,
            relatedLessonId: _lesson,
            ...rest
          }) => rest)(existing)
        : emptyInfantExperience(
            professionalId,
            date,
            initialAssignmentId ?? search.atuacao ?? "atp-002",
          ),
    [existing, professionalId, date, initialAssignmentId, search.atuacao],
  );
  const [value, setValue] = useState<InfantExperienceInput>(initial);
  const [baseline, setBaseline] = useState<InfantExperienceInput>(initial);
  const [draftId, setDraftId] = useState(existing?.id);
  const [concluded, setConcluded] = useState<InfantExperienceRecord>();
  const [notice, setNotice] = useState("");
  const context = diaryContext(professionalId, value.date);
  const details = infantExperienceContext(value);
  const issues = validateInfantExperience(value);
  const dirty = JSON.stringify(value) !== JSON.stringify(baseline);
  const navigate = useNavigate();
  useBlocker({
    shouldBlockFn: () =>
      dirty &&
      !window.confirm("Há alterações não concluídas nesta experiência. Deseja sair e perdê-las?"),
    enableBeforeUnload: dirty,
  });

  if (concluded)
    return (
      <div className="space-y-5">
        <DiaryHeader
          title="Experiência pedagógica"
          description="Registro demonstrativo concluído na memória desta aba."
          context={context}
        />
        <StatePanel
          tone="success"
          title={`Experiência ${concluded.id} concluída apenas nesta demonstração`}
          description="Nada foi publicado ou salvo permanentemente. O estado se perde ao recarregar a página."
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link
              to="/diario/registros/$registroId"
              params={{ registroId: concluded.id }}
              search={search}
            >
              Ver detalhamento <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/diario/aulas" search={search}>
              Histórico de experiências
            </Link>
          </Button>
          {concluded.relatedLessonId ? (
            <Button asChild variant="secondary">
              <Link
                to="/diario/chamada/$registroId"
                params={{ registroId: concluded.relatedLessonId }}
                search={search}
              >
                Fazer chamada
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    );

  const assignments = context.assignments.filter((item) => item.stage === "Educação Infantil");
  const saveDraft = () => {
    const record = infantExperienceStore.upsert(value, "Rascunho local", draftId);
    setDraftId(record.id);
    setBaseline(value);
    setNotice("Rascunho mantido somente na memória desta aba; ele se perde ao recarregar.");
  };
  const conclude = () => {
    if (issues.length) return;
    const planned = plannedLessonsFor(professionalId, value.date).filter(
      (item) => item.assignmentId === value.assignmentId,
    );
    const lessonInput = {
      ...emptyLessonInput(professionalId, value.date, value.assignmentId),
      blockIds: planned.map((item) => item.blockId),
      quantity: Math.max(1, planned.length),
      contents: { shared: value.description },
      planningRelation: value.planningRelation,
      objectives: value.objectiveIds
        .map((id) => objectiveById(id)?.code)
        .filter(Boolean)
        .join(", "),
      observations: value.collectiveObservation,
      groupings: details.groupings.join(", "),
      extraordinary: planned.length === 0,
      extraordinaryStart: planned.length ? "" : "09:00",
      extraordinaryEnd: planned.length ? "" : "10:00",
      justification: planned.length
        ? ""
        : "[Texto fictício] Experiência realizada fora de bloco demonstrativo disponível.",
    };
    const lesson = localLessonStore.upsert(lessonInput, "Concluído localmente (demonstração)");
    const record = infantExperienceStore.upsert(
      value,
      "Concluído localmente (demonstração)",
      draftId,
      lesson.id,
    );
    setBaseline(value);
    setConcluded(record);
  };

  return (
    <div className="space-y-5">
      <DiaryHeader
        title="Registrar experiência"
        description="Educação Infantil · documente experiências, propostas e observações qualitativas efetivamente realizadas."
        context={context}
      >
        <StatusBadge tone={dirty ? "warning" : draftId ? "info" : "neutral"}>
          {dirty ? "Alterações não concluídas" : draftId ? "Rascunho local" : "Novo registro"}
        </StatusBadge>
      </DiaryHeader>
      <StatePanel
        tone="info"
        title="Experiência pedagógica, não aula disciplinar"
        description="Este contexto não usa disciplinas, provas, notas, médias ou recuperação numérica. Campos e objetivos apoiam a descrição qualitativa e não são preenchidos automaticamente."
      />
      {notice ? (
        <p role="status" className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          {notice}
        </p>
      ) : null}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_clamp(18.75rem,25vw,23.75rem)]">
        <div className="min-w-0 space-y-5">
          <section className="surface-panel p-4 sm:p-5">
            <SectionHeader
              title="Contexto da experiência"
              description="Confirme data, turma e atuação pedagógica vigente."
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Data</span>
                <Input
                  type="date"
                  value={value.date}
                  onChange={(event) => setValue({ ...value, date: event.target.value })}
                  aria-label="Data da experiência"
                  disabled={Boolean(draftId)}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Atuação e turma
                </span>
                <Select
                  value={value.assignmentId}
                  onValueChange={(assignmentId) =>
                    setValue({ ...value, assignmentId, individualObservations: [] })
                  }
                >
                  <SelectTrigger aria-label="Atuação da Educação Infantil">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map((item) => (
                      <SelectItem key={item.record.id} value={item.record.id}>
                        {item.className} · {item.record.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
            {details.groupings.length ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Agrupamentos da turma: {details.groupings.join(" · ")}. A experiência coletiva não
                apaga a identificação de cada agrupamento.
              </p>
            ) : null}
          </section>
          <section className="surface-panel space-y-5 p-4 sm:p-5">
            <SectionHeader
              title="Experiência realizada"
              description="Registre o que aconteceu de fato; o planejamento permanece apenas como referência."
            />
            <label>
              <span className="mb-1 block text-sm font-semibold">
                Título breve <span className="font-normal text-muted-foreground">(opcional)</span>
              </span>
              <Input
                value={value.title}
                onChange={(event) => setValue({ ...value, title: event.target.value })}
                placeholder="Ex.: Exploração de formas e texturas"
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold">
                Experiências, propostas e atividades realizadas
              </span>
              <Textarea
                className="min-h-36"
                value={value.description}
                onChange={(event) => setValue({ ...value, description: event.target.value })}
                placeholder="Descreva a experiência efetivamente realizada, os materiais, interações e agrupamentos..."
                aria-describedby="experience-help"
              />
              <span id="experience-help" className="mt-1 block text-xs text-muted-foreground">
                Não cole códigos curriculares: selecione referências na seção própria quando fizer
                sentido.
              </span>
            </label>
            <FieldSelector
              value={value.fieldIds}
              onChange={(fieldIds) => setValue({ ...value, fieldIds })}
            />
            <ObjectiveSelector
              selected={value.objectiveIds}
              fields={value.fieldIds}
              onChange={(objectiveIds) => setValue({ ...value, objectiveIds })}
            />
          </section>
          <section className="surface-panel space-y-5 p-4 sm:p-5">
            <SectionHeader
              title="Observações pedagógicas"
              description="Registros qualitativos, sem classificação, nota, média ou diagnóstico automático."
            />
            <label>
              <span className="mb-1 block text-sm font-semibold">
                Observação coletiva{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </span>
              <Textarea
                className="min-h-28"
                value={value.collectiveObservation}
                onChange={(event) =>
                  setValue({ ...value, collectiveObservation: event.target.value })
                }
                placeholder="Descreva interações, hipóteses, descobertas e participação do grupo."
              />
            </label>
            <IndividualObservations
              value={value.individualObservations}
              input={value}
              onChange={(individualObservations) => setValue({ ...value, individualObservations })}
            />
          </section>
          <section className="surface-panel p-4 sm:p-5">
            <SectionHeader
              title="Relação com o planejamento"
              description="O planejamento é uma referência editável; não é convertido automaticamente em realização."
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Relação declarada
                </span>
                <Select
                  value={value.planningRelation}
                  onValueChange={(planningRelation: InfantExperienceInput["planningRelation"]) =>
                    setValue({ ...value, planningRelation })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Conforme o planejado",
                      "Adaptado do planejado",
                      "Diferente do planejado",
                      "Sem planejamento prévio",
                      "Não informado",
                    ].map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Referência de planejamento <span className="font-normal">(opcional)</span>
                </span>
                <Input
                  value={value.relatedPlanning?.summary ?? ""}
                  onChange={(event) =>
                    setValue({
                      ...value,
                      relatedPlanning: event.target.value
                        ? {
                            id: value.relatedPlanning?.id ?? `pla-local-${Date.now()}`,
                            summary: event.target.value,
                          }
                        : undefined,
                    })
                  }
                  placeholder="Síntese ou referência, sem alterar o original"
                />
              </label>
            </div>
          </section>
        </div>
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="surface-panel p-4">
            <SectionHeader
              title="Revisão da experiência"
              description="Confira antes de concluir."
            />
            <DefinitionList
              items={[
                { term: "Turma", detail: details.className },
                { term: "Escola", detail: details.unitName },
                { term: "Data", detail: value.date },
                { term: "Responsável", detail: details.professionalName },
                {
                  term: "Campos",
                  detail: value.fieldIds.length
                    ? value.fieldIds.map(fieldLabel).join(" · ")
                    : "Nenhum selecionado",
                },
                { term: "Objetivos", detail: `${value.objectiveIds.length} selecionado(s)` },
                {
                  term: "Observações individuais",
                  detail: `${value.individualObservations.length} criança(s)`,
                },
                { term: "Planejamento", detail: value.planningRelation },
              ]}
            />
          </section>
          {issues.length ? (
            <StatePanel
              tone="warning"
              title="Revise antes de concluir"
              description={issues.map((issue) => issue.message).join(" ")}
            />
          ) : (
            <StatePanel
              tone="success"
              title="Pronto para revisão final"
              description="Os dados mínimos foram informados. A conclusão continua sendo apenas demonstrativa."
            />
          )}
          <div className="surface-panel space-y-2 p-4">
            <Button className="w-full" variant="outline" onClick={saveDraft}>
              <BookOpenCheck /> Manter rascunho local
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" disabled={issues.length > 0}>
                  <Check /> Revisar e concluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Concluir esta experiência?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O registro será mantido somente na memória desta aba e não terá validade
                    institucional. Planejamento e chamada permanecem registros distintos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="font-medium">{value.title || "Experiência sem título"}</p>
                  <p className="mt-1 text-muted-foreground">
                    {value.date} · {details.className} · {value.fieldIds.length} campo(s) ·{" "}
                    {value.individualObservations.length} observação(ões) individual(is)
                  </p>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar e revisar</AlertDialogCancel>
                  <AlertDialogAction onClick={conclude}>
                    Concluir demonstrativamente
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" variant="ghost">
                  <Trash2 /> Descartar alterações
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Descartar este registro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    As alterações desta aba serão perdidas. Esta ação não modifica nenhum registro
                    histórico.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Continuar editando</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (draftId) infantExperienceStore.discard(draftId);
                      void navigate({ to: "/diario", search });
                    }}
                  >
                    Descartar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </aside>
      </div>
    </div>
  );
}

function experienceTone(record: InfantExperienceRecord) {
  return record.status === "Rascunho local"
    ? ("warning" as const)
    : record.origin === "local"
      ? ("info" as const)
      : ("neutral" as const);
}

export function InfantExperiencesTimeline({ search }: { search: DiarySearch }) {
  const professionalId = search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID;
  const records = infantExperienceRecords(professionalId, useLocalInfantExperiences());
  return (
    <section className="space-y-3" aria-labelledby="experiences-title">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <SectionHeader
          title="Experiências da Educação Infantil"
          description="Linha do tempo qualitativa; planejado, realizado, observado e chamada permanecem distintos."
        />
        <Button asChild size="sm">
          <Link to="/diario/registrar" search={{ ...search, atuacao: "atp-002", turma: "tur-009" }}>
            <Baby /> Registrar experiência
          </Link>
        </Button>
      </div>
      <div className="relative space-y-3 before:absolute before:bottom-4 before:left-[.7rem] before:top-4 before:w-px before:bg-border">
        {records.map((record) => {
          const details = infantExperienceContext(record);
          return (
            <article
              key={record.id}
              className="relative ml-7 rounded-lg border border-border bg-card p-4 shadow-panel before:absolute before:-left-[1.72rem] before:top-5 before:size-3 before:rounded-full before:border-2 before:border-card before:bg-primary"
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {record.date} · {details.className}
                  </p>
                  <h3 className="mt-1 break-words font-display text-base font-semibold">
                    {record.title || "Experiência pedagógica"}
                  </h3>
                </div>
                <StatusBadge tone={experienceTone(record)}>{record.status}</StatusBadge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {record.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {record.fieldIds.map((id) => (
                  <span
                    key={id}
                    className="rounded-md border border-border bg-muted/30 px-2 py-1 text-xs"
                  >
                    {fieldLabel(id)}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {record.objectiveIds.length} objetivo(s) · {record.individualObservations.length}{" "}
                  observação(ões) individual(is)
                </span>
                <Button asChild variant="ghost" size="sm">
                  <Link
                    to="/diario/registros/$registroId"
                    params={{ registroId: record.id }}
                    search={search}
                  >
                    Ver experiência <ArrowRight />
                  </Link>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function InfantExperienceDetail({
  record,
  search,
}: {
  record: InfantExperienceRecord;
  search: DiarySearch;
}) {
  const details = infantExperienceContext(record);
  const context = diaryContext(record.professionalId, record.date);
  const lesson = record.relatedLessonId
    ? findLessonEntry(record.relatedLessonId, localLessonStore.list())
    : undefined;
  return (
    <div className="space-y-5">
      <DiaryHeader
        title={record.title || "Experiência pedagógica"}
        description={`${details.className} · ${record.date} · acompanhamento qualitativo`}
        context={context}
      >
        <StatusBadge tone={experienceTone(record)}>{record.status}</StatusBadge>
      </DiaryHeader>
      <Button asChild variant="ghost" size="sm">
        <Link to="/diario/aulas" search={search}>
          <ArrowLeft /> Histórico de experiências
        </Link>
      </Button>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_clamp(18.75rem,25vw,23.75rem)]">
        <div className="min-w-0 space-y-5">
          <section className="surface-panel p-4 sm:p-5">
            <SectionHeader title="Experiência efetivamente realizada" />
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{record.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {record.fieldIds.map((id) => (
                <span
                  key={id}
                  className="rounded-md border border-primary/20 bg-primary/[.04] px-2.5 py-1.5 text-xs font-medium"
                >
                  {fieldLabel(id)}
                </span>
              ))}
            </div>
          </section>
          <section className="surface-panel p-4 sm:p-5">
            <SectionHeader
              title="Objetivos relacionados"
              description="Referências fictícias selecionadas pelo professor; não constituem catálogo oficial."
            />
            <ul className="mt-3 space-y-2">
              {record.objectiveIds.map((id) => {
                const objective = objectiveById(id);
                return objective ? (
                  <li key={id} className="rounded-md border border-border p-3 text-sm">
                    <span className="font-semibold text-primary">{objective.code}</span>
                    <span className="ml-2">{objective.description}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {fieldLabel(objective.fieldId)} · conteúdo demonstrativo
                    </span>
                  </li>
                ) : null;
              })}
            </ul>
            {!record.objectiveIds.length ? (
              <EmptyState
                title="Sem objetivos relacionados"
                description="A experiência pode ser registrada sem associação automática."
                compact
              />
            ) : null}
          </section>
          <section className="surface-panel p-4 sm:p-5">
            <SectionHeader
              title="Observações pedagógicas"
              description="Registros qualitativos; sem nota, média ou classificação."
            />
            {record.collectiveObservation ? (
              <div className="mt-3 rounded-md bg-muted/35 p-3 text-sm">
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  Coletiva
                </p>
                {record.collectiveObservation}
              </div>
            ) : null}
            <div className="mt-3 space-y-2">
              {record.individualObservations.map((observation) => {
                const child = eligibleChildren(record).find(
                  (item) => item.student.id === observation.studentId,
                );
                return (
                  <details key={observation.id} className="rounded-md border border-border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      {child?.student.personName ?? "Criança no contexto histórico"} · observação
                      individual
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed">{observation.text}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {observation.fieldIds.map(fieldLabel).join(" · ") || "Sem campo específico"}
                    </p>
                  </details>
                );
              })}
            </div>
            {!record.collectiveObservation && !record.individualObservations.length ? (
              <EmptyState
                title="Sem observações"
                description="Nenhuma observação opcional foi registrada."
                compact
              />
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">{DIARY_PRIVACY_NOTE}</p>
          </section>
          <section className="surface-panel p-4">
            <SectionHeader
              title="Relação com o planejamento"
              description="A referência não altera o planejamento original."
            />
            <InformationPair label="Relação declarada" value={record.planningRelation} />
            {record.relatedPlanning ? (
              <InformationPair label="Referência" value={record.relatedPlanning.summary} />
            ) : null}
          </section>
        </div>
        <aside className="min-w-0 space-y-4">
          <section className="surface-panel p-4">
            <SectionHeader title="Contexto e autoria" />
            <DefinitionList
              items={[
                { term: "Data", detail: record.date },
                { term: "Escola", detail: details.unitName },
                { term: "Turma", detail: details.className },
                { term: "Agrupamentos", detail: details.groupings.join(" · ") },
                { term: "Responsável", detail: details.professionalName },
                {
                  term: "Origem",
                  detail:
                    record.origin === "fixture" ? "Dado fictício histórico" : "Criado nesta sessão",
                },
              ]}
            />
          </section>
          {lesson ? (
            <AttendanceSummaryCard entry={lesson} search={search} />
          ) : (
            <StatePanel
              tone="info"
              title="Chamada separada"
              description="Nenhuma presença ou falta é inferida desta experiência. A chamada exige um registro de realização compatível."
            />
          )}
          {record.status === "Rascunho local" ? (
            <Button asChild className="w-full">
              <Link
                to="/diario/registrar"
                search={{ ...search, atuacao: record.assignmentId, registro: record.id }}
              >
                <BookOpenCheck /> Editar rascunho
              </Link>
            </Button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export function InfantChildObservations({
  studentId,
  classId,
  search,
}: {
  studentId: string;
  classId: string;
  search: DiarySearch;
}) {
  const professionalId = search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID;
  const records = infantExperienceRecords(professionalId, useLocalInfantExperiences()).flatMap(
    (record) => {
      const assignment = infantAssignment(record.assignmentId);
      if (assignment?.classId !== classId) return [];
      return record.individualObservations
        .filter((observation) => observation.studentId === studentId)
        .map((observation) => ({ record, observation }));
    },
  );
  return (
    <section className="surface-panel p-4 sm:p-5">
      <SectionHeader
        title="Observações pedagógicas individuais"
        description="Linha do tempo qualitativa no contexto da Educação Infantil; sem nota, média ou classificação."
      />
      <div className="mt-4 space-y-3">
        {records.map(({ record, observation }) => (
          <article key={observation.id} className="rounded-lg border border-border p-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">{record.date}</p>
              <StatusBadge tone={experienceTone(record)}>{record.status}</StatusBadge>
            </div>
            <h3 className="mt-1 text-sm font-semibold">
              {record.title || "Experiência pedagógica"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed">{observation.text}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {observation.fieldIds.map(fieldLabel).join(" · ") || "Sem campo específico"}
            </p>
            <Button asChild variant="ghost" size="sm" className="mt-2">
              <Link
                to="/diario/registros/$registroId"
                params={{ registroId: record.id }}
                search={search}
              >
                Ver experiência <ArrowRight />
              </Link>
            </Button>
          </article>
        ))}
        {!records.length ? (
          <EmptyState
            icon={History}
            title="Sem observações individuais"
            description="Nenhuma observação fictícia foi registrada para esta criança neste contexto."
            compact
          />
        ) : null}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{DIARY_PRIVACY_NOTE}</p>
    </section>
  );
}

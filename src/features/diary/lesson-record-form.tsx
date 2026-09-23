import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookMarked,
  CalendarPlus2,
  ChevronDown,
  Layers3,
  SplitSquareVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InformationPair } from "@/components/sigem/operational";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { cn } from "@/lib/utils";
import type { DiaryContext } from "./diary-data";
import {
  areConsecutive,
  foreignClassBlocks,
  plannedContentFor,
  selectionConflict,
  validateLessonInput,
  type LessonRecordInput,
  type PlannedLesson,
  type PlanningRelation,
} from "./lesson-records";

type Assignment = DiaryContext["assignments"][number];

export function DraftIndicator({
  dirty,
  draftId,
}: {
  dirty: boolean;
  draftId?: string | undefined;
}) {
  if (!dirty && !draftId) return null;
  return (
    <StatusBadge tone={dirty ? "warning" : "info"}>
      {dirty ? "Alterações não concluídas" : `Rascunho local ${draftId} · somente nesta aba`}
    </StatusBadge>
  );
}

export function ContextConflictState({ message }: { message: string }) {
  return (
    <div role="alert" className="state-warning flex gap-3 rounded-md border p-3 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 " aria-hidden />
      <div>
        <p className="font-semibold text-foreground">Seleção incompatível</p>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

/** Cartão de aula prevista selecionável. */
export function PlannedLessonCard({
  planned,
  checked,
  onToggle,
  disabled,
}: {
  planned: PlannedLesson;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const id = `planned-${planned.key}`;
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border p-3 shadow-panel transition-[border-color,background-color,box-shadow] focus-within:ring-2 focus-within:ring-ring",
        checked
          ? "border-primary bg-primary/5 shadow-none"
          : "border-border bg-card hover:border-primary/30 hover:bg-muted/35",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onToggle}
        aria-label={`Aula prevista ${planned.block.start}–${planned.block.end} · ${planned.className}`}
        className="mt-0.5"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold tabular-nums text-foreground">
            {planned.block.start}–{planned.block.end}
          </span>
          <span className="text-sm text-foreground">{planned.className}</span>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {planned.block.label} · {planned.unitName} · {planned.role} ({planned.assignmentId})
        </span>
      </span>
    </label>
  );
}

const RELATIONS: PlanningRelation[] = [
  "Não informado",
  "Conforme o planejado",
  "Adaptado do planejado",
  "Diferente do planejado",
  "Sem planejamento prévio",
];

export function LessonRecordForm({
  assignments,
  planned,
  value,
  onChange,
  onKeepDraft,
  onConclude,
  onDiscard,
  hasDraft,
}: {
  assignments: Assignment[];
  planned: PlannedLesson[];
  value: LessonRecordInput;
  onChange: (value: LessonRecordInput) => void;
  onKeepDraft: () => void;
  onConclude: () => void;
  onDiscard: () => void;
  hasDraft: boolean;
}) {
  const [showErrors, setShowErrors] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const set = (changes: Partial<LessonRecordInput>) => onChange({ ...value, ...changes });
  const current = assignments.find((item) => item.record.id === value.assignmentId);
  const infant = current?.stage === "Educação Infantil";
  const issues = useMemo(() => validateLessonInput(value, planned), [value, planned]);
  const conflict = selectionConflict(planned, value.blockIds);
  const selected = planned.filter((item) => value.blockIds.includes(item.blockId));
  const foreign = current ? foreignClassBlocks(current.classId, current.record.id, value.date) : [];
  const grouped = assignments
    .map((item) => ({ item, lessons: planned.filter((p) => p.assignmentId === item.record.id) }))
    .filter((group) => group.lessons.length);

  const toggleBlock = (lesson: PlannedLesson) => {
    const has = value.blockIds.includes(lesson.blockId);
    const blockIds = has
      ? value.blockIds.filter((id) => id !== lesson.blockId)
      : [...value.blockIds, lesson.blockId];
    set({
      blockIds,
      quantity: blockIds.length,
      ...(value.assignmentId ? {} : { assignmentId: lesson.assignmentId }),
    });
  };
  const issueFor = (field: string) =>
    showErrors ? issues.filter((issue) => issue.field === field) : [];
  const plans = selected
    .map((item) => plannedContentFor(value.date, item.blockId, item.assignmentId))
    .filter((plan): plan is NonNullable<typeof plan> => Boolean(plan));

  const contentLabel = infant
    ? "Experiências e vivências realizadas"
    : "Conteúdo ou atividade realizada";

  return (
    <form
      aria-label="Registro de aula"
      className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_clamp(18.75rem,25vw,23.75rem)]"
      onSubmit={(event) => {
        event.preventDefault();
        setShowErrors(true);
        if (!issues.length) setReviewing(true);
      }}
    >
      <div className="min-w-0 space-y-5">
        {/* 1. Atuação */}
        <section aria-labelledby="step-assignment" className="surface-panel p-4">
          <h2 id="step-assignment" className="text-sm font-semibold text-foreground">
            1. Atuação pedagógica responsável
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Somente atuações vigentes em {value.date}. A troca de atuação limpa as aulas
            selecionadas.
          </p>
          {assignments.length ? (
            <div
              role="radiogroup"
              aria-label="Atuação pedagógica"
              className="mt-3 flex flex-wrap gap-2"
            >
              {assignments.map((item) => {
                const active = item.record.id === value.assignmentId;
                return (
                  <button
                    key={item.record.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() =>
                      set({ assignmentId: item.record.id, blockIds: [], quantity: 0, contents: {} })
                    }
                    className={cn(
                      "w-full min-w-0 max-w-full rounded-md border px-3 py-2 text-left text-sm shadow-panel transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto",
                      active
                        ? "border-primary bg-primary/5 shadow-none"
                        : "border-border bg-card hover:border-primary/30 hover:bg-muted/35",
                    )}
                  >
                    <span className="block font-medium text-foreground">{item.className}</span>
                    <span className="block text-xs text-muted-foreground">
                      {item.field} · {item.unitName} · {item.record.role}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="Nenhuma atuação vigente"
              description="Não há atuação pedagógica deste profissional na data escolhida."
              compact
            />
          )}
          {issueFor("assignment").map((issue) => (
            <p key={issue.message} role="alert" className="mt-2 text-sm text-destructive">
              {issue.message}
            </p>
          ))}
        </section>

        {/* 2. Aulas previstas */}
        <section aria-labelledby="step-blocks" className="surface-panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="step-blocks" className="text-sm font-semibold text-foreground">
                2. {infant ? "Momentos previstos na rotina" : "Aulas previstas no horário"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Aula prevista não é aula ministrada: marque apenas o que realmente ocorreu.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={value.extraordinary}
                onCheckedChange={(checked) =>
                  set({
                    extraordinary: checked,
                    blockIds: [],
                    quantity: checked ? 1 : 0,
                    contentMode: "shared",
                    contents: {},
                  })
                }
                aria-label="Aula fora da previsão"
              />
              Aula fora da previsão
            </label>
          </div>
          {value.extraordinary ? (
            <div className="mt-3 space-y-3">
              <StatePanel
                tone="info"
                title="Registro extraordinário"
                description="Use para uma atividade realizada fora da grade. Não altera o planejamento nem é aprovado automaticamente; nenhuma categoria legal é presumida."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Início
                  </span>
                  <Input
                    type="time"
                    aria-label="Horário de início"
                    value={value.extraordinaryStart}
                    onChange={(e) => set({ extraordinaryStart: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Término
                  </span>
                  <Input
                    type="time"
                    aria-label="Horário de término"
                    value={value.extraordinaryEnd}
                    onChange={(e) => set({ extraordinaryEnd: e.target.value })}
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Descrição da situação (obrigatória)
                </span>
                <Textarea
                  aria-label="Justificativa da aula fora da previsão"
                  value={value.justification}
                  onChange={(e) => set({ justification: e.target.value })}
                  rows={2}
                />
              </label>
              {[...issueFor("justification"), ...issueFor("time")].map((issue) => (
                <p key={issue.message} role="alert" className="text-sm text-destructive">
                  {issue.message}
                </p>
              ))}
            </div>
          ) : grouped.length ? (
            <div className="mt-3 space-y-4">
              {grouped.map(({ item, lessons }) => (
                <fieldset key={item.record.id}>
                  <legend className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    {item.className} · {item.field}
                  </legend>
                  <div className="grid gap-2 md:grid-cols-2">
                    {lessons.map((lesson) => (
                      <PlannedLessonCard
                        key={lesson.key}
                        planned={lesson}
                        checked={value.blockIds.includes(lesson.blockId)}
                        onToggle={() => toggleBlock(lesson)}
                      />
                    ))}
                  </div>
                </fieldset>
              ))}
              {foreign.length ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Outras atuações desta turma (não selecionáveis)
                  </p>
                  <ul className="grid gap-2 md:grid-cols-2">
                    {foreign.map((block) => (
                      <li
                        key={block.id}
                        className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground"
                      >
                        <span className="font-medium tabular-nums text-foreground">
                          {block.start}–{block.end}
                        </span>{" "}
                        {block.label} · pertence a outra atuação pedagógica
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {conflict ? <ContextConflictState message={conflict.message} /> : null}
              {selected.length > 1 && !conflict ? (
                <p className="text-xs text-muted-foreground">
                  {selected.length} aulas selecionadas ·{" "}
                  {areConsecutive(selected.map((item) => item.block))
                    ? "consecutivas"
                    : "não consecutivas"}
                </p>
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon={CalendarPlus2}
              title="Sem aulas previstas nesta data"
              description="Não há blocos da grade para suas atuações neste dia. Se uma atividade ocorreu, use “Aula fora da previsão”."
              compact
            />
          )}
          {issueFor("blocks").map((issue) => (
            <p key={issue.message} role="alert" className="mt-2 text-sm text-destructive">
              {issue.message}
            </p>
          ))}
          <label className="mt-4 flex max-w-xs flex-col text-sm">
            <span className="mb-1 text-xs font-medium text-muted-foreground">
              {infant
                ? "Momentos efetivamente realizados"
                : "Quantidade de aulas efetivamente ministradas"}
            </span>
            <Input
              type="number"
              min={0}
              aria-label="Quantidade efetivamente realizada"
              value={value.quantity}
              onChange={(e) => set({ quantity: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
          {issueFor("quantity").map((issue) => (
            <p key={issue.message} role="alert" className="mt-2 text-sm text-destructive">
              {issue.message}
            </p>
          ))}
        </section>

        {/* 3. Conteúdo */}
        <section aria-labelledby="step-content" className="surface-panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="step-content" className="text-sm font-semibold text-foreground">
              3. {contentLabel}
            </h2>
            {selected.length > 1 && !value.extraordinary ? (
              <div role="radiogroup" aria-label="Organização do conteúdo" className="flex gap-1">
                {(
                  [
                    ["shared", "Conteúdo compartilhado", Layers3],
                    ["individual", "Individualizar por aula", SplitSquareVertical],
                  ] as const
                ).map(([mode, label, Icon]) => (
                  <Button
                    key={mode}
                    type="button"
                    size="sm"
                    role="radio"
                    aria-checked={value.contentMode === mode}
                    variant={value.contentMode === mode ? "default" : "outline"}
                    onClick={() => set({ contentMode: mode })}
                  >
                    <Icon /> {label}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
          {value.contentMode === "shared" || selected.length <= 1 ? (
            <>
              {selected.length > 1 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Aplicado a:{" "}
                  {selected.map((item) => `${item.block.start}–${item.block.end}`).join(", ")}
                </p>
              ) : null}
              <Textarea
                aria-label={contentLabel}
                className="mt-3 min-h-32 text-base"
                placeholder={
                  infant
                    ? "Descreva as experiências, propostas e vivências realizadas com as crianças"
                    : "Descreva o que foi efetivamente trabalhado"
                }
                value={value.contents["shared"] ?? ""}
                onChange={(e) => set({ contents: { ...value.contents, shared: e.target.value } })}
              />
            </>
          ) : (
            <div className="mt-3 space-y-3">
              {selected.map((item) => (
                <label key={item.blockId} className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Aula {item.block.start}–{item.block.end}
                  </span>
                  <Textarea
                    aria-label={`Conteúdo da aula ${item.block.start}–${item.block.end}`}
                    value={value.contents[item.blockId] ?? ""}
                    onChange={(e) =>
                      set({ contents: { ...value.contents, [item.blockId]: e.target.value } })
                    }
                  />
                </label>
              ))}
            </div>
          )}
          {issueFor("content").map((issue) => (
            <p key={issue.message} role="alert" className="mt-2 text-sm text-destructive">
              {issue.message}
            </p>
          ))}
          <Collapsible className="mt-4">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="group">
                <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
                Informações pedagógicas opcionais
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 grid gap-3 md:grid-cols-2">
              <OptionalField
                label="Objetivos"
                value={value.objectives}
                onChange={(v) => set({ objectives: v })}
              />
              {infant ? (
                <OptionalField
                  label="Agrupamentos e organização"
                  value={value.groupings}
                  onChange={(v) => set({ groupings: v })}
                />
              ) : (
                <OptionalField
                  label="Habilidades curriculares (quando aplicáveis)"
                  hint="Informe somente códigos de fonte curricular; o sistema não sugere códigos."
                  value={value.skills}
                  onChange={(v) => set({ skills: v })}
                />
              )}
              <OptionalField
                label="Estratégias e recursos"
                value={value.strategies}
                onChange={(v) => set({ strategies: v })}
              />
              <OptionalField
                label={infant ? "Observações pedagógicas do grupo" : "Observações pedagógicas"}
                value={value.observations}
                onChange={(v) => set({ observations: v })}
              />
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Relação com o planejamento
                </span>
                <select
                  aria-label="Relação com o planejamento"
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={value.planningRelation}
                  onChange={(e) => set({ planningRelation: e.target.value as PlanningRelation })}
                >
                  {RELATIONS.map((relation) => (
                    <option key={relation}>{relation}</option>
                  ))}
                </select>
              </label>
            </CollapsibleContent>
          </Collapsible>
        </section>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <section aria-labelledby="planning-title" className="surface-panel p-4">
          <h2
            id="planning-title"
            className="flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <BookMarked className="size-4" aria-hidden /> Planejamento relacionado
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Conteúdo planejado é consulta; editar o registro não altera o planejamento.
          </p>
          {plans.length ? (
            <ul className="mt-3 space-y-2">
              {plans.map((plan) => (
                <li
                  key={plan.id}
                  className="rounded-md border border-border bg-muted/40 p-3 text-sm"
                >
                  <StatusBadge tone="neutral">Conteúdo planejado</StatusBadge>
                  <p className="mt-2 text-foreground">{plan.text}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      set({
                        contentMode: "shared",
                        contents: {
                          ...value.contents,
                          shared: [value.contents["shared"], plan.text].filter(Boolean).join("\n"),
                        },
                        planningRelation:
                          value.planningRelation === "Não informado"
                            ? "Conforme o planejado"
                            : value.planningRelation,
                      })
                    }
                  >
                    Usar como ponto de partida
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {selected.length
                ? "Não há planejamento registrado para as aulas selecionadas."
                : "Selecione aulas para consultar o planejamento."}
            </p>
          )}
        </section>

        <section aria-labelledby="summary-title" className="surface-panel p-4">
          <h2 id="summary-title" className="text-sm font-semibold text-foreground">
            Resumo do registro
          </h2>
          <dl className="info-list mt-3 divide-y divide-border/60 text-sm">
            <SummaryRow label="Data" value={value.date} />
            <SummaryRow label="Turma" value={current?.className ?? "—"} />
            <SummaryRow label="Componente/campo" value={current?.field ?? "—"} />
            <SummaryRow label="Escola" value={current?.unitName ?? "—"} />
            <SummaryRow
              label="Atuação"
              value={current ? `${current.record.role} · ${current.record.id}` : "—"}
            />
            <SummaryRow
              label="Aulas"
              value={
                value.extraordinary
                  ? `Fora da previsão · ${value.extraordinaryStart || "--"}–${value.extraordinaryEnd || "--"}`
                  : selected.map((item) => `${item.block.start}–${item.block.end}`).join(", ") ||
                    "—"
              }
            />
            <SummaryRow label="Quantidade" value={String(value.quantity)} />
            <SummaryRow label="Planejamento" value={value.planningRelation} />
          </dl>
          {reviewing && !issues.length ? (
            <div className="mt-4 space-y-2" role="region" aria-label="Confirmação">
              <p className="text-sm text-foreground">
                Confira o resumo. A conclusão é demonstrativa e fica apenas nesta aba.
              </p>
              <Button type="button" className="w-full" onClick={onConclude}>
                Concluir registro demonstrativo
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setReviewing(false)}
              >
                Voltar à edição
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <Button type="submit" className="w-full">
                Revisar registro
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={onKeepDraft}>
                Manter rascunho nesta aba
              </Button>
              {hasDraft ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-destructive"
                  onClick={onDiscard}
                >
                  Descartar rascunho
                </Button>
              ) : null}
            </div>
          )}
          {showErrors && issues.length ? (
            <p role="status" className="mt-3 text-xs text-destructive">
              {issues.length} pendência(s) antes da revisão.
            </p>
          ) : null}
        </section>
      </aside>
    </form>
  );
}

function OptionalField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label} (opcional)
      </span>
      <Textarea
        aria-label={label}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <InformationPair label={label} value={value} className="py-2" />;
}

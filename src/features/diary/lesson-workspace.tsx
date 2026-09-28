import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, CalendarClock, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { formatAcademicDate } from "@/lib/academic-date";
import { cn } from "@/lib/utils";
import {
  type LessonRecordInput,
  type PlannedContent,
  type PlannedLesson,
  type PlanningRelation,
} from "./lesson-records";

/**
 * Etapa 6D.2.2 — Lesson Workspace 2.0 (ficha operacional de escrita).
 *
 * A superfície não conhece norma: ela projeta o contexto que o SIGEM já sabe,
 * recebe o texto realizado e conclui. Detalhes pedagógicos permanecem
 * opcionais; nenhuma exigência é inventada pela interface.
 */

export const SESSION_DRAFT_NOTE = "Rascunho mantido nesta sessão";

/** Agrupa as aulas previstas em sequências contíguas da mesma atuação. */
export function lessonBlockGroups(planned: PlannedLesson[]): PlannedLesson[][] {
  const sorted = [...planned].sort((a, b) => a.block.start.localeCompare(b.block.start));
  const groups: PlannedLesson[][] = [];
  for (const lesson of sorted) {
    const last = groups[groups.length - 1];
    const tail = last?.[last.length - 1];
    if (
      last &&
      tail &&
      tail.assignmentId === lesson.assignmentId &&
      tail.classId === lesson.classId &&
      tail.field === lesson.field &&
      tail.block.end === lesson.block.start
    ) {
      last.push(lesson);
      continue;
    }
    groups.push([lesson]);
  }
  return groups;
}

/** Sequência contígua que contém o bloco indicado (ou a primeira do dia). */
export function lessonBlockGroup(
  planned: PlannedLesson[],
  blockId?: string,
): PlannedLesson[] | undefined {
  const groups = lessonBlockGroups(planned);
  if (blockId) {
    const match = groups.find((group) => group.some((item) => item.blockId === blockId));
    if (match) return match;
  }
  return groups[0];
}

/** Desdobra o texto compartilhado, preservando-o em cada aula. */
export function splitSharedContent(
  value: LessonRecordInput,
  blockIds: string[],
): LessonRecordInput {
  const shared = value.contents["shared"] ?? "";
  const contents: Record<string, string> = { ...value.contents };
  for (const id of blockIds) {
    if (!contents[id]?.trim()) contents[id] = shared;
  }
  return { ...value, contentMode: "individual", contents };
}

export type MergeChoice = { kind: "join" } | { kind: "keep"; text: string };

/**
 * Retorna o valor unificado; quando há textos individuais diferentes e nenhuma
 * escolha foi declarada, devolve as opções para a interface perguntar.
 */
export function mergeIndividualContent(
  value: LessonRecordInput,
  blockIds: string[],
  choice?: MergeChoice,
): { value?: LessonRecordInput; options?: string[] } {
  const texts = blockIds.map((id) => value.contents[id] ?? "").filter((text) => text.trim());
  const distinct = [...new Set(texts.map((text) => text.trim()))];
  if (distinct.length > 1 && !choice) return { options: distinct };
  const shared =
    distinct.length <= 1
      ? (distinct[0] ?? value.contents["shared"] ?? "")
      : choice?.kind === "keep"
        ? choice.text
        : distinct.join("\n\n");
  return {
    value: {
      ...value,
      contentMode: "shared",
      contents: { ...value.contents, shared },
    },
  };
}

const RELATIONS: PlanningRelation[] = [
  "Não informado",
  "Conforme o planejado",
  "Adaptado do planejado",
  "Diferente do planejado",
  "Sem planejamento prévio",
];

export type PreviousLessonMemory = { id: string; date: string; text: string };

export type LessonWorkspaceProps = {
  group: PlannedLesson[];
  value: LessonRecordInput;
  onChange: (value: LessonRecordInput) => void;
  onConclude: () => void;
  plans: PlannedContent[];
  previous?: PreviousLessonMemory;
  previousGroup?: PlannedLesson[];
  nextGroup?: PlannedLesson[];
  onGoToGroup?: (group: PlannedLesson[]) => void;
  onOpenPreviousRecord?: (memory: PreviousLessonMemory) => void;
  onAdvanced?: () => void;
  dirty?: boolean;
};

function groupTimeRange(group: PlannedLesson[]) {
  const first = group[0]!;
  const last = group[group.length - 1]!;
  return `${first.block.start}–${last.block.end}`;
}

function groupLessonLabel(group: PlannedLesson[]) {
  return group.map((item) => item.block.label).join(" e ");
}

export function LessonWorkspace({
  group,
  value,
  onChange,
  onConclude,
  plans,
  previous,
  previousGroup,
  nextGroup,
  onGoToGroup,
  onOpenPreviousRecord,
  onAdvanced,
  dirty,
}: LessonWorkspaceProps) {
  const first = group[0]!;
  const blockIds = group.map((item) => item.blockId);
  const writingRef = useRef<HTMLTextAreaElement>(null);
  const baseId = useId();
  const [details, setDetails] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [mergeOptions, setMergeOptions] = useState<string[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    writingRef.current?.focus();
  }, []);

  const set = (changes: Partial<LessonRecordInput>) => onChange({ ...value, ...changes });
  const setContent = (key: string, text: string) =>
    set({ contents: { ...value.contents, [key]: text } });

  const individual = value.contentMode === "individual";
  const texts = individual
    ? blockIds.map((id) => value.contents[id] ?? "")
    : [value.contents["shared"] ?? ""];
  const ready = texts.length > 0 && texts.every((text) => text.trim().length > 0);

  const separate = () => onChange(splitSharedContent(value, blockIds));
  const unify = (choice?: MergeChoice) => {
    const result = mergeIndividualContent(value, blockIds, choice);
    if (result.options) {
      setMergeOptions(result.options);
      return;
    }
    setMergeOptions(null);
    if (result.value) onChange(result.value);
  };

  const copyToDraft = (text: string, source: string) => {
    if (individual) {
      const target = blockIds[0]!;
      setContent(target, text);
    } else {
      setContent("shared", text);
    }
    setCopied(source);
    writingRef.current?.focus();
  };

  return (
    <section aria-label="Registro da aula" className="space-y-4">
      <header className="surface-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold leading-tight text-foreground">
              {first.className} · {first.field}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {groupLessonLabel(group)} · {groupTimeRange(group)}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatAcademicDate(first.date)} · {first.unitName}
            </p>
          </div>
          <StatusBadge tone={dirty ? "warning" : "neutral"}>
            {dirty ? SESSION_DRAFT_NOTE : "Nada escrito ainda"}
          </StatusBadge>
        </div>
        {previousGroup || nextGroup ? (
          <div className="mt-3 flex flex-wrap justify-between gap-2">
            {previousGroup ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onGoToGroup?.(previousGroup)}
              >
                <ChevronLeft /> Aula anterior do dia
              </Button>
            ) : (
              <span />
            )}
            {nextGroup ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onGoToGroup?.(nextGroup)}
              >
                Próxima aula do dia <ChevronRight />
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="surface-panel space-y-3 p-4">
        {individual ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Registro separado por aula
              </h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => unify()}>
                Voltar a um registro único
              </Button>
            </div>
            {mergeOptions ? (
              <div
                role="group"
                aria-label="Unificar os registros"
                className="rounded-md border border-border bg-muted/40 p-3"
              >
                <p className="text-sm text-foreground">
                  As aulas têm textos diferentes. O que deseja preservar no registro único?
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => unify({ kind: "join" })}
                  >
                    Manter os dois textos, um após o outro
                  </Button>
                  {mergeOptions.map((text) => (
                    <Button
                      key={text}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto whitespace-normal py-2 text-left"
                      onClick={() => unify({ kind: "keep", text })}
                    >
                      Manter apenas: “{text}”
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setMergeOptions(null)}
                  >
                    Continuar separado
                  </Button>
                </div>
              </div>
            ) : null}
            {group.map((lesson, index) => (
              <label key={lesson.blockId} className="block">
                <span className="mb-1 block text-sm font-medium text-foreground">
                  {lesson.block.label} · {lesson.block.start}–{lesson.block.end}
                </span>
                <Textarea
                  ref={index === 0 ? writingRef : undefined}
                  rows={4}
                  value={value.contents[lesson.blockId] ?? ""}
                  onChange={(event) => setContent(lesson.blockId, event.target.value)}
                  placeholder="O que foi trabalhado nesta aula?"
                  aria-label={`O que foi trabalhado na ${lesson.block.label}?`}
                />
              </label>
            ))}
          </>
        ) : (
          <>
            <label htmlFor={`${baseId}-shared`} className="block">
              <span className="text-base font-semibold text-foreground">
                O que foi trabalhado nesta aula?
              </span>
            </label>
            <Textarea
              id={`${baseId}-shared`}
              ref={writingRef}
              rows={6}
              value={value.contents["shared"] ?? ""}
              onChange={(event) => setContent("shared", event.target.value)}
              placeholder="Escreva com suas palavras o que aconteceu na aula."
              aria-label="O que foi trabalhado nesta aula?"
              className="text-base leading-relaxed"
            />
            {group.length > 1 ? (
              <Button type="button" variant="ghost" size="sm" onClick={separate}>
                As aulas tiveram momentos diferentes? Separar por aula
              </Button>
            ) : null}
          </>
        )}
        {copied ? (
          <p role="status" className="text-xs text-muted-foreground">
            Texto copiado para o rascunho a partir de {copied}. Ele só passa a valer como realizado
            depois que você revisar e concluir.
          </p>
        ) : null}
      </div>

      {plans.length || previous ? (
        <div className="grid gap-3 md:grid-cols-2">
          {plans.map((plan) => (
            <div key={plan.id} className="surface-panel p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Planejado para hoje
              </p>
              <p className="mt-1 text-sm text-foreground">{plan.text}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => copyToDraft(plan.text, "o planejamento")}
              >
                Usar como ponto de partida
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">
                Planejado não é realizado: copiar apenas preenche o rascunho.
              </p>
            </div>
          ))}
          {previous ? (
            <div className="surface-panel p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Na aula anterior ({formatAcademicDate(previous.date)})
              </p>
              <p className="mt-1 text-sm text-foreground">{previous.text}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToDraft(previous.text, "a aula anterior")}
                >
                  Usar como ponto de partida
                </Button>
                {onOpenPreviousRecord ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenPreviousRecord(previous)}
                  >
                    Ver registro
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="surface-panel p-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={details}
          onClick={() => setDetails((open) => !open)}
        >
          <Plus /> {details ? "Ocultar detalhes pedagógicos" : "Adicionar detalhes pedagógicos"}
        </Button>
        {details ? (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Tudo aqui é opcional: o registro se conclui apenas com o que foi trabalhado.
            </p>
            {(
              [
                ["objectives", "Objetivos"],
                ["skills", "Habilidades curriculares"],
                ["strategies", "Estratégias e recursos"],
                ["groupings", "Agrupamentos"],
                ["observations", "Observações pedagógicas"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
                <Input
                  value={value[field]}
                  onChange={(event) => set({ [field]: event.target.value })}
                  aria-label={label}
                />
              </label>
            ))}
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Relação com o planejamento
              </span>
              <select
                aria-label="Relação com o planejamento"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={value.planningRelation}
                onChange={(event) =>
                  set({ planningRelation: event.target.value as PlanningRelation })
                }
              >
                {RELATIONS.map((relation) => (
                  <option key={relation} value={relation}>
                    {relation}
                  </option>
                ))}
              </select>
            </label>
            {onAdvanced ? (
              <Button type="button" variant="link" size="sm" className="px-0" onClick={onAdvanced}>
                Registrar em situação especial (fora do horário previsto) <ArrowRight />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3",
          "border-t border-border bg-background/95 px-1 py-3 backdrop-blur",
        )}
      >
        <p className="text-xs text-muted-foreground">
          <CalendarClock className="mr-1 inline size-3.5" aria-hidden />
          {dirty ? SESSION_DRAFT_NOTE : "Nada é enviado nem sincronizado nesta demonstração."}
        </p>
        {confirming ? (
          <div
            role="group"
            aria-label="Confirmar conclusão"
            className="w-full rounded-md border border-border bg-card p-3"
          >
            <p className="text-sm font-medium text-foreground">Concluir este registro?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Depois de concluído, qualquer alteração será registrada como uma correção, preservando
              esta versão.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" onClick={onConclude}>
                Concluir registro
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <Button
              type="button"
              disabled={!ready}
              onClick={() => setConfirming(true)}
              className="min-h-11"
            >
              Concluir registro da aula
            </Button>
            {!ready ? (
              <span className="text-xs text-muted-foreground">
                Escreva o que foi trabalhado para concluir.
              </span>
            ) : null}
          </div>
        )}
      </div>
      <StatePanel
        tone="info"
        title="Nada foi presumido"
        description="A chamada é um ciclo próprio: nenhuma presença ou falta é criada por este registro."
      />
    </section>
  );
}

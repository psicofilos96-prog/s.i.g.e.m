/**
 * SIGEM Human Interface Language — primitivas de tarefa humana (Etapa 13UX · Rodada 5).
 *
 * Extraídas do piloto aprovado `/alunos/novo`. Regras desta camada:
 *  - Estas primitivas são de APRESENTAÇÃO: não conhecem domínio, validação,
 *    política, capacidade nem persistência. Recebem texto já traduzido.
 *  - Orientação nunca é acusação: mensagem de requisito aparece como condução
 *    ("Para avançar, informe…") e desaparece quando o requisito é satisfeito.
 *  - Nenhum significado depende só de cor: forma, número, ícone e rótulo
 *    carregam o sentido junto.
 *  - Complexidade institucional existe, mas sob demanda: use
 *    `InstitutionalDetails` (workspace-ui) para o nível 3 de revelação.
 *
 * Documentação normativa: docs/human-interface-language.md
 */
import type { ReactNode } from "react";
import { Check, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* --------------------------------------------------------------- stepper */

export type WorkflowStep = {
  /** Identificador estável da etapa (valor interno, nunca exibido). */
  id: string;
  /** Rótulo humano curto da etapa. */
  label: string;
};

/**
 * Trilho contínuo de etapas de uma tarefa multietapas.
 *
 * Usar apenas quando existir sequência mental legítima. Não converter
 * formulários densos em assistente por padrão.
 */
export function StepRail<TStep extends WorkflowStep>({
  steps,
  currentId,
  furthestIndex,
  onSelect,
  label = "Etapas da tarefa",
}: {
  steps: readonly TStep[];
  currentId: string;
  /** Índice da etapa mais avançada já alcançada: só até ela o retorno é livre. */
  furthestIndex: number;
  onSelect: (index: number) => void;
  label?: string;
}) {
  const currentIndex = steps.findIndex((step) => step.id === currentId);
  const currentLabel = steps[currentIndex]?.label ?? "";
  return (
    <nav aria-label={`${label} — você está em ${currentLabel}`}>
      <ol className="flex items-stretch">
        {steps.map((candidate, index) => {
          const done = index < currentIndex;
          const isCurrent = candidate.id === currentId;
          const reachable = index <= furthestIndex;
          const last = index === steps.length - 1;
          return (
            <li key={candidate.id} className="flex min-w-0 flex-1 flex-col gap-2">
              <span aria-hidden="true" className="flex items-center">
                <span
                  className={cn(
                    "h-[3px] flex-1 rounded-full",
                    index === 0 ? "bg-transparent" : done || isCurrent ? "bg-primary" : "bg-border",
                  )}
                />
                <span
                  className={cn(
                    "mx-1.5 grid size-8 shrink-0 place-items-center rounded-full border text-[0.8125rem] font-semibold transition-colors",
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCurrent
                        ? "border-primary bg-card text-primary ring-4 ring-primary/15"
                        : "border-border bg-card text-muted-foreground/70",
                  )}
                >
                  {done ? <Check className="size-4" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "h-[3px] flex-1 rounded-full",
                    last ? "bg-transparent" : done ? "bg-primary" : "bg-border",
                  )}
                />
              </span>
              <button
                type="button"
                disabled={!reachable}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onSelect(index)}
                className={cn(
                  "min-h-9 rounded-md px-1 text-center text-[0.8125rem] leading-tight transition-colors sm:text-sm",
                  isCurrent
                    ? "font-semibold text-foreground"
                    : reachable
                      ? "font-medium text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/60",
                )}
              >
                <span className="block truncate">{candidate.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------ formulário */

/** Explicação serena de um campo. A microcopy explica; ela não legisla. */
export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-sm text-muted-foreground">{children}</p>;
}

/**
 * Mensagem de requisito de um campo.
 *
 * `show` existe para que nada apareça antes de interação significativa:
 * a tela orienta quem já mexeu no campo, nunca recebe quem acabou de chegar.
 */
export function FieldMessage({ children, show = true, id }: { children?: ReactNode; show?: boolean; id?: string | undefined }) {
  if (!children || !show) return null;
  return (
    <span id={id} className="mt-1.5 block text-sm font-medium text-destructive" role="alert">
      {children}
    </span>
  );
}

/** Bloco de campos de uma etapa: um assunto, uma instrução, campos amplos. */
export function TaskFieldset({
  legend,
  instruction,
  children,
}: {
  legend: string;
  instruction: string;
  children: ReactNode;
}) {
  const headingId = `tarefa-${legend.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section className="surface-float p-5 sm:p-7" aria-labelledby={headingId}>
      <h2 id={headingId} className="font-display text-xl font-semibold text-foreground">
        {legend}
      </h2>
      <p className="mt-1 max-w-prose text-base text-muted-foreground">{instruction}</p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * Orientação do que falta para avançar.
 *
 * Aparece somente enquanto houver requisito pendente; satisfeito o requisito,
 * desaparece e a ação primária assume o protagonismo sozinha.
 */
export function StepGuidance({ requirement }: { requirement?: string | null }) {
  if (!requirement) return null;
  return (
    <p className="text-sm text-muted-foreground" role="status">
      Para avançar, {requirement}
    </p>
  );
}

/* -------------------------------------------------------------- revisão */

/** Bloco de conferência por assunto, com retorno direto à etapa de origem. */
export function ReviewSection({
  title,
  onEdit,
  editLabel = "Editar",
  children,
}: {
  title: string;
  onEdit?: () => void;
  editLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="surface-float p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
        {onEdit ? (
          <Button size="sm" variant="ghost" className="min-h-10" onClick={onEdit}>
            <Pencil aria-hidden="true" /> {editLabel}
          </Button>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

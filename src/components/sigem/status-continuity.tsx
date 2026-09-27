/**
 * SIGEM — primitivas de estado, bloqueio e continuidade (Rodada 6B.1).
 *
 * Gramática única: estado → explicação → consequência → dependência →
 * próximo passo → fundamentação (Níveis 2/3).
 *
 * Estas primitivas apenas APRESENTAM o que `resolveHumanStatus` devolveu.
 * Nenhuma delas deduz responsável, prazo, requisito ou autorização.
 */
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CircleCheck,
  CircleHelp,
  Info,
  Lock,
  OctagonAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { HumanStatusPresentation, HumanStatusTone } from "@/lib/human-status";

const TONE_META: Record<HumanStatusTone, { surface: string; icon: LucideIcon; word: string }> = {
  neutro: { surface: "tone-surface-neutral", icon: Info, word: "" },
  informacao: { surface: "tone-surface-info", icon: Info, word: "Informação" },
  acompanhamento: { surface: "tone-surface-neutral", icon: CalendarClock, word: "Em andamento" },
  atencao: { surface: "tone-surface-attention", icon: AlertTriangle, word: "Atenção" },
  "acao-necessaria": { surface: "tone-surface-info", icon: CircleHelp, word: "Falta informar" },
  impedimento: { surface: "tone-surface-impediment", icon: Lock, word: "Ainda não é possível" },
  erro: { surface: "tone-surface-error", icon: OctagonAlert, word: "Erro" },
};

/**
 * Explicação completa de um estado institucional.
 * Recebe a apresentação já resolvida; `null` significa "nada a projetar".
 */
export function StatusExplanation({
  status,
  title,
  nextAction,
  details,
  className,
}: {
  status: HumanStatusPresentation | null;
  /** Título opcional do bloco (ex.: o nome da etapa). */
  title?: string;
  /** Próximo passo autorizado, quando existir. */
  nextAction?: ReactNode;
  /** Níveis 2 e 3: fundamentação sob demanda. */
  details?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!status) return null;
  const meta = TONE_META[status.tone];
  const Icon = meta.icon;

  return (
    <div className={cn("border border-border bg-card px-3.5 py-3 text-sm", className)}>
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full",
            meta.surface,
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-1.5">
          {title ? <p className="text-xs text-muted-foreground">{title}</p> : null}
          <p className="font-medium">{status.headline}</p>
          {status.because ? (
            <p className="text-sm text-muted-foreground">{status.because}</p>
          ) : null}
          {status.consequence ? (
            <p className="text-sm text-muted-foreground">{status.consequence}</p>
          ) : null}
          {status.pendingRequirements.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
              {status.pendingRequirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
          ) : null}
          {status.waitingLine ? (
            <p className="text-sm text-muted-foreground">{status.waitingLine}</p>
          ) : null}
          <p
            className={cn(
              "text-sm",
              status.responsibilityKnown ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {status.responsibility}
          </p>
          {nextAction ? <div className="pt-1">{nextAction}</div> : null}
          {details ? (
            <div className="pt-1">
              <Button
                size="sm"
                variant="link"
                className="h-auto px-0 text-xs"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
              >
                {open ? "Ocultar fundamentação" : "Entender o que falta"}
              </Button>
              {open ? (
                <div className="mt-1.5 space-y-1 border-l-2 border-border pl-3 text-xs text-muted-foreground">
                  {details}
                  {status.provenance.diagnosticCode ? (
                    <p>Referência técnica: {status.provenance.diagnosticCode}</p>
                  ) : null}
                  {status.provenance.policyDefinitionId ? (
                    <p>
                      Política: {status.provenance.policyDefinitionId}
                      {status.provenance.policyVersion
                        ? ` (versão ${status.provenance.policyVersion})`
                        : ""}
                    </p>
                  ) : null}
                  {status.provenance.competentExecutorDefinitionId ? (
                    <p>Executor competente: {status.provenance.competentExecutorDefinitionId}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Motivo imediato de uma ação institucional indisponível.
 * A ação continua indisponível: aqui só a causa fica visível, com caminho direto.
 */
export function BlockingReason({
  actionLabel,
  explanation,
  requirements = [],
  resolveAction,
  className,
}: {
  actionLabel: string;
  explanation: string;
  requirements?: readonly string[];
  /** Caminho direto para suprir a pendência. */
  resolveAction?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border border-border bg-muted/40 px-3.5 py-3 text-sm", className)}>
      <div className="flex items-start gap-2.5">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 space-y-1.5">
          <p className="font-medium">{actionLabel}</p>
          <p className="text-muted-foreground">{explanation}</p>
          {requirements.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              {requirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
          ) : null}
          {resolveAction ? <div className="pt-1">{resolveAction}</div> : null}
        </div>
      </div>
    </div>
  );
}

/** Espera legítima: serena por padrão, atenção só quando os fatos exigem. */
export function DependencyNotice({
  waitingFor,
  dueDateLabel,
  attentionRequired = false,
  description,
  action,
  className,
}: {
  waitingFor: string;
  dueDateLabel?: string | null;
  attentionRequired?: boolean;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  const meta = attentionRequired ? TONE_META.atencao : TONE_META.acompanhamento;
  const Icon = meta.icon;
  return (
    <div className={cn("border border-border bg-card px-3.5 py-3 text-sm", className)}>
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full",
            meta.surface,
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="font-medium">
            Aguardando {waitingFor}
            {dueDateLabel ? ` — prazo até ${dueDateLabel}` : ""}
          </p>
          {description ? <p className="text-muted-foreground">{description}</p> : null}
          {action ? <div className="pt-1">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

/** Conclusão conectiva: o que foi feito, o que não foi e o que vem depois. */
export function SuccessContinuity({
  headline,
  honesty,
  registered = [],
  primaryAction,
  secondaryActions,
  className,
}: {
  headline: string;
  /** Honestidade sobre o que foi (ou não) gravado. */
  honesty: string;
  registered?: readonly string[];
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border border-border bg-card px-4 py-4", className)}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full tone-surface-success">
          <CircleCheck className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-2">
          <p className="font-medium">{headline}</p>
          {registered.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
              {registered.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-sm text-muted-foreground">{honesty}</p>
          {primaryAction ? <div className="pt-1">{primaryAction}</div> : null}
          {secondaryActions ? (
            <div className="flex flex-wrap gap-2 pt-1">{secondaryActions}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

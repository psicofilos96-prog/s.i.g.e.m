import type { ReactNode } from "react";
import { AlertTriangle, History, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { StatusBadge, StatePanel, EmptyState } from "./patterns";
import { RecoveryRetryButton } from "./recovery-retry-button";
import { useRecoveryTrail } from "@/lib/observability/recovery-trail";

/** Estados de ciclo de vida de um registro versionado. Rótulo é apresentação; o estado vem do dado. */
export type VersionState = "rascunho" | "em-revisao" | "efetivo" | "revogado" | "historico";

const VERSION_TONE: Record<VersionState, "neutral" | "info" | "success" | "danger" | "warning"> = {
  rascunho: "neutral",
  "em-revisao": "info",
  efetivo: "success",
  revogado: "danger",
  historico: "warning",
};
const VERSION_LABEL: Record<VersionState, string> = {
  rascunho: "Rascunho",
  "em-revisao": "Em revisão",
  efetivo: "Efetivo",
  revogado: "Revogado",
  historico: "Histórico",
};

export function VersionStateBadge({ state, version }: { state: VersionState; version?: number | string }) {
  return (
    <StatusBadge tone={VERSION_TONE[state]}>
      {VERSION_LABEL[state]}
      {version !== undefined && <span className="ml-1 opacity-75">· v{version}</span>}
    </StatusBadge>
  );
}

/**
 * Valor de um fato. `null`/`undefined` é ausência e nunca vira zero; zero real
 * é exibido como zero. Ausência é anunciada por extenso a leitores de tela.
 */
export function FactValue({
  value,
  format,
  absentLabel = "Não informado",
}: {
  value: number | string | null | undefined;
  format?: (v: number | string) => string;
  absentLabel?: string;
}) {
  if (value === null || value === undefined || value === "") {
    return <span className="italic text-muted-foreground" data-absent="true">{absentLabel}</span>;
  }
  return <span className="tabular-nums">{format ? format(value) : String(value)}</span>;
}

/** Linha de proveniência: origem, autoria e momento do registro. Nada é inferido. */
export function ProvenanceLine({
  source,
  actor,
  recordedAt,
  children,
}: {
  source?: string | null;
  actor?: string | null;
  recordedAt?: string | null;
  children?: ReactNode;
}) {
  const parts = [source && `Fonte: ${source}`, actor && `Registrado por ${actor}`, recordedAt && `em ${recordedAt}`].filter(Boolean);
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <History className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{parts.length ? parts.join(" · ") : "Proveniência não informada"}{children}</span>
    </p>
  );
}

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({
  title = "Não foi possível carregar",
  description,
  onRetry,
  operation = "error-state",
  traced = false,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
  /** NOBS.4: operação técnica fixa registrada na trilha de recuperação. */
  operation?: string;
  /** Quem chama já governou o erro e passa `trail.retry` (evita trilha dupla). */
  traced?: boolean;
}) {
  return (
    <div role="alert">
      <StatePanel
        tone="danger"
        title={title}
        description={description}
        action={onRetry && (traced
          ? <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw aria-hidden="true" /> Tentar novamente</Button>
          : <RecoveryRetryButton size="sm" variant="outline" icon operation={operation} onRetry={onRetry} />)}
      />
    </div>
  );
}

/** Conflito de concorrência otimista: outra gravação venceu; nada é sobrescrito sem recarregar. */
export function ConcurrencyConflictNotice({ onReload }: { onReload: () => void }) {
  // NOBS.4: recarregar após conflito entra na trilha (desfecho "recarregou"), sem dado pessoal.
  const trail = useRecoveryTrail("concurrency:conflict", { operation: "concurrency-conflict" }, { onReload });
  return (
    <div role="alert">
      <StatePanel
        tone="warning"
        title="Este registro mudou desde que você o abriu"
        description="Outra gravação foi salva primeiro. Recarregue para ver a versão atual antes de alterar; sua edição não foi aplicada."
        action={<Button size="sm" variant="outline" onClick={trail.reload}><RefreshCw aria-hidden="true" /> Recarregar versão atual</Button>}
      />
    </div>
  );
}

export function WarningNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-warning-foreground">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** Ação perigosa ou irreversível: sempre confirmação explícita com consequência descrita. */
export function DangerAction({
  trigger,
  title,
  consequence,
  confirmLabel,
  onConfirm,
  disabled,
}: {
  trigger: ReactNode;
  title: string;
  consequence: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={disabled}>{trigger}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground">{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * NEMPTY.3 — tipos de ausência, cada um com frase própria. Zero observado NÃO é ausência:
 * é valor e aparece como número (FactValue). Nenhum tipo afirma que "está tudo bem".
 */
export type AbsenceKind = "sem-dado" | "nao-configurado" | "sem-permissao" | "nenhum-resultado" | "nenhum-registro";

export const ABSENCE_TEXT: Readonly<Record<AbsenceKind, { title: string; description: string }>> = {
  "sem-dado": { title: "Sem dado", description: "Esta informação não foi registrada ou não pôde ser lida. Não significa zero." },
  "nao-configurado": { title: "Ainda não configurado", description: "Falta a regra ou o cadastro que permite mostrar esta informação." },
  "sem-permissao": { title: "Sem permissão", description: "Sua conta não tem permissão vigente para ver esta informação. Isso não indica que ela não exista." },
  "nenhum-resultado": { title: "Nenhum resultado", description: "Nada corresponde à busca ou aos filtros. Ajuste os critérios." },
  "nenhum-registro": { title: "Nenhum registro", description: "Ainda não há registros aqui." },
};

export function AbsenceState({ kind, title, description, action, compact }: { kind: AbsenceKind; title?: string; description?: string; action?: ReactNode; compact?: boolean }) {
  const t = ABSENCE_TEXT[kind];
  return <div data-absence={kind}><EmptyState title={title ?? t.title} description={description ?? t.description} action={action} compact={compact} /></div>;
}

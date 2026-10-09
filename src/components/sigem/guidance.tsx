import { useId, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecoveryTrail } from "@/lib/observability/recovery-trail";
import { ErrorState } from "./states";

/**
 * Orientação para baixa alfabetização digital: onde estou, o que fazer e
 * próximo passo, com UMA ação principal. Só apresentação; não decide regra.
 */
export function TaskGuide({ where, todo, next, action }: { where: string; todo: string; next?: string; action?: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-t`} className="border-l-2 border-territory-accent py-1 pl-4 text-foreground">
      <h2 id={`${id}-t`} className="font-sans text-xs font-semibold uppercase tracking-wide text-accent-foreground">Você está em: {where}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{todo}</p>
      {next && (
        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
          <ArrowRight className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Próximo passo: {next}</span>
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </section>
  );
}

/** Esqueleto de carregamento anunciado a leitores de tela; nunca texto cru. */
export function SkeletonState({ rows = 3, label = "Carregando informações" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" data-sigem-skeleton className="space-y-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-10 w-full" aria-hidden="true" />)}
    </div>
  );
}

/** Acesso negado com retorno seguro: nada é revelado e há um único caminho de volta. */
export function AccessDeniedState({ reason = "Sua conta não tem permissão para esta área.", backTo = "/", backLabel = "Voltar para a minha área" }: { reason?: string; backTo?: string; backLabel?: string }) {
  return (
    <div role="alert" className="mx-auto max-w-md rounded-lg border bg-card p-6 text-center text-card-foreground">
      <Lock className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
      <h2 className="mt-2 text-lg font-semibold">Acesso não liberado</h2>
      <p className="mt-1 text-sm">{reason} Se precisar, peça a liberação a quem coordena seu setor.</p>
      <Button asChild className="mt-4 min-h-11"><Link to={backTo}>{backLabel}</Link></Button>
    </div>
  );
}

/** Erro orientador: converte qualquer falha em mensagem humana + código; nunca mostra SQL cru. */
export function GuidedErrorState({ error, onRetry, title, operation }: { error: unknown; onRetry?: () => void; title?: string; operation?: string }) {
  // NOBS.4: governado uma vez; "Tentar novamente" e o desfecho entram na trilha de recuperação.
  const trail = useRecoveryTrail(error, { operation: operation ?? "carregar" }, { onRetry: () => onRetry?.() });
  const g = trail.governed;
  return <ErrorState {...(title ? { title } : {})} {...(onRetry ? { onRetry: trail.retry } : {})} traced description={`${g.userMessage} (código ${g.correlationId})`} />;
}

/** Campo com rótulo visível, dica e erro associados por aria-describedby. */
export function FieldShell({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: (p: { id: string; "aria-invalid": true | undefined; "aria-describedby": string | undefined }) => ReactNode }) {
  const id = useId();
  const describedBy = [hint && `${id}-h`, error && `${id}-e`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && <p id={`${id}-h`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-e`} role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** Alternativa tabular de gráfico: mesmos números; ausência por extenso, nunca zero. */
export function ChartDataTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: Array<Array<string | number | null>> }) {
  return (
    <table className="w-full text-sm">
      <caption className="mb-1 text-left font-medium">{caption}</caption>
      <thead><tr>{columns.map((c) => <th key={c} scope="col" className="border-b p-2 text-left">{c}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((v, j) => j === 0
            ? <th key={j} scope="row" className="border-b p-2 text-left font-normal">{v ?? "Não informado"}</th>
            : <td key={j} className="border-b p-2 tabular-nums">{v ?? <span className="italic text-muted-foreground">Não informado</span>}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

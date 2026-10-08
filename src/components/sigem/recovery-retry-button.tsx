// NOBS.4 — botão "Tentar novamente" ligado à trilha de recuperação quando a tela só tem o estado
// de falha (sem objeto de erro): o motivo vira um código técnico fixo, nunca texto da pessoa.
import type { ComponentProps } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecoveryTrail } from "@/lib/observability/recovery-trail";

export function RecoveryRetryButton({ error, operation, onRetry, icon, ...props }: Omit<ComponentProps<typeof Button>, "onClick"> & { error?: unknown; operation: string; onRetry: () => void; icon?: boolean }) {
  const trail = useRecoveryTrail(error ?? "recurso:unavailable", { operation }, { onRetry });
  return <Button {...props} onClick={trail.retry}>{icon ? <RefreshCw aria-hidden="true" /> : null} Tentar novamente</Button>;
}

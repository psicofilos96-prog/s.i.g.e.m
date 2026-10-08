// NOBS.4 — trilha de recuperação de cada estado de erro mostrado ao usuário.
// O erro é governado UMA vez (mesmo correlationId exibido na tela); cada ação de recuperação
// grava `recovery` com esse id: nova-tentativa, recarregou, desistiu; e "recuperado" quando o
// estado de erro sai da tela depois de uma nova tentativa. Só rota/operação/desfecho, sem payload,
// sem dado pessoal, sem telemetria externa nem retenção própria (só o log estruturado do processo).
import { useEffect, useMemo, useRef } from "react";
import { reportGoverned, recordRecovery, type GovernedError, type OperationContext } from "./governed-errors";

export type RecoveryTrail = {
  governed: GovernedError;
  retry: () => void;
  reload: () => void;
  giveUp: () => void;
  /** Para testes e estados sem hook: encerra a trilha como se o erro saísse da tela. */
  settle: () => void;
};

const currentRoute = () => (typeof window !== "undefined" ? window.location.pathname.replace(/[^a-z0-9/_.:$-]/gi, "").slice(0, 80) : undefined);

/** Núcleo puro (sem React): usado pelo hook e pelos testes. */
export function createRecoveryTrail(error: unknown, ctx: OperationContext = {}, hooks: { onRetry?: () => void; onReload?: () => void; onGiveUp?: () => void } = {}): RecoveryTrail {
  const c: OperationContext = { route: ctx.route ?? currentRoute(), operation: ctx.operation ?? "ui" };
  const governed = reportGoverned(error, c);
  let retried = false, closed = false;
  const mark = (o: Parameters<typeof recordRecovery>[1]) => { if (!closed) recordRecovery(governed.correlationId, o, c); };
  return {
    governed,
    retry: () => { mark("nova-tentativa"); retried = true; hooks.onRetry?.(); },
    reload: () => { mark("recarregou"); closed = true; hooks.onReload?.(); },
    giveUp: () => { mark("desistiu"); closed = true; hooks.onGiveUp?.(); },
    settle: () => { if (retried) mark("recuperado"); closed = true; },
  };
}

/** Hook: uma trilha por erro; "recuperado" ao desmontar após nova tentativa. */
export function useRecoveryTrail(error: unknown, ctx: OperationContext = {}, hooks: { onRetry?: () => void; onReload?: () => void; onGiveUp?: () => void } = {}): RecoveryTrail {
  const hooksRef = useRef(hooks); hooksRef.current = hooks;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const trail = useMemo(() => createRecoveryTrail(error, ctx, {
    onRetry: () => hooksRef.current.onRetry?.(), onReload: () => hooksRef.current.onReload?.(), onGiveUp: () => hooksRef.current.onGiveUp?.(),
  }), [error, ctx.operation, ctx.route]);
  useEffect(() => () => trail.settle(), [trail]);
  return trail;
}

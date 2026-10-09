import { useCallback, useEffect, useRef } from "react";

/**
 * NLOADING.2 — leitura disparada por filtro/contexto: só a última resposta pode
 * gravar na tela. Troca rápida de escola, ano ou período não deixa uma resposta
 * antiga (mais lenta) sobrescrever a atual, e nada grava depois de desmontar.
 */
export function createLatestGate() {
  let seq = 0;
  return {
    begin(): () => boolean { const mine = ++seq; return () => mine === seq; },
    cancel() { seq++; },
  };
}

export function useLatestRequest() {
  const gate = useRef(createLatestGate()).current;
  useEffect(() => () => gate.cancel(), [gate]);
  return useCallback(() => gate.begin(), [gate]);
}

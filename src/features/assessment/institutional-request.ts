import { useCallback, useEffect, useRef, useState } from "react";

type Snapshot<T> =
  | { key: string; kind: "loading" }
  | { key: string; kind: "ready"; value: T }
  | { key: string; kind: "error"; error: string };

/** A resposta só pertence ao contexto que a iniciou; uma nova consulta invalida a anterior. */
export function useInstitutionalRequest<T>(key: string, enabled: boolean, load: () => Promise<T>) {
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    if (!enabled) return;
    setSnapshot({ key, kind: "loading" });
    try {
      const value = await load();
      if (generation.current === current) setSnapshot({ key, kind: "ready", value });
    } catch (error) {
      if (generation.current === current)
        setSnapshot({ key, kind: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }, [enabled, key, load]);

  useEffect(() => {
    const requestGeneration = generation;
    void refresh();
    return () => { requestGeneration.current++; };
  }, [refresh]);

  // A chave do render atual bloqueia o resultado antigo antes mesmo de useEffect executar.
  const current = enabled && snapshot?.key === key ? snapshot : null;
  return {
    ready: current?.kind === "ready" || current?.kind === "error",
    value: current?.kind === "ready" ? current.value : undefined,
    error: current?.kind === "error" ? current.error : undefined,
    refresh,
  };
}

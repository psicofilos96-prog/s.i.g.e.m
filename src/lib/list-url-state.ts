import { useCallback, useMemo } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

/**
 * NFILTER.1 — filtros de lista na URL.
 * Só entram na URL chaves declaradas em `defaults` com valor de opção (texto curto, sem espaço);
 * valores iguais ao padrão saem da URL. A busca livre NUNCA vai para a URL (contém nomes de
 * pessoas): fica em `usePersistentState` (sessão do navegador).
 */
const SAFE_VALUE = /^[\p{L}\p{N}_.:-]{1,80}$/u;

export function readListFilters<T extends Record<string, string>>(search: Record<string, unknown>, defaults: T): T {
  const out = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof T & string>) {
    const raw = search[key];
    const value = typeof raw === "number" ? String(raw) : raw;
    if (typeof value === "string" && SAFE_VALUE.test(value)) (out as Record<string, string>)[key] = value;
  }
  return out;
}

export function writeListFilters<T extends Record<string, string>>(
  prev: Record<string, unknown>, next: T, defaults: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...prev };
  for (const key of Object.keys(defaults)) {
    const value = next[key];
    if (value === undefined || value === defaults[key] || !SAFE_VALUE.test(value)) delete out[key];
    else out[key] = value;
  }
  return out;
}

export function useListUrlFilters<T extends Record<string, string>>(defaults: T) {
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const navigate = useNavigate();
  const values = useMemo(() => readListFilters(search, defaults), [search, defaults]);
  const setValues = useCallback(
    (next: T | ((current: T) => T)) => {
      const resolved = typeof next === "function" ? next(values) : next;
      // replace: filtrar não empilha histórico; voltar de um detalhe reencontra a URL filtrada.
      void navigate({
        to: ".",
        search: ((prev: Record<string, unknown>) => writeListFilters(prev, resolved, defaults)) as never,
        replace: true,
      });
    },
    [navigate, values, defaults],
  );
  return [values, setValues] as const;
}

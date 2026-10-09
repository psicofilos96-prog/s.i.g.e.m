/**
 * PERF.LOADING.2 — paginação real no servidor + tempo-limite técnico.
 * A primeira página nunca depende do conjunto inteiro: lê só `range(from, to)` e uma contagem
 * estimada. Mudança de filtro/página troca a chave (resposta antiga nunca sobrescreve a nova)
 * e cancela a requisição anterior pelo AbortSignal.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export const LIST_PAGE_SIZE = 50;
export const LIST_TIMEOUT_MS = 15_000;

export class ListTimeoutError extends Error {
  constructor() { super("A consulta demorou demais e foi interrompida."); this.name = "ListTimeoutError"; }
}

/** Sinal que aborta quando a consulta é cancelada OU quando passa do tempo-limite. */
export function timeoutSignal(parent: AbortSignal | undefined, ms = LIST_TIMEOUT_MS): { signal: AbortSignal; timedOut: () => boolean; clear: () => void } {
  const ctl = new AbortController(); let fired = false;
  const t = setTimeout(() => { fired = true; ctl.abort(); }, ms);
  const onAbort = () => ctl.abort();
  if (parent) { if (parent.aborted) ctl.abort(); else parent.addEventListener("abort", onAbort, { once: true }); }
  return { signal: ctl.signal, timedOut: () => fired, clear: () => { clearTimeout(t); parent?.removeEventListener("abort", onAbort); } };
}

/** Executa a leitura com tempo-limite; promessa rejeitada sempre sai do carregamento. */
export async function withListTimeout<T>(parent: AbortSignal | undefined, run: (signal: AbortSignal) => PromiseLike<T>, ms = LIST_TIMEOUT_MS): Promise<T> {
  const ts = timeoutSignal(parent, ms);
  try {
    return await Promise.race([
      Promise.resolve(run(ts.signal)),
      new Promise<never>((_, rej) => ts.signal.addEventListener("abort", () => rej(ts.timedOut() ? new ListTimeoutError() : new DOMException("cancelada", "AbortError")), { once: true })),
    ]);
  } finally { ts.clear(); }
}

export type ServerPage<T> = { items: T[]; total: number | null; page: number; pageSize: number };

export function pageRange(page: number, size = LIST_PAGE_SIZE): { from: number; to: number } {
  const p = Math.max(1, Math.floor(Number.isFinite(page) ? page : 1));
  return { from: (p - 1) * size, to: p * size - 1 };
}

type Resp<T> = { data: T[] | null; error: { message: string; code?: string } | null; count: number | null };

/** Hook padrão de lista paginada no servidor. `fetchPage` recebe from/to e o sinal. */
export function useServerPage<T>(key: readonly unknown[], page: number, fetchPage: (r: { from: number; to: number; signal: AbortSignal }) => PromiseLike<Resp<T>>, opts: { enabled?: boolean; size?: number } = {}) {
  const size = opts.size ?? LIST_PAGE_SIZE;
  return useQuery({
    queryKey: [...key, "page", page, size],
    enabled: opts.enabled ?? true,
    placeholderData: keepPreviousData,
    // Leitura idempotente: no máximo 1 nova tentativa automática, nunca após tempo-limite.
    retry: (n, e) => n < 1 && !(e instanceof ListTimeoutError),
    queryFn: async ({ signal }): Promise<ServerPage<T>> => {
      const { from, to } = pageRange(page, size);
      const r = await withListTimeout(signal, (s) => fetchPage({ from, to, signal: s }));
      if (r.error) throw r.error;
      return { items: r.data ?? [], total: r.count, page, pageSize: size };
    },
  });
}

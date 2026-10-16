import { supabase } from "@/integrations/supabase/client";

type Rpc = (fn: string, a?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** Só leituras (readers) compartilham a mesma pergunta em andamento; gravações nunca. */
export const SHAREABLE_READ = /(_at|_overview|_summary|_quality|_lines|_rows)$/;
const inFlight = new Map<string, Promise<unknown>>();

async function once<T>(fn: string, a?: Record<string, unknown>): Promise<T> {
  const r = await (supabase.rpc as unknown as Rpc)(fn, a);
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

/**
 * NARCH.2 — chamada única de função do banco pelas telas: erro do banco vira exceção com a mensagem original.
 * PERF.LOADING.1 — leituras idênticas simultâneas (mesma função e argumentos) viram UMA pergunta;
 * nada é guardado depois da resposta, então não há dado velho nem mistura entre contas.
 */
export function callRpc<T>(fn: string, a?: Record<string, unknown>): Promise<T> {
  if (!SHAREABLE_READ.test(fn)) return once<T>(fn, a);
  const key = `${fn}|${JSON.stringify(a ?? {})}`;
  const hit = inFlight.get(key);
  if (hit) return hit as Promise<T>;
  const p = once<T>(fn, a).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

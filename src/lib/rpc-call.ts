import { currentSessionReadKey } from "./session-read-context";
import { withListTimeout } from "./server-page";
import { supabase } from "@/integrations/supabase/client";

type RpcResponse = { data: unknown; error: { message: string } | null };
type RpcPending = PromiseLike<RpcResponse> & { abortSignal?: (signal: AbortSignal) => PromiseLike<RpcResponse> };
type Rpc = (fn: string, a?: Record<string, unknown>) => RpcPending;

/** Só leituras (readers) compartilham a mesma pergunta em andamento; gravações nunca. */
export const SHAREABLE_READ = /(_at|_overview|_summary|_quality|_lines|_rows)$/;
const inFlight = new Map<string, Promise<unknown>>();

async function once<T>(fn: string, a?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const query = (supabase.rpc as unknown as Rpc)(fn, a);
  const r = await (signal && typeof query.abortSignal === "function" ? query.abortSignal(signal) : query);
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

/**
 * NARCH.2 — chamada única de função do banco pelas telas: erro do banco vira exceção com a mensagem original.
 * Leituras idênticas só compartilham a mesma pergunta no contexto confirmado da conta + revisão.
 * Sem contexto (inclusive SSR), cada chamada é independente. Troca de sessão invalida a resposta
 * atrasada; prazo técnico remove perguntas travadas para que a recuperação possa consultar novamente.
 */
export function callRpc<T>(fn: string, a?: Record<string, unknown>): Promise<T> {
  if (!SHAREABLE_READ.test(fn)) return once<T>(fn, a);
  const context = currentSessionReadKey();
  if (!context) return once<T>(fn, a);
  const key = `${context}|${fn}|${JSON.stringify(a ?? {})}`;
  const hit = inFlight.get(key);
  if (hit) return hit as Promise<T>;
  const assertContext = () => {
    if (currentSessionReadKey() !== context) throw new DOMException("A sessão mudou durante a consulta.", "AbortError");
  };
  const p = withListTimeout(undefined, async (signal) => {
    assertContext();
    const data = await once<T>(fn, a, signal);
    assertContext();
    return data;
  }).finally(() => { if (inFlight.get(key) === p) inFlight.delete(key); });
  inFlight.set(key, p);
  return p;
}

import { supabase } from "@/integrations/supabase/client";

type Rpc = (fn: string, a?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** NARCH.2 — chamada única de função do banco pelas telas: erro do banco vira exceção com a mensagem original (mapeada por cada módulo). */
export async function callRpc<T>(fn: string, a?: Record<string, unknown>): Promise<T> {
  const r = await (supabase.rpc as unknown as Rpc)(fn, a);
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

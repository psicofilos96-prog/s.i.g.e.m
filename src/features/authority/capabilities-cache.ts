import { supabase } from "@/integrations/supabase/client";
import { readAllEffectiveCapabilities } from "./read-all-capabilities";

/**
 * NPERF.4 — leitura compartilhada de `effective_capabilities()` para leitores em lote fora do
 * React (Diário, fechamento, tarefas). Chave = conta da sessão; dura 60 s; consultas simultâneas
 * dividem a mesma chamada; erro nunca fica guardado; login/logout/troca de conta descartam tudo.
 * Só evita repetir a MESMA pergunta: o banco (RLS/writers) continua a única garantia.
 */
export const CAPABILITIES_TTL_MS = 60_000;
type Result = { data: unknown[] | null; error: { message: string } | null };
let entry: { key: string; at: number; promise: Promise<Result> } | null = null;

export function clearSharedCapabilities(): void { entry = null; }

export async function readEffectiveCapabilitiesShared(now: () => number = Date.now): Promise<Result> {
  const auth = (supabase as { auth?: { getSession?: () => Promise<{ data: { session: { user?: { id?: string } } | null } }> } }).auth;
  const key = auth?.getSession ? ((await auth.getSession()).data?.session?.user?.id ?? "") : "";
  if (!key) return (await readAllEffectiveCapabilities(supabase)) as Result;
  if (entry && entry.key === key && now() - entry.at < CAPABILITIES_TTL_MS) return entry.promise;
  const promise = (async () => (await readAllEffectiveCapabilities(supabase)) as Result)();
  const mine = { key, at: now(), promise };
  entry = mine;
  const r = await promise;
  if (r.error && entry === mine) entry = null;
  return r;
}

if (typeof window !== "undefined" && typeof supabase.auth?.onAuthStateChange === "function") {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") clearSharedCapabilities();
  });
}

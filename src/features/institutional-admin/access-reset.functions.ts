import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * N1 — APOSENTADO (Intervenção 11). A redefinição em massa aplicava UMA senha escolhida pelo
 * administrador a várias contas — senha universal. Substituída pelo código individual de uso único
 * (`activation.functions.ts`, `/primeiro-acesso`), que também cobre a recuperação individual.
 * O endpoint permanece só para recusar chamadas de clientes antigos; nunca toca o Auth.
 */
export const resetAccessPasswords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(async () => ({
    ok: false as const,
    error: "A redefinição com uma mesma senha para várias contas foi desativada. Gere um código individual de nova senha para cada conta.",
  }));

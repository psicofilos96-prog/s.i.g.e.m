import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { passwordProblem } from "./access-inventory";

/**
 * N1 — Redefinição de senha pelo Administrador Geral. A autorização é do BANCO, sob a sessão de quem pede
 * (`access_center_authorize_reset`); o valor é repassado uma única vez ao Auth e nunca gravado, registrado
 * ou devolvido. A auditoria guarda só ator, quantidade e contas atingidas.
 */
const schema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(500),
  password: z.string().min(12).max(128),
});

export const resetAccessPasswords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const ids = [...new Set(data.userIds)];
    if (passwordProblem(data.password, data.password)) return { ok: false as const, error: "Senha fraca: use 12+ caracteres com letras e números." };
    const auth = await context.supabase.rpc("access_center_authorize_reset", { _users: ids });
    if (auth.error) return { ok: false as const, error: auth.error.message };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const done: string[] = [];
    let weak = false;
    for (const id of ids) {
      const r = await supabaseAdmin.auth.admin.updateUserById(id, { password: data.password });
      if (!r.error) done.push(id);
      else if (/weak|pwned|leak/i.test(r.error.message)) { weak = true; break; }
    }
    const rec = await context.supabase.rpc("access_center_record_reset", { _users: ids, _succeeded: done });
    return {
      ok: true as const, requested: ids.length, succeeded: done.length,
      weakRejected: weak, audited: !rec.error,
    };
  });

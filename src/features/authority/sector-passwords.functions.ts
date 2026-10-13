/** Senhas das contas de setor: só a administração (login mestre ou quem mantém contas institucionais) define. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { passwordProblem } from "./password-policy";

const MASTER = "admin@sigem.itap.gov.br";

/** Conta de setor = login institucional que não é de servidor (matrícula) nem o login mestre; contas antigas (ex.: supervisao@) não têm a marca "sector". */
function isSectorAccount(u: { email?: string | null; app_metadata?: Record<string, unknown> } | null | undefined): boolean {
  const email = String(u?.email ?? "").toLowerCase();
  if (!email.endsWith("@sigem.itap.gov.br") || email === MASTER) return false;
  const kind = u?.app_metadata?.["sigem_account"];
  return kind === "sector" || kind == null || kind === "";
}

async function assertAdmin(ctx: { supabase: any; claims: any }) {
  if (String(ctx.claims?.email ?? "").toLowerCase() === MASTER) return;
  const { data } = await ctx.supabase.rpc("has_network_capability", { _capability: "manter-contas-institucionais" });
  if (data !== true) throw new Error("Sem permissão para definir senhas de setor.");
}

export const listSectorLogins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: { id: string; login: string }[] = [];
    for (let page = 1; page < 50; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("Não foi possível listar as contas.");
      for (const u of data.users) if (isSectorAccount(u) && u.email) out.push({ id: u.id, login: u.email });
      if (data.users.length < 1000) break;
    }
    return out.sort((a, b) => a.login.localeCompare(b.login));
  });

export const setSectorPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), password: z.string().max(200), password2: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    await assertAdmin(context);
    const p = passwordProblem(data.password, data.password2);
    if (p) return { ok: false, message: p };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (!isSectorAccount(u?.user)) return { ok: false, message: "Esta conta não é de setor." };
    const up = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
      app_metadata: { ...(u?.user?.app_metadata ?? {}), sigem_account: "sector" },
    });
    if (up.error) return { ok: false, message: "Não foi possível gravar a senha. Tente outra senha." };
    const rec = await supabaseAdmin.rpc("sector_password_record", { p_user: data.userId, p_by: context.userId });
    if (rec.error) return { ok: false, message: "Senha gravada, mas o registro falhou." };
    return { ok: true, message: "Senha definida. O setor já pode entrar com ela." };
  });

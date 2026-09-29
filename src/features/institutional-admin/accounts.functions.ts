import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { formInstitutionalLogin, generateProvisionalPassword } from "./login-rule";

/**
 * Contas institucionais (B1). Reutiliza a autenticação existente; a capacidade
 * `manter-contas-institucionais` é verificada NO BANCO (autorize → crie → vincule).
 * A senha provisória nunca é gravada nem registrada: volta uma única vez ao autor.
 */
const createSchema = z.object({
  personId: z.string().uuid(),
  basis: z.enum(["matricula", "inep", "setor"]),
  value: z.string().min(1).max(120),
});

export const createInstitutionalAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const login = formInstitutionalLogin(data.basis, data.value);
    if (!login) return { ok: false as const, error: "Login inválido pela regra oficial." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const auth = await supabaseAdmin.rpc("authorize_account_action", { _actor: context.userId, _user: null as unknown as string });
    if (auth.error) return { ok: false as const, error: "Sem capacidade para manter contas institucionais." };
    const password = generateProvisionalPassword();
    const created = await supabaseAdmin.auth.admin.createUser({ email: login, password, email_confirm: true });
    if (created.error || !created.data.user) return { ok: false as const, error: "Não foi possível criar a conta (login já existente?)." };
    const link = await supabaseAdmin.rpc("link_institutional_account", {
      _actor: context.userId,
      _user: created.data.user.id,
      _person: data.personId,
      _login: login,
    });
    if (link.error) {
      await supabaseAdmin.auth.admin.deleteUser(created.data.user.id);
      return { ok: false as const, error: link.error.message.includes("already-linked") ? "Esta pessoa já possui conta." : "Vínculo recusado; nada foi gravado." };
    }
    return { ok: true as const, login, provisionalPassword: password };
  });

const resetSchema = z.object({ userId: z.string().uuid(), actRef: z.string().min(1).max(200) });

export const resetInstitutionalCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => resetSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const auth = await supabaseAdmin.rpc("authorize_account_action", { _actor: context.userId, _user: data.userId });
    if (auth.error) return { ok: false as const, error: "Sem capacidade ou conta não institucional." };
    const password = generateProvisionalPassword();
    const upd = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password });
    if (upd.error) return { ok: false as const, error: "Não foi possível redefinir." };
    const ev = await supabaseAdmin.rpc("record_credential_reset", { _actor: context.userId, _user: data.userId, _act_ref: data.actRef });
    if (ev.error) return { ok: false as const, error: "Redefinição não registrada." };
    return { ok: true as const, provisionalPassword: password };
  });

export const listInstitutionalAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("user_person_links").select("user_id, person_id, created_at");
    if (error) return [];
    const { data: ev } = await context.supabase
      .from("account_credential_events")
      .select("user_id, login, kind, created_at")
      .order("created_at", { ascending: true });
    return (data ?? []).map((l) => {
      const mine = (ev ?? []).filter((e) => e.user_id === l.user_id);
      return {
        userId: l.user_id,
        personId: l.person_id,
        login: mine.find((e) => e.login)?.login ?? null,
        lastEvent: mine.at(-1)?.kind ?? null,
      };
    });
  });

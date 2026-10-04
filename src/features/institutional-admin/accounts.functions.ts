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

/**
 * B1.3 — Primeiro acesso do Administrador Geral. Só enquanto o SIGEM não foi ativado, só para o
 * login designado (lido do banco, nunca do cliente) e só a partir de uma sessão institucional já
 * existente (o cadastro público continua desligado). A senha é escolhida pela pessoa no navegador,
 * repassada uma única vez ao Auth oficial e nunca gravada, registrada ou devolvida.
 */
const activatorSchema = z.object({ password: z.string().min(12).max(128) });

export const createDesignatedActivatorAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => activatorSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // The first account must be requested by the existing, confirmed supervisory
    // login. The historical designation is the source of that identity.
    const supervisor = await supabaseAdmin
      .from("sigem_installer_designation_versions")
      .select("installer_email")
      .order("version", { ascending: true })
      .limit(1)
      .maybeSingle();
    const requester = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (
      supervisor.error ||
      !supervisor.data ||
      requester.error ||
      !requester.data.user?.email_confirmed_at ||
      requester.data.user.email?.toLowerCase() !== supervisor.data.installer_email.toLowerCase()
    ) {
      return { ok: false as const, error: "Somente a conta da Supervisão confirmada pode preparar o primeiro acesso." };
    }
    const st = await supabaseAdmin.from("sigem_installation_state").select("state").maybeSingle();
    if (st.error || st.data?.state !== "nao-instalado") return { ok: false as const, error: "O SIGEM já foi ativado; esta porta está fechada." };
    const prior = await supabaseAdmin
      .from("sigem_activator_account_origins")
      .select("user_id")
      .limit(1);
    if (prior.error || prior.data?.length) {
      return { ok: false as const, error: "O primeiro acesso já foi preparado ou não pôde ser verificado." };
    }
    const des = await supabaseAdmin
      .from("sigem_installer_designation_versions")
      .select("version, installer_email")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (des.error || !des.data) return { ok: false as const, error: "Não há login designado para a ativação." };
    const login = des.data.installer_email;
    const created = await supabaseAdmin.auth.admin.createUser({ email: login, password: data.password, email_confirm: true });
    if (created.error || !created.data.user) return { ok: false as const, error: "A conta designada já existe ou não pôde ser criada." };
    const origin = await supabaseAdmin.from("sigem_activator_account_origins").insert({
      user_id: created.data.user.id,
      login,
      requested_by_user_id: context.userId,
      designation_version: des.data.version,
    });
    if (origin.error) {
      await supabaseAdmin.auth.admin.deleteUser(created.data.user.id);
      return { ok: false as const, error: "A origem da conta não pôde ser registrada; nada foi criado." };
    }
    return { ok: true as const, login };
  });

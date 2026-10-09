import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CODE_TTL_HOURS, DECISION_TEXT, decideCode, generateCode, hashCode, normalizeLogin, passwordIssue, type CodeRow } from "./activation-code";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Emissão: autorização é do BANCO sob a sessão de quem pede (`access_center_authorize_reset`).
 * Cada conta recebe um código próprio; só o hash é gravado e o código aparece uma única vez.
 */
export const issueActivationCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userIds: z.array(z.string().uuid()).min(1).max(500), purpose: z.enum(["ativacao", "recuperacao"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const ids = [...new Set(data.userIds)];
    const auth = await context.supabase.rpc("access_center_authorize_reset", { _users: ids });
    if (auth.error) return { ok: false as const, error: "Sua conta não pode emitir códigos de acesso." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: acts } = await sb.from("account_activations").select("user_id, method").in("user_id", ids);
    const preserved = new Set((acts ?? []).filter((a: any) => a.method === "preservada").map((a: any) => a.user_id));
    const activated = new Set((acts ?? []).map((a: any) => a.user_id));
    const out: { userId: string; login: string; code: string | null; expiresAt: string | null; skipped?: string }[] = [];
    const expiresAt = new Date(Date.now() + CODE_TTL_HOURS * 3600_000).toISOString();
    for (const id of ids) {
      const u = await supabaseAdmin.auth.admin.getUserById(id);
      const login = u.data.user?.email ? normalizeLogin(u.data.user.email) : null;
      if (!login) { out.push({ userId: id, login: "", code: null, expiresAt: null, skipped: "conta não encontrada" }); continue; }
      if (preserved.has(id)) { out.push({ userId: id, login, code: null, expiresAt: null, skipped: "conta especial preservada" }); continue; }
      if (data.purpose === "ativacao" && activated.has(id)) { out.push({ userId: id, login, code: null, expiresAt: null, skipped: "já ativada — use recuperação" }); continue; }
      await sb.from("account_activation_codes").update({ revoked_at: new Date().toISOString() }).eq("user_id", id).is("consumed_at", null).is("revoked_at", null);
      const code = generateCode();
      const ins = await sb.from("account_activation_codes").insert({ user_id: id, login, purpose: data.purpose, code_hash: await hashCode(code), expires_at: expiresAt, issued_by: context.userId });
      out.push(ins.error ? { userId: id, login, code: null, expiresAt: null, skipped: "falha ao registrar" } : { userId: id, login, code, expiresAt });
    }
    return { ok: true as const, items: out };
  });

/** Ativação/recuperação pública: login + código de uso único + nova senha. Nunca revela se o login existe. */
export const redeemActivationCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ login: z.string().min(3).max(200), code: z.string().min(4).max(40), password: z.string().max(200), confirm: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const pw = passwordIssue(data.password, data.confirm);
    if (pw) return { ok: false as const, error: pw };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const login = normalizeLogin(data.login);
    const { data: rows } = await sb.from("account_activation_codes").select("id, user_id, purpose, code_hash, expires_at, consumed_at, revoked_at, attempts")
      .eq("login", login).is("revoked_at", null).order("created_at", { ascending: false }).limit(1);
    const row = (rows?.[0] ?? null) as (CodeRow & { id: string; user_id: string; purpose: string }) | null;
    const hash = await hashCode(data.code);
    const decision = decideCode(row, hash, new Date());
    if (decision !== "ok") {
      if (decision === "invalid" && row && !row.consumed_at) await sb.from("account_activation_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return { ok: false as const, error: DECISION_TEXT[decision] };
    }
    // Consome antes de trocar a senha (corrida = só um vence); devolve se o Auth recusar.
    const claim = await sb.from("account_activation_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row!.id).is("consumed_at", null).select("id");
    if (claim.error || !claim.data?.length) return { ok: false as const, error: DECISION_TEXT.used };
    const upd = await supabaseAdmin.auth.admin.updateUserById(row!.user_id, { password: data.password });
    if (upd.error) {
      await sb.from("account_activation_codes").update({ consumed_at: null }).eq("id", row!.id);
      const weak = /weak|pwned|leak|password/i.test(upd.error.message);
      return { ok: false as const, error: weak ? "Essa senha é conhecida ou fraca demais. Escolha outra." : "Não foi possível definir a senha agora. Tente de novo." };
    }
    await sb.from("account_activations").upsert({ user_id: row!.user_id, method: "codigo", code_id: row!.id }, { onConflict: "user_id", ignoreDuplicates: true });
    return { ok: true as const, login };
  });

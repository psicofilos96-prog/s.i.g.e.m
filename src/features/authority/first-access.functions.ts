/** Primeiro acesso do servidor: login + data de nascimento (conferida com a folha) criam a primeira senha.
 * A conferência e o limite de tentativas ficam no banco (first_access_verify); aqui só se grava a senha. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { passwordProblem } from "./password-policy";

const input = z.object({
  login: z.string().trim().toLowerCase().email().max(120),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  password: z.string().max(200),
  password2: z.string().max(200),
});

const MESSAGES: Record<string, string> = {
  "nao-confere": "Login ou data de nascimento não conferem.",
  "ja-ativado": "Esta conta já tem senha. Entre com ela ou peça uma nova senha à administração.",
  "sem-nascimento": "Não há data de nascimento registrada para esta matrícula. Procure a administração.",
  "bloqueado-temporariamente": "Muitas tentativas. Aguarde uma hora e tente de novo.",
};

export const firstAccessSetPassword = createServerFn({ method: "POST" })
  .validator((d: unknown) => input.parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; message: string }> => {
    const p = passwordProblem(data.password, data.password2);
    if (p) return { ok: false, message: p };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("first_access_verify", { p_login: data.login, p_birth: data.birthDate });
    if (error) return { ok: false, message: "Não foi possível conferir agora. Tente de novo." };
    const row = (rows as { user_id: string | null; reason: string }[] | null)?.[0];
    if (!row || row.reason !== "ok" || !row.user_id) return { ok: false, message: MESSAGES[row?.reason ?? ""] ?? MESSAGES["nao-confere"]! };
    const up = await supabaseAdmin.auth.admin.updateUserById(row.user_id, { password: data.password });
    if (up.error) return { ok: false, message: "Não foi possível gravar a senha. Tente outra senha." };
    const rec = await supabaseAdmin.rpc("first_access_record", { p_user: row.user_id });
    if (rec.error) return { ok: false, message: "Senha criada, mas o registro falhou. Tente entrar com a nova senha." };
    return { ok: true };
  });

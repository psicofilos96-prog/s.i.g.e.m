/** L44 — com sessão, troca de senha pendente (decidida no banco: password_change_required) bloqueia a área de trabalho até a troca. */
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionAuthority } from "./session-authority";
import { passwordProblem } from "./password-policy";

export function PasswordChangeGate({ children }: { children: ReactNode }) {
  const a = useSessionAuthority();
  const uid = a.status === "signed-in" ? a.user.id : null;
  const [must, setMust] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!uid) { setMust(null); return; }
    let alive = true;
    void supabase.rpc("password_change_required").then(({ data, error }) => { if (alive) setMust(error ? false : !!data); });
    return () => { alive = false; };
  }, [uid]);
  if (!uid || must !== true) return <>{children}</>;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget); const pw = String(f.get("npw")), pw2 = String(f.get("npw2"));
    const p = passwordProblem(pw, pw2); if (p) return setErr(p);
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setBusy(false);
      const m = error.message.toLowerCase();
      if (m.includes("same")) return setErr("A nova senha precisa ser diferente da senha inicial.");
      if (m.includes("6 char") || m.includes("at least")) return setErr("A nova senha precisa ter pelo menos 6 caracteres.");
      return setErr("Não foi possível trocar a senha. Recarregue a página e tente de novo.");
    }
    const r = await supabase.rpc("record_own_password_change");
    setBusy(false);
    if (r.error) return setErr("Senha trocada, mas o registro falhou. Recarregue a página.");
    setMust(false);
  }
  return (
    <section aria-labelledby="pwgate" className="mx-auto max-w-md space-y-4 p-6">
      <h1 id="pwgate" className="text-xl font-semibold">Troque sua senha inicial</h1>
      <p className="text-sm text-muted-foreground">Por segurança, a senha entregue na planilha só serve para o primeiro acesso. Escolha uma senha nova para continuar.</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">Nova senha<input name="npw" type="password" autoComplete="new-password" required className="mt-1 block min-h-11 w-full rounded-md border bg-background px-2" /></label>
        <label className="block text-sm">Repita a nova senha<input name="npw2" type="password" autoComplete="new-password" required className="mt-1 block min-h-11 w-full rounded-md border bg-background px-2" /></label>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <button type="submit" disabled={busy} className="min-h-11 rounded-md bg-primary px-4 text-primary-foreground">Trocar senha</button>
      </form>
    </section>
  );
}

/** L44 — com sessão, troca de senha pendente (decidida no banco: password_change_required) bloqueia a área de trabalho até a troca. */
import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSessionAuthority } from "./session-authority";
import { passwordProblem } from "./password-policy";

export function PasswordChangeGate({ children }: { children: ReactNode }) {
  const a = useSessionAuthority();
  const uid = a.status === "signed-in" ? a.user.id : null;
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const check = useQuery({
    queryKey: ["password-change-gate", uid], enabled: uid !== null, retry: false,
    queryFn: async ({ signal }) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener("abort", abort, { once: true });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          (async () => {
            const { data, error } = await supabase.rpc("password_change_required").abortSignal(controller.signal);
            if (error || typeof data !== "boolean") throw new Error("password-check-unconfirmed");
            return data;
          })(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error("password-check-timeout")); }, 15_000);
          }),
        ]);
      } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
    },
  });
  if (a.status === "loading" || (uid && check.isPending)) {
    if (a.status === "loading" && a.error) return <section role="alert" className="mx-auto max-w-md space-y-4 p-6"><p>Não foi possível confirmar seu acesso.</p><Button onClick={() => window.location.reload()}>Tentar novamente</Button></section>;
    return <p role="status" className="mx-auto max-w-md p-6 text-muted-foreground">Confirmando seu acesso…</p>;
  }
  if (uid && check.isError) return <section role="alert" className="mx-auto max-w-md space-y-4 p-6"><p>Não foi possível confirmar se sua senha precisa ser trocada.</p><Button onClick={() => void check.refetch()}>Tentar novamente</Button></section>;
  if (!uid || check.data === false) return <>{children}</>;
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
    await check.refetch();
  }
  return (
    <section aria-labelledby="pwgate" className="mx-auto max-w-md space-y-4 p-6">
      <h1 id="pwgate" className="text-xl font-semibold">Troque sua senha inicial</h1>
      <p className="text-sm text-muted-foreground">Por segurança, a senha entregue na planilha só serve para o primeiro acesso. Escolha uma senha nova para continuar.</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">Nova senha<input name="npw" type="password" autoComplete="new-password" required className="mt-1 block min-h-11 w-full rounded-md border bg-background px-2" /></label>
        <label className="block text-sm">Repita a nova senha<input name="npw2" type="password" autoComplete="new-password" required className="mt-1 block min-h-11 w-full rounded-md border bg-background px-2" /></label>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <Button type="submit" disabled={busy}>Trocar senha</Button>
      </form>
    </section>
  );
}

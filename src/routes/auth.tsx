import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — SIGEM" },
      { name: "description", content: "Acesso ao SIGEM com conta institucional." },
      { property: "og:title", content: "Entrar — SIGEM" },
      { property: "og:description", content: "Acesso ao SIGEM com conta institucional." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

/**
 * Login institucional: o identificador @sigem.itap.gov.br não é caixa postal.
 * Contas são provisionadas pela administração; não há cadastro público nem link por e-mail.
 */
function AuthPage() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/diario", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email: login.trim().toLowerCase(), password });
    setBusy(false);
    if (error) return setMsg("Login ou senha não conferem.");
    navigate({ to: "/diario", replace: true });
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 py-10">
      <h1 className="font-display text-2xl font-semibold">Entrar no SIGEM</h1>
      <p className="text-sm text-muted-foreground">
        Entrar não concede permissões por si só: elas vêm da sua atuação institucional vigente, conforme política homologada.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <Input type="text" autoComplete="username" required placeholder="Login institucional (ex.: setor@sigem.itap.gov.br)" aria-label="Login institucional" value={login} onChange={(e) => setLogin(e.target.value)} />
        <Input type="password" autoComplete="current-password" required placeholder="Senha" aria-label="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" className="w-full" disabled={busy}>Entrar</Button>
      </form>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      <p className="text-xs text-muted-foreground">
        Esqueceu a senha? O login institucional não recebe e-mail: peça a redefinição a quem administra as contas institucionais no SIGEM.
      </p>
    </div>
  );
}

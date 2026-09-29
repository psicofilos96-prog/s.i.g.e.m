import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

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

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
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
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setMsg("E-mail ou senha não conferem.");
      navigate({ to: "/diario", replace: true });
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      setBusy(false);
      setMsg(error ? error.message : "Enviamos um link de confirmação para o seu e-mail.");
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setMsg("Não foi possível entrar com Google.");
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 py-10">
      <h1 className="font-display text-2xl font-semibold">{mode === "in" ? "Entrar no SIGEM" : "Criar acesso"}</h1>
      <p className="text-sm text-muted-foreground">
        Entrar não concede permissões por si só: elas vêm da sua atuação institucional vigente, conforme política homologada.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <Input type="email" required placeholder="E-mail" aria-label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" required minLength={8} placeholder="Senha" aria-label="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" className="w-full" disabled={busy}>{mode === "in" ? "Entrar" : "Criar acesso"}</Button>
      </form>
      <Button variant="outline" className="w-full" onClick={google}>Continuar com Google</Button>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      <button type="button" className="text-sm text-primary underline" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }}>
        {mode === "in" ? "Ainda não tenho acesso" : "Já tenho acesso"}
      </button>
    </div>
  );
}

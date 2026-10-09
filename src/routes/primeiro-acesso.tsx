import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { hideBrokenImage, hideIfAlreadyBroken } from "@/lib/img-fallback";
import { redeemActivationCode } from "@/features/institutional-admin/activation.functions";
import { PASSWORD_MIN } from "@/features/institutional-admin/activation-code";
import cityPhoto from "@/assets/itaperuna-home.png.asset.json";
import brasao from "@/assets/brasao-itaperuna.png.asset.json";
import sigemLogo from "@/assets/logo-sigem.png.asset.json";

export const Route = createFileRoute("/primeiro-acesso")({
  head: () => ({
    meta: [
      { title: "Primeiro acesso e nova senha — SIGEM Itaperuna" },
      { name: "description", content: "Ative sua conta institucional do SIGEM ou defina uma nova senha com seu código individual." },
      { property: "og:title", content: "Primeiro acesso — SIGEM Itaperuna" },
      { property: "og:description", content: "Ativação de conta institucional com código individual de uso único." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FirstAccessPage,
});

function FirstAccessPage() {
  const router = useRouter();
  const redeem = useServerFn(redeemActivationCode);
  const [login, setLogin] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!login.trim() || !code.trim()) return setMsg("Informe o login e o código de acesso.");
    setBusy(true); setMsg(null);
    try {
      const r = await redeem({ data: { login, code, password, confirm } });
      if (!r.ok) return setMsg(r.error);
      setDone(true);
      const s = await supabase.auth.signInWithPassword({ email: r.login, password });
      if (!s.error) router.history.replace("/");
    } catch {
      setMsg("Sem conexão com o servidor. Tente de novo.");
    } finally { setBusy(false); }
  }

  const pwField = (id: string, label: string, value: string, set: (v: string) => void, auto: string) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={show ? "text" : "password"} autoComplete={auto} className="h-12 pr-12 text-base" value={value} onChange={(e) => set(e.target.value)} disabled={busy} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Esconder senha" : "Mostrar senha"} aria-pressed={show} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );

  return (
    <div data-sigem-auth className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-territory text-territory-foreground lg:block">
        <img src={cityPhoto.url} onError={hideBrokenImage} ref={hideIfAlreadyBroken} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-territory via-territory/70 to-transparent" />
        <div className="relative flex h-full flex-col justify-end gap-4 p-12">
          <img src={brasao.url} alt="Brasão de Itaperuna" className="h-16 w-auto self-start object-contain" />
          <p className="font-display text-4xl font-semibold leading-tight">Sua conta,<br />sua senha.</p>
          <p className="max-w-md text-hero-muted">Cada pessoa define a própria senha. Ninguém mais a conhece — nem a administração.</p>
        </div>
      </aside>
      <main className="flex items-center justify-center bg-background px-6 py-10">
        <div className="w-full max-w-sm">
          <img src={sigemLogo.url} alt="SIGEM" className="h-10 w-auto object-contain" />
          <h1 className="mt-8 flex items-center gap-2 font-display text-3xl font-semibold text-foreground"><KeyRound className="h-7 w-7 text-primary" aria-hidden />Primeiro acesso</h1>
          <p className="mt-2 text-sm text-muted-foreground">Também serve para criar uma nova senha se você esqueceu a sua. Use o código individual que recebeu da administração.</p>
          {done ? (
            <div role="status" className="mt-8 space-y-4 rounded-lg border border-border bg-muted p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-foreground"><CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />Senha definida. Abrindo o SIGEM…</p>
              <Link to="/auth" className="font-medium text-primary hover:underline">Ir para a tela de entrada</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-5" noValidate aria-busy={busy}>
              <div className="space-y-2">
                <Label htmlFor="login">Login</Label>
                <Input id="login" autoComplete="username" inputMode="email" className="h-12 text-base" value={login} onChange={(e) => setLogin(e.target.value)} disabled={busy} />
                <p className="text-xs text-muted-foreground">Termina em @sigem.itap.gov.br.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigo">Código de acesso</Label>
                <Input id="codigo" autoComplete="one-time-code" className="h-12 font-mono text-base uppercase tracking-widest" placeholder="XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} />
                <p className="text-xs text-muted-foreground">Vale uma única vez, por 3 dias.</p>
              </div>
              {pwField("senha", "Nova senha", password, setPassword, "new-password")}
              {pwField("confirmar", "Repita a nova senha", confirm, setConfirm, "new-password")}
              <p className="text-xs text-muted-foreground">Pelo menos {PASSWORD_MIN} caracteres. Uma frase fácil de lembrar funciona bem.</p>
              {msg ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{msg}</p> : null}
              <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
                {busy ? "Definindo…" : "Definir senha e entrar"}
              </Button>
              <p className="text-center text-sm"><Link to="/auth" className="text-muted-foreground hover:text-foreground">Já tenho senha — entrar</Link></p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

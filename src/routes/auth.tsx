import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { hideBrokenImage, hideIfAlreadyBroken } from "@/lib/img-fallback";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { safeRedirect } from "@/features/authority/session-lifecycle";
import { classifyLoginError, loginMessage } from "@/features/authority/login-messages";
import cityPhoto from "@/assets/itaperuna-home.png.asset.json";
import brasao from "@/assets/brasao-itaperuna.png.asset.json";
import sigemLogo from "@/assets/logo-sigem.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — SIGEM Itaperuna" },
      { name: "description", content: "Acesso ao SIGEM, sistema de gestão escolar da rede municipal de Itaperuna." },
      { property: "og:title", content: "Entrar — SIGEM Itaperuna" },
      { property: "og:description", content: "Acesso ao SIGEM com conta institucional." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { redirect?: string; motivo?: "expirada" } => ({
    ...(safeRedirect(s["redirect"]) ? { redirect: safeRedirect(s["redirect"])! } : {}),
    ...(s["motivo"] === "expirada" ? { motivo: "expirada" as const } : {}),
  }),
  component: AuthPage,
});

/**
 * Login institucional: o identificador @sigem.itap.gov.br não é caixa postal.
 * Contas são provisionadas pela administração; não há cadastro público nem link por e-mail.
 */
function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const target = safeRedirect(search.redirect) ?? "/diario";
  const router = useRouter();
  // Caminho interno sanitizado (pode trazer ?busca); history preserva a busca do deep link.
  const go = () => router.history.replace(target);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [caps, setCaps] = useState(false);
  // NLOGIN.2: estado da sessão — conferindo, já conectado (redireciona) ou sem sessão (formulário).
  const [session, setSession] = useState<"checking" | "signed-in" | "signed-out">("checking");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { setSession("signed-in"); go(); } else setSession("signed-out");
    }, () => setSession("signed-out"));
  }, [router, target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!login.trim() || !password) return setMsg(loginMessage("empty"));
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: login.trim().toLowerCase(), password });
      if (error) return setMsg(loginMessage(classifyLoginError(error)));
      setSession("signed-in");
      go();
    } catch {
      setMsg(loginMessage("network"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-sigem-auth className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-territory text-territory-foreground lg:block">
        <img src={cityPhoto.url} onError={hideBrokenImage} ref={hideIfAlreadyBroken} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-territory via-territory/70 to-transparent" />
        <div className="relative flex h-full flex-col justify-end gap-4 p-12">
          <img src={brasao.url} alt="Brasão de Itaperuna" className="self-start h-16 w-auto object-contain" />
          <p className="font-display text-4xl font-semibold leading-tight">Educação de Itaperuna,<br />num só lugar.</p>
          <p className="max-w-md text-hero-muted">Diário, matrículas, calendário e acompanhamento das escolas da rede municipal.</p>
        </div>
      </aside>
      <div className="flex flex-col bg-background">
        <header className="flex items-center gap-3 border-b border-border bg-territory px-6 py-3 text-territory-foreground lg:hidden">
          <img src={brasao.url} onError={hideBrokenImage} ref={hideIfAlreadyBroken} alt="Brasão de Itaperuna" className="h-9 w-auto object-contain" />
          <p className="text-sm font-medium leading-tight">Prefeitura de Itaperuna<br /><span className="text-hero-muted">Secretaria Municipal de Educação</span></p>
        </header>
        <main className="flex flex-1 items-center justify-center px-6 py-10 sm:py-12">
        <div className="w-full max-w-sm">
          <img src={sigemLogo.url} alt="SIGEM" className="h-10 w-auto object-contain" />
          <h1 className="mt-8 font-display text-3xl font-semibold text-foreground">Entrar</h1>
          <p className="mt-2 text-sm text-muted-foreground">Use o login e a senha que a administração entregou a você.</p>
          {search.motivo === "expirada" && (
            <p role="status" className="mt-4 rounded-md border border-border bg-muted p-3 text-sm">Sua sessão terminou. Entre de novo para continuar de onde parou.</p>
          )}
          {session !== "signed-out" ? (
            <p role="status" aria-live="polite" className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {session === "checking" ? "Conferindo se você já está conectado…" : "Você já está conectado. Abrindo o SIGEM…"}
            </p>
          ) : (<>
          <form onSubmit={submit} className="mt-8 space-y-5" noValidate aria-busy={busy}>
            <div className="space-y-2">
              <Label htmlFor="login">Login</Label>
              <Input id="login" type="text" inputMode="email" autoComplete="username" required className="h-12 text-base" value={login} onChange={(e) => setLogin(e.target.value)} disabled={busy} aria-invalid={msg ? true : undefined} aria-describedby={msg ? "login-dica auth-erro" : "login-dica"} />
              <p id="login-dica" className="text-xs text-muted-foreground">Termina em @sigem.itap.gov.br.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input id="senha" type={show ? "text" : "password"} autoComplete="current-password" required className="h-12 pr-12 text-base" value={password} onChange={(e) => setPassword(e.target.value)} onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))} disabled={busy} aria-invalid={msg ? true : undefined} aria-describedby={msg ? "auth-erro" : undefined} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Esconder senha" : "Mostrar senha"} aria-pressed={show} aria-controls="senha" className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                  {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {caps ? <p className="text-xs text-muted-foreground" role="status">A tecla Caps Lock está ligada.</p> : null}
            </div>
            {msg ? <p id="auth-erro" role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{msg}</p> : null}
            <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              {busy ? "Entrando…" : "Entrar"}
            </Button>
          </form>
          <p className="mt-8 text-sm text-muted-foreground">
            Primeiro acesso ou esqueceu a senha?{" "}
            <Link to="/primeiro-acesso" search={{ convite: undefined }} className="font-medium text-primary underline-offset-4 hover:underline">Use o link individual que você recebeu</Link>.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">O link de ativação é entregue por quem administra as contas e vale uma única vez.</p>
          </>)}
        </div>
        </main>
      </div>
    </div>
  );
}

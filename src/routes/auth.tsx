import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { safeRedirect } from "@/features/authority/session-lifecycle";
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });
  }, [router, target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email: login.trim().toLowerCase(), password });
    setBusy(false);
    if (error) return setMsg("Login ou senha não conferem. Confira e tente de novo.");
    go();
  }

  return (
    <div data-sigem-auth className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-territory text-territory-foreground lg:block">
        <img src={cityPhoto.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-territory via-territory/70 to-transparent" />
        <div className="relative flex h-full flex-col justify-end gap-4 p-12">
          <img src={brasao.url} alt="Brasão de Itaperuna" className="self-start h-16 w-auto object-contain" />
          <p className="font-display text-4xl font-semibold leading-tight">Educação de Itaperuna,<br />num só lugar.</p>
          <p className="max-w-md text-hero-muted">Diário, matrículas, calendário e acompanhamento das escolas da rede municipal.</p>
        </div>
      </aside>
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <img src={sigemLogo.url} alt="SIGEM" className="h-10 w-auto object-contain" />
          <h1 className="mt-8 font-display text-3xl font-semibold text-foreground">Entrar</h1>
          <p className="mt-2 text-sm text-muted-foreground">Use o login e a senha que a administração entregou a você.</p>
          {search.motivo === "expirada" && (
            <p role="status" className="mt-4 rounded-md border border-border bg-muted p-3 text-sm">Sua sessão terminou. Entre de novo para continuar de onde parou.</p>
          )}
          <form onSubmit={submit} className="mt-8 space-y-5" noValidate={false}>
            <div className="space-y-2">
              <Label htmlFor="login">Login</Label>
              <Input id="login" type="text" inputMode="email" autoComplete="username" required className="h-12 text-base" placeholder="setor@sigem.itap.gov.br" value={login} onChange={(e) => setLogin(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input id="senha" type={show ? "text" : "password"} autoComplete="current-password" required className="h-12 pr-12 text-base" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={msg ? true : undefined} aria-describedby={msg ? "auth-erro" : undefined} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Esconder senha" : "Mostrar senha"} className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                  {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            {msg ? <p id="auth-erro" role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{msg}</p> : null}
            <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              {busy ? "Entrando…" : "Entrar"}
            </Button>
          </form>
          <p className="mt-8 text-xs text-muted-foreground">
            Esqueceu a senha? Peça uma nova a quem administra as contas do SIGEM. O login não recebe e-mail.
          </p>
        </div>
      </div>
    </div>
  );
}

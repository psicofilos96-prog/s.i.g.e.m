import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { hideBrokenImage, hideIfAlreadyBroken } from "@/lib/img-fallback";
import { ArrowRight, Eye, EyeOff, GraduationCap, LockKeyhole, Loader2, School, UserRound, Users, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { safeRedirect } from "@/features/authority/session-lifecycle";
import { classifyLoginError, loginMessage } from "@/features/authority/login-messages";
import wallpaper from "@/assets/itaperuna-wallpaper.png.asset.json";
import logoCiece from "@/assets/logo-ciece.png.asset.json";
import logoEducacao from "@/assets/logo-educacao.png.asset.json";
import logoPrefeitura from "@/assets/logo-prefeitura.png.asset.json";
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

  const field = "h-12 w-full rounded-xl border border-login-ink/20 bg-login-ink/5 pl-11 text-base text-login-ink placeholder:text-login-ink/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-login-gold disabled:opacity-60";
  return (
    <div data-sigem-auth className="relative min-h-dvh overflow-hidden bg-login-navy text-login-ink">
      <img src={wallpaper.url} onError={hideBrokenImage} ref={hideIfAlreadyBroken} alt="Vista de Itaperuna ao pôr do sol com o Cristo" className="absolute inset-0 h-full w-full object-cover object-center" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-login-navy/80 via-login-navy/30 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-login-navy/80 to-transparent" />
      <div className="relative flex min-h-dvh flex-col gap-6 p-2.5 lg:flex-row">
        <main className="login-glass flex w-full shrink-0 flex-col rounded-3xl px-8 py-8 lg:w-[400px]">
          <div className="flex items-center gap-3">
            <img src={brasao.url} alt="Brasão de Itaperuna" className="h-14 w-14 shrink-0 rounded-full bg-login-ink object-contain p-1" />
            <div className="min-w-0 text-xs font-semibold uppercase leading-tight tracking-wider">
              Prefeitura Municipal de Itaperuna
              <span aria-hidden className="my-1 block h-px w-10 bg-login-gold" />
              <span className="font-normal text-login-ink/80">Secretaria Municipal de Educação</span>
            </div>
          </div>
          <div className="mt-8 rounded-2xl bg-login-ink px-4 py-3"><img src={sigemLogo.url} alt="SIGEM — Sistema Integrado de Gestão Escolar" className="h-12 w-full object-contain" /></div>
          <span aria-hidden className="mt-6 block h-0.5 w-12 bg-login-gold" />
          <p className="mt-3 font-display text-xl italic leading-snug text-login-ink/90">Gestão eficiente.<br />Educação que transforma.</p>
          {search.motivo === "expirada" && (
            <p role="status" className="mt-4 rounded-xl border border-login-ink/20 bg-login-ink/10 p-3 text-sm">Sua sessão terminou. Entre de novo para continuar de onde parou.</p>
          )}
          {session !== "signed-out" ? (
            <p role="status" aria-live="polite" className="mt-8 flex items-center gap-2 text-sm text-login-ink/80">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {session === "checking" ? "Conferindo se você já está conectado…" : "Você já está conectado. Abrindo o SIGEM…"}
            </p>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4" noValidate aria-busy={busy}>
              <div className="relative">
                <label htmlFor="login" className="sr-only">Usuário</label>
                <UserRound aria-hidden className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-login-ink/70" />
                <input id="login" type="text" inputMode="email" autoComplete="username" placeholder="Usuário" required className={field} value={login} onChange={(e) => setLogin(e.target.value)} disabled={busy} aria-invalid={msg ? true : undefined} aria-describedby={msg ? "login-dica auth-erro" : "login-dica"} />
                <p id="login-dica" className="mt-1 text-xs text-login-ink/70">Termina em @sigem.itap.gov.br.</p>
              </div>
              <div className="relative">
                <label htmlFor="senha" className="sr-only">Senha</label>
                <LockKeyhole aria-hidden className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-login-ink/70" />
                <input id="senha" type={show ? "text" : "password"} autoComplete="current-password" placeholder="Senha" required className={`${field} pr-12`} value={password} onChange={(e) => setPassword(e.target.value)} onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))} disabled={busy} aria-invalid={msg ? true : undefined} aria-describedby={msg ? "auth-erro" : undefined} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Esconder senha" : "Mostrar senha"} aria-pressed={show} aria-controls="senha" className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-login-ink/70 hover:text-login-ink focus-visible:outline-2 focus-visible:outline-login-gold">
                  {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
                {caps ? <p className="mt-1 text-xs text-login-ink/80" role="status">A tecla Caps Lock está ligada.</p> : null}
              </div>
              <div className="flex justify-end">
                <Link to="/primeiro-acesso" search={{ convite: undefined }} className="text-sm text-login-gold-soft underline-offset-4 hover:underline">Esqueceu sua senha?</Link>
              </div>
              {msg ? <p id="auth-erro" role="alert" className="rounded-xl border border-destructive/50 bg-destructive/20 px-3 py-2 text-sm">{msg}</p> : null}
              <button type="submit" disabled={busy} className="login-gold-button flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition-[filter] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-login-ink disabled:opacity-70">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {busy ? "Entrando…" : <>Entrar <ArrowRight className="h-5 w-5" aria-hidden /></>}
              </button>
              <p className="text-xs text-login-ink/70">Primeiro acesso ou senha esquecida: use o link individual entregue por quem administra as contas (vale uma única vez).</p>
            </form>
          )}
          <div className="mt-auto pt-10 text-center">
            <p className="font-display italic text-login-ink/85">“Educação constrói futuros.”</p>
            <p className="mt-1 text-xs uppercase tracking-[0.3em] text-login-ink/70">Itaperuna - RJ</p>
            <span aria-hidden className="mx-auto mt-2 block h-px w-10 bg-login-gold" />
          </div>
        </main>
        <section aria-label="Identidade da cidade" className="hidden flex-1 flex-col py-10 pl-16 pr-10 lg:flex">
          <div className="flex items-start justify-between gap-6">
            <p className="flex items-center gap-3 text-sm uppercase tracking-[0.6em] text-login-ink/90">Itaperuna <span aria-hidden className="h-px w-12 bg-login-gold" /></p>
            <LiveClock />
          </div>
          <h2 className="mt-10 max-w-2xl font-display text-6xl font-semibold leading-[1.05] text-login-ink/95">Educação que<br />move <span className="text-login-gold-soft">nossa cidade.</span></h2>
          <p className="mt-6 max-w-lg text-lg text-login-ink/90">Escolas mais organizadas. Alunos com mais oportunidades.<br />Uma Itaperuna ainda melhor.</p>
          <ul aria-label="Valores" className="ml-auto mt-8 w-40 space-y-3 rounded-xl border border-login-gold/50 px-5 py-4 text-center text-xs tracking-[0.3em] text-login-ink/90">
            {["TRADIÇÃO", "TRABALHO", "EDUCAÇÃO", "FUTURO"].map((v) => <li key={v}>{v}</li>)}
          </ul>
          <ul className="mt-auto grid max-w-3xl grid-cols-4 gap-3">
            {[{ i: Users, t: "Alunos", d: "Trajetória acompanhada" }, { i: School, t: "Escolas", d: "Toda a rede municipal" }, { i: GraduationCap, t: "Profissionais", d: "Equipes integradas" }, { i: Building2, t: "Gestão", d: "Decisão com dados" }].map(({ i: I, t, d }) => (
              <li key={t} className="login-glass rounded-xl px-4 py-3">
                <I aria-hidden className="h-5 w-5 text-login-gold-soft" />
                <p className="mt-2 font-semibold">{t}</p>
                <p className="text-xs text-login-ink/75">{d}</p>
                <span aria-hidden className="mt-2 block h-0.5 w-8 bg-login-gold" />
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center gap-3">
            {[{ s: logoPrefeitura.url, a: "Prefeitura de Itaperuna" }, { s: logoEducacao.url, a: "Secretaria Municipal de Educação" }, { s: logoCiece.url, a: "Central de Informações, Estatística e Censo Escolar" }].map((l) => (
              <span key={l.a} className="rounded-lg bg-login-ink/95 px-3 py-1.5"><img src={l.s} onError={hideBrokenImage} alt={l.a} className="h-7 w-auto object-contain" /></span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Data e hora em America/Sao_Paulo; clima não é exibido porque não há fonte meteorológica conectada. */
function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);
  if (!now) return null;
  const tz = { timeZone: "America/Sao_Paulo" } as const;
  return (
    <p className="text-right text-sm text-login-ink/90">
      <span className="block capitalize">{now.toLocaleDateString("pt-BR", { ...tz, weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span>
      <span className="block font-display text-2xl">{now.toLocaleTimeString("pt-BR", { ...tz, hour: "2-digit", minute: "2-digit" })}</span>
      <span className="block text-xs uppercase tracking-widest text-login-ink/70">Itaperuna - RJ</span>
    </p>
  );
}

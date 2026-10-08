import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import itaperunaImage from "@/assets/itaperuna-home.png.asset.json";
import { hideBrokenImage, hideIfAlreadyBroken } from "@/lib/img-fallback";
import logoEducacao from "@/assets/logo-educacao.png.asset.json";
import logoPrefeitura from "@/assets/logo-prefeitura.png.asset.json";
import logoSigem from "@/assets/logo-sigem.png.asset.json";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: `Acesso demonstrativo — ${brand.name}` },
      {
        name: "description",
        content: `Interface demonstrativa de acesso ao ${brand.fullName} de Itaperuna.`,
      },
      { property: "og:title", content: `Acesso demonstrativo — ${brand.name}` },
      {
        property: "og:description",
        content: `Interface demonstrativa de acesso ao ${brand.fullName} de Itaperuna.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="relative isolate min-h-svh overflow-hidden bg-territory text-territory-foreground">
      <img
        src={itaperunaImage.url}
          onError={hideBrokenImage} ref={hideIfAlreadyBroken}
        alt="Vista panorâmica de Itaperuna ao pôr do sol, com o Cristo de Itaperuna em primeiro plano"
        className="absolute inset-0 -z-20 size-full object-cover object-[66%_center] lg:object-center"
      />
      <div className="login-scene-overlay absolute inset-0 -z-10" aria-hidden="true" />
      <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(27rem,35%)] lg:items-center">
        <section className="hidden min-h-svh flex-col justify-between px-14 py-11 lg:flex xl:px-20">
          <div className="flex items-center gap-5">
            <img
              src={logoSigem.url}
              alt={brand.displayName}
              className="h-auto w-52 brightness-0 invert sm:w-60"
            />
            <span className="h-8 w-px bg-territory-foreground/35" aria-hidden="true" />
            <span className="max-w-40 text-[0.64rem] font-bold uppercase leading-relaxed text-territory-foreground/80">
              Educação pública de Itaperuna
            </span>
          </div>
          <div className="hidden max-w-2xl pb-9 lg:block">
            <p className="mb-4 text-xs font-bold uppercase text-territory-accent">
              Ambiente institucional
            </p>
            <h1 className="max-w-xl font-display text-5xl font-semibold leading-[1.02] xl:text-6xl">
              Itaperuna em perspectiva. Educação em movimento.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-territory-foreground/74">
              {brand.displayName}
            </p>
          </div>
          <div className="hidden items-center gap-6 lg:flex">
            <img
              src={logoPrefeitura.url}
              alt="Prefeitura de Itaperuna"
              className="h-8 w-auto brightness-0 invert"
            />
            <span className="h-7 w-px bg-territory-foreground/30" aria-hidden="true" />
            <img
              src={logoEducacao.url}
              alt="Prefeitura de Itaperuna — Educação"
              className="h-8 w-auto brightness-0 invert"
            />
          </div>
        </section>
        <section className="relative flex min-h-svh items-center px-4 py-5 sm:px-8 lg:px-8 lg:py-10 xl:px-10">
          <div
            className="login-architectural-plate absolute inset-y-[13%] -left-7 right-3 hidden rounded-[1.75rem] lg:block"
            aria-hidden="true"
          />
          <div className="login-access pilot-page relative mx-auto w-full max-w-md rounded-[1.35rem] px-6 py-7 sm:px-9 sm:py-9 lg:px-10 lg:py-11">
            <div className="mb-8">
              <img
                src={logoSigem.url}
                alt={brand.displayName}
                className="mb-8 h-auto w-56 brightness-0 invert lg:w-64"
              />
              <span className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-territory-foreground/68">
                <span className="size-1.5 rounded-full bg-territory-accent" />
                Acesso demonstrativo
              </span>
              <h1 className="font-display text-3xl font-semibold">Bem-vindo(a)</h1>
              <p className="mt-2 text-sm leading-relaxed text-territory-foreground/62">
                Entre com suas credenciais para acessar o sistema.
              </p>
            </div>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="usuario" className="text-territory-foreground/82">
                  Usuário
                </Label>
                <div className="group relative">
                  <UserRound className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-territory-foreground/48 group-focus-within:text-territory-accent" />
                  <Input
                    id="usuario"
                    name="usuario"
                    autoComplete="username"
                    placeholder="Digite seu usuário"
                    className="login-input h-12 pl-10 pr-3 shadow-none"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha" className="text-territory-foreground/82">
                  Senha
                </Label>
                <div className="group relative">
                  <LockKeyhole className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-territory-foreground/48 group-focus-within:text-territory-accent" />
                  <Input
                    id="senha"
                    name="senha"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    className="login-input h-12 pl-10 pr-11 shadow-none"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-territory-foreground/58 hover:bg-territory-foreground/10 hover:text-territory-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="lembrar"
                    className="border-territory-foreground/50 data-[state=checked]:bg-territory-accent data-[state=checked]:text-territory"
                  />
                  <Label htmlFor="lembrar" className="font-normal text-territory-foreground/72">
                    Manter-me conectado
                  </Label>
                </div>
                <Button type="button" variant="link" className="h-auto p-0 text-territory-accent">
                  Esqueceu sua senha?
                </Button>
              </div>
              <Button
                type="submit"
                className="h-12 w-full justify-between px-5 shadow-lg shadow-primary/20"
              >
                Entrar no SIGEM
                <ArrowRight />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-territory-foreground/20 bg-transparent text-territory-foreground hover:bg-territory-foreground/10 hover:text-territory-foreground"
                disabled
              >
                <ShieldCheck /> Acesso com conta institucional
              </Button>
              <div
                aria-live="polite"
                className="min-h-10 text-sm leading-relaxed text-territory-foreground/68"
              >
                {submitted && (
                  <p>Esta tela é demonstrativa. Nenhuma credencial foi enviada ou armazenada.</p>
                )}
              </div>
            </form>
            <div className="mt-3 border-t border-territory-foreground/15 pt-5 text-xs text-territory-foreground/50">
              <p>Acesso restrito a profissionais autorizados.</p>
              <Button
                asChild
                variant="link"
                className="mt-2 h-auto p-0 text-territory-foreground/72"
              >
                <Link to="/">Visualizar ambiente demonstrativo</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

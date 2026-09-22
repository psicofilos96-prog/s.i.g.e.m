import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import itaperunaImage from "@/assets/itaperuna-home.png.asset.json";
import logoEducacao from "@/assets/logo-educacao.png.asset.json";
import logoPrefeitura from "@/assets/logo-prefeitura.png.asset.json";
import logoSigem from "@/assets/logo-sigem.png.asset.json";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Acesso demonstrativo — SIGEM 2.0" },
      {
        name: "description",
        content: "Interface demonstrativa de acesso ao SIGEM 2.0 da Educação de Itaperuna.",
      },
      { property: "og:title", content: "Acesso demonstrativo — SIGEM 2.0" },
      {
        property: "og:description",
        content: "Interface demonstrativa de acesso ao sistema de gestão escolar de Itaperuna.",
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
        alt="Vista panorâmica de Itaperuna ao pôr do sol, com o Cristo Redentor em primeiro plano"
        className="absolute inset-0 -z-20 size-full object-cover object-[62%_center] lg:object-center"
      />
      <div className="login-scene-overlay absolute inset-0 -z-10" aria-hidden="true" />
      <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(25rem,34rem)]">
        <section className="flex min-h-[42svh] flex-col justify-between px-6 py-7 sm:px-10 sm:py-9 lg:min-h-svh lg:px-12 lg:py-10 xl:px-16">
          <div className="flex items-center gap-5">
            <img
              src={logoSigem.url}
              alt="SIGEM — Sistema Integrado de Gestão Escolar"
              className="h-auto w-48 brightness-0 invert sm:w-56"
            />
            <span className="h-8 w-px bg-territory-foreground/35" aria-hidden="true" />
            <span className="max-w-40 text-[0.64rem] font-bold uppercase leading-relaxed text-territory-foreground/80">
              Educação pública de Itaperuna
            </span>
          </div>
          <div className="max-w-2xl pb-8 lg:pb-4">
            <p className="mb-4 text-xs font-bold uppercase text-territory-accent">
              Ambiente institucional
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.04] sm:text-5xl lg:text-6xl">
              Gestão escolar com o território em perspectiva.
            </h1>
            <p className="mt-5 max-w-lg text-xs leading-relaxed text-territory-foreground/74 sm:text-base">
              SIGEM 2.0 — Sistema Integrado de Gestão e Estatística Escolar
            </p>
            <p className="mt-2 text-[0.68rem] leading-relaxed text-territory-foreground/58 lg:hidden">
              Prefeitura Municipal de Itaperuna · Secretaria Municipal de Educação
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
        <section className="login-access flex items-center px-6 py-9 sm:px-10 lg:min-h-svh lg:px-12">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-9">
              <span className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-territory-foreground/68">
                <span className="size-1.5 rounded-full bg-territory-accent" />
                Acesso demonstrativo
              </span>
              <h2 className="text-3xl font-semibold">Acesse o SIGEM</h2>
              <p className="mt-2 text-sm leading-relaxed text-territory-foreground/62">
                Use suas credenciais institucionais para continuar.
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
                    className="login-input h-12 rounded-none border-x-0 border-t-0 pl-7 pr-0 shadow-none"
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
                    className="login-input h-12 rounded-none border-x-0 border-t-0 pl-7 pr-11 shadow-none"
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
                    Lembrar-me
                  </Label>
                </div>
                <Button type="button" variant="link" className="h-auto p-0 text-territory-accent">
                  Esqueci minha senha
                </Button>
              </div>
              <Button type="submit" className="h-12 w-full justify-between px-5">
                Entrar
                <ArrowRight />
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
            <div className="mt-5 border-t border-territory-foreground/15 pt-5 text-xs text-territory-foreground/50">
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

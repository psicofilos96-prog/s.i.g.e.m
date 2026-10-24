import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/branding";
import { institution } from "@/config/institution";
import sigemLogo from "@/assets/logo-sigem.png.asset.json";

/** Entrada pública: identidade oficial, uma ação de acesso e nenhum contexto de trabalho presumido. */
export function PublicEntryShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:ring-2 focus:ring-ring">Pular para o conteúdo</a>
      <header className="border-b border-border/60 bg-card/80">
        <div className="mx-auto flex min-h-20 w-full max-w-[var(--content-max)] items-center gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <Link to="/" aria-label="Início do SIGEM" className="flex min-w-0 items-center gap-3">
            <img src={institution.emblemUrl} alt="" className="size-10 shrink-0 object-contain" />
            <img src={sigemLogo.url} alt={brand.name} className="h-5 w-auto max-w-28 object-contain" />
            <span className="hidden truncate border-l border-border pl-3 text-xs text-muted-foreground md:block">{institution.departmentName}</span>
          </Link>
          <Button asChild className="ml-auto min-h-11 shrink-0 whitespace-nowrap"><Link to="/auth">Entrar</Link></Button>
        </div>
      </header>
      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-[var(--content-max)] px-4 py-6 outline-none sm:px-6 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}


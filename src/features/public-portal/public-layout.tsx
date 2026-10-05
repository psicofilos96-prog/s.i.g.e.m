import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { institution } from "@/config/institution";
import { brand } from "@/config/branding";

/** Moldura das páginas públicas: sem menu interno, sem sessão, sem busca. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 p-4">
          <img src={institution.emblemUrl} alt="" className="size-9 shrink-0 object-contain" />
          <div className="min-w-0">
            <Link to="/publico" className="block truncate font-semibold text-foreground">{institution.departmentName}</Link>
            <p className="truncate text-xs text-muted-foreground">{institution.governmentName} · {brand.name}</p>
          </div>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-3xl p-4 sm:p-6">{children}</main>
    </div>
  );
}

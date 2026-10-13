import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { homeActionsFor } from "@/config/profile-home";
import { pathAllowed } from "@/features/authority/nav-capabilities";
import type { SessionAuthority } from "@/features/authority/session-authority";
import { HomeTodayPanel } from "./home-today";

function greeting(h: number) { return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }

/** Início simples: saudação, até 6 botões grandes, "Mais" e o painel de hoje. */
export function SimpleHome({ userId, authority }: { userId: string; authority: SessionAuthority }) {
  const [open, setOpen] = useState(false);
  const { primary, more } = homeActionsFor((p) => pathAllowed(authority, p));
  const name = (authority as { person?: { displayName?: string } | null }).person?.displayName?.split(" ")[0];
  const now = new Date();
  const today = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-1 py-4 sm:py-8">
      <header>
        <h1 className="font-display text-3xl sm:text-4xl">{greeting(now.getHours())}{name ? `, ${name}` : ""}</h1>
        <p className="mt-1 text-lg capitalize text-muted-foreground">{today}</p>
      </header>

      <section aria-label="O que você quer fazer">
        {primary.length === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-lg">
            Sua conta ainda não tem tarefas liberadas. Fale com a administração do SIGEM.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {primary.map((a) => (
              <li key={a.to}>
                <Link to={a.to} className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-4 text-center shadow-sm transition hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <a.icon className="h-10 w-10 text-primary" aria-hidden />
                  <span className="text-lg font-semibold leading-tight">{a.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {more.length > 0 && (
          <div className="mt-4">
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-base font-medium hover:bg-accent">
              Mais <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {open && (
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {more.map((a) => (
                  <li key={a.to}>
                    <Link to={a.to} className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 hover:bg-accent">
                      <a.icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                      <span className="font-medium">{a.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <HomeTodayPanel userId={userId} />
    </div>
  );
}

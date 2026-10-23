import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { homeActionsFor } from "@/config/profile-home";
import { pathAllowed } from "@/features/authority/nav-capabilities";
import { STATION_ROUTES } from "@/features/authority/station-navigation";
import type { SessionAuthority } from "@/features/authority/session-authority";
import { HomeTodayPanel } from "./home-today";
import { PersonNoticeBoard, SchoolNoticeBoard } from "@/features/ciece/network-notices";
import { MyPendingWorkCard } from "@/features/teacher-review/my-pending-card";

function sectorOf(a: SessionAuthority) {
  const pr = (a as { principal?: { station: keyof typeof STATION_ROUTES } | null }).principal;
  return pr ? { station: pr.station, routes: STATION_ROUTES[pr.station] ?? [] } : null;
}

/** PREMIUM.2026 — tom visual por ação (apresentação; a lista vem do perfil). */
export function toneFor(label: string, i: number): string {
  const l = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (l.includes("matric")) return "tone-blue";
  if (l.includes("transfer")) return "tone-mint";
  if (l.includes("transporte")) return "tone-amber";
  if (l.includes("relat")) return "tone-forest";
  if (l.includes("calend")) return "tone-coral";
  return ["tone-blue", "tone-mint", "tone-amber", "tone-forest", "tone-coral", "tone-teal"][i % 6]!;
}

function greeting(h: number) { return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }

/** Início simples: saudação, até 6 botões grandes, "Mais" e o painel de hoje. */
export function SimpleHome({ userId, authority }: { userId: string; authority: SessionAuthority }) {
  const [open, setOpen] = useState(false);
  const { primary, more } = homeActionsFor((p) => pathAllowed(authority, p), sectorOf(authority));
  const name = (authority as { person?: { displayName?: string } | null }).person?.displayName?.split(" ")[0];
  const now = new Date();
  const today = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-1 py-4 sm:py-8">
      <header className="space-y-2">
        <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">{greeting(now.getHours())}{name ? `, ${name}` : ""}</h1>
        <p className="text-lg text-muted-foreground">{today.charAt(0).toUpperCase() + today.slice(1)}</p>
      </header>
      {authority.status === "signed-in" && authority.principal?.scope === "school" && authority.principal.schoolId ? <SchoolNoticeBoard schoolId={authority.principal.schoolId} /> : authority.status === "signed-in" && !authority.principal && authority.person ? <PersonNoticeBoard personId={authority.person.id} /> : null}
      {authority.status === "signed-in" && !authority.principal && authority.person ? <MyPendingWorkCard /> : null}

      <section aria-label="O que você quer fazer">
        <p className="eyebrow mb-3">Ações rápidas</p>
        {primary.length === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-lg">
            Sua conta ainda não tem tarefas liberadas. Fale com a administração do SIGEM.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {primary.map((a, i) => (
              <li key={a.to}>
                <Link to={a.to} className={`${toneFor(a.label, i)} tone-wash lift flex min-h-36 flex-col items-start justify-between gap-4 rounded-2xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
                  <span className="tone-icon grid size-12 place-items-center rounded-xl"><a.icon className="size-7" strokeWidth={1.75} aria-hidden /></span>
                  <span className="text-base font-semibold leading-tight">{a.label}</span>
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

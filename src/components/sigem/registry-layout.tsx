/**
 * ONDA 1 — composição editorial comum dos cadastros (Escolas, Turmas e seguintes):
 * abertura com sobretítulo, título grande, contagem lida do dado, ações à direita,
 * barra de filtros em faixa própria e lista que vira cartões no celular.
 * Só apresentação: não lê dado nem decide acesso.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function RegistryHero(p: {
  eyebrow: string;
  title: string;
  lede: string;
  count?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-8 sm:py-8">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary via-territory-accent to-primary/40" />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-territory-accent">{p.eyebrow}</p>
          <h1 className="font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl">{p.title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{p.lede}</p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          {p.count != null && (
            <p className="font-display text-4xl font-semibold tabular-nums leading-none text-primary" aria-live="polite">{p.count}</p>
          )}
          {p.actions && <div className="flex flex-wrap gap-2">{p.actions}</div>}
        </div>
      </div>
    </header>
  );
}

export function RegistryToolbar({ children, summary }: { children: ReactNode; summary?: ReactNode }) {
  return (
    <section aria-label="Pesquisa e filtros" className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      {summary && <div role="status" className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">{summary}</div>}
    </section>
  );
}

/** Tabela no computador; abaixo de `md` cada linha vira cartão (o chamador fornece ambos). */
export function RegistryList(p: { table: ReactNode; cards: ReactNode; label: string }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
        <div className="max-h-[70vh] overflow-auto">{p.table}</div>
      </div>
      <ul aria-label={p.label} className="grid gap-3 md:hidden">{p.cards}</ul>
    </>
  );
}

export const registryTh = "sticky top-0 z-10 bg-muted px-4 py-3 text-left text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground";
export const registryTd = "px-4 py-3 align-top";
export const registryRow = "border-t border-border transition-colors hover:bg-muted/40";

export function RegistryCard({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <li className={cn("rounded-xl border border-border bg-card p-4 shadow-sm", className)}>
      <div className="font-medium">{title}</div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">{children}</dl>
    </li>
  );
}

export function CardFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function RegistryEmpty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

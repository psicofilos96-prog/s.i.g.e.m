import type { ReactNode } from "react";

/**
 * NUX.5 — filtros avançados ficam atrás de "Mais filtros". Se algum já está preenchido
 * (`active`), o painel abre sozinho, para que um filtro em uso nunca fique escondido.
 */
export function MoreFilters({ active = false, children }: { active?: boolean; children: ReactNode }) {
  return (
    <details open={active} className="min-w-0 text-sm sm:col-span-full" data-testid="more-filters">
      <summary className="inline-flex min-h-9 cursor-pointer items-center font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Filtros avançados{active ? " (em uso)" : ""}
      </summary>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">{children}</div>
    </details>
  );
}

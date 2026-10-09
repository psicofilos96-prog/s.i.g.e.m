import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { PageResult } from "@/lib/list-paging";

/** NPAG.1 — contagem honesta + navegação acessível entre páginas. */
export function ListPager({ r, onPage, noun }: { r: PageResult<unknown>; onPage: (p: number) => void; noun: string }) {
  return (
    <nav aria-label={`Paginação de ${noun}`} className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <p aria-live="polite">{r.total ? `${r.from}–${r.to} de ${r.total} ${noun}` : `0 ${noun}`}{r.truncated ? " (leitura atingiu o limite; refine a busca)" : ""}</p>
      {r.pageCount > 1 && <div className="flex items-center gap-1">
        <Button type="button" size="sm" variant="outline" disabled={r.page <= 1} onClick={() => onPage(r.page - 1)}>Página anterior</Button>
        <span>Página {r.page} de {r.pageCount}</span>
        <Button type="button" size="sm" variant="outline" disabled={r.page >= r.pageCount} onClick={() => onPage(r.page + 1)}>Próxima página</Button>
      </div>}
    </nav>
  );
}

/** Paginação local (índice 0) sobre lista já lida; o resumo é do chamador, porque cada tela conta seu próprio objeto. */
export function OffsetPager({ page, pageSize, total, onPage, noun, children }: {
  page: number; pageSize: number; total: number; onPage: (p: number) => void; noun: string; children?: ReactNode;
}) {
  return (
    <nav aria-label={`Paginação de ${noun}`} className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <Button type="button" size="sm" variant="outline" disabled={page === 0} onClick={() => onPage(page - 1)}>Anterior</Button>
      <Button type="button" size="sm" variant="outline" disabled={(page + 1) * pageSize >= total} onClick={() => onPage(page + 1)}>Próxima</Button>
      {children && <span aria-live="polite" className="text-muted-foreground">{children}</span>}
    </nav>
  );
}

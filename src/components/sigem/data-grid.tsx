import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  LockKeyhole,
  RefreshCw,
  SearchX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, StatePanel } from "@/components/sigem/patterns";
import { cn } from "@/lib/utils";

/**
 * DataGrid — contrato de UI genérico do SIGEM.
 *
 * Este componente é deliberadamente independente de qualquer domínio:
 * não conhece unidades, escolas, enumerações institucionais ou fixtures.
 * Toda configuração (colunas, células, rótulos, ações, estados) é fornecida
 * pela tela consumidora.
 *
 * Arquitetura preparada para, futuramente, receber paginação, ordenação e
 * filtros resolvidos no servidor: as props `sort` e `pagination` são
 * puramente controladas — o componente apenas emite intenções.
 */

export type DataGridState = "ready" | "loading" | "empty" | "error" | "permission" | "stale";

/** Prioridade usada para ocultação progressiva de colunas em telas estreitas. */
export type DataGridColumnPriority = "primary" | "secondary" | "tertiary";

export type DataGridColumn<TRow> = {
  id: string;
  header: ReactNode;
  cell: (row: TRow) => ReactNode;
  /** Classe de largura (ex.: "w-[30%]"). */
  width?: string;
  className?: string;
  priority?: DataGridColumnPriority;
  sortable?: boolean;
  align?: "left" | "right";
  srOnlyHeader?: boolean;
};

export type DataGridSort = {
  columnId: string | null;
  direction: "asc" | "desc";
  /** Emite a intenção de ordenação; pode ser resolvida local ou no servidor. */
  onSortChange: (columnId: string, direction: "asc" | "desc") => void;
};

export type DataGridSelection<TRow> = {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  rowLabel?: (row: TRow) => string;
  allLabel?: string;
};

export type DataGridPagination = {
  page: number;
  pageCount: number;
  /** Total conhecido; em modo servidor virá da resposta. */
  total?: number;
  onPageChange?: (page: number) => void;
};

export type DataGridProps<TRow> = {
  rows: TRow[];
  columns: Array<DataGridColumn<TRow>>;
  getRowId: (row: TRow) => string;
  label: string;
  state?: DataGridState;
  selection?: DataGridSelection<TRow>;
  sort?: DataGridSort;
  rowActions?: (row: TRow) => ReactNode;
  rowActionsLabel?: string;
  pagination?: DataGridPagination;
  footerSummary?: ReactNode;
  staleNotice?: ReactNode;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
  permissionTitle?: string;
  permissionDescription?: string;
  skeletonRows?: number;
  minWidthClassName?: string;
  heightClassName?: string;
};

const priorityClass: Record<DataGridColumnPriority, string> = {
  primary: "",
  secondary: "hidden md:table-cell",
  tertiary: "hidden xl:table-cell",
};

export function DataGrid<TRow>({
  rows,
  columns,
  getRowId,
  label,
  state = "ready",
  selection,
  sort,
  rowActions,
  rowActionsLabel = "Ações",
  pagination,
  footerSummary,
  staleNotice,
  onRetry,
  emptyTitle = "Nenhum registro encontrado",
  emptyDescription = "Ajuste a pesquisa ou remova os filtros aplicados.",
  errorTitle = "Não foi possível carregar os registros",
  errorDescription = "Tente novamente em instantes.",
  permissionTitle = "Consulta não permitida",
  permissionDescription = "Seu acesso não contempla esta consulta.",
  skeletonRows = 8,
  minWidthClassName = "min-w-[760px]",
  heightClassName = "max-h-[calc(100dvh-21rem)] min-h-[19rem] sm:max-h-[calc(100dvh-19rem)]",
}: DataGridProps<TRow>) {
  if (state === "loading") {
    return (
      <div
        className="space-y-px"
        role="status"
        aria-live="polite"
        aria-label={`Carregando ${label}`}
      >
        {Array.from({ length: skeletonRows }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-11 w-full rounded-none first:rounded-t-md last:rounded-b-md"
          />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <StatePanel
        tone="danger"
        title={errorTitle}
        description={errorDescription}
        action={
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw /> Tentar novamente
          </Button>
        }
      />
    );
  }

  if (state === "permission") {
    return (
      <StatePanel
        tone="warning"
        title={permissionTitle}
        description={permissionDescription}
        action={
          <Button size="sm" variant="outline">
            <LockKeyhole /> Entendi
          </Button>
        }
      />
    );
  }

  if (state === "empty" || rows.length === 0) {
    return <EmptyState compact icon={SearchX} title={emptyTitle} description={emptyDescription} />;
  }

  const rowIds = rows.map(getRowId);
  const selectedIds = selection?.selectedIds ?? [];
  const allSelected = rowIds.length > 0 && rowIds.every((id) => selectedIds.includes(id));
  const someSelected = selectedIds.length > 0;

  return (
    <div className="min-w-0 overflow-hidden border border-border bg-card shadow-panel">
      {state === "stale" && staleNotice ? (
        <div className="flex items-center justify-between gap-3 border-b border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          <span>{staleNotice}</span>
          <Button size="sm" variant="ghost" className="h-7" onClick={onRetry}>
            <RefreshCw /> Atualizar
          </Button>
        </div>
      ) : null}
      <div className={cn("overflow-auto", heightClassName)}>
        <Table className={cn("table-fixed", minWidthClassName)}>
          <caption className="sr-only">{label}</caption>
          <TableHeader className="sticky top-0 z-10 bg-muted shadow-[0_1px_0_var(--border)]">
            <TableRow className="hover:bg-muted">
              {selection ? (
                <TableHead className="w-10 pl-3">
                  <Checkbox
                    aria-label={selection.allLabel ?? "Selecionar todos os registros visíveis"}
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(checked) =>
                      selection.onSelectionChange(checked ? rowIds : [])
                    }
                  />
                </TableHead>
              ) : null}
              {columns.map((column) => {
                const isSorted = sort?.columnId === column.id;
                const SortIcon = !isSorted
                  ? ChevronsUpDown
                  : sort?.direction === "asc"
                    ? ArrowUp
                    : ArrowDown;
                return (
                  <TableHead
                    key={column.id}
                    className={cn(
                      column.width,
                      column.priority ? priorityClass[column.priority] : "",
                      column.align === "right" ? "text-right" : "",
                      column.className,
                    )}
                    aria-sort={
                      column.sortable
                        ? isSorted
                          ? sort?.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                  >
                    {column.srOnlyHeader ? (
                      <span className="sr-only">{column.header}</span>
                    ) : column.sortable && sort ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-8 px-2"
                        onClick={() =>
                          sort.onSortChange(
                            column.id,
                            isSorted && sort.direction === "asc" ? "desc" : "asc",
                          )
                        }
                      >
                        {column.header} <SortIcon className="size-3.5" aria-hidden="true" />
                      </Button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
              {rowActions ? (
                <TableHead className="w-12">
                  <span className="sr-only">{rowActionsLabel}</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const id = getRowId(row);
              const isSelected = selectedIds.includes(id);
              return (
                <TableRow
                  key={id}
                  data-state={isSelected ? "selected" : undefined}
                  className="h-11"
                >
                  {selection ? (
                    <TableCell className="pl-3">
                      <Checkbox
                        aria-label={selection.rowLabel?.(row) ?? `Selecionar registro ${id}`}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          selection.onSelectionChange(
                            checked
                              ? [...selectedIds, id]
                              : selectedIds.filter((value) => value !== id),
                          )
                        }
                      />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        "overflow-hidden",
                        column.priority ? priorityClass[column.priority] : "",
                        column.align === "right" ? "text-right" : "",
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                  {rowActions ? <TableCell>{rowActions(row)}</TableCell> : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {footerSummary || pagination ? (
        <footer className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
          <span>{footerSummary}</span>
          {pagination ? (
            <div className="flex items-center gap-1" aria-label="Paginação">
              <span className="mr-2 hidden sm:inline">
                Página {pagination.page} de {pagination.pageCount}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={!pagination.onPageChange || pagination.page <= 1}
                onClick={() => pagination.onPageChange?.(pagination.page - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={!pagination.onPageChange || pagination.page >= pagination.pageCount}
                onClick={() => pagination.onPageChange?.(pagination.page + 1)}
                aria-label="Próxima página"
              >
                <ChevronRight />
              </Button>
            </div>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}

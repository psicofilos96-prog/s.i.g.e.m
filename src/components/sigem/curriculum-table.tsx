import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * MatrixTable — contrato de UI genérico para visualização matricial.
 *
 * Deliberadamente neutro: não assume "disciplina", "ano" ou "escola". As
 * linhas podem representar componentes curriculares, campos de experiências,
 * elementos de ampliação curricular ou qualquer outro elemento fornecido pela
 * tela consumidora. Nenhuma regra de cálculo definitivo é aplicada: os totais
 * exibidos são fornecidos ou somados apenas para leitura.
 */

export type MatrixTableColumn = { id: string; label: string; helper?: string };

export type MatrixTableRow = {
  id: string;
  label: string;
  helper?: string;
  /** Valores por coluna; `null` representa ausência de valor documentado. */
  values: Array<number | null>;
};

export type MatrixTableGroup = {
  id: string;
  label?: string;
  rows: MatrixTableRow[];
};

export type MatrixTableProps = {
  label: string;
  rowsHeader: string;
  columns: MatrixTableColumn[];
  groups: MatrixTableGroup[];
  unitLabel: string;
  totalsLabel?: string;
  totals?: Array<number | null>;
  showRowTotals?: boolean;
  rowTotalsHeader?: string;
  legend?: ReactNode[];
  emptyValueLabel?: string;
  heightClassName?: string;
};

function formatValue(value: number | null, emptyValueLabel: string) {
  if (value === null || Number.isNaN(value)) return emptyValueLabel;
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function sum(values: Array<number | null>) {
  const known = values.filter((value): value is number => typeof value === "number");
  return known.length ? known.reduce((total, value) => total + value, 0) : null;
}

export function MatrixTable({
  label,
  rowsHeader,
  columns,
  groups,
  unitLabel,
  totalsLabel = "Total",
  totals,
  showRowTotals = false,
  rowTotalsHeader = "Total",
  legend,
  emptyValueLabel = "—",
  heightClassName = "max-h-[30rem]",
}: MatrixTableProps) {
  const numericCellClass = "px-3 py-2 text-right font-mono text-xs text-tabular tabular-nums";

  return (
    <div className="min-w-0">
      <div
        className={cn(
          "min-w-0 max-w-full overflow-auto overscroll-contain border border-border bg-card shadow-panel",
          heightClassName,
        )}
      >
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <caption className="sr-only">{label}</caption>
          <thead className="sticky top-0 z-20 bg-muted">
            <tr className="shadow-[0_1px_0_var(--border)]">
              <th
                scope="col"
                className="sticky left-0 z-30 min-w-[14rem] bg-muted px-3 py-2 text-left text-xs font-semibold text-foreground shadow-[1px_0_0_var(--border)]"
              >
                {rowsHeader}
                <span className="ml-1 font-normal text-muted-foreground">({unitLabel})</span>
              </th>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className="px-3 py-2 text-right text-xs font-semibold text-foreground"
                >
                  {column.label}
                  {column.helper ? (
                    <span className="block font-normal text-[0.6875rem] text-muted-foreground">
                      {column.helper}
                    </span>
                  ) : null}
                </th>
              ))}
              {showRowTotals ? (
                <th
                  scope="col"
                  className="px-3 py-2 text-right text-xs font-semibold text-foreground"
                >
                  {rowTotalsHeader}
                </th>
              ) : null}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.id} className="border-t border-border">
              {group.label ? (
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={columns.length + 1 + (showRowTotals ? 1 : 0)}
                    className="sticky left-0 bg-muted/50 px-3 py-1.5 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {group.label}
                  </th>
                </tr>
              ) : null}
              {group.rows.map((row) => (
                <tr key={row.id} className="border-t border-border hover:bg-muted/40">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 min-w-[14rem] bg-card px-3 py-2 text-left text-sm font-medium text-foreground shadow-[1px_0_0_var(--border)]"
                  >
                    <span className="block [overflow-wrap:anywhere]">{row.label}</span>
                    {row.helper ? (
                      <span className="block text-[0.6875rem] font-normal text-muted-foreground">
                        {row.helper}
                      </span>
                    ) : null}
                  </th>
                  {row.values.map((value, index) => (
                    <td key={columns[index]?.id ?? index} className={numericCellClass}>
                      {formatValue(value, emptyValueLabel)}
                    </td>
                  ))}
                  {showRowTotals ? (
                    <td className={cn(numericCellClass, "font-semibold text-foreground")}>
                      {formatValue(sum(row.values), emptyValueLabel)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          ))}
          {totals ? (
            <tfoot className="sticky bottom-0 z-20 bg-muted">
              <tr className="border-t border-border shadow-[0_-1px_0_var(--border)]">
                <th
                  scope="row"
                  className="sticky left-0 z-30 bg-muted px-3 py-2 text-left text-xs font-semibold text-foreground shadow-[1px_0_0_var(--border)]"
                >
                  {totalsLabel}
                </th>
                {totals.map((value, index) => (
                  <td
                    key={columns[index]?.id ?? index}
                    className={cn(numericCellClass, "font-semibold text-foreground")}
                  >
                    {formatValue(value, emptyValueLabel)}
                  </td>
                ))}
                {showRowTotals ? <td className={numericCellClass}>{emptyValueLabel}</td> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {legend?.length ? (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground" aria-label="Legenda">
          {legend.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

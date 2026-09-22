import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  LockKeyhole,
  MoreHorizontal,
  RefreshCw,
  SearchX,
} from "lucide-react";
import type { DemonstrationUnit } from "./units-data";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";

export type UnitsViewState = "ready" | "loading" | "empty" | "error" | "permission" | "stale";

function statusTone(status: DemonstrationUnit["status"]) {
  if (status === "Em atividade") return "success" as const;
  if (status === "Em revisão") return "warning" as const;
  return "neutral" as const;
}

export function UnitsDataGrid({
  units,
  state,
  selected,
  onSelectedChange,
  sortDirection,
  onSort,
}: {
  units: DemonstrationUnit[];
  state: UnitsViewState;
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  sortDirection: "asc" | "desc";
  onSort: () => void;
}) {
  if (state === "loading") {
    return (
      <div className="space-y-px" aria-live="polite" aria-label="Carregando unidades">
        {Array.from({ length: 8 }).map((_, index) => (
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
        title="Não foi possível carregar as unidades"
        description="O estado demonstra como uma falha de consulta será apresentada. Nenhuma fonte externa está conectada."
        action={
          <Button size="sm" variant="outline">
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
        title="Consulta não permitida"
        description="Este estado demonstra uma futura restrição de acesso. Nenhuma permissão real foi definida."
        action={
          <Button size="sm" variant="outline">
            <LockKeyhole /> Entendi
          </Button>
        }
      />
    );
  }

  if (state === "empty" || units.length === 0) {
    return (
      <EmptyState
        compact
        icon={SearchX}
        title="Nenhuma unidade encontrada"
        description="Ajuste a pesquisa ou remova filtros para visualizar os exemplos demonstrativos."
      />
    );
  }

  const allSelected = units.length > 0 && units.every((unit) => selected.includes(unit.id));
  const SortIcon = sortDirection === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className="min-w-0 overflow-hidden border border-border bg-card shadow-panel">
      {state === "stale" ? (
        <div className="flex items-center justify-between gap-3 border-b border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          <span>
            <strong>Dados desatualizados.</strong> Visualização demonstrativa da última consulta
            disponível.
          </span>
          <Button size="sm" variant="ghost" className="h-7">
            <RefreshCw /> Atualizar
          </Button>
        </div>
      ) : null}
      <div className="max-h-[calc(100dvh-21rem)] min-h-[19rem] overflow-auto sm:max-h-[calc(100dvh-19rem)]">
        <Table className="min-w-[760px] table-fixed">
          <TableHeader className="sticky top-0 z-10 bg-muted shadow-[0_1px_0_var(--border)]">
            <TableRow className="hover:bg-muted">
              <TableHead className="w-10 pl-3">
                <Checkbox
                  aria-label="Selecionar todas as unidades visíveis"
                  checked={allSelected ? true : selected.length > 0 ? "indeterminate" : false}
                  onCheckedChange={(checked) =>
                    onSelectedChange(checked ? units.map((unit) => unit.id) : [])
                  }
                />
              </TableHead>
              <TableHead className="w-[30%]">
                <Button variant="ghost" size="sm" className="-ml-2 h-8 px-2" onClick={onSort}>
                  Unidade <SortIcon className="size-3.5" />
                </Button>
              </TableHead>
              <TableHead className="w-[13%]">Identificação</TableHead>
              <TableHead className="hidden w-[18%] md:table-cell">Categoria</TableHead>
              <TableHead className="hidden w-[16%] lg:table-cell">Localidade</TableHead>
              <TableHead className="w-[15%]">Situação</TableHead>
              <TableHead className="hidden w-[13%] xl:table-cell">Atualização</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((unit) => {
              const isSelected = selected.includes(unit.id);
              return (
                <TableRow
                  key={unit.id}
                  data-state={isSelected ? "selected" : undefined}
                  className="h-11"
                >
                  <TableCell className="pl-3">
                    <Checkbox
                      aria-label={`Selecionar ${unit.name}`}
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        onSelectedChange(
                          checked
                            ? [...selected, unit.id]
                            : selected.filter((id) => id !== unit.id),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="overflow-hidden">
                    <Link
                      to="/unidades/$id"
                      params={{ id: unit.id }}
                      className="block truncate font-semibold text-foreground hover:text-primary hover:underline"
                      title={unit.name}
                    >
                      {unit.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-tabular text-muted-foreground">
                    {unit.identifier}
                  </TableCell>
                  <TableCell
                    className="hidden truncate text-muted-foreground md:table-cell"
                    title={unit.category}
                  >
                    {unit.category}
                  </TableCell>
                  <TableCell
                    className="hidden truncate text-muted-foreground lg:table-cell"
                    title={unit.location}
                  >
                    {unit.location}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={statusTone(unit.status)}>{unit.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap font-mono text-xs text-tabular text-muted-foreground xl:table-cell">
                    {unit.updatedAt}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Ações de ${unit.name}`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to="/unidades/$id" params={{ id: unit.id }}>
                            Abrir visão geral
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>Editar dados</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <footer className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
        <span>{units.length} de 8 registros demonstrativos</span>
        <div className="flex items-center gap-1" aria-label="Paginação demonstrativa">
          <span className="mr-2 hidden sm:inline">Página 1 de 1</span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled
            aria-label="Página anterior"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled
            aria-label="Próxima página"
          >
            <ChevronRight />
          </Button>
        </div>
      </footer>
    </div>
  );
}

export function UnitNotFoundState() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Unidade não encontrada"
      description="O identificador informado não corresponde aos registros demonstrativos disponíveis."
      action={
        <Button asChild variant="outline">
          <Link to="/unidades">Voltar para unidades</Link>
        </Button>
      }
    />
  );
}

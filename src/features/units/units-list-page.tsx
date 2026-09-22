import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MoreHorizontal, Plus } from "lucide-react";
import { OperationalPageHeader } from "@/components/sigem/operational";
import {
  DataGrid,
  type DataGridColumn,
  type DataGridState,
} from "@/components/sigem/data-grid";
import {
  FILTER_ALL,
  FilterBar,
  type FilterDefinition,
  type FilterValues,
} from "@/components/sigem/filter-bar";
import { StatusBadge } from "@/components/sigem/patterns";
import {
  DEMO_CONTEXTS,
  DEMO_GROUPS,
  DEMO_MARKERS,
  demonstrationUnits,
  markerTone,
  type DemonstrationUnit,
} from "@/features/units/units-data";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Tela consumidora. TODA configuração de filtros e colunas é declarada aqui:
 * os componentes DataGrid e FilterBar permanecem genéricos.
 *
 * Os filtros abaixo são DEMONSTRAÇÕES DE COMPORTAMENTO. Os valores são
 * neutros de propósito e não representam taxonomia oficial.
 */
const demonstrationFilters: FilterDefinition[] = [
  {
    id: "marker",
    label: "Marcador (demonstrativo)",
    allLabel: "Todos os marcadores",
    options: DEMO_MARKERS.map((value) => ({ value, label: value })),
    triggerClassName: "h-9 sm:w-52",
  },
  {
    id: "group",
    label: "Grupo (demonstrativo)",
    allLabel: "Todos os grupos",
    options: DEMO_GROUPS.map((value) => ({ value, label: value })),
    triggerClassName: "h-9 sm:w-48",
  },
  {
    id: "context",
    label: "Contexto (demonstrativo)",
    allLabel: "Todos os contextos",
    options: DEMO_CONTEXTS.map((value) => ({ value, label: value })),
    advanced: true,
  },
];

const initialValues: FilterValues = {
  marker: FILTER_ALL,
  group: FILTER_ALL,
  context: FILTER_ALL,
};

export function UnitsListPage() {
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<FilterValues>(initialValues);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<string[]>([]);
  const [viewState, setViewState] = useState<DataGridState>("ready");

  const rows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return demonstrationUnits
      .filter(
        (unit) =>
          !term ||
          [unit.name, unit.identifier, unit.group, unit.context].some((value) =>
            value.toLocaleLowerCase("pt-BR").includes(term),
          ),
      )
      .filter((unit) => values["marker"] === FILTER_ALL || unit.marker === values["marker"])
      .filter((unit) => values["group"] === FILTER_ALL || unit.group === values["group"])
      .filter((unit) => values["context"] === FILTER_ALL || unit.context === values["context"])
      .sort((a, b) =>
        sortDirection === "asc"
          ? a.name.localeCompare(b.name, "pt-BR")
          : b.name.localeCompare(a.name, "pt-BR"),
      );
  }, [query, sortDirection, values]);

  const columns: Array<DataGridColumn<DemonstrationUnit>> = [
    {
      id: "name",
      header: "Unidade",
      width: "w-[30%]",
      sortable: true,
      cell: (unit) => (
        <Link
          to="/unidades/$id"
          params={{ id: unit.id }}
          className="block truncate font-semibold text-foreground hover:text-primary hover:underline"
          title={unit.name}
        >
          {unit.name}
        </Link>
      ),
    },
    {
      id: "identifier",
      header: "Identificação",
      width: "w-[13%]",
      className: "font-mono text-xs text-tabular text-muted-foreground",
      cell: (unit) => unit.identifier,
    },
    {
      id: "group",
      header: "Grupo",
      width: "w-[16%]",
      priority: "secondary",
      className: "truncate text-muted-foreground",
      cell: (unit) => unit.group,
    },
    {
      id: "context",
      header: "Contexto",
      width: "w-[15%]",
      priority: "secondary",
      className: "truncate text-muted-foreground",
      cell: (unit) => unit.context,
    },
    {
      id: "marker",
      header: "Marcador",
      width: "w-[16%]",
      cell: (unit) => <StatusBadge tone={markerTone(unit.marker)}>{unit.marker}</StatusBadge>,
    },
    {
      id: "updatedAt",
      header: "Atualização",
      width: "w-[13%]",
      priority: "tertiary",
      className: "whitespace-nowrap font-mono text-xs text-tabular text-muted-foreground",
      cell: (unit) => unit.updatedAt,
    },
  ];

  const clearFilters = () => {
    setValues(initialValues);
    setQuery("");
  };

  return (
    <div className="space-y-4 pb-4">
      <OperationalPageHeader
        title="Unidades escolares"
        description="Consulte e acompanhe as unidades atendidas pelo SIGEM."
        actions={
          <Button size="sm" disabled title="Disponível em uma etapa futura">
            <Plus /> Nova unidade
          </Button>
        }
      />

      <FilterBar
        search={{
          value: query,
          onChange: setQuery,
          label: "Pesquisar unidades",
          placeholder: "Pesquisar por nome, identificação ou contexto",
        }}
        filters={demonstrationFilters}
        values={values}
        onValueChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
        onClear={clearFilters}
        advancedDescription="Filtros demonstrativos. Os valores são neutros e não representam taxonomia oficial."
        advancedExtra={
          <div className="space-y-2">
            <Label htmlFor="demo-view-state">Estado da interface</Label>
            <Select
              value={viewState}
              onValueChange={(value) => setViewState(value as DataGridState)}
            >
              <SelectTrigger id="demo-view-state" aria-label="Estado da interface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ready">Dados disponíveis</SelectItem>
                <SelectItem value="loading">Carregamento</SelectItem>
                <SelectItem value="empty">Sem resultados</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
                <SelectItem value="permission">Acesso negado</SelectItem>
                <SelectItem value="stale">Dados desatualizados</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Apenas para validar estados; não representa uma regra do sistema.
            </p>
          </div>
        }
        summary={
          <>
            <strong className="font-semibold text-foreground">{rows.length}</strong> resultados
            demonstrativos {selected.length ? `· ${selected.length} selecionados` : ""}
          </>
        }
        note="Filtros e valores são demonstrativos"
      />

      <DataGrid
        label="Unidades escolares demonstrativas"
        rows={rows}
        columns={columns}
        getRowId={(unit) => unit.id}
        state={viewState}
        onRetry={() => setViewState("ready")}
        selection={{
          selectedIds: selected,
          onSelectionChange: setSelected,
          rowLabel: (unit) => `Selecionar ${unit.name}`,
          allLabel: "Selecionar todas as unidades visíveis",
        }}
        sort={{
          columnId: "name",
          direction: sortDirection,
          onSortChange: (_columnId, direction) => setSortDirection(direction),
        }}
        rowActions={(unit) => (
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
        )}
        emptyTitle="Nenhuma unidade encontrada"
        emptyDescription="Ajuste a pesquisa ou remova filtros para visualizar os exemplos demonstrativos."
        errorDescription="O estado demonstra como uma falha de consulta será apresentada. Nenhuma fonte externa está conectada."
        permissionDescription="Este estado demonstra uma futura restrição de acesso. Nenhuma permissão real foi definida."
        staleNotice={
          <>
            <strong>Dados desatualizados.</strong> Visualização demonstrativa da última consulta
            disponível.
          </>
        }
        footerSummary={`${rows.length} de ${demonstrationUnits.length} registros demonstrativos`}
        pagination={{ page: 1, pageCount: 1, total: demonstrationUnits.length }}
      />
    </div>
  );
}

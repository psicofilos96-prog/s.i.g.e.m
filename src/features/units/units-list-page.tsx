import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MoreHorizontal, Plus } from "lucide-react";
import { OperationalPageHeader } from "@/components/sigem/operational";
import { DataGrid, type DataGridColumn, type DataGridState } from "@/components/sigem/data-grid";
import {
  FILTER_ALL,
  FilterBar,
  type FilterDefinition,
  type FilterValues,
} from "@/components/sigem/filter-bar";
import { StatusBadge } from "@/components/sigem/patterns";
import {
  DEMO_INEP_FILTERS,
  DEMO_INSTITUTIONAL_CONTEXTS,
  DEMO_LOCATION_SCOPES,
  DEMO_OPERATIONAL_SITUATIONS,
  demonstrationUnits,
  operationalSituationTone,
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
 * DataGrid e FilterBar permanecem genéricos.
 *
 * Os filtros abaixo demonstram dimensões institucionais reais de consulta,
 * mas os valores continuam fictícios e NÃO representam listas oficiais.
 */
const demonstrationFilters: FilterDefinition[] = [
  {
    id: "operationalSituation",
    label: "Situação operacional",
    allLabel: "Todas as situações",
    options: DEMO_OPERATIONAL_SITUATIONS.map((value) => ({ value, label: value })),
    triggerClassName: "h-9 sm:w-56",
  },
  {
    id: "institutionalContext",
    label: "Contexto institucional",
    allLabel: "Todos os contextos",
    options: DEMO_INSTITUTIONAL_CONTEXTS.map((value) => ({ value, label: value })),
    triggerClassName: "h-9 sm:w-64",
  },
  {
    id: "locationScope",
    label: "Localização",
    allLabel: "Todas as localizações",
    options: DEMO_LOCATION_SCOPES.map((value) => ({ value, label: value })),
    advanced: true,
  },
  {
    id: "inepPresence",
    label: "Código INEP",
    allLabel: "Com ou sem código INEP",
    options: [...DEMO_INEP_FILTERS],
    advanced: true,
  },
];

const initialValues: FilterValues = {
  operationalSituation: FILTER_ALL,
  institutionalContext: FILTER_ALL,
  locationScope: FILTER_ALL,
  inepPresence: FILTER_ALL,
};

function unitSearchHaystack(unit: DemonstrationUnit) {
  return [
    unit.currentName,
    unit.internalIdentifier,
    unit.inepCode ?? "",
    unit.institutionalContext,
    unit.neighborhood,
    unit.locality,
    ...unit.previousNames.map((entry) => entry.previousName),
  ]
    .join(" ")
    .toLocaleLowerCase("pt-BR");
}

export function UnitsListPage() {
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<FilterValues>(initialValues);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<string[]>([]);
  const [viewState, setViewState] = useState<DataGridState>("ready");

  const rows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return demonstrationUnits
      .filter((unit) => !term || unitSearchHaystack(unit).includes(term))
      .filter(
        (unit) =>
          values["operationalSituation"] === FILTER_ALL ||
          unit.operationalSituation === values["operationalSituation"],
      )
      .filter(
        (unit) =>
          values["institutionalContext"] === FILTER_ALL ||
          unit.institutionalContext === values["institutionalContext"],
      )
      .filter(
        (unit) =>
          values["locationScope"] === FILTER_ALL || unit.locationScope === values["locationScope"],
      )
      .filter((unit) => {
        if (values["inepPresence"] === FILTER_ALL) return true;
        if (values["inepPresence"] === "with-inep") return Boolean(unit.inepCode);
        return !unit.inepCode;
      })
      .sort((a, b) =>
        sortDirection === "asc"
          ? a.currentName.localeCompare(b.currentName, "pt-BR")
          : b.currentName.localeCompare(a.currentName, "pt-BR"),
      );
  }, [query, sortDirection, values]);

  const columns: Array<DataGridColumn<DemonstrationUnit>> = [
    {
      id: "currentName",
      header: "Nome atual",
      width: "w-[29%]",
      sortable: true,
      cell: (unit) => (
        <div className="min-w-0">
          <Link
            to="/unidades/$id"
            params={{ id: unit.id }}
            className="block truncate font-semibold text-foreground hover:text-primary hover:underline"
            title={unit.currentName}
          >
            {unit.currentName}
          </Link>
          {unit.previousNames[0] ? (
            <p
              className="truncate text-xs text-muted-foreground"
              title={unit.previousNames[0].previousName}
            >
              Antes: {unit.previousNames[0].previousName}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "identifiers",
      header: "Identificação",
      width: "w-[15%]",
      className: "font-mono text-xs text-tabular text-muted-foreground",
      cell: (unit) => (
        <div className="space-y-0.5">
          <div>{unit.internalIdentifier}</div>
          <div>{unit.inepCode ? `INEP ${unit.inepCode}` : "INEP não informado"}</div>
        </div>
      ),
    },
    {
      id: "institutionalContext",
      header: "Contexto institucional",
      width: "w-[20%]",
      priority: "secondary",
      className: "truncate text-muted-foreground",
      cell: (unit) => unit.institutionalContext,
    },
    {
      id: "location",
      header: "Localização",
      width: "w-[16%]",
      priority: "secondary",
      className: "truncate text-muted-foreground",
      cell: (unit) => unit.neighborhood,
    },
    {
      id: "operationalSituation",
      header: "Situação operacional",
      width: "w-[16%]",
      cell: (unit) => (
        <StatusBadge tone={operationalSituationTone(unit.operationalSituation)}>
          {unit.operationalSituation}
        </StatusBadge>
      ),
    },
    {
      id: "updatedAt",
      header: "Atualização",
      width: "w-[12%]",
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
        description="Consulte instituições educacionais por identidade, histórico nominal, identificação e contexto."
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
          placeholder: "Nome atual, nome anterior, ID interno ou código INEP",
        }}
        filters={demonstrationFilters}
        values={values}
        onValueChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
        onClear={clearFilters}
        advancedDescription="Filtros conceituais demonstrativos; os valores não representam listas oficiais do domínio."
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
            fictícios {selected.length ? `· ${selected.length} selecionados` : ""}
          </>
        }
        note="Dados fictícios, não oficiais"
      />

      <DataGrid
        label="Consulta institucional de unidades escolares fictícias"
        rows={rows}
        columns={columns}
        getRowId={(unit) => unit.id}
        state={viewState}
        onRetry={() => setViewState("ready")}
        selection={{
          selectedIds: selected,
          onSelectionChange: setSelected,
          rowLabel: (unit) => `Selecionar ${unit.currentName}`,
          allLabel: "Selecionar todas as unidades visíveis",
        }}
        sort={{
          columnId: "currentName",
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
                aria-label={`Ações de ${unit.currentName}`}
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
        emptyDescription="Ajuste a pesquisa ou remova filtros para visualizar os exemplos fictícios."
        errorDescription="O estado demonstra como uma falha de consulta será apresentada. Nenhuma fonte externa está conectada."
        permissionDescription="Este estado demonstra uma futura restrição de acesso. Nenhuma permissão real foi definida."
        staleNotice={
          <>
            <strong>Dados desatualizados.</strong> Visualização demonstrativa da última consulta
            disponível.
          </>
        }
        footerSummary={`${rows.length} de ${demonstrationUnits.length} registros fictícios`}
        pagination={{ page: 1, pageCount: 1, total: demonstrationUnits.length }}
      />
    </div>
  );
}

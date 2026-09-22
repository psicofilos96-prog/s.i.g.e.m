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
  DEMO_ACADEMIC_PERIODS,
  DEMO_CLASS_GROUPINGS,
  DEMO_CLASS_ORGANIZATIONS,
  DEMO_CLASS_SHIFTS,
  DEMO_CLASS_UNITS,
  classSituationTone,
  demonstrationClasses,
  getClassUnitName,
  type DemonstrationClass,
} from "@/features/classes/classes-data";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Filtros conceituais demonstrativos. Os valores derivam dos fixtures e NÃO
 * representam listas oficiais de domínio.
 */
const classFilters: FilterDefinition[] = [
  {
    id: "academicPeriod",
    label: "Período letivo",
    allLabel: "Todos os períodos letivos",
    options: DEMO_ACADEMIC_PERIODS.map((value) => ({ value, label: value })),
    triggerClassName: "h-9 sm:w-64",
  },
  {
    id: "unitId",
    label: "Unidade",
    allLabel: "Todas as unidades",
    options: DEMO_CLASS_UNITS,
    triggerClassName: "h-9 sm:w-64",
  },
  {
    id: "academicOrganization",
    label: "Oferta / organização acadêmica",
    allLabel: "Todas as organizações",
    options: DEMO_CLASS_ORGANIZATIONS.map((value) => ({ value, label: value })),
    advanced: true,
  },
  {
    id: "grouping",
    label: "Agrupamento",
    allLabel: "Todos os agrupamentos",
    options: DEMO_CLASS_GROUPINGS.map((value) => ({ value, label: value })),
    advanced: true,
  },
  {
    id: "shift",
    label: "Turno",
    allLabel: "Todos os turnos",
    options: DEMO_CLASS_SHIFTS.map((value) => ({ value, label: value })),
    advanced: true,
  },
];

const initialValues: FilterValues = {
  academicPeriod: FILTER_ALL,
  unitId: FILTER_ALL,
  academicOrganization: FILTER_ALL,
  grouping: FILTER_ALL,
  shift: FILTER_ALL,
};

function classSearchHaystack(item: DemonstrationClass) {
  return [
    item.name,
    item.code,
    getClassUnitName(item.unitId),
    item.academicPeriod.label,
    item.academicOrganization,
    item.shift,
    item.journey,
    ...item.groupings.map((group) => group.label),
  ]
    .join(" ")
    .toLocaleLowerCase("pt-BR");
}

export function ClassesListPage() {
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<FilterValues>(initialValues);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<string[]>([]);
  const [viewState] = useState<DataGridState>("ready");

  const rows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return demonstrationClasses
      .filter((item) => !term || classSearchHaystack(item).includes(term))
      .filter(
        (item) =>
          values["academicPeriod"] === FILTER_ALL ||
          item.academicPeriod.label === values["academicPeriod"],
      )
      .filter((item) => values["unitId"] === FILTER_ALL || item.unitId === values["unitId"])
      .filter(
        (item) =>
          values["academicOrganization"] === FILTER_ALL ||
          item.academicOrganization === values["academicOrganization"],
      )
      .filter(
        (item) =>
          values["grouping"] === FILTER_ALL ||
          item.groupings.some((group) => group.label === values["grouping"]),
      )
      .filter((item) => values["shift"] === FILTER_ALL || item.shift === values["shift"])
      .sort((a, b) =>
        sortDirection === "asc"
          ? a.name.localeCompare(b.name, "pt-BR")
          : b.name.localeCompare(a.name, "pt-BR"),
      );
  }, [query, sortDirection, values]);

  const columns: Array<DataGridColumn<DemonstrationClass>> = [
    {
      id: "name",
      header: "Turma",
      width: "w-[24%]",
      sortable: true,
      cell: (item) => (
        <div className="min-w-0">
          <Link
            to="/turmas/$id"
            params={{ id: item.id }}
            className="block truncate font-semibold text-foreground hover:text-primary hover:underline"
            title={item.name}
          >
            {item.name}
          </Link>
          <p className="truncate font-mono text-xs text-tabular text-muted-foreground">
            {item.code}
          </p>
        </div>
      ),
    },
    {
      id: "unit",
      header: "Unidade",
      width: "w-[20%]",
      className: "truncate text-muted-foreground",
      cell: (item) => getClassUnitName(item.unitId),
    },
    {
      id: "academicPeriod",
      header: "Período letivo",
      width: "w-[13%]",
      className: "text-muted-foreground",
      cell: (item) => item.academicPeriod.label,
    },
    {
      id: "academicOrganization",
      header: "Organização acadêmica",
      width: "w-[17%]",
      priority: "secondary",
      className: "truncate text-muted-foreground",
      cell: (item) => item.academicOrganization,
    },
    {
      id: "groupings",
      header: "Agrupamentos",
      width: "w-[12%]",
      cell: (item) => (
        <ul className="space-y-0.5">
          {item.groupings.map((group) => (
            <li key={group.id} className="text-xs">
              <span className="text-foreground">{group.label}</span>{" "}
              <span className="text-muted-foreground">({group.kind})</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "shiftJourney",
      header: "Turno e jornada",
      width: "w-[14%]",
      priority: "secondary",
      cell: (item) => (
        <div className="space-y-0.5 text-xs">
          <p>
            <span className="text-muted-foreground">Turno:</span> {item.shift}
          </p>
          <p className="truncate" title={item.journey}>
            <span className="text-muted-foreground">Jornada:</span> {item.journey}
          </p>
        </div>
      ),
    },
    {
      id: "situation",
      header: "Situação contextual",
      width: "w-[13%]",
      cell: (item) => (
        <StatusBadge tone={classSituationTone(item.situation)}>{item.situation}</StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-4 pb-4">
      <OperationalPageHeader
        title="Turmas"
        description="Consulte turmas pelo contexto institucional e temporal: unidade, período letivo, organização acadêmica e agrupamentos."
        actions={
          <Button size="sm" disabled title="Criação de turma não faz parte desta etapa">
            <Plus /> Nova turma
          </Button>
        }
      />

      <FilterBar
        search={{
          value: query,
          onChange: setQuery,
          label: "Pesquisar turmas",
          placeholder: "Nome, código, unidade, período letivo ou agrupamento",
        }}
        filters={classFilters}
        values={values}
        onValueChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
        onClear={() => {
          setValues(initialValues);
          setQuery("");
        }}
        advancedDescription="Filtros conceituais demonstrativos; nenhuma enumeração aqui é definitiva."
        summary={
          <>
            <strong className="font-semibold text-foreground">{rows.length}</strong> turmas fictícias
            {selected.length ? ` · ${selected.length} selecionadas` : ""}
          </>
        }
        note="Dados fictícios, não oficiais"
      />

      <DataGrid
        label="Consulta de turmas fictícias"
        rows={rows}
        columns={columns}
        getRowId={(item) => item.id}
        state={viewState}
        selection={{
          selectedIds: selected,
          onSelectionChange: setSelected,
          rowLabel: (item) => `Selecionar ${item.name}`,
          allLabel: "Selecionar todas as turmas visíveis",
        }}
        sort={{
          columnId: "name",
          direction: sortDirection,
          onSortChange: (_columnId, direction) => setSortDirection(direction),
        }}
        rowActions={(item) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Ações de ${item.name}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/turmas/$id" params={{ id: item.id }}>
                  Abrir visão geral
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/matrizes-curriculares/$id" params={{ id: item.matrixId }}>
                  Abrir matriz aplicável
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>Editar turma (etapa futura)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        emptyTitle="Nenhuma turma encontrada"
        emptyDescription="Ajuste a pesquisa ou remova filtros para visualizar os exemplos fictícios."
        footerSummary={`${rows.length} de ${demonstrationClasses.length} turmas fictícias`}
        pagination={{ page: 1, pageCount: 1, total: demonstrationClasses.length }}
      />
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { DataGrid, type DataGridColumn, type DataGridState } from "@/components/sigem/data-grid";
import {
  FILTER_ALL,
  FilterBar,
  type FilterDefinition,
  type FilterValues,
} from "@/components/sigem/filter-bar";
import { OperationalPageHeader } from "@/components/sigem/operational";
import { StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROFESSIONAL_ALLOCATIONS,
  PROFESSIONAL_CARGOS,
  PROFESSIONAL_DATA_MINIMIZATION_NOTE,
  PROFESSIONAL_EMPLOYERS,
  PROFESSIONAL_FUNCTIONS,
  PROFESSIONAL_SITUATIONS,
  currentAllocations,
  currentFunctions,
  currentLinks,
  demonstrationProfessionals,
  hasPedagogicalActivity,
  professionalSituationTone,
  type DemonstrationProfessional,
} from "./professionals-data";

const filters: FilterDefinition[] = [
  {
    id: "situation",
    label: "Situação contextual",
    allLabel: "Todas as situações",
    options: PROFESSIONAL_SITUATIONS.map((value) => ({ value, label: value })),
    triggerClassName: "h-9 sm:w-56",
  },
  {
    id: "allocation",
    label: "Unidade / lotação",
    allLabel: "Todas as lotações",
    options: PROFESSIONAL_ALLOCATIONS.map((value) => ({ value, label: value })),
    triggerClassName: "h-9 sm:w-64",
  },
  {
    id: "cargo",
    label: "Cargo",
    allLabel: "Todos os cargos",
    options: PROFESSIONAL_CARGOS.map((value) => ({ value, label: value })),
    advanced: true,
  },
  {
    id: "function",
    label: "Função",
    allLabel: "Todas as funções",
    options: PROFESSIONAL_FUNCTIONS.map((value) => ({ value, label: value })),
    advanced: true,
  },
  {
    id: "employer",
    label: "Empregador / contexto",
    allLabel: "Todos os contextos",
    options: PROFESSIONAL_EMPLOYERS.map((value) => ({ value, label: value })),
    advanced: true,
  },
  {
    id: "pedagogical",
    label: "Possui atuação pedagógica",
    allLabel: "Com ou sem atuação",
    options: [
      { value: "yes", label: "Com atuação pedagógica" },
      { value: "no", label: "Sem atuação pedagógica" },
    ],
    advanced: true,
  },
];

const initialValues: FilterValues = {
  situation: FILTER_ALL,
  allocation: FILTER_ALL,
  cargo: FILTER_ALL,
  function: FILTER_ALL,
  employer: FILTER_ALL,
  pedagogical: FILTER_ALL,
};

function searchHaystack(item: DemonstrationProfessional) {
  return [
    item.personName,
    item.professionalId,
    item.externalId ?? "",
    ...item.links.flatMap((link) => [link.functionalIdentifier, link.employerContext, link.cargo]),
  ]
    .join(" ")
    .toLocaleLowerCase("pt-BR");
}

export function ProfessionalsListPage() {
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<FilterValues>(initialValues);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<string[]>([]);
  const [viewState, setViewState] = useState<DataGridState>("ready");

  const rows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return demonstrationProfessionals
      .filter((item) => !term || searchHaystack(item).includes(term))
      .filter(
        (item) => values["situation"] === FILTER_ALL || item.situation === values["situation"],
      )
      .filter(
        (item) =>
          values["allocation"] === FILTER_ALL ||
          item.links.some((link) =>
            link.allocations.some((allocation) => allocation.place === values["allocation"]),
          ),
      )
      .filter(
        (item) =>
          values["cargo"] === FILTER_ALL ||
          item.links.some((link) => link.cargo === values["cargo"]),
      )
      .filter(
        (item) =>
          values["function"] === FILTER_ALL ||
          item.links.some((link) =>
            link.functions.some((assignment) => assignment.name === values["function"]),
          ),
      )
      .filter(
        (item) =>
          values["employer"] === FILTER_ALL ||
          item.links.some((link) => link.employerContext === values["employer"]),
      )
      .filter(
        (item) =>
          values["pedagogical"] === FILTER_ALL ||
          hasPedagogicalActivity(item) === (values["pedagogical"] === "yes"),
      )
      .sort((a, b) =>
        sortDirection === "asc"
          ? a.personName.localeCompare(b.personName, "pt-BR")
          : b.personName.localeCompare(a.personName, "pt-BR"),
      );
  }, [query, sortDirection, values]);

  const columns: Array<DataGridColumn<DemonstrationProfessional>> = [
    {
      id: "professional",
      header: "Profissional",
      width: "w-[25%]",
      sortable: true,
      cell: (item) => (
        <div className="min-w-0">
          <Link
            to="/profissionais/$id"
            params={{ id: item.id }}
            className="block truncate font-semibold text-foreground hover:text-primary hover:underline"
          >
            {item.personName}
          </Link>
          <p className="truncate font-mono text-xs text-tabular text-muted-foreground">
            {item.professionalId}
          </p>
        </div>
      ),
    },
    {
      id: "link",
      header: "Vínculo principal / contextual",
      width: "w-[25%]",
      cell: (item) => {
        const link = currentLinks(item)[0] ?? item.links[0];
        return (
          <div className="min-w-0 text-xs">
            <p className="truncate text-foreground">
              {link?.employerContext ?? "Sem vínculo vigente"}
            </p>
            <p className="truncate text-muted-foreground">
              {link ? `${link.cargo} · ${link.functionalIdentifier}` : "Contexto histórico"}
            </p>
          </div>
        );
      },
    },
    {
      id: "allocation",
      header: "Lotação atual",
      width: "w-[20%]",
      priority: "secondary",
      cell: (item) => {
        const places = currentAllocations(item);
        return (
          <span className="text-xs text-muted-foreground">
            {places.length ? places.map((place) => place.place).join("; ") : "Sem lotação atual"}
          </span>
        );
      },
    },
    {
      id: "functions",
      header: "Função atual",
      width: "w-[17%]",
      priority: "secondary",
      cell: (item) => {
        const assignments = currentFunctions(item);
        return (
          <span className="text-xs text-muted-foreground">
            {assignments.length
              ? assignments.map((assignment) => assignment.name).join("; ")
              : "Sem função atual"}
          </span>
        );
      },
    },
    {
      id: "situation",
      header: "Situação",
      width: "w-[13%]",
      cell: (item) => (
        <StatusBadge tone={professionalSituationTone(item.situation)}>{item.situation}</StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-4 pb-4">
      <OperationalPageHeader
        title="Profissionais"
        description="Consulte pessoas em seu papel profissional e os vínculos funcionais associados. Pessoa, Profissional, Vínculo, Cargo, Lotação, Função e Atuação Pedagógica são conceitos distintos."
        actions={
          <Button asChild size="sm">
            <Link to="/profissionais/novo">Novo profissional</Link>
          </Button>
        }
      />
      <FilterBar
        search={{
          value: query,
          onChange: setQuery,
          label: "Pesquisar profissionais",
          placeholder:
            "Nome, identificador profissional, matrícula funcional ou identificador externo",
        }}
        filters={filters}
        values={values}
        onValueChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
        onClear={() => {
          setValues(initialValues);
          setQuery("");
        }}
        advancedDescription="Filtros conceituais demonstrativos; nenhuma enumeração jurídica ou administrativa é definitiva."
        summary={
          <>
            <strong className="font-semibold text-foreground">{rows.length}</strong> profissionais
            fictícios{selected.length ? ` · ${selected.length} selecionados` : ""}
          </>
        }
        note="Dados fictícios, não oficiais"
        advancedExtra={
          <div className="space-y-2">
            <Label htmlFor="professional-state">Estado demonstrativo da consulta</Label>
            <Select
              value={viewState}
              onValueChange={(value) => setViewState(value as DataGridState)}
            >
              <SelectTrigger id="professional-state">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ready">Pronto</SelectItem>
                <SelectItem value="loading">Carregando</SelectItem>
                <SelectItem value="empty">Sem registros</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
                <SelectItem value="permission">Permissão negada</SelectItem>
                <SelectItem value="stale">Dados desatualizados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
      <p className="text-xs text-muted-foreground" role="note">
        {PROFESSIONAL_DATA_MINIMIZATION_NOTE}
      </p>
      <DataGrid
        label="Consulta de profissionais fictícios"
        rows={viewState === "empty" ? [] : rows}
        columns={columns}
        getRowId={(item) => item.id}
        state={viewState}
        selection={{
          selectedIds: selected,
          onSelectionChange: setSelected,
          rowLabel: (item) => `Selecionar ${item.personName}`,
          allLabel: "Selecionar todos os profissionais visíveis",
        }}
        sort={{
          columnId: "professional",
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
                aria-label={`Ações de ${item.personName}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/profissionais/$id" params={{ id: item.id }}>
                  Abrir visão geral
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/profissionais/editar/$id" params={{ id: item.id }}>
                  Editar cadastro
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        onRetry={() => setViewState("ready")}
        staleNotice="Esta visualização pode estar desatualizada. Atualize antes de tomar decisões."
        emptyTitle="Nenhum profissional encontrado"
        emptyDescription="Ajuste a pesquisa ou remova filtros para visualizar os exemplos fictícios."
        errorTitle="Não foi possível carregar os profissionais"
        permissionTitle="Consulta funcional não permitida"
        permissionDescription="A futura autorização considerará papel institucional, escopo, finalidade e temporalidade."
        footerSummary={`${rows.length} de ${demonstrationProfessionals.length} profissionais fictícios`}
        pagination={{ page: 1, pageCount: 1, total: demonstrationProfessionals.length }}
      />
    </div>
  );
}

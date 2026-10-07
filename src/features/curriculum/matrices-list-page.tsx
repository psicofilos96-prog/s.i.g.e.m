import { useMemo, useState } from "react";
import { formatAcademicDate } from "@/lib/academic-date";
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
  curriculumMatrices,
  DEMO_MATRIX_SEGMENTS,
  DEMO_MATRIX_SITUATIONS,
  matrixSituationTone,
  type CurriculumMatrix,
} from "@/features/curriculum/curriculum-data";
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
 * Tela consumidora: declara filtros e colunas. DataGrid e FilterBar continuam
 * genéricos. Os valores abaixo são demonstrativos e não constituem enumeração
 * oficial nem fluxo de aprovação normativa.
 */
const matrixFilters: FilterDefinition[] = [
  {
    id: "segment",
    label: "Segmento / organização",
    allLabel: "Todos os segmentos",
    options: DEMO_MATRIX_SEGMENTS.map((value) => ({ value, label: value })),
    triggerClassName: "h-9 sm:w-72",
  },
  {
    id: "situation",
    label: "Situação",
    allLabel: "Vigentes e históricas",
    options: DEMO_MATRIX_SITUATIONS.map((value) => ({ value, label: value })),
    triggerClassName: "h-9 sm:w-48",
  },
  {
    id: "version",
    label: "Versão",
    allLabel: "Todas as versões",
    options: [
      { value: "current", label: "Apenas versão mais recente" },
      { value: "previous", label: "Apenas versões anteriores" },
    ],
    advanced: true,
  },
];

const initialValues: FilterValues = {
  segment: FILTER_ALL,
  situation: FILTER_ALL,
  version: FILTER_ALL,
};

function matrixHaystack(matrix: CurriculumMatrix) {
  return [
    matrix.name,
    matrix.code,
    matrix.segment,
    matrix.organization,
    matrix.version,
    matrix.normativeReference,
  ]
    .join(" ")
    .toLocaleLowerCase("pt-BR");
}

export function MatricesListPage() {
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<FilterValues>(initialValues);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<string[]>([]);
  const [viewState, setViewState] = useState<DataGridState>("ready");

  const rows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return curriculumMatrices
      .filter((matrix) => !term || matrixHaystack(matrix).includes(term))
      .filter((matrix) => values["segment"] === FILTER_ALL || matrix.segment === values["segment"])
      .filter(
        (matrix) => values["situation"] === FILTER_ALL || matrix.situation === values["situation"],
      )
      .filter((matrix) => {
        if (values["version"] === FILTER_ALL) return true;
        if (values["version"] === "current") return !matrix.nextVersionId;
        return Boolean(matrix.nextVersionId);
      })
      .sort((a, b) => {
        const byName = a.name.localeCompare(b.name, "pt-BR");
        const value = byName !== 0 ? byName : b.versionOrder - a.versionOrder;
        return sortDirection === "asc" ? value : -value;
      });
  }, [query, sortDirection, values]);

  const columns: Array<DataGridColumn<CurriculumMatrix>> = [
    {
      id: "name",
      header: "Matriz curricular",
      width: "w-[30%]",
      sortable: true,
      cell: (matrix) => (
        <div className="min-w-0">
          <Link
            to="/matrizes-curriculares/$id"
            params={{ id: matrix.id }}
            className="block truncate font-semibold text-foreground hover:text-primary hover:underline"
            title={matrix.name}
          >
            {matrix.name}
          </Link>
          <p className="truncate font-mono text-xs text-tabular text-muted-foreground">
            {matrix.code}
          </p>
        </div>
      ),
    },
    {
      id: "segment",
      header: "Segmento / organização",
      width: "w-[22%]",
      priority: "secondary",
      className: "text-muted-foreground",
      cell: (matrix) => (
        <div className="min-w-0">
          <p className="truncate text-foreground" title={matrix.segment}>
            {matrix.segment}
          </p>
          <p className="truncate text-xs" title={matrix.organization}>
            {matrix.organization}
          </p>
        </div>
      ),
    },
    {
      id: "version",
      header: "Versão",
      width: "w-[10%]",
      className: "whitespace-nowrap font-mono text-xs text-tabular text-muted-foreground",
      cell: (matrix) => matrix.version,
    },
    {
      id: "validity",
      header: "Vigência",
      width: "w-[16%]",
      className: "whitespace-nowrap font-mono text-xs text-tabular text-muted-foreground",
      cell: (matrix) =>
        `${formatAcademicDate(matrix.effectiveFrom)} — ${formatAcademicDate(matrix.effectiveUntil, "atual")}`,
    },
    {
      id: "situation",
      header: "Situação",
      width: "w-[11%]",
      cell: (matrix) => (
        <StatusBadge tone={matrixSituationTone(matrix.situation)}>{matrix.situation}</StatusBadge>
      ),
    },
    {
      id: "normative",
      header: "Documento de referência",
      width: "w-[15%]",
      priority: "tertiary",
      className: "truncate text-xs text-muted-foreground",
      cell: (matrix) => matrix.normativeReference,
    },
  ];

  return (
    <div className="space-y-4 pb-4">
      <OperationalPageHeader
        title="Matrizes curriculares"
        description="Consulte matrizes versionadas, sua organização acadêmica e a vigência de cada versão."
        actions={
          <Button asChild size="sm">
            <Link to="/matrizes-curriculares/nova">
              <Plus /> Nova matriz
            </Link>
          </Button>
        }
      />

      <FilterBar
        search={{
          value: query,
          onChange: setQuery,
          label: "Pesquisar matrizes curriculares",
          placeholder: "Nome, código, segmento, organização ou documento de referência",
        }}
        filters={matrixFilters}
        values={values}
        onValueChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
        onClear={() => {
          setValues(initialValues);
          setQuery("");
        }}
        advancedDescription="Filtros demonstrativos; nenhuma lista oficial de segmentos ou situações foi definida."
        advancedExtra={
          <div className="space-y-2">
            <Label htmlFor="matrix-view-state">Estado da interface</Label>
            <Select
              value={viewState}
              onValueChange={(value) => setViewState(value as DataGridState)}
            >
              <SelectTrigger id="matrix-view-state" aria-label="Estado da interface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ready">Dados disponíveis</SelectItem>
                <SelectItem value="loading">Carregamento</SelectItem>
                <SelectItem value="empty">Nenhum resultado.</SelectItem>
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
            <strong className="font-semibold text-foreground">{rows.length}</strong> matrizes
            demonstrativas {selected.length ? `· ${selected.length} selecionadas` : ""}
          </>
        }
        note="Dados demonstrativos, não oficiais"
      />

      <DataGrid
        label="Consulta demonstrativa de matrizes curriculares"
        rows={rows}
        columns={columns}
        getRowId={(matrix) => matrix.id}
        state={viewState}
        onRetry={() => setViewState("ready")}
        selection={{
          selectedIds: selected,
          onSelectionChange: setSelected,
          rowLabel: (matrix) => `Selecionar ${matrix.name} (${matrix.version})`,
          allLabel: "Selecionar todas as matrizes visíveis",
        }}
        sort={{
          columnId: "name",
          direction: sortDirection,
          onSortChange: (_columnId, direction) => setSortDirection(direction),
        }}
        rowActions={(matrix) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Ações de ${matrix.name} ${matrix.version}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/matrizes-curriculares/$id" params={{ id: matrix.id }}>
                  Abrir matriz
                </Link>
              </DropdownMenuItem>
              {matrix.situation === "Rascunho" ? (
                <DropdownMenuItem asChild>
                  <Link to="/matrizes-curriculares/rascunho/$id" params={{ id: matrix.id }}>
                    Editar rascunho
                  </Link>
                </DropdownMenuItem>
              ) : matrix.situation === "Histórica" ? (
                <DropdownMenuItem disabled>Somente consulta (versão histórica)</DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild>
                  <Link to="/matrizes-curriculares/nova-versao/$id" params={{ id: matrix.id }}>
                    Nova versão
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link to="/matrizes-curriculares/impressao/$id" params={{ id: matrix.id }}>
                  Preparar impressão
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        emptyTitle="Nenhuma matriz encontrada"
        emptyDescription="Ajuste a pesquisa ou remova filtros para visualizar os exemplos demonstrativos."
        errorDescription="O estado demonstra como uma falha de consulta será apresentada. Nenhuma fonte externa está conectada."
        permissionDescription="Este estado demonstra uma futura restrição de acesso. Nenhuma permissão real foi definida."
        staleNotice={
          <>
            <strong>Dados desatualizados.</strong> Visualização demonstrativa da última consulta
            disponível.
          </>
        }
        footerSummary={`${rows.length} de ${curriculumMatrices.length} matrizes demonstrativas`}
        pagination={{ page: 1, pageCount: 1, total: curriculumMatrices.length }}
      />
    </div>
  );
}

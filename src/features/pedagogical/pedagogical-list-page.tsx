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
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
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
import { FileQuestion } from "lucide-react";
import {
  PEDAGOGICAL_CLASSES,
  PEDAGOGICAL_DATA_MINIMIZATION_NOTE,
  PEDAGOGICAL_FIELDS,
  PEDAGOGICAL_PERIODS,
  PEDAGOGICAL_PERIOD_NOTE,
  PEDAGOGICAL_ROLES,
  PEDAGOGICAL_UNITS,
  demonstrationPedagogicalAssignments,
  pedagogicalContext,
  pedagogicalFieldLabel,
  pedagogicalSituationLabel,
  pedagogicalValidityLabel,
  type PedagogicalAssignmentRecord,
} from "./pedagogical-data";

const filters: FilterDefinition[] = [
  {
    id: "situation",
    label: "Situação temporal",
    allLabel: "Atuais e históricas",
    options: [
      { value: "Atual", label: "Atual" },
      { value: "Histórico", label: "Histórico" },
    ],
    triggerClassName: "h-9 sm:w-48",
  },
  {
    id: "unit",
    label: "Unidade",
    allLabel: "Todas as unidades",
    options: PEDAGOGICAL_UNITS.map((value) => ({ value, label: value })),
    triggerClassName: "h-9 sm:w-64",
  },
  {
    id: "period",
    label: "Período letivo",
    allLabel: "Todos os períodos letivos",
    options: PEDAGOGICAL_PERIODS.map((value) => ({ value, label: value })),
    advanced: true,
  },
  {
    id: "class",
    label: "Turma",
    allLabel: "Todas as turmas",
    options: PEDAGOGICAL_CLASSES,
    advanced: true,
  },
  {
    id: "field",
    label: "Componente ou campo",
    allLabel: "Todos os recortes pedagógicos",
    options: PEDAGOGICAL_FIELDS.map((value) => ({ value, label: value })),
    advanced: true,
  },
  {
    id: "role",
    label: "Papel na atuação",
    allLabel: "Todos os papéis",
    options: PEDAGOGICAL_ROLES.map((value) => ({ value, label: value })),
    advanced: true,
  },
];

const initialValues: FilterValues = {
  situation: FILTER_ALL,
  unit: FILTER_ALL,
  period: FILTER_ALL,
  class: FILTER_ALL,
  field: FILTER_ALL,
  role: FILTER_ALL,
};

type ViewState = DataGridState | "not-found";

function haystack(record: PedagogicalAssignmentRecord) {
  const { professional, link, klass, unitName, periodLabel } = pedagogicalContext(record);
  return [
    professional?.personName ?? "",
    professional?.professionalId ?? "",
    link?.functionalIdentifier ?? "",
    klass?.name ?? "",
    klass?.code ?? "",
    unitName,
    periodLabel,
    record.field ?? "",
    record.role,
  ]
    .join(" ")
    .toLocaleLowerCase("pt-BR");
}

export function PedagogicalListPage() {
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<FilterValues>(initialValues);
  const [viewState, setViewState] = useState<ViewState>("ready");
  const [selected, setSelected] = useState<string[]>([]);

  const rows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return demonstrationPedagogicalAssignments
      .filter((record) => !term || haystack(record).includes(term))
      .filter(
        (record) => values["situation"] === FILTER_ALL || record.status === values["situation"],
      )
      .filter(
        (record) =>
          values["unit"] === FILTER_ALL || pedagogicalContext(record).unitName === values["unit"],
      )
      .filter(
        (record) =>
          values["period"] === FILTER_ALL ||
          pedagogicalContext(record).periodLabel === values["period"],
      )
      .filter((record) => values["class"] === FILTER_ALL || record.classId === values["class"])
      .filter((record) => values["field"] === FILTER_ALL || record.fieldKind === values["field"])
      .filter((record) => values["role"] === FILTER_ALL || record.role === values["role"]);
  }, [query, values]);

  const columns: Array<DataGridColumn<PedagogicalAssignmentRecord>> = [
    {
      id: "professional",
      header: "Profissional",
      width: "w-[18%]",
      cell: (record) => {
        const { professional } = pedagogicalContext(record);
        return (
          <div className="min-w-0">
            <Link
              to="/profissionais/$id/atuacoes"
              params={{ id: record.professionalId }}
              className="block truncate font-semibold text-foreground hover:text-primary hover:underline"
            >
              {professional?.personName ?? "Profissional não identificado"}
            </Link>
            <p className="truncate font-mono text-xs text-tabular text-muted-foreground">
              {professional?.professionalId ?? record.professionalId}
            </p>
          </div>
        );
      },
    },
    {
      id: "link",
      header: "Vínculo contextual",
      width: "w-[14%]",
      cell: (record) => {
        const { link } = pedagogicalContext(record);
        return (
          <div className="min-w-0 text-xs">
            <p className="truncate text-foreground">
              {link?.functionalIdentifier ?? "Vínculo não identificado"}
            </p>
            <p className="truncate text-muted-foreground">{link?.cargo ?? "Cargo contextual"}</p>
          </div>
        );
      },
    },
    {
      id: "unit",
      header: "Unidade",
      width: "w-[15%]",
      priority: "secondary",
      cell: (record) => (
        <span className="text-xs text-muted-foreground">{pedagogicalContext(record).unitName}</span>
      ),
    },
    {
      id: "period",
      header: "Período letivo",
      width: "w-[12%]",
      priority: "secondary",
      cell: (record) => (
        <span className="text-xs text-muted-foreground">
          {pedagogicalContext(record).periodLabel}
        </span>
      ),
    },
    {
      id: "class",
      header: "Turma / contexto pedagógico",
      width: "w-[15%]",
      cell: (record) => {
        const { klass } = pedagogicalContext(record);
        return klass ? (
          <Link
            to="/turmas/$id"
            params={{ id: klass.id }}
            className="block truncate text-xs text-primary hover:underline"
          >
            {klass.name}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">Turma não identificada</span>
        );
      },
    },
    {
      id: "field",
      header: "Componente ou campo",
      width: "w-[14%]",
      priority: "tertiary",
      cell: (record) => (
        <span className="text-xs text-muted-foreground">{pedagogicalFieldLabel(record)}</span>
      ),
    },
    {
      id: "role",
      header: "Papel na atuação",
      width: "w-[12%]",
      priority: "secondary",
      cell: (record) => <span className="text-xs">{record.role}</span>,
    },
    {
      id: "validity",
      header: "Vigência",
      width: "w-[12%]",
      priority: "tertiary",
      cell: (record) => (
        <span className="font-mono text-xs text-tabular text-muted-foreground">
          {pedagogicalValidityLabel(record)}
        </span>
      ),
    },
    {
      id: "situation",
      header: "Situação temporal",
      width: "w-[11%]",
      cell: (record) => (
        <StatusBadge tone={record.status === "Atual" ? "success" : "neutral"}>
          {pedagogicalSituationLabel(record)}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-4 pb-4">
      <OperationalPageHeader
        title="Atuações pedagógicas"
        description="Consulta demonstrativa da relação entre profissional, vínculo funcional e contexto acadêmico. Cargo, Lotação, Função e Atuação Pedagógica são conceitos distintos."
      />
      <FilterBar
        search={{
          value: query,
          onChange: setQuery,
          label: "Pesquisar atuações pedagógicas",
          placeholder: "Profissional, matrícula funcional, turma, unidade ou componente",
        }}
        filters={filters}
        values={values}
        onValueChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
        onClear={() => {
          setValues(initialValues);
          setQuery("");
        }}
        advancedDescription="Filtros conceituais demonstrativos; nenhuma enumeração normativa é definitiva."
        summary={
          <>
            <strong className="font-semibold text-foreground">{rows.length}</strong> atuações
            fictícias{selected.length ? ` · ${selected.length} selecionadas` : ""}
          </>
        }
        note="Dados fictícios, não oficiais"
        advancedExtra={
          <div className="space-y-2">
            <Label htmlFor="pedagogical-state">Estado demonstrativo da consulta</Label>
            <Select value={viewState} onValueChange={(value) => setViewState(value as ViewState)}>
              <SelectTrigger id="pedagogical-state">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ready">Pronto</SelectItem>
                <SelectItem value="loading">Carregando</SelectItem>
                <SelectItem value="empty">Sem registros</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
                <SelectItem value="not-found">Registro não encontrado</SelectItem>
                <SelectItem value="permission">Permissão negada</SelectItem>
                <SelectItem value="stale">Dados desatualizados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
      <p className="text-xs text-muted-foreground" role="note">
        {PEDAGOGICAL_DATA_MINIMIZATION_NOTE}
      </p>
      <p className="text-xs text-muted-foreground" role="note">
        {PEDAGOGICAL_PERIOD_NOTE}
      </p>
      {viewState === "not-found" ? (
        <div className="surface-panel">
          <EmptyState
            icon={FileQuestion}
            title="Atuação pedagógica não encontrada"
            description="O identificador consultado não corresponde às atuações fictícias disponíveis."
            action={
              <Button variant="outline" onClick={() => setViewState("ready")}>
                Voltar à consulta
              </Button>
            }
          />
        </div>
      ) : (
        <DataGrid
          label="Consulta de atuações pedagógicas fictícias"
          rows={viewState === "empty" ? [] : rows}
          columns={columns}
          getRowId={(record) => record.id}
          state={viewState}
          minWidthClassName="min-w-[1180px]"
          selection={{
            selectedIds: selected,
            onSelectionChange: setSelected,
            rowLabel: (record) => `Selecionar atuação ${record.id}`,
            allLabel: "Selecionar todas as atuações visíveis",
          }}
          rowActions={(record) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Ações da atuação ${record.id}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link
                    to="/profissionais/$id/atuacoes/$atuacaoId"
                    params={{ id: record.professionalId, atuacaoId: record.id }}
                  >
                    Abrir detalhe da atuação
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/profissionais/$id/atuacoes" params={{ id: record.professionalId }}>
                    Atuações do profissional
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/turmas/$id" params={{ id: record.classId }}>
                    Abrir turma
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          onRetry={() => setViewState("ready")}
          staleNotice="Esta visualização pode estar desatualizada. Atualize antes de tomar decisões."
          emptyTitle="Nenhuma atuação pedagógica encontrada"
          emptyDescription="Ajuste a pesquisa ou remova filtros para visualizar os exemplos fictícios."
          errorTitle="Não foi possível carregar as atuações pedagógicas"
          permissionTitle="Consulta de atuação não permitida"
          permissionDescription="A futura autorização considerará profissional, vínculo, atuação, turma, componente ou campo, papel, vigência e capacidade específica."
          footerSummary={`${rows.length} de ${demonstrationPedagogicalAssignments.length} atuações fictícias`}
          pagination={{
            page: 1,
            pageCount: 1,
            total: demonstrationPedagogicalAssignments.length,
          }}
        />
      )}
    </div>
  );
}

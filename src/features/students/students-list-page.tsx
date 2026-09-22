import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MoreHorizontal, UserPlus } from "lucide-react";
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
  DATA_MINIMIZATION_NOTE,
  DEMO_PARTICIPATION_NATURES,
  DEMO_STUDENT_ORGANIZATIONS,
  DEMO_STUDENT_PERIODS,
  DEMO_STUDENT_SITUATIONS,
  DEMO_STUDENT_UNITS,
  allAcademicLinks,
  currentAcademicLink,
  demonstrationStudents,
  getStudentUnitName,
  studentSituationTone,
  type DemonstrationStudent,
} from "@/features/students/students-data";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Filtros conceituais demonstrativos; nenhuma lista aqui é oficial. */
const studentFilters: FilterDefinition[] = [
  {
    id: "situation",
    label: "Situação contextual",
    allLabel: "Todas as situações",
    options: DEMO_STUDENT_SITUATIONS.map((value) => ({ value, label: value })),
    triggerClassName: "h-9 sm:w-56",
  },
  {
    id: "unitId",
    label: "Unidade de vínculo",
    allLabel: "Todas as unidades",
    options: DEMO_STUDENT_UNITS,
    triggerClassName: "h-9 sm:w-64",
  },
  {
    id: "periodLabel",
    label: "Período letivo",
    allLabel: "Todos os períodos letivos",
    options: DEMO_STUDENT_PERIODS.map((value) => ({ value, label: value })),
    advanced: true,
  },
  {
    id: "organization",
    label: "Organização acadêmica",
    allLabel: "Todas as organizações",
    options: DEMO_STUDENT_ORGANIZATIONS.map((value) => ({ value, label: value })),
    advanced: true,
  },
  {
    id: "participationNature",
    label: "Natureza da participação",
    allLabel: "Todas as participações",
    options: DEMO_PARTICIPATION_NATURES.map((value) => ({ value, label: value })),
    advanced: true,
  },
];

const initialValues: FilterValues = {
  situation: FILTER_ALL,
  unitId: FILTER_ALL,
  periodLabel: FILTER_ALL,
  organization: FILTER_ALL,
  participationNature: FILTER_ALL,
};

/**
 * Pesquisa por múltiplos identificadores demonstrativos. Nunca por CPF ou
 * qualquer documento pessoal.
 */
function studentSearchHaystack(item: DemonstrationStudent) {
  return [
    item.personName,
    item.sigemId,
    item.externalId ?? "",
    ...item.enrollments.map((enrollment) => enrollment.number),
    getStudentUnitName(item.currentUnitId),
    item.currentClassLabel ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase("pt-BR");
}

export function StudentsListPage() {
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<FilterValues>(initialValues);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<string[]>([]);
  const [viewState] = useState<DataGridState>("ready");

  const rows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return demonstrationStudents
      .filter((item) => !term || studentSearchHaystack(item).includes(term))
      .filter(
        (item) =>
          values["situation"] === FILTER_ALL || item.currentSituation === values["situation"],
      )
      .filter(
        (item) =>
          values["unitId"] === FILTER_ALL ||
          item.enrollments.some((enrollment) => enrollment.unitId === values["unitId"]),
      )
      .filter(
        (item) =>
          values["periodLabel"] === FILTER_ALL ||
          allAcademicLinks(item).some(({ link }) => link.periodLabel === values["periodLabel"]),
      )
      .filter(
        (item) =>
          values["organization"] === FILTER_ALL ||
          allAcademicLinks(item).some(
            ({ link }) => link.academicOrganization === values["organization"],
          ),
      )
      .filter(
        (item) =>
          values["participationNature"] === FILTER_ALL ||
          allAcademicLinks(item).some(({ link }) =>
            link.participations.some(
              (participation) => participation.nature === values["participationNature"],
            ),
          ),
      )
      .sort((a, b) =>
        sortDirection === "asc"
          ? a.personName.localeCompare(b.personName, "pt-BR")
          : b.personName.localeCompare(a.personName, "pt-BR"),
      );
  }, [query, sortDirection, values]);

  const columns: Array<DataGridColumn<DemonstrationStudent>> = [
    {
      id: "student",
      header: "Aluno",
      width: "w-[26%]",
      sortable: true,
      cell: (item) => (
        <div className="min-w-0">
          <Link
            to="/alunos/$id"
            params={{ id: item.id }}
            className="block truncate font-semibold text-foreground hover:text-primary hover:underline"
            title={item.personName}
          >
            {item.personName}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            Pessoa fictícia · papel de aluno no SIGEM
          </p>
        </div>
      ),
    },
    {
      id: "sigemId",
      header: "Identificador SIGEM",
      width: "w-[15%]",
      cell: (item) => (
        <span className="font-mono text-xs text-tabular text-foreground">{item.sigemId}</span>
      ),
    },
    {
      id: "link",
      header: "Vínculo escolar atual",
      width: "w-[21%]",
      className: "truncate text-muted-foreground",
      cell: (item) => {
        const link = currentAcademicLink(item);
        return (
          <div className="min-w-0 space-y-0.5 text-xs">
            <p className="truncate text-foreground">{getStudentUnitName(item.currentUnitId)}</p>
            <p className="truncate">
              {link ? link.periodLabel : "Sem vínculo letivo em andamento"}
            </p>
          </div>
        );
      },
    },
    {
      id: "organization",
      header: "Etapa / organização atual",
      width: "w-[18%]",
      priority: "secondary",
      className: "truncate text-muted-foreground",
      cell: (item) => item.currentOrganization ?? "Não aplicável no momento",
    },
    {
      id: "currentClass",
      header: "Turma atual",
      width: "w-[12%]",
      priority: "secondary",
      cell: (item) =>
        item.currentClassId ? (
          <Link
            to="/turmas/$id"
            params={{ id: item.currentClassId }}
            className="block truncate text-xs text-primary hover:underline"
            title={item.currentClassLabel ?? undefined}
          >
            {item.currentClassLabel}
          </Link>
        ) : (
          <span className="block truncate text-xs text-muted-foreground">
            {item.currentClassLabel ?? "Sem alocação"}
          </span>
        ),
    },
    {
      id: "situation",
      header: "Situação contextual",
      width: "w-[14%]",
      cell: (item) => (
        <StatusBadge tone={studentSituationTone(item.currentSituation)}>
          {item.currentSituation}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-4 pb-4">
      <OperationalPageHeader
        title="Alunos"
        description="Localize o aluno por nome ou identificadores demonstrativos e consulte sua trajetória escolar. Pessoa e aluno são conceitos distintos: a pessoa é a identidade humana, o aluno é o papel educacional dessa pessoa no SIGEM."
        actions={
          <Button asChild size="sm">
            <Link to="/alunos/novo">
              <UserPlus /> Novo aluno
            </Link>
          </Button>
        }
      />

      <FilterBar
        search={{
          value: query,
          onChange: setQuery,
          label: "Pesquisar alunos",
          placeholder: "Nome, identificador SIGEM, matrícula escolar ou identificador externo",
        }}
        filters={studentFilters}
        values={values}
        onValueChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
        onClear={() => {
          setValues(initialValues);
          setQuery("");
        }}
        advancedDescription="Filtros conceituais demonstrativos; nenhuma enumeração aqui é definitiva."
        summary={
          <>
            <strong className="font-semibold text-foreground">{rows.length}</strong> alunos
            fictícios
            {selected.length ? ` · ${selected.length} selecionados` : ""}
          </>
        }
        note="Dados fictícios, não oficiais"
      />

      <p className="text-xs text-muted-foreground" role="note">
        {DATA_MINIMIZATION_NOTE}
      </p>

      <DataGrid
        label="Consulta de alunos fictícios"
        rows={rows}
        columns={columns}
        getRowId={(item) => item.id}
        state={viewState}
        selection={{
          selectedIds: selected,
          onSelectionChange: setSelected,
          rowLabel: (item) => `Selecionar ${item.personName}`,
          allLabel: "Selecionar todos os alunos visíveis",
        }}
        sort={{
          columnId: "student",
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
                <Link to="/alunos/$id" params={{ id: item.id }}>
                  Abrir visão geral
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/alunos/editar/$id" params={{ id: item.id }}>
                  Editar cadastro
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>Matrícula escolar (etapa futura)</DropdownMenuItem>
              <DropdownMenuItem disabled>Enturmação (etapa futura)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        emptyTitle="Nenhum aluno encontrado"
        emptyDescription="Ajuste a pesquisa ou remova filtros para visualizar os exemplos fictícios."
        footerSummary={`${rows.length} de ${demonstrationStudents.length} alunos fictícios`}
        pagination={{ page: 1, pageCount: 1, total: demonstrationStudents.length }}
      />
    </div>
  );
}

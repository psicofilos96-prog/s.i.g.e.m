import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { DataGrid, type DataGridColumn } from "@/components/sigem/data-grid";
import { FILTER_ALL, FilterBar, type FilterValues } from "@/components/sigem/filter-bar";
import { OperationalPageHeader } from "@/components/sigem/operational";
import { StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { DEMO_ACADEMIC_PERIODS, DEMO_CLASS_UNITS } from "@/features/classes/classes-data";
import { scheduleClassRows, scheduleSituationTone, scheduleStateTone } from "./schedules-data";

type Row = NonNullable<(typeof scheduleClassRows)[number]>;
const initial: FilterValues = { unitId: FILTER_ALL, period: FILTER_ALL, state: FILTER_ALL };
export function ClassSchedulesPage() {
  const [query, setQuery] = useState("");
  const [values, setValues] = useState(initial);
  const rows = useMemo(
    () =>
      scheduleClassRows
        .filter((row): row is Row => Boolean(row))
        .filter(
          (row) =>
            !query ||
            `${row.klass.name} ${row.klass.code} ${row.unitName}`
              .toLocaleLowerCase("pt-BR")
              .includes(query.toLocaleLowerCase("pt-BR")),
        )
        .filter((row) => values["unitId"] === FILTER_ALL || row.klass.unitId === values["unitId"])
        .filter(
          (row) =>
            values["period"] === FILTER_ALL || row.klass.academicPeriod.label === values["period"],
        )
        .filter(
          (row) =>
            values["state"] === FILTER_ALL ||
            (row.schedule?.state ?? "Não iniciada") === values["state"],
        ),
    [query, values],
  );
  const columns: Array<DataGridColumn<Row>> = [
    {
      id: "class",
      header: "Turma",
      width: "w-[24%]",
      cell: (row) => (
        <div>
          <Link
            to="/horarios/turmas/$turmaId"
            params={{ turmaId: row.klass.id }}
            className="font-semibold hover:text-primary hover:underline"
          >
            {row.klass.name}
          </Link>
          <p className="font-mono text-xs text-muted-foreground">{row.klass.code}</p>
        </div>
      ),
    },
    {
      id: "unit",
      header: "Unidade",
      width: "w-[20%]",
      cell: (row) => (
        <Link
          to="/horarios/unidades/$unidadeId"
          params={{ unidadeId: row.klass.unitId }}
          className="text-xs hover:text-primary hover:underline"
        >
          {row.unitName}
        </Link>
      ),
    },
    {
      id: "period",
      header: "Período letivo",
      width: "w-[14%]",
      cell: (row) => row.klass.academicPeriod.label,
    },
    {
      id: "journey",
      header: "Turno e jornada",
      width: "w-[18%]",
      priority: "secondary",
      cell: (row) => (
        <div className="text-xs">
          <p>{row.klass.shift}</p>
          <p className="text-muted-foreground">
            {row.journey ? `${row.journey.days.length} dias declarados` : "Sem detalhamento"}
          </p>
        </div>
      ),
    },
    {
      id: "state",
      header: "Grade",
      width: "w-[14%]",
      cell: (row) => (
        <StatusBadge tone={scheduleStateTone(row.schedule?.state ?? "Não iniciada")}>
          {row.schedule?.state ?? "Não iniciada"}
        </StatusBadge>
      ),
    },
    {
      id: "situation",
      header: "Situação",
      width: "w-[18%]",
      priority: "secondary",
      cell: (row) => (
        <StatusBadge tone={scheduleSituationTone(row.situation)}>{row.situation}</StatusBadge>
      ),
    },
  ];
  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title="Grades semanais de turmas"
        description="Jornadas e distribuições semanais preservam etapa, modalidade, agrupamentos e período letivo."
        parent={{ label: "Horários", to: "/horarios" }}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/horarios">Visão geral</Link>
          </Button>
        }
      />
      <FilterBar
        search={{
          value: query,
          onChange: setQuery,
          label: "Pesquisar turmas e unidades",
          placeholder: "Turma, código ou unidade",
        }}
        filters={[
          {
            id: "unitId",
            label: "Unidade",
            allLabel: "Todas as unidades",
            options: DEMO_CLASS_UNITS,
          },
          {
            id: "period",
            label: "Período letivo",
            allLabel: "Todos os períodos",
            options: DEMO_ACADEMIC_PERIODS.map((value) => ({ value, label: value })),
          },
          {
            id: "state",
            label: "Estado da grade",
            allLabel: "Todos os estados",
            advanced: true,
            options: [
              "Não iniciada",
              "Em elaboração",
              "Pronta para revisão",
              "Publicada",
              "Histórica",
            ].map((value) => ({ value, label: value })),
          },
        ]}
        values={values}
        onValueChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
        onClear={() => {
          setQuery("");
          setValues(initial);
        }}
        summary={
          <>
            <strong className="text-foreground">{rows.length}</strong> turmas no recorte
          </>
        }
        note="Dados fictícios"
      />
      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(row) => row.klass.id}
        label="Consulta de grades semanais por turma"
        footerSummary={`${rows.length} registros demonstrativos`}
        rowActions={(row) => (
          <div className="flex items-center gap-1">
            <Button
              asChild
              size="icon"
              variant="ghost"
              aria-label={`Consultar horário de ${row.klass.name}`}
            >
              <Link to="/horarios/turmas/$turmaId" params={{ turmaId: row.klass.id }}>
                <Eye />
              </Link>
            </Button>
            <Button
              asChild
              size="icon"
              variant="ghost"
              aria-label={`Editar grade demonstrativa de ${row.klass.name}`}
            >
              <Link to="/horarios/turmas/$turmaId/editar" params={{ turmaId: row.klass.id }}>
                <PencilLine />
              </Link>
            </Button>
          </div>
        )}
      />
    </div>
  );
}

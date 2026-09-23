import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { OperationalPageHeader } from "@/components/sigem/operational";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { DataGrid } from "@/components/sigem/data-grid";
import { FILTER_ALL, FilterBar, type FilterValues } from "@/components/sigem/filter-bar";
import { Button } from "@/components/ui/button";
import { getClassUnitName, getDemonstrationClass } from "@/features/classes/classes-data";
import { ChangeKindBadge } from "./lifecycle-widgets";
import {
  CHANGE_KINDS,
  CHANGE_REQUEST_STATES,
  LIFECYCLE_PRIVACY_NOTE,
  LIFECYCLE_REVIEWER_NOTE,
  changeRequestStateTone,
  changeRequests,
  getVersionRecord,
  type ChangeRequest,
} from "./schedule-lifecycle";

/** Central de revisões e solicitações — /horarios/revisoes. */
export function ScheduleReviewsPage() {
  const [values, setValues] = useState<FilterValues>({});
  const [search, setSearch] = useState("");

  const units = useMemo(
    () =>
      [...new Set(changeRequests.map((item) => item.unitId))].map((id) => ({
        value: id,
        label: getClassUnitName(id),
      })),
    [],
  );
  const periods = useMemo(
    () =>
      [...new Set(changeRequests.map((item) => item.periodLabel))].map((label) => ({
        value: label,
        label,
      })),
    [],
  );

  const rows = changeRequests.filter((item) => {
    const unit = values["unidade"] ?? FILTER_ALL;
    const period = values["periodo"] ?? FILTER_ALL;
    const state = values["situacao"] ?? FILTER_ALL;
    const kind = values["tipo"] ?? FILTER_ALL;
    if (unit !== FILTER_ALL && item.unitId !== unit) return false;
    if (period !== FILTER_ALL && item.periodLabel !== period) return false;
    if (state !== FILTER_ALL && item.state !== state) return false;
    if (kind !== FILTER_ALL && item.kind !== kind) return false;
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      const klass = getDemonstrationClass(item.classId)?.name ?? "";
      if (!`${klass} ${item.id} ${item.justification}`.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5 pb-5">
      <OperationalPageHeader
        title="Central de revisões e alterações"
        description="Solicitações demonstrativas de revisão e de alteração de grades. Nenhuma aprovação administrativa real ocorre aqui."
        parent={{ label: "Horários escolares", to: "/horarios" }}
      />
      <FilterBar
        label="Filtros da central de revisões"
        search={{
          value: search,
          onChange: setSearch,
          label: "Pesquisar solicitações",
          placeholder: "Turma, identificador ou justificativa",
        }}
        filters={[
          { id: "unidade", label: "Unidade", allLabel: "Todas as unidades", options: units },
          {
            id: "periodo",
            label: "Período letivo",
            allLabel: "Todos os períodos",
            options: periods,
          },
          {
            id: "situacao",
            label: "Situação",
            allLabel: "Todas as situações",
            options: CHANGE_REQUEST_STATES.map((state) => ({ value: state, label: state })),
          },
          {
            id: "tipo",
            label: "Tipo de operação",
            allLabel: "Todos os tipos",
            options: CHANGE_KINDS.map((kind) => ({ value: kind, label: kind })),
            advanced: true,
          },
        ]}
        values={values}
        onValueChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
        onClear={() => setValues({})}
        summary={`${rows.length} de ${changeRequests.length} solicitações demonstrativas`}
        note={LIFECYCLE_PRIVACY_NOTE}
      />
      <DataGrid<ChangeRequest>
        label="Central de revisões e alterações de grades"
        rows={rows}
        getRowId={(row) => row.id}
        columns={[
          {
            id: "unidade",
            header: "Unidade",
            width: "w-[16%]",
            cell: (row) => <span className="text-xs">{getClassUnitName(row.unitId)}</span>,
          },
          {
            id: "turma",
            header: "Turma",
            width: "w-[16%]",
            cell: (row) => (
              <Link
                to="/horarios/turmas/$turmaId"
                params={{ turmaId: row.classId }}
                className="text-xs text-primary hover:underline"
              >
                {getDemonstrationClass(row.classId)?.name ?? row.classId}
              </Link>
            ),
          },
          {
            id: "periodo",
            header: "Período",
            width: "w-[11%]",
            priority: "secondary",
            cell: (row) => <span className="text-xs">{row.periodLabel}</span>,
          },
          {
            id: "versao",
            header: "Versão",
            width: "w-[10%]",
            cell: (row) => (
              <span className="text-xs">
                {getVersionRecord(row.originVersionId)?.version ?? row.originVersionId}
              </span>
            ),
          },
          {
            id: "tipo",
            header: "Tipo de solicitação",
            width: "w-[13%]",
            cell: (row) => <ChangeKindBadge kind={row.kind} />,
          },
          {
            id: "situacao",
            header: "Situação",
            width: "w-[13%]",
            cell: (row) => (
              <StatusBadge tone={changeRequestStateTone(row.state)}>{row.state}</StatusBadge>
            ),
          },
          {
            id: "data",
            header: "Data de referência",
            width: "w-[10%]",
            priority: "secondary",
            cell: (row) => <span className="font-mono text-xs">{row.referenceDate}</span>,
          },
          {
            id: "responsavel",
            header: "Responsável demonstrativo",
            width: "w-[14%]",
            priority: "tertiary",
            cell: (row) => <span className="text-xs">{row.author}</span>,
          },
          {
            id: "pendencias",
            header: "Pendências",
            width: "w-[14%]",
            priority: "tertiary",
            cell: (row) => (
              <span className="text-xs text-muted-foreground">
                {row.pendencies.length ? row.pendencies.join(" ") : "Nenhuma registrada"}
              </span>
            ),
          },
        ]}
        rowActions={(row) => (
          <div className="flex justify-end gap-1">
            <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
              <Link to="/horarios/turmas/$turmaId/revisar" params={{ turmaId: row.classId }}>
                Revisar
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
              <Link to="/horarios/turmas/$turmaId/alteracoes" params={{ turmaId: row.classId }}>
                Alterações
              </Link>
            </Button>
          </div>
        )}
        footerSummary={`${rows.length} solicitações demonstrativas listadas`}
        emptyTitle="Nenhuma solicitação demonstrativa"
        emptyDescription="Ajuste os filtros para ver outras solicitações fictícias."
      />
      <StatePanel tone="info" title="Quem revisa varia" description={LIFECYCLE_REVIEWER_NOTE} />
    </div>
  );
}

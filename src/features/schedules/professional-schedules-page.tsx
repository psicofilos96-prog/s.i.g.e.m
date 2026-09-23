import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { DataGrid, type DataGridColumn } from "@/components/sigem/data-grid";
import { FilterBar } from "@/components/sigem/filter-bar";
import { OperationalPageHeader } from "@/components/sigem/operational";
import { StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import {
  demonstrationProfessionals,
  currentLinks,
} from "@/features/professionals/professionals-data";
import { personProjection } from "./schedule-integration";
import { professionalScheduleSummary } from "./schedules-data";

type Row = (typeof demonstrationProfessionals)[number];
export function ProfessionalSchedulesPage() {
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () =>
      demonstrationProfessionals.filter(
        (item) =>
          !query ||
          `${item.personName} ${item.professionalId}`
            .toLocaleLowerCase("pt-BR")
            .includes(query.toLocaleLowerCase("pt-BR")),
      ),
    [query],
  );
  const columns: Array<DataGridColumn<Row>> = [
    {
      id: "professional",
      header: "Profissional",
      width: "w-[28%]",
      cell: (item) => (
        <div>
          <Link
            to="/horarios/profissionais/$profissionalId"
            params={{ profissionalId: item.id }}
            className="font-semibold hover:text-primary hover:underline"
          >
            {item.personName}
          </Link>
          <p className="font-mono text-xs text-muted-foreground">{item.professionalId}</p>
        </div>
      ),
    },
    {
      id: "links",
      header: "Vínculos atuais",
      width: "w-[15%]",
      cell: (item) => `${currentLinks(item).length} vínculo(s)`,
    },
    {
      id: "assignments",
      header: "Atuações pedagógicas",
      width: "w-[18%]",
      priority: "secondary",
      cell: (item) => `${professionalScheduleSummary(item.id).assignments.length} atuação(ões)`,
    },
    {
      id: "blocks",
      header: "Blocos planejados",
      width: "w-[18%]",
      cell: (item) => {
        const projection = personProjection(item.id);
        return `${projection.entries.length} bloco(s) · ${projection.linkIds.length || 0} vínculo(s) nos blocos`;
      },
    },
    {
      id: "conflicts",
      header: "Situação",
      width: "w-[20%]",
      cell: (item) => {
        const count = personProjection(item.id).conflicts.length;
        return (
          <StatusBadge tone={count ? "danger" : "neutral"}>
            {count ? `${count} conflito(s) potencial(is)` : "Sem conflito identificado"}
          </StatusBadge>
        );
      },
    },
  ];
  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title="Horários individuais de profissionais"
        description="Consulta derivada exclusivamente dos blocos e das atuações registradas, considerando múltiplos vínculos e unidades."
        parent={{ label: "Horários", to: "/horarios" }}
      />
      <FilterBar
        search={{
          value: query,
          onChange: setQuery,
          label: "Pesquisar profissionais",
          placeholder: "Nome ou Identificador SIGEM",
        }}
        filters={[]}
        values={{}}
        onValueChange={() => undefined}
        onClear={() => setQuery("")}
        summary={
          <>
            <strong className="text-foreground">{rows.length}</strong> profissionais
          </>
        }
        note="Conflitos apurados pela identidade da Pessoa; nenhuma carga horária foi convertida em grade"
      />
      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(item) => item.id}
        label="Consulta de horários individuais"
        footerSummary={`${rows.length} pessoas no papel Profissional`}
        rowActions={(item) => (
          <Button
            asChild
            size="icon"
            variant="ghost"
            aria-label={`Consultar horário de ${item.personName}`}
          >
            <Link to="/horarios/profissionais/$profissionalId" params={{ profissionalId: item.id }}>
              <Eye />
            </Link>
          </Button>
        )}
      />
    </div>
  );
}

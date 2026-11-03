import {
  runReport, toCsv, toPdfFile, toXlsx, downloadBlob,
  type ReportDefinition, type ReportResult,
} from "@/features/reports/report-engine";
import type { NetworkRow } from "./model";

// Usa somente as linhas do reader autorizado. Nunca consulta dados fora do escopo.
export const FOLLOWUP_NETWORK_REPORT: ReportDefinition = {
  id: "acompanhamento-institucional-unidades", version: 1,
  title: "Acompanhamento institucional — Unidades escolares",
  description: "Visitas e ações registradas, conforme as permissões do usuário.",
  source: "school_institutional_followup_network",
  params: [
    { id: "from", label: "Início", type: "date", required: true },
    { id: "to", label: "Fim", type: "date", required: true },
  ],
  columns: [
    { id: "school_name", label: "Unidade escolar", kind: "text" },
    { id: "visits", label: "Visitas no período", kind: "number" },
    { id: "actions", label: "Ações registradas", kind: "number" },
    { id: "completed", label: "Concluídas (declaradas)", kind: "number" },
    { id: "overdue", label: "Prazo vencido", kind: "number" },
    { id: "last_visit", label: "Última visita", kind: "date" },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 10000,
};
export function followupReport(rows: readonly NetworkRow[], from: string, to: string): ReportResult {
  return runReport(FOLLOWUP_NETWORK_REPORT, { params: { from, to } },
    rows.map((r) => ({
      school_name: r.school_name, visits: r.visits, actions: r.actions,
      completed: r.completed, overdue: r.overdue, last_visit: r.last_visit,
    })));
}
export async function exportFollowupNetwork(
  rows: readonly NetworkRow[], from: string, to: string, format: "csv" | "xlsx" | "pdf",
): Promise<void> {
  const result = followupReport(rows, from, to);
  const branding = {
    headerLines: ["Secretaria Municipal de Educação"],
    title: FOLLOWUP_NETWORK_REPORT.title,
  };
  const meta = [
    `Visitas de ${from} a ${to}`,
    "Ações: total vigente, independentemente da data da visita. Conclusão declarada pela equipe; não equivale à homologação do Gabinete.",
    `Unidades no filtro: ${rows.length}`,
  ];
  const base = `acompanhamento-unidades-${from}-${to}`;
  if (format === "csv") {
    downloadBlob(base + ".csv", new Blob([toCsv(result, branding, meta)], { type: "text/csv;charset=utf-8" }));
  } else if (format === "xlsx") {
    const bytes = await toXlsx(result, branding, meta);
    downloadBlob(base + ".xlsx", new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  } else {
    const pdf = await toPdfFile(result, branding, meta, { landscape: true });
    downloadBlob(base + ".pdf", pdf);
  }
}

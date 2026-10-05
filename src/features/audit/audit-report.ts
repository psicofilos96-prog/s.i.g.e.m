import type { ReportDefinition } from "@/features/reports/report-engine";
import { AUDIT_COLUMNS } from "./audit-model";

export const AUDIT_REPORT: ReportDefinition = {
  id: "trilha-de-auditoria", version: 1, title: "Trilha de auditoria",
  description: "Eventos dos registros históricos visíveis à conta, já minimizados.", source: "ledgers existentes via RLS",
  params: [], columns: AUDIT_COLUMNS.map((c) => ({ id: c, label: c, kind: "text" as const })),
  formats: ["csv"], reproducible: false, syncRowLimit: 5000,
};

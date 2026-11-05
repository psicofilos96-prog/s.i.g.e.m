import {
  runReport, toCsv, toPdfFile, toXlsx, downloadBlob,
  type ReportDefinition, type ReportResult,
} from "@/features/reports/report-engine";
import { UserFacingError } from "@/lib/observability/governed-errors";
import {
  currentSituation, currentUpdate, filterSchoolActions, followupVisitByLogicalId,
  type SchoolSnapshot,
} from "./model";

/** Roteiro de consulta, nunca uma visita registrada nem uma ordem de cobrança. */
export const FOLLOWUP_PREPARATION_REPORT: ReportDefinition = {
  id: "acompanhamento-institucional-preparacao-visita",
  version: 1,
  title: "Roteiro de preparação para visita escolar",
  description: "Medidas sem conclusão declarada na unidade autorizada, com última evolução disponível.",
  source: "school_institutional_followup_school",
  params: [
    { id: "school", label: "Unidade", type: "text", required: true, maxLength: 200 },
    { id: "prepared_on", label: "Consulta em", type: "date", required: true },
  ],
  columns: [
    { id: "description", label: "Medida a acompanhar", kind: "text" },
    { id: "origin", label: "Visita de origem", kind: "date" },
    { id: "responsible", label: "Responsável declarado", kind: "text" },
    { id: "deadline", label: "Prazo declarado", kind: "date" },
    { id: "situation", label: "Situação declarada", kind: "text" },
    { id: "last_update", label: "Última evolução efetiva", kind: "date" },
    { id: "last_notes", label: "Relato da última evolução", kind: "text" },
  ],
  formats: ["csv", "xlsx", "pdf"],
  reproducible: false,
  syncRowLimit: 2000,
};

function latestNotes(update: ReturnType<typeof currentUpdate>): string | null {
  if (!update) return null;
  const parts: string[] = [];
  if (update.done_text?.trim()) parts.push(`Realizado: ${update.done_text}`);
  if (update.not_done_text?.trim()) parts.push(`Não realizado: ${update.not_done_text}`);
  if (update.results?.trim()) parts.push(`Resultados: ${update.results}`);
  if (update.referrals?.trim()) parts.push(`Encaminhamentos: ${update.referrals}`);
  return parts.join(" | ") || null;
}

/** O próprio snapshot vem da RPC escolar autorizada; há filtro adicional por unidade. */
export function preparationFollowupReport(
  snapshot: SchoolSnapshot, schoolId: string, today: string,
  selectedIds?: readonly string[],
): ReportResult {
  const actions = filterSchoolActions(
    snapshot.actions.filter((a) => a.school_id === schoolId),
    snapshot.updates, "todas", "", today,
  ).filter((a) => currentSituation(a, snapshot.updates) !== "concluída");
  let included = actions;
  if (selectedIds !== undefined) {
    const selected = new Set(selectedIds);
    const current = new Set(actions.map((a) => a.id));
    if (selected.size === 0 || selected.size !== selectedIds.length ||
        [...selected].some((id) => !current.has(id))) {
      throw new UserFacingError(
        "A seleção do roteiro está vazia, desatualizada ou contém uma medida não autorizada. Confira as pendências da escola.",
      );
    }
    included = actions.filter((a) => selected.has(a.id));
  }
  return runReport(
    FOLLOWUP_PREPARATION_REPORT,
    { params: { school: schoolId, prepared_on: today } },
    included.map((a) => {
      const last = currentUpdate(a, snapshot.updates);
      return {
        description: a.description,
        origin: followupVisitByLogicalId(snapshot.visits, a.visit_logical_id)?.visit_date ?? null,
        responsible: a.responsible_label,
        deadline: a.due_on,
        situation: last?.situation ?? "sem atualização",
        last_update: last?.occurred_on ?? null,
        last_notes: latestNotes(last),
      };
    }),
  );
}

export async function exportFollowupPreparation(
  snapshot: SchoolSnapshot, schoolId: string, schoolName: string,
  inep: string | null, today: string, format: "csv" | "xlsx" | "pdf",
  selectedIds?: readonly string[],
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) return;
  const result = preparationFollowupReport(snapshot, schoolId, today, selectedIds);
  if (result.mode !== "sync") throw new UserFacingError("O roteiro excedeu o limite de exportação.");
  const branding = {
    headerLines: ["Secretaria Municipal de Educação", schoolName, inep ? `INEP: ${inep}` : "INEP não informado"],
    title: FOLLOWUP_PREPARATION_REPORT.title,
  };
  const meta = [
    selectedIds === undefined
      ? `Consulta em ${today}; ${result.rows.length} medida(s) sem conclusão declarada.`
      : `Roteiro de foco preparado em ${today}; ${result.rows.length} medida(s) selecionada(s).`,
    selectedIds === undefined
      ? "Roteiro integral da unidade: todas as medidas sem conclusão declarada."
      : "Roteiro de foco: somente as medidas selecionadas dentre as pendentes da unidade.",
    "Somente dados previamente autorizados da unidade; não inclui medidas declaradas concluídas.",
    "Sem atualização significa falta de registro, não ausência de execução. Prazo não informado não é vencido.",
    "Roteiro informativo: não é registro de nova visita, homologação ou cobrança. Registre a visita e as evoluções no SIGEM.",
  ];
  const safeId = schoolId.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 70);
  const base = `${selectedIds === undefined ? "preparacao-visita" : "preparacao-foco-visita"}-${safeId}-${today}`;
  if (signal?.aborted) return;
  if (format === "csv") {
    const csv = toCsv(result, branding, meta);
    if (signal?.aborted) return;
    downloadBlob(base + ".csv", new Blob([csv], { type: "text/csv;charset=utf-8" }));
  } else if (format === "xlsx") {
    const bytes = await toXlsx(result, branding, meta);
    if (signal?.aborted) return;
    downloadBlob(base + ".xlsx", new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  } else {
    const pdf = await toPdfFile(result, branding, meta, { landscape: true });
    if (signal?.aborted) return;
    downloadBlob(base + ".pdf", pdf);
  }
}

import {
  runReport, toCsv, toPdfFile, toXlsx, downloadBlob,
  type ReportDefinition, type ReportResult,
} from "@/features/reports/report-engine";
import { currentSituation, type NetworkRow, type SchoolSnapshot } from "./model";

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


/** Ficha cronológica de uma unidade, montada somente com o snapshot já autorizado pela RPC. */
export const FOLLOWUP_SCHOOL_REPORT: ReportDefinition = {
  id: "acompanhamento-institucional-ficha-escola", version: 1,
  title: "Ficha de acompanhamento da unidade escolar",
  description: "Histórico completo de visitas, medidas e evoluções da unidade autorizada.",
  source: "school_institutional_followup_school",
  params: [
    { id: "school", label: "Unidade", type: "text", required: true, maxLength: 200 },
  ],
  columns: [
    { id: "event_date", label: "Data do fato", kind: "date" },
    { id: "event_type", label: "Registro", kind: "text" },
    { id: "description", label: "Descrição e diagnóstico", kind: "text" },
    { id: "responsible", label: "Responsável declarado", kind: "text" },
    { id: "deadline", label: "Prazo", kind: "date" },
    { id: "situation", label: "Situação declarada", kind: "text" },
    { id: "author", label: "Autoria", kind: "text" },
    { id: "detail", label: "Resultados e encaminhamentos", kind: "text" },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 10000,
};

function joinDescriptions(...parts: [string, string | null | undefined][]): string | null {
  const text = parts.filter(([, value]) => Boolean(value?.trim()))
    .map(([label, value]) => `${label}: ${value}`).join(" | ");
  return text || null;
}

export function schoolFollowupReport(snapshot: SchoolSnapshot, schoolId: string): ReportResult {
  const rows: Record<string, string | number | null>[] = [];
  for (const v of [...snapshot.visits, ...snapshot.visit_history]) {
    rows.push({
      event_date: v.visit_date,
      event_type: snapshot.visit_history.some((old) => old.id === v.id)
        ? `Visita substituída (v${v.version})` : `Visita vigente (v${v.version})`,
      description: joinDescriptions(["Diagnóstico", v.diagnosis], ["Pontos fortes", v.strengths],
        ["Fragilidades", v.weaknesses]),
      responsible: null, deadline: null, situation: null,
      author: v.author_name,
      detail: joinDescriptions(["Observações", v.summary], ["Justificativa de retificação", v.correction_reason]),
    });
  }
  for (const a of snapshot.actions) {
    const visit = snapshot.visits.find((v) => v.logical_id === a.visit_logical_id);
    rows.push({
      event_date: a.created_at.slice(0, 10),
      event_type: "Medida proposta",
      description: a.description, responsible: a.responsible_label,
      deadline: a.due_on, situation: currentSituation(a, snapshot.updates),
      author: a.author_name,
      detail: visit ? `Vinculada à visita de ${visit.visit_date}` : null,
    });
  }
  for (const u of snapshot.updates) {
    const action = snapshot.actions.find((a) => a.id === u.action_id);
    rows.push({
      event_date: u.occurred_on, event_type: "Evolução de medida",
      description: joinDescriptions(["Medida", action?.description], ["Realizado", u.done_text],
        ["Não realizado", u.not_done_text]),
      responsible: action?.responsible_label ?? null,
      deadline: action?.due_on ?? null, situation: u.situation,
      author: u.author_name,
      detail: joinDescriptions(["Resultados", u.results], ["Encaminhamentos", u.referrals]),
    });
  }
  return runReport(FOLLOWUP_SCHOOL_REPORT, { params: { school: schoolId },
    sort: [{ column: "event_date", dir: "desc" }] }, rows);
}

export async function exportFollowupSchool(
  snapshot: SchoolSnapshot, schoolId: string, schoolName: string, format: "csv" | "xlsx" | "pdf",
): Promise<void> {
  const result = schoolFollowupReport(snapshot, schoolId);
  if (result.mode !== "sync") throw new Error("O relatório excedeu o limite de exportação.");
  const branding = {
    headerLines: ["Secretaria Municipal de Educação", schoolName],
    title: FOLLOWUP_SCHOOL_REPORT.title,
  };
  const meta = [
    "Registros da unidade autorizada, incluindo versões anteriores e atualizações cronológicas.",
    "Conclusão e execução são informações declaradas pela equipe, sem homologação do Gabinete.",
    "Dados provenientes da consulta institucional; não constituem cobrança administrativa.",
  ];
  const slug = schoolId.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 70);
  const base = `ficha-acompanhamento-${slug}`;
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

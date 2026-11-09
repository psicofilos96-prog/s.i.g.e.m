import {
  runReport, toCsv, toPdfFile, toXlsx, downloadBlob,
  type ReportDefinition, type ReportResult,
} from "@/features/reports/report-engine";
import { civilDateOf, formatDateTime } from "@/lib/academic-date";
import { UserFacingError } from "@/lib/observability/governed-errors";
import { currentSituation, type FollowupVisit, type NetworkPendingAction, type NetworkRow, type SchoolSnapshot } from "./model";
import { stripTextFormat } from "./text-format-model";
import type { FollowupAttachment } from "./source";
import { followupPdfSections, loadFollowupPdfAttachments } from "./report-content";

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
    { id: "inep", label: "INEP", kind: "text" },
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
      school_name: r.school_name, inep: r.inep ?? null, visits: r.visits, actions: r.actions,
      completed: r.completed, overdue: r.overdue, last_visit: r.last_visit,
    })));
}
export async function exportFollowupNetwork(
  rows: readonly NetworkRow[], from: string, to: string, format: "csv" | "xlsx" | "pdf",
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) return;
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
    if (signal?.aborted) return;
    downloadBlob(base + ".csv", new Blob([toCsv(result, branding, meta)], { type: "text/csv;charset=utf-8" }));
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


/** Ficha cronológica de uma unidade, montada somente com o snapshot já autorizado pela RPC. */
export const FOLLOWUP_SCHOOL_REPORT: ReportDefinition = {
  id: "acompanhamento-institucional-ficha-escola", version: 2,
  title: "Ficha de acompanhamento da unidade escolar",
  description: "Histórico completo de visitas, medidas e evoluções da unidade autorizada.",
  source: "school_institutional_followup_school",
  params: [
    { id: "school", label: "Unidade", type: "text", required: true, maxLength: 200 },
  ],
  columns: [
    { id: "event_date", label: "Data do fato", kind: "date" },
    { id: "recorded_at", label: "Registrado em (Brasília)", kind: "text" },
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
    .map(([label, value]) => `${label}: ${stripTextFormat(value ?? "")}`).join(" | ");
  return text || null;
}

function followupRows(
  snapshot: SchoolSnapshot, linkedVisits: readonly FollowupVisit[] = snapshot.visits,
): Record<string, string | number | null>[] {
  const rows: Record<string, string | number | null>[] = [];
  for (const v of [...snapshot.visits, ...snapshot.visit_history]) {
    rows.push({
      event_date: v.visit_date,
      recorded_at: formatDateTime(v.created_at),
      event_type: snapshot.visit_history.some((old) => old.id === v.id)
        ? `Visita substituída (v${v.version})` : `Visita vigente (v${v.version})`,
      description: joinDescriptions(["Objetivo", v.purpose_note], ["Diagnóstico", v.diagnosis],
        ["Pontos fortes", v.strengths], ["Fragilidades", v.weaknesses]),
      responsible: null, deadline: null, situation: null,
      author: v.author_name,
      detail: joinDescriptions(["Demais participantes informados", v.participants_note],
        ["Observações", v.summary], ["Justificativa de retificação", v.correction_reason]),
    });
  }
  for (const a of snapshot.actions) {
    const visit = snapshot.visits.find((v) => v.logical_id === a.visit_logical_id);
    rows.push({
      event_date: civilDateOf(a.created_at),
      recorded_at: formatDateTime(a.created_at),
      event_type: "Medida proposta",
      description: stripTextFormat(a.description), responsible: a.responsible_label,
      deadline: a.due_on, situation: currentSituation(a, snapshot.updates),
      author: a.author_name,
      detail: visit ? `Vinculada à visita de ${visit.visit_date}` : null,
    });
  }
  for (const u of snapshot.updates) {
    const action = snapshot.actions.find((a) => a.id === u.action_id);
    const linkedVisit = u.visit_logical_id
      ? linkedVisits.find((v) => v.logical_id === u.visit_logical_id)
      : null;
    rows.push({
      event_date: u.occurred_on, recorded_at: formatDateTime(u.created_at),
      event_type: "Evolução de medida",
      description: joinDescriptions(["Medida", action?.description], ["Realizado", u.done_text],
        ["Não realizado", u.not_done_text]),
      responsible: action?.responsible_label ?? null,
      deadline: action?.due_on ?? null, situation: u.situation,
      author: u.author_name,
      detail: joinDescriptions(["Resultados", u.results], ["Encaminhamentos", u.referrals],
        ["Visita associada", u.visit_logical_id
          ? linkedVisit ? `Visita de ${linkedVisit.visit_date}` : "Referência não encontrada no histórico"
          : null]),
    });
  }
  return rows;
}

export function schoolFollowupReport(snapshot: SchoolSnapshot, schoolId: string): ReportResult {
  return runReport(FOLLOWUP_SCHOOL_REPORT, { params: { school: schoolId },
    sort: [{ column: "event_date", dir: "desc" }] }, followupRows(snapshot));
}

/** Relatório de uma visita, suas versões e as medidas daquela visita (sem outras unidades). */
export const FOLLOWUP_VISIT_REPORT: ReportDefinition = {
  id: "acompanhamento-institucional-relatorio-visita", version: 1,
  title: "Relatório individual de visita institucional",
  description: "Diagnóstico, retificações, medidas e evoluções de uma visita da unidade autorizada.",
  source: "school_institutional_followup_school",
  params: [
    { id: "school", label: "Unidade", type: "text", required: true, maxLength: 200 },
    { id: "visit", label: "Visita", type: "text", required: true, maxLength: 200 },
  ],
  columns: FOLLOWUP_SCHOOL_REPORT.columns,
  formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 10000,
};

export function visitFollowupReport(snapshot: SchoolSnapshot, schoolId: string, visitId: string): ReportResult {
  const visit = snapshot.visits.find((v) => v.id === visitId && v.school_id === schoolId);
  if (!visit) throw new UserFacingError("A visita selecionada não está disponível. Atualize o histórico da escola.");
  const actions = snapshot.actions.filter((a) =>
    a.school_id === schoolId && a.visit_logical_id === visit.logical_id);
  const actionIds = new Set(actions.map((a) => a.id));
  const subset: SchoolSnapshot = {
    visits: [visit],
    visit_history: snapshot.visit_history.filter((v) =>
      v.school_id === schoolId && v.logical_id === visit.logical_id),
    actions,
    updates: snapshot.updates.filter((u) => actionIds.has(u.action_id)),
  };
  return runReport(FOLLOWUP_VISIT_REPORT, { params: { school: schoolId, visit: visitId },
    sort: [{ column: "event_date", dir: "desc" }] }, followupRows(subset, snapshot.visits));
}


export async function exportFollowupSchool(
  snapshot: SchoolSnapshot, schoolId: string, schoolName: string, format: "csv" | "xlsx" | "pdf",
  signal?: AbortSignal,
  attachments: readonly FollowupAttachment[] = [],
): Promise<void> {
  if (signal?.aborted) return;
  const result = schoolFollowupReport(snapshot, schoolId);
  if (result.mode !== "sync") throw new Error("O relatório excedeu o limite de exportação.");
  const branding = {
    headerLines: ["Secretaria Municipal de Educação", schoolName],
    title: FOLLOWUP_SCHOOL_REPORT.title,
  };
  const meta = [
    "Registros da unidade autorizada, incluindo versões anteriores e atualizações cronológicas.",
    "Data do fato é a data efetiva declarada; registrado em é a data/hora da gravação no SIGEM (horário de Brasília).",
    "Conclusão e execução são informações declaradas pela equipe, sem homologação do Gabinete.",
    "Dados provenientes da consulta institucional; não constituem cobrança administrativa.",
  ];
  const slug = schoolId.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 70);
  const base = `ficha-acompanhamento-${slug}`;
  if (format === "csv") {
    if (signal?.aborted) return;
    downloadBlob(base + ".csv", new Blob([toCsv(result, branding, meta)], { type: "text/csv;charset=utf-8" }));
  } else if (format === "xlsx") {
    const bytes = await toXlsx(result, branding, meta);
    if (signal?.aborted) return;
    downloadBlob(base + ".xlsx", new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  } else {
    const images = attachments.length ? await loadFollowupPdfAttachments(snapshot, schoolId, attachments, undefined, signal) : [];
    if (signal?.aborted) return;
    const pdf = await toPdfFile(result, branding, meta, {
      sections: followupPdfSections(snapshot, schoolId), attachments: images,
    });
    if (signal?.aborted) return;
    downloadBlob(base + ".pdf", pdf);
  }
}

export async function exportFollowupVisit(
  snapshot: SchoolSnapshot, schoolId: string, schoolName: string,
  visitId: string, format: "csv" | "xlsx" | "pdf",
  signal?: AbortSignal,
  attachments: readonly FollowupAttachment[] = [],
): Promise<void> {
  if (signal?.aborted) return;
  const result = visitFollowupReport(snapshot, schoolId, visitId);
  if (result.mode !== "sync") throw new UserFacingError("O relatório excedeu o limite de exportação.");
  const visit = snapshot.visits.find((v) => v.id === visitId && v.school_id === schoolId);
  if (!visit) throw new UserFacingError("A visita selecionada não está disponível. Atualize o histórico da escola.");
  const branding = {
    headerLines: ["Secretaria Municipal de Educação", schoolName],
    title: FOLLOWUP_VISIT_REPORT.title,
  };
  const meta = [
    `Visita de ${visit.visit_date} · ${visit.author_name || "Autoria institucional registrada"}`,
    "Inclui as retificações, medidas vinculadas e sua evolução posterior, inclusive em outras visitas.",
    "Data do fato e data/hora do registro são distintas, usando o horário oficial de Brasília.",
    "Informações declaradas pela equipe; não equivalem à homologação ou cobrança administrativa.",
  ];
  const safeSchool = schoolId.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 70);
  const safeVisit = visitId.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 40);
  const base = `relatorio-visita-${safeSchool}-${visit.visit_date}-${safeVisit}`;
  if (format === "csv") {
    if (signal?.aborted) return;
    downloadBlob(base + ".csv", new Blob([toCsv(result, branding, meta)], { type: "text/csv;charset=utf-8" }));
  } else if (format === "xlsx") {
    const bytes = await toXlsx(result, branding, meta);
    if (signal?.aborted) return;
    downloadBlob(base + ".xlsx", new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  } else {
    const images = attachments.length ? await loadFollowupPdfAttachments(snapshot, schoolId, attachments, visitId, signal) : [];
    if (signal?.aborted) return;
    const pdf = await toPdfFile(result, branding, meta, {
      sections: followupPdfSections(snapshot, schoolId, visitId), attachments: images,
    });
    if (signal?.aborted) return;
    downloadBlob(base + ".pdf", pdf);
  }
}
/** Quadro do Gabinete: linhas previamente autorizadas, sem dados de outras unidades. */
export const FOLLOWUP_PENDING_REPORT: ReportDefinition = {
  id: "acompanhamento-institucional-providencias", version: 1,
  title: "Quadro de providências — Acompanhamento institucional",
  description: "Medidas ainda não declaradas concluídas, sem atribuir qualidade às escolas.",
  source: "school_institutional_followup_pending",
  params: [],
  columns: [
    { id: "school_name", label: "Unidade escolar", kind: "text" },
    { id: "inep", label: "INEP", kind: "text" },
    { id: "description", label: "Medida proposta", kind: "text" },
    { id: "responsible_label", label: "Responsável declarado", kind: "text" },
    { id: "due_on", label: "Prazo declarado", kind: "date" },
    { id: "situation", label: "Situação declarada", kind: "text" },
    { id: "last_update_on", label: "Última evolução efetiva", kind: "date" },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 5000,
};
export function networkPendingReport(rows: readonly NetworkPendingAction[]): ReportResult {
  return runReport(FOLLOWUP_PENDING_REPORT, { params: {} }, rows.map((r) => ({
    school_name: r.school_name, inep: r.inep, description: r.description,
    responsible_label: r.responsible_label, due_on: r.due_on,
    situation: r.situation, last_update_on: r.last_update_on,
  })));
}
export async function exportNetworkPending(
  rows: readonly NetworkPendingAction[], format: "csv" | "xlsx" | "pdf",
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) return;
  const result = networkPendingReport(rows);
  if (result.mode !== "sync") throw new Error("O quadro excedeu o limite de exportação.");
  const branding = {
    headerLines: ["Secretaria Municipal de Educação"], title: FOLLOWUP_PENDING_REPORT.title,
  };
  const meta = [
    "Medidas ainda não declaradas concluídas; apenas unidades do escopo autorizado.",
    "Sem atualização não significa não realizada; prazos são os informados pela equipe.",
    `Medidas no filtro: ${rows.length}. Situações declaradas não equivalem à homologação do Gabinete.`,
  ];
  const base = "quadro-providencias-institucionais";
  if (format === "csv") {
    if (signal?.aborted) return;
    downloadBlob(base + ".csv", new Blob([toCsv(result, branding, meta)], { type: "text/csv;charset=utf-8" }));
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

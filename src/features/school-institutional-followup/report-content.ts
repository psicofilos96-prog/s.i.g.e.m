import type { PdfParagraph, PdfSection, PdfAttachment } from "@/features/reports/pdf-content";
import { supabase } from "@/integrations/supabase/client";
import { withListTimeout } from "@/lib/server-page";
import { UserFacingError } from "@/lib/observability/governed-errors";
import { formatDateTime } from "@/lib/academic-date";
import { parseTextParagraphs } from "./text-format-model";
import type { FollowupAttachment } from "./source";
import { currentSituation, type SchoolSnapshot } from "./model";

export function followupPdfSections(snapshot: SchoolSnapshot, schoolId: string, visitId?: string): PdfSection[] {
  const chosen = visitId ? snapshot.visits.find((v) => v.id === visitId && v.school_id === schoolId) : null;
  if (visitId && !chosen) throw new UserFacingError("A visita selecionada não está disponível. Atualize o histórico da escola.");
  const visits = [...snapshot.visits, ...snapshot.visit_history].filter((v) => v.school_id === schoolId && (!chosen || v.logical_id === chosen.logical_id));
  const actions = snapshot.actions.filter((a) => a.school_id === schoolId && (!chosen || a.visit_logical_id === chosen.logical_id));
  const field = (label: string, text: string | null | undefined): PdfParagraph[] => text?.trim()
    ? [{ alignment: "left", runs: [{ text: label, bold: true }] }, ...parseTextParagraphs(text)] : [];
  const sections: PdfSection[] = visits.map((v) => ({
    title: `Visita de ${v.visit_date.split("-").reverse().join("/")} · versão ${v.version}${snapshot.visit_history.some((h) => h.id === v.id) ? " (substituída)" : " (vigente)"}`,
    paragraphs: [
      ...field("Registrado em", formatDateTime(v.created_at)), ...field("Autoria registrada", v.author_name),
      ...field("Objetivo", v.purpose_note), ...field("Diagnóstico", v.diagnosis),
      ...field("Pontos fortes", v.strengths), ...field("Fragilidades", v.weaknesses),
      ...field("Demais participantes informados", v.participants_note), ...field("Observações", v.summary),
      ...field("Justificativa de retificação", v.correction_reason),
    ],
  }));
  for (const action of actions) {
    const origin = snapshot.visits.find((v) => v.logical_id === action.visit_logical_id);
    sections.push({ title: `Medida proposta${origin ? ` · visita de ${origin.visit_date}` : ""}`, paragraphs: [
      ...field("Descrição", action.description), ...field("Responsável declarado", action.responsible_label ?? "Não informado"),
      ...field("Prazo declarado", action.due_on ?? "Não informado"), ...field("Situação declarada", currentSituation(action, snapshot.updates)),
      ...field("Autoria registrada", action.author_name), ...field("Registrado em", formatDateTime(action.created_at)),
    ] });
    for (const u of snapshot.updates.filter((u) => u.action_id === action.id)) {
      const linked = snapshot.visits.find((v) => v.logical_id === u.visit_logical_id);
      sections.push({ title: `Evolução de medida · ${u.occurred_on}`, paragraphs: [
        ...field("Situação declarada", u.situation), ...field("Realizado", u.done_text), ...field("Não realizado", u.not_done_text),
        ...field("Resultados", u.results), ...field("Encaminhamentos", u.referrals),
        ...field("Visita associada", linked?.visit_date), ...field("Autoria registrada", u.author_name), ...field("Registrado em", formatDateTime(u.created_at)),
      ] });
    }
  }
  return sections;
}

export function scopedPdfAttachments(snapshot: SchoolSnapshot, schoolId: string, attachments: readonly FollowupAttachment[], visitId?: string) {
  const chosen = visitId ? snapshot.visits.find((v) => v.id === visitId && v.school_id === schoolId) : null;
  if (visitId && !chosen) throw new UserFacingError("A visita selecionada não está disponível.");
  const visits = new Map([...snapshot.visits, ...snapshot.visit_history].filter((v) => v.school_id === schoolId).map((v) => [v.id, v]));
  const scoped = attachments.filter((a) => !chosen || a.visit_logical_id === chosen.logical_id);
  const ids = new Set<string>();
  for (const a of scoped) {
    const visit = visits.get(a.visit_id);
    if (!visit || visit.logical_id !== a.visit_logical_id || !a.storage_path.startsWith(`${schoolId}/`) || ids.has(a.id)) {
      throw new UserFacingError("Os anexos não correspondem ao histórico desta escola. Atualize antes de imprimir.");
    }
    ids.add(a.id);
  }
  return scoped.slice().sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

export async function loadFollowupPdfAttachments(snapshot: SchoolSnapshot, schoolId: string, attachments: readonly FollowupAttachment[], visitId?: string, signal?: AbortSignal): Promise<PdfAttachment[]> {
  const scoped = scopedPdfAttachments(snapshot, schoolId, attachments, visitId);
  const result: PdfAttachment[] = [];
  // Bounded sequential reads keep large private images out of simultaneous memory spikes.
  for (const a of scoped) {
    const image = await withListTimeout(signal, async (readSignal) => {
      const { data, error } = await supabase.storage.from("followup-attachments").download(a.storage_path);
      if (readSignal.aborted) throw new DOMException("cancelada", "AbortError");
      if (error || !data || !["image/png", "image/jpeg", "image/webp"].includes(data.type) || data.size > 5 * 1024 * 1024) {
        throw new UserFacingError("Não foi possível ler uma das imagens. O PDF não foi gerado para evitar anexos ausentes. Atualize e tente novamente.");
      }
      const url = URL.createObjectURL(data);
      try {
        const img = new Image(); img.src = url;
        await img.decode();
        if (readSignal.aborted) throw new DOMException("cancelada", "AbortError");
        const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new UserFacingError("Não foi possível preparar a imagem para impressão.");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const visit = [...snapshot.visits, ...snapshot.visit_history].find((v) => v.id === a.visit_id);
        return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height,
          caption: `${a.caption || "Imagem anexada"} · visita de ${visit?.visit_date ?? ""} · versão ${visit?.version ?? ""}\nAnexada em ${formatDateTime(a.created_at)}${a.author_name ? ` · ${a.author_name}` : ""}` };
      } finally { URL.revokeObjectURL(url); }
    });
    result.push(image);
  }
  return result;
}
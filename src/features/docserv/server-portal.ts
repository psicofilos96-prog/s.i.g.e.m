/** DocServ LOTE 03 — portal do servidor: alertas e situação por tipo, derivados dos documentos (puro). */
import type { DocRow } from "./documents-model";

export type Alert = { key: string; tone: "danger" | "warning" | "info"; text: string; documentId: string | null };
export const NOTICE_DAYS = 30; // antecedência do aviso de vencimento: apresentação, não prazo legal

const TYPE_LABEL: Record<string, string> = { antecedente_criminal: "antecedentes criminais", antecedente_civil: "antecedentes cíveis" };
export const typeLabel = (c: string) => TYPE_LABEL[c] ?? c;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function deriveAlerts(rows: DocRow[], today: string, season: string, types: string[]): Alert[] {
  const out: Alert[] = [];
  for (const d of rows) {
    const k = `${d.document_id}:${d.seq}`;
    if (d.status === "rejeitado") out.push({ key: `${k}:rej`, tone: "danger", documentId: d.document_id, text: `Certidão de ${typeLabel(d.type)} rejeitada${d.note ? `: ${d.note}` : ""}. Envie um arquivo substituto.` });
    else if (d.status === "alerta_revisao_urgente") out.push({ key: `${k}:urg`, tone: "danger", documentId: d.document_id, text: `Revisão urgente da certidão de ${typeLabel(d.type)}${d.note ? `: ${d.note}` : ""}.` });
    else if (d.status === "vencido") out.push({ key: `${k}:venc`, tone: "danger", documentId: d.document_id, text: `Certidão de ${typeLabel(d.type)} vencida em ${d.valid_until}. Envie uma nova.` });
    else if (d.valid_until && d.status !== "excluido") {
      const left = daysBetween(today, d.valid_until);
      if (left >= 0 && left <= NOTICE_DAYS) out.push({ key: `${k}:prox`, tone: "warning", documentId: d.document_id, text: `Certidão de ${typeLabel(d.type)} vence em ${left} dia(s) (${d.valid_until}).` });
    }
  }
  for (const t of types) {
    if (!rows.some((d) => d.type === t && d.season === season && d.status !== "excluido"))
      out.push({ key: `sem:${t}:${season}`, tone: "info", documentId: null, text: `Nenhuma certidão de ${typeLabel(t)} enviada para ${season}.` });
  }
  return out;
}

/** Documento atual por tipo na temporada: o mais recente não excluído. */
export function currentByType(rows: DocRow[], season: string): Map<string, DocRow> {
  const m = new Map<string, DocRow>();
  for (const d of rows) {
    if (d.season !== season || d.status === "excluido") continue;
    const prev = m.get(d.type);
    if (!prev || d.submitted_at > prev.submitted_at) m.set(d.type, d);
  }
  return m;
}

/** Substituição é permitida quando o documento não está válido em vigor. */
export const canReplace = (d: DocRow) => d.status !== "valido" && d.status !== "excluido";

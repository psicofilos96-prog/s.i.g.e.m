// L15, L16, L20–L23 — solicitações compartilhadas, pesquisa, LGPD e integração com módulos.
// Integração é REFERÊNCIA ao fato do módulo dono (`link_admin_case_origin`), nunca cópia.

/* L15 — toda solicitação (Secretaria, Família, Direção…) entra pelo mesmo protocolo L06 */
export const SHARED_REQUEST_CHANNELS = {
  "secretaria-escolar": "presencial", familia: "digital", "direcao-escolar": "interno",
  "gestao-de-pessoas": "interno", supervisao: "interno", orientacao: "interno",
} as const;
export type OriginModule = keyof typeof SHARED_REQUEST_CHANNELS | "sistema-externo";

export function sharedRequestPlan(module: OriginModule, originRef: string) {
  if (module === "sistema-externo") return { ok: false as const, reason: "Nenhum sistema oficial externo configurado (sem contrato nem decisão)." };
  if (!originRef.trim()) return { ok: false as const, reason: "Referência ao registro de origem é obrigatória." };
  return { ok: true as const, channel: SHARED_REQUEST_CHANNELS[module], writes: ["register_protocol", "link_admin_case_origin"] as const };
}

/* L16 — pesquisa: só processos legíveis (RLS); metadados sensíveis nunca entram no índice */
export const SEARCHABLE_FIELDS = ["case_number", "subject", "classification_code", "unit_id", "opened_at"] as const;
export const NEVER_SEARCHABLE = ["document_ref", "content_sha256", "interested_external_ref", "text_body", "purpose"] as const;
export function sanitizeSearchTerm(t: string): string {
  return t.replace(/[%_\\]/g, "").trim().slice(0, 80);
}

/* L20 — LGPD: termos que indicam dado pessoal sensível no assunto ⇒ alerta para marcar anexo sensível */
const SENSITIVE_HINTS = [/\bcid\b/i, /laudo/i, /diagn[oó]stic/i, /sa[uú]de/i, /\bcpf\b/i, /\brg\b/i, /medida protetiva/i, /conselho tutelar/i];
export function subjectPrivacyWarnings(subject: string): string[] {
  const w: string[] = [];
  if (SENSITIVE_HINTS.some((r) => r.test(subject))) w.push("O assunto sugere dado pessoal sensível: descreva de forma genérica e junte o conteúdo como anexo sensível.");
  if (/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(subject)) w.push("Não escreva CPF no assunto do processo.");
  return w;
}

/* L21–L23 — mapa de integração: o que o módulo dono fornece, sempre por referência */
export const MODULE_INTEGRATIONS: Record<OriginModule, { provides: string; status: "referencia" | "bloqueado"; note: string }> = {
  "secretaria-escolar": { provides: "atendimento/protocolo da escola, documento emitido (emit_school_document_v3)", status: "referencia", note: "Processo cita o protocolo/emissão; não recompõe documento escolar." },
  "gestao-de-pessoas": { provides: "vínculo funcional, ato administrativo", status: "referencia", note: "Processo cita o ato; efetivação continua no writer de Pessoas." },
  "direcao-escolar": { provides: "demanda escola→SEMED", status: "referencia", note: "Demanda segue no ledger da Direção; processo só referencia." },
  supervisao: { provides: "calendário e decisões da Supervisão", status: "referencia", note: "Sem cópia de calendário." },
  orientacao: { provides: "acompanhamento pedagógico", status: "referencia", note: "Conteúdo confidencial nunca é juntado sem anexo sensível." },
  familia: { provides: "solicitação da família (protocolo L06 com autorização vigente)", status: "referencia", note: "Família vê só o próprio protocolo." },
  "sistema-externo": { provides: "—", status: "bloqueado", note: "Nenhum sistema oficial municipal identificado; integração exige nome, contrato e decisão." },
};

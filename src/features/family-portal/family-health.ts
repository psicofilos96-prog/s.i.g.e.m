/**
 * Declarações de saúde da família (alimentar, alergia, medicamento) — dado sensível de menor (LGPD art. 11/14).
 * O banco decide quem grava/lê; esta camada valida o rascunho e projeta o histórico. Nada aqui é diagnóstico.
 */
export const HEALTH_KINDS = ["alimentar", "alergia", "medicamento"] as const;
export type HealthKind = (typeof HEALTH_KINDS)[number];
export const HEALTH_KIND_LABEL: Record<HealthKind, string> = {
  alimentar: "Restrição ou necessidade alimentar", alergia: "Alergia", medicamento: "Medicamento de uso na escola",
};
/** Versão do texto de ciência gravada junto da declaração; mudar o texto exige nova versão. */
export const CONSENT_VERSION = "nfam2-ciencia-v1";
export const CONSENT_TEXT =
  "Declaro, como responsável autorizado, que estas informações são verdadeiras e autorizo seu uso pela escola " +
  "exclusivamente para o cuidado do educando (alimentação, prevenção de reações e administração de medicamento conforme orientação). " +
  "Elas ficam visíveis apenas à equipe de alimentação da escola da matrícula vigente e aos responsáveis autorizados, " +
  "não aparecem em relatórios gerais nem na verificação pública, e posso retificá-las ou retirá-las a qualquer momento.";

export type HealthDraft = { kind: HealthKind | ""; description: string; instructions: string; consent: boolean };
export function validateHealthDraft(d: HealthDraft): string | null {
  if (!d.kind || !HEALTH_KINDS.includes(d.kind)) return "Escolha o tipo de informação.";
  const desc = d.description.trim();
  if (desc.length < 3) return "Descreva a informação (pelo menos 3 caracteres).";
  if (desc.length > 600 || d.instructions.length > 600) return "Use no máximo 600 caracteres por campo.";
  if (!d.consent) return "É preciso marcar a ciência para enviar.";
  return null;
}

export type HealthRow = Readonly<{ id: string; logical_id: string; version: number; kind: HealthKind; event_kind: "declaracao" | "retificacao" | "retirada";
  description: string; instructions: string | null; consent_text_version: string; recorded_at: string; by_me: boolean; is_head: boolean }>;
export type HealthItem = Readonly<{ logicalId: string; head: HealthRow; active: boolean; history: readonly HealthRow[] }>;

/** Agrupa por declaração lógica; vigente = cabeça não retirada. Histórico sempre completo, mais recente primeiro. */
export function projectHealth(rows: readonly HealthRow[]): HealthItem[] {
  const by = new Map<string, HealthRow[]>();
  for (const r of rows) by.set(r.logical_id, [...(by.get(r.logical_id) ?? []), r]);
  return [...by.entries()].map(([logicalId, list]) => {
    const history = [...list].sort((a, b) => b.version - a.version);
    const head = history[0]!;
    return { logicalId, head, active: head.event_kind !== "retirada", history };
  }).sort((a, b) => Number(b.active) - Number(a.active) || b.head.recorded_at.localeCompare(a.head.recorded_at));
}

export function healthMessage(raw: string): string {
  if (raw.includes("session-required")) return "Sua sessão expirou. Entre novamente.";
  if (raw.includes("family:not-authorized")) return "Sua autorização não inclui informações de saúde deste educando. Procure a secretaria da escola.";
  if (raw.includes("health:consent-required")) return "É preciso marcar a ciência para enviar.";
  if (raw.includes("health:stale-base")) return "Outro responsável alterou esta informação. Recarregue para ver a versão atual.";
  if (raw.includes("health:already-withdrawn")) return "Esta informação já foi retirada.";
  if (raw.includes("health:capability-missing")) return "Sua conta não tem permissão de alimentação nesta escola.";
  return "Não foi possível concluir agora. Tente novamente.";
}

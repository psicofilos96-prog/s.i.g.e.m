/**
 * Docente LOTE 07 — Editor de planejamento (modelo puro sobre os writers existentes).
 *
 * Gravação continua só por `record_teaching_plan_version_v2` (0137/0150); modelos vêm
 * de `sipe_plan_template_versions`; compartilhamento/cópia pelo ledger existente.
 * Aqui: tipo de plano aberto (do modelo), completude por campos declarados, cópia
 * segura, devolutivas da OP como ledger e validação só quando a política exigir.
 */
export type PlanKind = string; // ex.: anual, bimestral, semanal, aula, sequência, projeto — vem do modelo

export type TemplateField = { key: string; label: string; required: boolean };
export type PlanTemplate = { id: string; version: number; kinds: readonly PlanKind[]; fields: readonly TemplateField[] };

export type PlanDraft = {
  planId: string | null;
  kind: PlanKind;
  title: string;
  start: string;
  end: string;
  fields: Record<string, string>;
  curricularRefs: readonly string[]; // só IDs canônicos
  adaptations: string; // texto pedagógico; nunca dado clínico
  templateId: string;
  templateVersion: number;
  copiedFromVersionId?: string;
};

export function validateDraft(d: PlanDraft, t: PlanTemplate, assignment: { start: string; end?: string | null }): string[] {
  const out: string[] = [];
  if (t.id !== d.templateId || t.version !== d.templateVersion) out.push("Modelo do rascunho difere da versão vigente do modelo; revise antes de salvar.");
  if (!t.kinds.includes(d.kind)) out.push(`Tipo "${d.kind}" não está previsto no modelo.`);
  if (!d.title.trim()) out.push("Informe o título do plano.");
  if (!d.start || !d.end || d.start > d.end) out.push("Período do plano inválido.");
  if (d.start < assignment.start || (assignment.end && d.end > assignment.end)) out.push("O período do plano deve caber na sua atribuição.");
  for (const f of t.fields) if (f.required && !d.fields[f.key]?.trim()) out.push(`Preencha "${f.label}".`);
  for (const k of Object.keys(d.fields)) if (!t.fields.some((f) => f.key === k)) out.push(`Campo "${k}" não pertence ao modelo.`);
  if (/\b(CID|laudo)\b/i.test(d.adaptations)) out.push("Adaptações não devem conter diagnóstico ou laudo; descreva apenas a estratégia pedagógica.");
  return out;
}

/** Cópia segura: nova instância, sem id, sem datas, sem devolutivas, com origem registrada. */
export function safeCopy(source: PlanDraft, sourceVersionId: string, target: { start: string; end: string; template: PlanTemplate }): PlanDraft {
  const allowed = new Set(target.template.fields.map((f) => f.key));
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(source.fields)) if (allowed.has(k)) fields[k] = v;
  return {
    ...source,
    planId: null,
    start: target.start,
    end: target.end,
    fields,
    adaptations: "", // adaptações são da turma de origem; não migram
    templateId: target.template.id,
    templateVersion: target.template.version,
    copiedFromVersionId: sourceVersionId,
  };
}

export type FeedbackEvent = { seq: number; planVersionId: string; authorId: string; at: string; kind: "devolutiva" | "resposta" | "ciente"; text: string };

/** Devolutivas da OP: ledger com seq contínuo; nunca alteram o plano. */
export function appendFeedback(ledger: readonly FeedbackEvent[], e: Omit<FeedbackEvent, "seq">, expectedSeq: number): FeedbackEvent[] {
  const head = ledger.length ? ledger[ledger.length - 1]!.seq : 0;
  if (head !== expectedSeq) throw new Error("Outra pessoa registrou antes; recarregue as devolutivas.");
  if (e.kind !== "ciente" && !e.text.trim()) throw new Error("Devolutiva sem texto.");
  return [...ledger, { ...e, seq: head + 1 }];
}

export type ValidationPolicy = { required: boolean; capability: string } | null;
export type PlanState = "rascunho" | "compartilhado" | "aguardando-validacao" | "validado" | "devolvido";

/** Validação só existe se a política homologada exigir; validador ≠ autor e com capacidade. */
export function validationStep(
  policy: ValidationPolicy,
  plan: { authorId: string; state: PlanState },
  actor: { id: string; capabilities: readonly string[] },
): { available: boolean; reason?: string } {
  if (!policy?.required) return { available: false, reason: "Nenhuma validação é exigida para este plano." };
  if (plan.state !== "aguardando-validacao") return { available: false, reason: "O plano não foi enviado para validação." };
  if (actor.id === plan.authorId) return { available: false, reason: "Quem escreveu o plano não pode validá-lo." };
  if (!actor.capabilities.includes(policy.capability)) return { available: false, reason: "Você não tem a autorização exigida para validar." };
  return { available: true };
}

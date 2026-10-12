// Tecnologia L04 — central de chamados (migration 0478). Categoria = versão append-only com formulário declarado,
// utilizável só na última versão aprovada por pessoa ≠ autor; respostas validadas aqui e no banco (tech_answers_problem).
// Anexo = evento 'anexo' (juntada do SIGEM Documentos), vínculo = 'vinculo-objeto' e problema PRB, protocolo = L06
// com no máximo um vínculo por chamado (trigger tech_protocol_once). Nenhuma fila, anexo ou protocolo paralelo.
import type { OpsProjection } from "@/features/operations-center/shared-requests";

export type FieldType = "texto" | "escolha" | "sim-nao" | "data";
export interface Field { key: string; label: string; type: FieldType; required: boolean; options?: string[] }
export interface CategoryVersion { id: string; categoryKey: string; version: number; label: string; fields: Field[]; requiresAttachment: boolean; personId: string; approvedBy: string | null }

export function fieldsProblem(fs: readonly Field[]): string | null {
  const keys = new Set<string>();
  for (const f of fs) {
    if (!/^[a-z0-9-]{2,40}$/.test(f.key) || f.label.trim().length < 2) return `campo-invalido:${f.key}`;
    if (keys.has(f.key)) return `campo-duplicado:${f.key}`;
    if (f.type === "escolha" && (f.options?.length ?? 0) < 2) return `opcoes-insuficientes:${f.key}`;
    keys.add(f.key);
  }
  return fs.length > 30 ? "campos-demais" : null;
}

export function answersProblem(fs: readonly Field[], a: Record<string, unknown>): string | null {
  for (const k of Object.keys(a)) if (!fs.some((f) => f.key === k)) return `campo-desconhecido:${k}`;
  for (const f of fs) if (f.required && !(f.key in a)) return `campo-obrigatorio:${f.key}`;
  for (const f of fs) {
    if (!(f.key in a)) continue;
    const v = a[f.key];
    const ok = f.type === "texto" ? typeof v === "string" && v.trim().length >= 1 && v.trim().length <= 500
      : f.type === "sim-nao" ? typeof v === "boolean"
      : f.type === "data" ? typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
      : typeof v === "string" && (f.options ?? []).includes(v);
    if (!ok) return `valor-invalido:${f.key}`;
  }
  return null;
}

/** Utilizáveis = última versão de cada categoria, aprovada por pessoa diferente do autor. */
export function usableCategories(vs: readonly CategoryVersion[]): CategoryVersion[] {
  const latest = new Map<string, CategoryVersion>();
  for (const v of vs) if ((latest.get(v.categoryKey)?.version ?? 0) < v.version) latest.set(v.categoryKey, v);
  return [...latest.values()].filter((v) => v.approvedBy !== null && v.approvedBy !== v.personId);
}

/** Pendências do chamado na central (não bloqueiam abertura; orientam o atendimento). */
export function ticketPending(i: { category: CategoryVersion | null; projection: OpsProjection }): string[] {
  const out: string[] = [];
  if (!i.category) out.push("sem-categoria");
  if (i.category?.requiresAttachment && i.projection.attachments === 0) out.push("anexo-exigido-pela-categoria");
  if (i.projection.protocols.length === 0) out.push("sem-protocolo");
  if (i.projection.protocols.length > 1) out.push("protocolo-duplicado");
  return out;
}

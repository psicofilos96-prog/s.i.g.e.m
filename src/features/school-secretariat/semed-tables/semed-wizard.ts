/**
 * TSEMED.UI — assistente por etapas e checklist de pendências (puro). Não decide nada que o banco
 * não decida: o ciclo continua em `semed_table_act`; aqui só se explica o que falta.
 */
import { editableKeys, type SemedState, type TableDef, type Values } from "./semed-catalog";
import type { Central } from "./semed-export";

export const WIZARD_STEPS = [
  { id: "preencher", label: "Preencher" },
  { id: "conferir", label: "Conferência da escola" },
  { id: "ciece", label: "CIECE / SEMED" },
  { id: "fechado", label: "Fechado" },
] as const;
export type StepId = (typeof WIZARD_STEPS)[number]["id"];

export function stepOf(state: SemedState): StepId {
  if (state === "rascunho" || state === "devolvido" || state === "revisao-solicitada") return "preencher";
  if (state === "em-conferencia" || state === "conferido") return "conferir";
  if (state === "enviado" || state === "recebido") return "ciece";
  return "fechado";
}

/** Erro por campo (validação contextual inline); espelha `validateValues`. */
export function fieldError(def: TableDef, key: string, x: unknown): string | null {
  if (x === null || x === undefined || x === "") return null;
  const s = editableKeys(def)[key];
  if (!s) return "Campo desconhecido";
  if (s.type === "int") {
    const lo = s.min ?? 0, hi = s.max ?? 100000;
    if (!(typeof x === "number" && Number.isInteger(x))) return "Use número inteiro";
    if (x < lo || x > hi) return `Entre ${lo} e ${hi}`;
  }
  if (s.type === "text" && !(typeof x === "string" && x.length <= 500)) return "Até 500 caracteres";
  if (s.type === "enum" && !(typeof x === "string" && s.options?.includes(x))) return "Escolha uma opção da lista";
  return null;
}

export type Progress = { filled: number; total: number; sections: { id: string; title: string; filled: number; total: number }[] };
/** Progresso por seção. Grade conta linhas com algum valor (linha vazia pode ser legítima: etapa não ofertada). */
export function progress(def: TableDef, v: Values): Progress {
  const has = (k: string) => v[k] !== null && v[k] !== undefined && v[k] !== "";
  const sections = def.sections.map((s) => {
    if (s.kind === "fields") {
      const ed = s.fields.filter((f) => !f.central);
      return { id: s.id, title: s.title, filled: ed.filter((f) => has(`${s.id}.${f.key}`)).length, total: ed.length };
    }
    return { id: s.id, title: s.title, filled: s.rows.filter((r) => s.cols.some((c) => has(`${s.id}.${r.key}.${c.key}`))).length, total: s.rows.length };
  });
  return { filled: sections.reduce((a, s) => a + s.filled, 0), total: sections.reduce((a, s) => a + s.total, 0), sections };
}

export type CheckItem = { level: "bloqueio" | "aviso" | "ok"; text: string };
/**
 * Checklist antes de enviar. "bloqueio" = o banco recusaria (erro de validação, alteração não salva,
 * nada salvo); "aviso" = lacuna legítima que deve ser conhecida (campo vazio, dado central ausente).
 */
export function checklist(def: TableDef, saved: Values, draft: Values, central: Central, opts: { dirty: boolean; hasSaved: boolean; state: SemedState; lastReason?: string | null; extra?: CheckItem[] }): CheckItem[] {
  const out: CheckItem[] = [];
  if (opts.state === "devolvido" || opts.state === "revisao-solicitada") out.push({ level: "aviso", text: `Devolvida${opts.lastReason ? `: “${opts.lastReason}”` : ""}. Corrija e salve de novo.` });
  const errs = Object.entries(draft).map(([k, x]) => fieldError(def, k, x)).filter(Boolean).length;
  if (errs) out.push({ level: "bloqueio", text: `${errs} campo(s) com valor inválido.` });
  if (opts.dirty) out.push({ level: "bloqueio", text: "Há alterações não salvas — salve o rascunho." });
  if (!opts.hasSaved && !opts.dirty) out.push({ level: "bloqueio", text: "Nenhum rascunho salvo ainda." });
  for (const s of progress(def, saved).sections) {
    if (s.total && s.filled < s.total) out.push({ level: "aviso", text: `${s.title}: ${s.filled}/${s.total} ${def.sections.find((x) => x.id === s.id)?.kind === "grid" ? "linhas com dados" : "campos respondidos"}.` });
  }
  const refs = new Set<string>();
  for (const s of def.sections) if (s.kind === "fields") for (const f of s.fields) if (f.central) refs.add(f.central);
  const missing = [...refs].filter((r) => central[r] === null || central[r] === undefined || central[r] === "");
  if (missing.length) out.push({ level: "aviso", text: `Cadastro central sem: ${missing.join(", ")} (corrija na origem; não é digitável aqui).` });
  out.push(...(opts.extra ?? []));
  if (!out.some((x) => x.level !== "ok")) out.push({ level: "ok", text: "Sem pendências conhecidas." });
  return out;
}
export const blocked = (items: readonly CheckItem[]) => items.some((i) => i.level === "bloqueio");

/** Pacote anual: só entram tabelas com rascunho salvo; as demais são listadas como ausentes, nunca impressas vazias como se fossem respostas. */
export function packagePlan(codes: readonly string[], hasSaved: (c: string) => boolean): { include: string[]; missing: string[] } {
  return { include: codes.filter(hasSaved), missing: codes.filter((c) => !hasSaved(c)) };
}

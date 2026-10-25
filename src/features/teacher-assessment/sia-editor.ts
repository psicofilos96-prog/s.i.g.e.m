/**
 * SIA.ED.1 — regras puras do editor de provas: validação por tipo (objetiva 4/5, V/F, discursiva),
 * gabarito único, conteúdo rico seguro (tabela e equação como texto estruturado, nunca HTML),
 * pesos por questão (dado da prova, sem fórmula de nota), cabeçalho institucional e gabarito por versão.
 */
import type { ItemOption } from "./authoring-model";

export const OPTION_COUNT: Record<string, number> = { "objetiva-4": 4, "objetiva-5": 5, "verdadeiro-falso": 2 };
export const VF_OPTIONS: ItemOption[] = [{ key: "V", text: "Verdadeiro" }, { key: "F", text: "Falso" }];
export const blankOptions = (typeId: string): ItemOption[] =>
  typeId === "verdadeiro-falso" ? VF_OPTIONS : Array.from({ length: OPTION_COUNT[typeId] ?? 2 }, (_, i) => ({ key: String.fromCharCode(65 + i), text: "" }));

/** Problemas impeditivos para publicar; rascunho pode ficar incompleto. */
export function itemProblems(typeId: string, stem: string, options: ItemOption[], answer: string): string[] {
  const out: string[] = [];
  if (!stem.trim()) out.push("Enunciado vazio.");
  const n = OPTION_COUNT[typeId];
  if (n !== undefined) {
    if (options.length !== n) out.push(`Este tipo exige exatamente ${n} alternativas.`);
    if (options.some((o) => !o.text.trim())) out.push("Há alternativa sem texto.");
    if (new Set(options.map((o) => o.key)).size !== options.length) out.push("Rótulos de alternativa repetidos.");
    const ans = answer.split(",").map((x) => x.trim()).filter(Boolean);
    if (ans.length !== 1) out.push("Informe exatamente uma alternativa correta (gabarito único).");
    else if (!options.some((o) => o.key === ans[0])) out.push("A alternativa correta não existe entre as alternativas.");
  }
  return out;
}

export type RichBlock = { kind: "p"; parts: RichPart[] } | { kind: "table"; rows: string[][] } | { kind: "eq"; text: string };
export type RichPart = { kind: "text" | "eq"; text: string };
const inline = (line: string): RichPart[] => line.split(/(\$[^$\n]+\$)/).filter(Boolean).map((t) => (t.length > 2 && t.startsWith("$") && t.endsWith("$") ? { kind: "eq", text: t.slice(1, -1) } : { kind: "text", text: t }));
/** Marcação mínima: linhas `| a | b |` formam tabela; `$$ … $$` em linha própria é equação; `$x$` é equação em linha. */
export function richBlocks(src: string): RichBlock[] {
  const out: RichBlock[] = []; let para: string[] = []; let table: string[][] = [];
  const flushP = () => { if (para.length) out.push({ kind: "p", parts: inline(para.join("\n")) }); para = []; };
  const flushT = () => { if (table.length) out.push({ kind: "table", rows: table }); table = []; };
  for (const raw of src.split("\n")) {
    const l = raw.trim();
    if (l.startsWith("|") && l.endsWith("|") && l.length > 1) {
      flushP(); const cells = l.slice(1, -1).split("|").map((c) => c.trim());
      if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) table.push(cells); continue;
    }
    flushT();
    if (l.startsWith("$$") && l.endsWith("$$") && l.length > 4) { flushP(); out.push({ kind: "eq", text: l.slice(2, -2).trim() }); continue; }
    if (!l) { flushP(); continue; }
    para.push(raw);
  }
  flushP(); flushT(); return out;
}

export type InstrumentEntry = { itemVersionId: string; weight: number | null };
export const parseEntries = (v: unknown): InstrumentEntry[] => Array.isArray(v) ? v.flatMap((value) => {
  if (!value || typeof value !== "object") return [];
  const x = value as Record<string, unknown>;
  return typeof x["item_version_id"] === "string"
    ? [{ itemVersionId: x["item_version_id"], weight: typeof x["weight"] === "number" && Number.isFinite(x["weight"]) && x["weight"] > 0 ? x["weight"] : null }] : [];
}) : [];
/** Peso é declarado pelo professor; ausente fica ausente (nunca vira 0 nem 1). */
export function weightSummary(entries: InstrumentEntry[]) {
  const declared = entries.filter((e) => e.weight !== null);
  return { declared: declared.length, missing: entries.length - declared.length, total: declared.length === entries.length && entries.length ? Math.round(declared.reduce((s, e) => s + e.weight!, 0) * 100) / 100 : null };
}
export const validWeight = (w: string) => w.trim() === "" || (/^\d{1,3}([.,]\d{1,2})?$/.test(w.trim()) && Number(w.replace(",", ".")) > 0);

export const HEADER_LOGOS = ["brasao", "prefeitura", "educacao", "sigem"] as const;
export type HeaderConfig = { labels: string[]; logos: string[]; line1?: string; line2?: string; notice?: string; showStudentLines?: boolean };
export const DEFAULT_LABELS = ["AV1", "AV2", "AV3", "Recuperação"];
export function headerProblems(c: HeaderConfig): string[] {
  const out: string[] = []; const labels = c.labels.map((l) => l.trim()).filter(Boolean);
  if (labels.length < 1 || labels.length > 12) out.push("Configure de 1 a 12 nomes de avaliação.");
  if (new Set(labels).size !== labels.length) out.push("Nomes de avaliação repetidos.");
  if (labels.some((l) => l.length > 40)) out.push("Nome de avaliação acima de 40 caracteres.");
  if (c.logos.some((l) => !(HEADER_LOGOS as readonly string[]).includes(l))) out.push("Logo fora da lista permitida.");
  return out;
}

const POS = "ABCDEFGHIJ";
/** Gabarito da versão impressa: chave canônica do item traduzida para a letra exibida naquela versão. */
export function variantAnswerKey(questions: { number: number; itemVersionId: string; options: ItemOption[] }[], keys: ReadonlyMap<string, string | null>) {
  return questions.map((q) => {
    const k = keys.get(q.itemVersionId) ?? null;
    if (!q.options.length) return { number: q.number, display: k === null ? "não acessível" : "discursiva" };
    const i = q.options.findIndex((o) => o.key === k);
    return { number: q.number, display: i < 0 ? "sem gabarito" : q.options[0]?.key === "V" && q.options.length === 2 ? q.options[i]!.key : POS[i]! };
  });
}

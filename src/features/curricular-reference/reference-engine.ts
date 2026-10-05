/**
 * Referência curricular externa (BNCC, SAEB, futuras). Puro, sem rede.
 * - Fonte e edição são dado; o motor não conhece nenhum código, etapa, componente ou natureza de relação.
 * - Texto oficial é imutável por edição; simplificação é camada editorial versionada à parte.
 * - Relação é muitos-para-muitos com natureza, confiança e proveniência declaradas; nunca presume equivalência.
 * - Vínculo a etapa/posição/componente só por IDs canônicos de esquemas de valores, nunca por string.
 */

export const SOURCE_SCHEMA = "sigem.curricular-reference-source.v1";

export type SourceItem = Readonly<{
  code: string; kind: string; official_text: string; parent_code?: string | null;
  source_labels?: Readonly<Record<string, string>>; locator?: string | null;
  bindings?: readonly Readonly<{ scheme_id: string; value_id: string }>[];
}>;
export type SourceFile = Readonly<{
  schema: string;
  source: Readonly<{ id: string; label: string; authority: string }>;
  edition: Readonly<{ label: string; published_on?: string | null; valid_from?: string | null }>;
  items: readonly SourceItem[];
}>;

const ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Valida o arquivo-fonte. Nunca completa campo ausente. */
export function validateSource(json: unknown): { ok: true; file: SourceFile } | { ok: false; problems: string[] } {
  const p: string[] = [];
  const f = json as SourceFile;
  if (!f || typeof f !== "object") return { ok: false, problems: ["Arquivo não é um objeto JSON."] };
  if (f.schema !== SOURCE_SCHEMA) p.push(`Esquema esperado "${SOURCE_SCHEMA}".`);
  if (!f.source || !ID.test(f.source.id ?? "")) p.push("Identificador da fonte ausente ou inválido.");
  if (!f.source?.label?.trim()) p.push("Nome da fonte ausente.");
  if (!f.source?.authority?.trim()) p.push("Órgão responsável pela fonte ausente.");
  if (!f.edition?.label?.trim()) p.push("Edição da fonte ausente.");
  for (const k of ["published_on", "valid_from"] as const) {
    const v = f.edition?.[k];
    if (v != null && !DATE.test(v)) p.push(`Data ${k} inválida.`);
  }
  if (!Array.isArray(f.items) || f.items.length === 0) p.push("Nenhum item na fonte.");
  const seen = new Map<string, number>();
  (f.items ?? []).forEach((it, i) => {
    const at = `Item ${i + 1}`;
    if (!it.code?.trim()) p.push(`${at}: código ausente.`);
    else if (seen.has(it.code.trim())) p.push(`${at}: código ${it.code} repetido (item ${seen.get(it.code.trim())! + 1}).`);
    else seen.set(it.code.trim(), i);
    if (!ID.test(it.kind ?? "")) p.push(`${at}: tipo do item ausente ou inválido.`);
    if (!it.official_text?.trim()) p.push(`${at}: texto oficial ausente.`);
    for (const b of it.bindings ?? []) if (!b.scheme_id || !b.value_id) p.push(`${at}: vínculo incompleto.`);
  });
  return p.length ? { ok: false, problems: p } : { ok: true, file: f };
}

export type StoredItem = Readonly<{
  id: string; edition_id: string; code: string; item_kind: string; official_text: string;
  parent_code: string | null; source_labels: Readonly<Record<string, string>>; source_locator: string | null;
}>;
export type Edition = Readonly<{
  id: string; source_id: string; source_label: string; authority: string; edition_label: string;
  published_on: string | null; valid_from: string | null; source_sha256: string; source_ref: string | null;
  supersedes_id: string | null; item_count: number; recorded_at: string;
}>;
export type Binding = Readonly<{ item_id: string; scheme_id: string; value_id: string }>;
export type Relation = Readonly<{ id: string; from_item_id: string; to_item_id: string; nature: string; confidence: string; provenance: string; revokes_id: string | null; reason: string | null; recorded_at: string }>;
export type Simplification = Readonly<{ id: string; item_id: string; version_no: number; supersedes_id: string | null; simplified_text: string; reason: string | null; recorded_at: string }>;

/** Diferença da nova edição contra a anterior; a anterior permanece intacta. */
export function diffEditions(prev: readonly Pick<StoredItem, "code" | "official_text">[], next: readonly SourceItem[]) {
  const before = new Map(prev.map((i) => [i.code, i.official_text]));
  const nextCodes = new Set(next.map((i) => i.code.trim()));
  return {
    added: next.filter((i) => !before.has(i.code.trim())).map((i) => i.code),
    changed: next.filter((i) => before.has(i.code.trim()) && before.get(i.code.trim()) !== i.official_text).map((i) => i.code),
    removed: [...before.keys()].filter((c) => !nextCodes.has(c)),
  };
}

/** Edição vigente da fonte = cabeça da cadeia (sem sucessora). Mais de uma cabeça ⇒ ambíguo, nenhuma é escolhida. */
export function headEdition(editions: readonly Edition[], sourceId: string): Edition | "ambigua" | null {
  const own = editions.filter((e) => e.source_id === sourceId);
  const heads = own.filter((e) => !own.some((s) => s.supersedes_id === e.id));
  return heads.length === 0 ? null : heads.length > 1 ? "ambigua" : heads[0]!;
}

export const activeRelations = (rels: readonly Relation[]) => {
  const revoked = new Set(rels.filter((r) => r.revokes_id).map((r) => r.revokes_id));
  return rels.filter((r) => !r.revokes_id && !revoked.has(r.id));
};
export const currentSimplification = (s: readonly Simplification[], itemId: string) =>
  s.filter((x) => x.item_id === itemId).sort((a, b) => b.version_no - a.version_no)[0] ?? null;

export type Catalog = Readonly<{ editions: readonly Edition[]; items: readonly StoredItem[]; bindings: readonly Binding[]; relations: readonly Relation[]; simplifications: readonly Simplification[] }>;

export type SearchQuery = Readonly<{ text?: string; sourceId?: string; binding?: Readonly<{ scheme_id: string; value_id: string }>[]; onlyCurrentEditions?: boolean }>;

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Busca por código, termo (texto oficial ou simplificado) e vínculos canônicos (todos exigidos). */
export function searchItems(c: Catalog, q: SearchQuery): StoredItem[] {
  const edById = new Map(c.editions.map((e) => [e.id, e]));
  const currentIds = new Set(
    [...new Set(c.editions.map((e) => e.source_id))].map((s) => headEdition(c.editions, s)).filter((h): h is Edition => !!h && h !== "ambigua").map((h) => h.id),
  );
  const terms = q.text ? fold(q.text).split(/\s+/).filter(Boolean) : [];
  return c.items.filter((i) => {
    const ed = edById.get(i.edition_id);
    if (!ed) return false;
    if (q.sourceId && ed.source_id !== q.sourceId) return false;
    if ((q.onlyCurrentEditions ?? true) && !currentIds.has(ed.id)) return false;
    for (const b of q.binding ?? []) if (!c.bindings.some((x) => x.item_id === i.id && x.scheme_id === b.scheme_id && x.value_id === b.value_id)) return false;
    if (!terms.length) return true;
    const hay = fold(`${i.code} ${i.official_text} ${currentSimplification(c.simplifications, i.id)?.simplified_text ?? ""}`);
    return terms.every((t) => hay.includes(t));
  }).sort((a, b) => a.code.localeCompare(b.code));
}

export type GlossaryEntry = Readonly<{
  item: StoredItem; edition: Edition | null; officialText: string; simplified: Simplification | null; simplificationHistory: Simplification[];
  bindings: Binding[]; relations: { relation: Relation; other: StoredItem | null; direction: "saida" | "entrada" }[];
}>;
export function glossaryEntry(c: Catalog, itemId: string): GlossaryEntry | null {
  const item = c.items.find((i) => i.id === itemId);
  if (!item) return null;
  const hist = c.simplifications.filter((s) => s.item_id === itemId).sort((a, b) => b.version_no - a.version_no);
  return {
    item, edition: c.editions.find((e) => e.id === item.edition_id) ?? null, officialText: item.official_text,
    simplified: hist[0] ?? null, simplificationHistory: hist,
    bindings: c.bindings.filter((b) => b.item_id === itemId),
    relations: activeRelations(c.relations).filter((r) => r.from_item_id === itemId || r.to_item_id === itemId).map((r) => {
      const out = r.from_item_id === itemId;
      return { relation: r, other: c.items.find((i) => i.id === (out ? r.to_item_id : r.from_item_id)) ?? null, direction: out ? "saida" as const : "entrada" as const };
    }),
  };
}

/** Rótulo de seleção: simplificação quando existe, senão o texto oficial. O código acompanha, mas nunca precisa ser digitado. */
export const selectionLabel = (c: Catalog, i: StoredItem) => currentSimplification(c.simplifications, i.id)?.simplified_text ?? i.official_text;

export function referenceMessage(raw: string): string {
  const m = raw ?? "";
  if (m.includes("session-required")) return "Sua sessão expirou. Entre novamente.";
  if (m.includes("capability:manter-referencia-curricular")) return "Sua conta não tem a permissão de manter referências curriculares. Ela ainda não foi atribuída a nenhuma atuação.";
  if (m.includes("reference:stale-head")) return "Outra pessoa registrou uma versão antes de você. Recarregue e confira.";
  if (m.includes("reference:same-source-already-recorded")) return "Este mesmo arquivo-fonte já foi registrado; nada foi duplicado.";
  if (m.includes("reference:duplicate-code")) return "A fonte tem códigos repetidos; corrija antes de registrar.";
  if (m.includes("reference:binding-unknown:")) return `Vínculo a valor que não existe no SIGEM: ${m.split("binding-unknown:")[1]?.split(/\s/)[0]}.`;
  if (m.includes("duplicate key") && m.includes("edition_label")) return "Esta edição da fonte já está registrada.";
  if (m.includes("reference:append-only")) return "Referências registradas não podem ser alteradas nem apagadas.";
  return m;
}

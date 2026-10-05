import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  SOURCE_SCHEMA, activeRelations, diffEditions, glossaryEntry, headEdition, searchItems, selectionLabel, validateSource,
  type Catalog, type Edition, type StoredItem,
} from "./reference-engine";

const ed = (id: string, source_id: string, supersedes_id: string | null = null): Edition => ({
  id, source_id, source_label: source_id, authority: "a", edition_label: id, published_on: null, valid_from: null,
  source_sha256: "0".repeat(64), source_ref: null, supersedes_id, item_count: 1, recorded_at: "",
});
const it_ = (id: string, edition_id: string, code: string, text: string): StoredItem => ({ id, edition_id, code, item_kind: "item", official_text: text, parent_code: null, source_labels: {}, source_locator: null });
const file = (items: unknown[]) => ({ schema: SOURCE_SCHEMA, source: { id: "fonte-x", label: "X", authority: "Y" }, edition: { label: "1" }, items });

describe("referência curricular", () => {
  it("fonte ausente/incompleta é recusada, sem completar campos", () => {
    expect(validateSource({}).ok).toBe(false);
    const r = validateSource(file([{ code: "A1", kind: "item" }]));
    expect(r.ok).toBe(false);
  });
  it("código duplicado é recusado", () => {
    const r = validateSource(file([{ code: "A1", kind: "item", official_text: "t" }, { code: "A1", kind: "item", official_text: "u" }]));
    expect(!r.ok && r.problems.join()).toContain("repetido");
  });
  it("versionamento: nova edição não apaga a anterior; diff explícito; cabeça ambígua não escolhe", () => {
    const d = diffEditions([{ code: "A1", official_text: "t" }, { code: "A2", official_text: "u" }], [{ code: "A1", kind: "item", official_text: "t2" }, { code: "A3", kind: "item", official_text: "v" }]);
    expect(d).toEqual({ added: ["A3"], changed: ["A1"], removed: ["A2"] });
    expect((headEdition([ed("e1", "s"), ed("e2", "s", "e1")], "s") as Edition).id).toBe("e2");
    expect(headEdition([ed("e1", "s"), ed("e2", "s")], "s")).toBe("ambigua");
    expect(headEdition([], "s")).toBeNull();
  });
  const cat: Catalog = {
    editions: [ed("e1", "bn"), ed("e2", "bn", "e1"), ed("s1", "sa")],
    items: [it_("old", "e1", "H1", "Texto antigo"), it_("h1", "e2", "H1", "Compreender frações"), it_("h2", "e2", "H2", "Ler textos"), it_("d1", "s1", "D1", "Identificar frações")],
    bindings: [{ item_id: "h1", scheme_id: "elemento-de-matriz-curricular", value_id: "mat" }],
    relations: [
      { id: "r1", from_item_id: "h1", to_item_id: "d1", nature: "n", confidence: "c", provenance: "p", revokes_id: null, reason: null, recorded_at: "" },
      { id: "r2", from_item_id: "h2", to_item_id: "d1", nature: "n", confidence: "c", provenance: "p", revokes_id: null, reason: null, recorded_at: "" },
      { id: "r3", from_item_id: "h2", to_item_id: "d1", nature: "n", confidence: "c", provenance: "p", revokes_id: "r2", reason: "x", recorded_at: "" },
    ],
    simplifications: [
      { id: "s1", item_id: "h1", version_no: 1, supersedes_id: null, simplified_text: "Partes de um inteiro", reason: null, recorded_at: "" },
      { id: "s2", item_id: "h1", version_no: 2, supersedes_id: "s1", simplified_text: "Pedaços iguais de um todo", reason: "clareza", recorded_at: "" },
    ],
  };
  it("busca por código, termo, simplificação e vínculo canônico; só edição vigente", () => {
    expect(searchItems(cat, { text: "H1" }).map((i) => i.id)).toEqual(["h1"]);
    expect(searchItems(cat, { text: "fracoes" }).map((i) => i.id)).toEqual(["d1", "h1"]);
    expect(searchItems(cat, { text: "pedacos" }).map((i) => i.id)).toEqual(["h1"]);
    expect(searchItems(cat, { binding: [{ scheme_id: "elemento-de-matriz-curricular", value_id: "mat" }] }).map((i) => i.id)).toEqual(["h1"]);
    expect(searchItems(cat, { text: "antigo", onlyCurrentEditions: false }).map((i) => i.id)).toEqual(["old"]);
  });
  it("simplificação separada do oficial; relação muitos-para-muitos com revogação", () => {
    const g = glossaryEntry(cat, "h1")!;
    expect(g.officialText).toBe("Compreender frações");
    expect(g.simplified?.simplified_text).toBe("Pedaços iguais de um todo");
    expect(g.simplificationHistory).toHaveLength(2);
    expect(selectionLabel(cat, cat.items[2]!)).toBe("Ler textos");
    expect(activeRelations(cat.relations).map((r) => r.id)).toEqual(["r1"]);
    expect(glossaryEntry(cat, "d1")!.relations.map((r) => r.other?.id)).toEqual(["h1"]);
  });
  it("motor sem hardcode de BNCC/SAEB", () => {
    const src = readFileSync("src/features/curricular-reference/reference-engine.ts", "utf8").replace(/\/\*\*[\s\S]*?\*\//g, "");
    expect(src).not.toMatch(/\b(bncc|saeb|EF0\d|EI0\d|matem|portugu)/i);
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  draftFromVersion, emptyDraft, headerRows, orderedLeaves, toWriterArgs, validateDraft, cellKey, type MatrixDraft,
} from "./matrix-editor-model";
import { leafColumns, type MatrixLayout } from "./curricular-matrix-source";

const base = (): MatrixDraft => ({
  ...emptyDraft(), officialName: "Matriz T", validFrom: "2026-01-01", actRef: "Ato fictício",
  source: { locator: "Anexo fictício", page: "", sha256: "" },
  columns: [
    { key: "a", parent: null, header: "A", ref: null },
    { key: "a1", parent: "a", header: "A1", ref: null },
    { key: "a1x", parent: "a1", header: "A1x", ref: null },
    { key: "a1y", parent: "a1", header: "A1y", ref: null },
    { key: "a2", parent: "a", header: "A2", ref: null },
    { key: "b", parent: null, header: "B", ref: null },
  ],
  rows: [
    { key: "alfa", group: null, role: "item", label: "", item: { kind: "componente", componentId: "cmp-1", label: "Alfa" } },
    { key: "tot", group: null, role: "total", label: "Total", item: null },
  ],
  cells: { [cellKey("alfa", "a1x")]: { text: "X", unit: null }, [cellKey("alfa", "a1y")]: { text: "--", unit: null },
    [cellKey("alfa", "b")]: { text: "*", unit: null }, [cellKey("tot", "a2")]: { text: "4,5", unit: null } },
});

describe("B4.1.3 editor — modelo", () => {
  it("cabeçalhos de qualquer profundidade (3 níveis) com spans coerentes", () => {
    const h = headerRows(base().columns);
    expect(h).toHaveLength(3);
    expect(h[0]!.map((c) => [c.key, c.colSpan, c.rowSpan])).toEqual([["a", 3, 1], ["b", 1, 3]]);
    expect(h[1]!.map((c) => [c.key, c.colSpan, c.rowSpan])).toEqual([["a1", 2, 1], ["a2", 1, 2]]);
    expect(h[2]!.map((c) => c.key)).toEqual(["a1x", "a1y"]);
    expect(orderedLeaves(base().columns).map((c) => c.key)).toEqual(["a1x", "a1y", "a2", "b"]);
  });

  it("folhas do leitor seguem a mesma pré-ordem, mesmo com colunas fora de ordem", () => {
    const layout = { columns: [
      { key: "b", parent: null, header: "B" }, { key: "a", parent: null, header: "A" },
      { key: "a2", parent: "a", header: "A2" }, { key: "a1", parent: "a", header: "A1" },
    ] } as unknown as MatrixLayout;
    expect(leafColumns(layout).map((c) => c.key)).toEqual(["b", "a2", "a1"]);
  });

  it("símbolos e números vão como texto literal; célula vazia não é enviada; item sem quantidade", () => {
    const d = base(); d.cells[cellKey("tot", "b")] = { text: "", unit: null };
    const a = toWriterArgs(d);
    const cells = a._layout["cells"] as { text: string; number?: unknown }[];
    expect(cells.map((c) => c.text).sort()).toEqual(["*", "--", "4,5", "X"]);
    expect(cells.every((c) => !("number" in c) && !("unit" in c))).toBe(true);
    expect(a._items).toEqual([{ key: "alfa", component: "cmp-1" }]);
    expect(JSON.stringify(a._items)).not.toContain("quantity");
    expect(a._matrix).toBeNull(); expect(a._base_version_id).toBeNull(); expect(a._change_kind).toBe("constituicao");
  });

  it("validação: motivo e base em nova versão, unidade só em número, ciclos e chaves", () => {
    expect(validateDraft(base())).toEqual([]);
    const s = { ...base(), mode: "sucessao" as const };
    expect(validateDraft(s).map((i) => i.field)).toEqual(expect.arrayContaining(["base", "reason"]));
    const u = base(); u.cells[cellKey("alfa", "a1x")] = { text: "X", unit: { scheme: "unidade-de-carga-da-matriz", value: "h", version: 1 } };
    expect(validateDraft(u).some((i) => i.message.includes("Unidade só pode"))).toBe(true);
    const c = base(); c.columns[0]!.parent = "a1x";
    expect(validateDraft(c).some((i) => i.field === "columns")).toBe(true);
    const k = base(); k.rows[1]!.key = "Tot Al";
    expect(validateDraft(k).some((i) => i.message.includes("inválida"))).toBe(true);
    const sha = base(); sha.source.sha256 = "abc";
    expect(validateDraft(sha).some((i) => i.field === "source.sha256")).toBe(true);
  });

  it("carregar versão existente gera NOVA versão com base esperada = última, sem copiar o ato", () => {
    const d = draftFromVersion({
      matrix: { matrixId: "mat-1", versionId: "v2", version: 2, changeKind: "sucessao", officialName: "M", validFrom: "2026-01-01",
        validUntil: null, effectiveUntil: null, actRef: "Ato 1", recordedAt: "" },
      latestVersionId: "v3",
      items: [{ versionId: "v2", itemKey: "alfa", position: 0, reference: { kind: "componente", componentId: "cmp-1", labelSnapshot: "Alfa" }, load: null }],
      applicability: [], mode: "retificacao",
      layout: { versionId: "v2", source: { act: "Ato 1", locator: "Anexo", page: null, sha256: null },
        columns: [{ key: "c", parent: null, header: "C" }], groups: [], rows: [{ key: "r", group: null, role: "item", item: "alfa", label: null }],
        cells: [{ row: "r", column: "c", text: "X", number: null }], notes: [] },
    });
    expect(d.mode).toBe("retificacao"); expect(d.baseVersionId).toBe("v3"); expect(d.actRef).toBe("");
    expect(d.cells[cellKey("r", "c")]?.text).toBe("X");
    const a = toWriterArgs({ ...d, actRef: "Ato 2", reason: "correção" });
    expect(a._matrix).toBe("mat-1"); expect(a._items).toEqual([{ key: "r", component: "cmp-1" }]);
    expect((a._layout["rows"] as { item?: string }[])[0]?.item).toBe("r");
  });

  it("UI grava só pelo writer canônico e condiciona escrita à capacidade de rede", () => {
    const ui = readFileSync("src/features/curriculum/institutional-matrix-editor.tsx", "utf8");
    const page = readFileSync("src/features/curriculum/institutional-matrices.tsx", "utf8");
    const src = readFileSync("src/features/curriculum/curricular-matrix-source.ts", "utf8");
    expect(ui).not.toMatch(/\.from\(|\.insert\(|\.update\(|service_role/);
    expect(src).toMatch(/rpc\("record_curricular_matrix_version"/);
    expect(page).toMatch(/canMaintainMatrices\(a\.capabilities\)/);
    expect(ui + page).not.toMatch(/curriculum-data|matrix-draft"/);
  });
});

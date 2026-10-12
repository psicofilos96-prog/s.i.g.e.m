import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const doc = readFileSync("docs/sigem-relatorio-pendencias-lote22.md", "utf8");
const rows = doc.split("\n").filter((l) => /^\| P\d-\d\d \|/.test(l));

describe("lote 22 — relatório de pendências com uma linha completa por pendência", () => {
  it("tem pendências", () => expect(rows.length).toBeGreaterThan(20));
  it("cada linha tem classe, arquivo, rota, teste, bloqueio, evidência e próximo passo", () => {
    for (const r of rows) {
      const cells = r.split("|").slice(1, -1).map((c) => c.trim());
      expect(cells, r).toHaveLength(9);
      expect(["C", "P", "B", "V", "X"], r).toContain(cells[1]);
      for (const c of cells) expect(c.length, r).toBeGreaterThan(0);
    }
  });
  it("concluído só com evidência e totais batem", () => {
    const cls = rows.map((r) => r.split("|")[2]!.trim());
    const n = (k: string) => cls.filter((c) => c === k).length;
    expect(doc).toContain(`C ${n("C")} · P ${n("P")} · B ${n("B")} · V ${n("V")} · X ${n("X")} — total ${rows.length}`);
    expect(doc).not.toMatch(/homologad[oa] por /i);
  });
});

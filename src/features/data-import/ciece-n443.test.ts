import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("N4.4.3 — CIECE: zero ≠ sem dado e proveniência", () => {
  it("proveniência da importação nunca exibe versão 0 quando o formato é desconhecido", () => {
    const s = read("src/features/data-import/import-center-page.tsx");
    expect(s).not.toMatch(/adapter\?\.version \?\? 0/);
    expect(s).toContain("versão não disponível");
  });
  it("tabelas de Importações e Censo têm caption e cabeçalhos com scope", () => {
    for (const p of ["src/features/data-import/import-center-page.tsx", "src/features/census-cycle/census-page.tsx"]) {
      const s = read(p);
      const tables = (s.match(/<table/g) ?? []).length;
      expect((s.match(/<caption/g) ?? []).length).toBeGreaterThanOrEqual(tables);
      expect(s).not.toMatch(/<th className=/);
    }
  });
  it("situação desconhecida da Qualidade não fica em branco", () => {
    expect(read("src/features/data-quality/quality-page.tsx")).toContain('STATE_LABEL[item.state] ?? "Situação não reconhecida"');
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dictionary, indicatorCatalog, type SchemaColumn } from "./data-dictionary";

/** Lê colunas reais do schema gerado (bloco Row de cada tabela). */
function schemaFromTypes(): SchemaColumn[] {
  const src = readFileSync("src/integrations/supabase/types.ts", "utf8").replace(/\r\n/g, "\n");
  const out: SchemaColumn[] = [];
  for (const m of src.matchAll(/\n      (\w+): \{\n        Row: \{\n([\s\S]*?)\n        \}/g)) {
    for (const c of m[2]!.matchAll(/^\s+(\w+): ([^\n]+)$/gm)) out.push({ table: m[1]!, column: c[1]!, type: c[2]!.replace(/ \| null$/, ""), nullable: c[2]!.includes("| null") });
  }
  return out;
}

describe("dicionário de dados", () => {
  const schema = schemaFromTypes();
  const dict = dictionary(schema);
  it("toda entidade do catálogo existe no schema real com campos e tipos", () => {
    expect(schema.length).toBeGreaterThan(100);
    expect(dict.filter((d) => !d.schemaFound).map((d) => d.entity)).toEqual([]);
    expect(dict.find((d) => d.entity === "school_enrollments")!.fields.find((f) => f.field === "opened_on")).toMatchObject({ nullable: true });
  });
  it("todo campo tem dono e LGPD da matrícula vem do inventário", () => {
    expect(dict.every((d) => d.owner && d.writer)).toBe(true);
    expect(dict.find((d) => d.entity === "school_enrollments")!.lgpd).toMatchObject({ sensitivity: "pessoal-crianca", minors: true });
  });
  it("indicador tem fórmula explícita, denominador quando proporção e limitações", () => {
    for (const c of indicatorCatalog()) { expect(c.formula).toBeTruthy(); expect(c.numerator).toBeTruthy(); }
    const p = indicatorCatalog().find((c) => c.code === "frequencia-registrada@v1")!;
    expect(p.denominator).not.toBeNull();
    expect(p.limitations.join()).toContain("denominador");
  });
});

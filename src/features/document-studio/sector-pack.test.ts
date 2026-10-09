import { describe, expect, it } from "vitest";
import { BASE_TEMPLATES } from "./base-templates";
import { validateTemplate } from "./studio-engine";

describe("DOCS.PRO.2 — pacote por setor", () => {
  it("cobre todos os setores pedidos", () => {
    const s = new Set(BASE_TEMPLATES.map((t) => t.sector));
    for (const x of ["secretaria", "direcao", "orientacao", "docente", "ciece", "avaliacao", "alimentacao", "inclusao", "familia", "admin"]) expect(s.has(x)).toBe(true);
  });
  it("todo modelo valida (tokens do catálogo, sem marcação)", () => {
    for (const t of BASE_TEMPLATES) expect(validateTemplate(t.blocks, t.page), t.id).toEqual([]);
  });
  it("ids únicos", () => {
    expect(new Set(BASE_TEMPLATES.map((t) => t.id)).size).toBe(BASE_TEMPLATES.length);
  });
  it("modelo de inclusão não usa campo clínico", () => {
    const inc = BASE_TEMPLATES.filter((t) => t.sector === "inclusao");
    for (const t of inc) expect(JSON.stringify(t.blocks)).not.toMatch(/cid|laudo|diagn/i);
  });
});

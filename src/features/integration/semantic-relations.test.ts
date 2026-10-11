import { describe, expect, it } from "vitest";
import { SEMANTIC_RELATIONS, path, isQueryable } from "./semantic-relations";

describe("camada semântica", () => {
  it("chaves únicas e toda relação com cardinalidade e origem", () => {
    expect(new Set(SEMANTIC_RELATIONS.map((r) => r.key)).size).toBe(SEMANTIC_RELATIONS.length);
    for (const r of SEMANTIC_RELATIONS) expect(r.origin.length).toBeGreaterThan(0);
  });
  it("servidor da planilha nunca liga a atuação por nome", () => {
    expect(isQueryable(SEMANTIC_RELATIONS.find((r) => r.key === "servidor->atuacao")!)).toBe(false);
    expect(path(["servidor->atuacao"]).ok).toBe(false);
  });
  it("alimentação fica fora da consulta livre", () => {
    expect(path(["escola->alimentacao"]).ok).toBe(false);
  });
  it("estudante→matrícula→escola é caminho de 3 fontes válido", () => {
    expect(path(["estudante->matricula", "escola->matricula"]).ok).toBe(true);
  });
  it("vigência de matrícula nunca usa data da carga", () => {
    expect(SEMANTIC_RELATIONS.find((r) => r.key === "escola->matricula")!.validity).toMatch(/nunca a data da carga/);
  });
});

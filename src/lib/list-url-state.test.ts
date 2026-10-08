import { describe, expect, it } from "vitest";
import { readListFilters, writeListFilters } from "./list-url-state";

const defaults = { situation: "all", unitId: "all" };

describe("NFILTER.1 — filtros na URL", () => {
  it("lê só chaves declaradas e ignora as demais", () => {
    expect(readListFilters({ situation: "ativo", nome: "Maria Silva", extra: "x" }, defaults)).toEqual({ situation: "ativo", unitId: "all" });
  });
  it("valor fora do formato de opção volta ao padrão", () => {
    expect(readListFilters({ situation: "<script>", unitId: "a".repeat(200) }, defaults)).toEqual(defaults);
  });
  it("valor padrão sai da URL e preserva outros parâmetros", () => {
    expect(writeListFilters({ page: 2, situation: "ativo" }, { situation: "all", unitId: "u1" }, defaults)).toEqual({ page: 2, unitId: "u1" });
  });
  it("limpar filtros remove todas as chaves de filtro", () => {
    expect(writeListFilters({ situation: "ativo", unitId: "u1" }, defaults, defaults)).toEqual({});
  });
});

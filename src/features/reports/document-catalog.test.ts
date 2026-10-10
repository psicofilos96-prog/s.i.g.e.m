import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { DOCUMENT_CATALOG, filterCatalog } from "./document-catalog";

const file = (r: string) => `src/routes/${r.slice(1).replaceAll("/", ".").replaceAll("$codigo", "$codigo")}.tsx`;

describe("catálogo documental", () => {
  it("todo documento com tela aponta para rota existente", () => {
    for (const d of DOCUMENT_CATALOG.filter((x) => x.route)) expect(existsSync(file(d.route!)), d.id).toBe(true);
  });
  it("BLOQUEADO nunca tem tela; COMPLETO sempre tem", () => {
    expect(DOCUMENT_CATALOG.filter((d) => d.status === "BLOQUEADO" && d.route)).toEqual([]);
    expect(DOCUMENT_CATALOG.filter((d) => d.status === "COMPLETO" && !d.route)).toEqual([]);
  });
  it("todo item tem razão e ids únicos", () => {
    expect(new Set(DOCUMENT_CATALOG.map((d) => d.id)).size).toBe(DOCUMENT_CATALOG.length);
    expect(DOCUMENT_CATALOG.every((d) => d.reason.length > 10)).toBe(true);
  });
  it("filtra por setor e status", () => {
    expect(filterCatalog("", "Alimentação", "BLOQUEADO").every((d) => d.sector === "Alimentação")).toBe(true);
  });
});

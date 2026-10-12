import { describe, expect, it } from "vitest";
import { historicalLabel, makeLink, searchCatalog, skillCoverage, type CatalogItem } from "./skill-links";

const cat: CatalogItem[] = [
  { itemId: "i1", editionId: "bncc-2018", code: "EF06MA07", description: "Compreender frações associadas às ideias de partes", stage: "EF", year: "6", component: "MA", thematicUnit: "Números", knowledgeObject: "Frações" },
  { itemId: "i2", editionId: "bncc-2018", code: "EF06LP01", description: "Reconhecer a impossibilidade de uma neutralidade absoluta", stage: "EF", year: "6", component: "LP", thematicUnit: "Leitura" },
];
const valid = (e: string, d: string) => e === "bncc-2018" && d >= "2019-01-01";

describe("catálogo e vínculo de habilidades (Docente L08)", () => {
  it("busca por filtros exatos e texto sem acento exigindo todas as palavras", () => {
    expect(searchCatalog(cat, { component: "MA" }).map((i) => i.code)).toEqual(["EF06MA07"]);
    expect(searchCatalog(cat, { text: "fracoes partes" }).map((i) => i.code)).toEqual(["EF06MA07"]);
    expect(searchCatalog(cat, { text: "fracoes leitura" })).toEqual([]);
    expect(searchCatalog(cat, { text: "ef06lp" }).map((i) => i.itemId)).toEqual(["i2"]);
  });
  it("plano nunca prova trabalho; aula concluída prova; avaliação aplicada é avaliada", () => {
    const p = makeLink({ target: "plano", targetId: "p", targetDate: "2026-03-01", item: cat[0]!, editionValidOn: valid, positionKey: "6ano", realized: true });
    expect(p.realized).toBe(false);
    expect(skillCoverage([p], "i1")).toBe("planejada");
    const a = makeLink({ target: "aula", targetId: "l", targetDate: "2026-03-05", item: cat[0]!, editionValidOn: valid, positionKey: "6ano", realized: true });
    expect(skillCoverage([p, a], "i1")).toBe("trabalhada");
    const av = makeLink({ target: "avaliacao", targetId: "v", targetDate: "2026-03-20", item: cat[0]!, editionValidOn: valid, positionKey: "6ano", realized: true });
    expect(skillCoverage([p, a, av], "i1")).toBe("avaliada");
    expect(skillCoverage([], "i2")).toBe("sem registro");
  });
  it("edição fora de vigência na data é recusada", () => {
    expect(() => makeLink({ target: "aula", targetId: "l", targetDate: "2018-05-01", item: cat[0]!, editionValidOn: valid, positionKey: null, realized: true })).toThrow(/vigente/);
  });
  it("vínculo histórico preserva edição e posição gravadas", () => {
    const a = makeLink({ target: "aula", targetId: "l", targetDate: "2026-03-05", item: cat[0]!, editionValidOn: valid, positionKey: "6ano", realized: true });
    expect(a.ref.editionId).toBe("bncc-2018");
    expect(a.positionKey).toBe("6ano");
    expect(historicalLabel(a, cat)).toMatch(/EF06MA07/);
    expect(historicalLabel(a, [])).toMatch(/preservada/);
  });
});

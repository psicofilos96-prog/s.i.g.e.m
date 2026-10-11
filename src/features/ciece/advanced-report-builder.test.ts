import { describe, expect, it } from "vitest";
import { validateSpec, render, resolveChart, saveModel, openModel, SUPPORTED_CHARTS, authorizedSources, type BuilderSpec } from "./advanced-report-builder";

const caps = new Set(["consultar-ciece"]);
const layout: BuilderSpec["layout"] = { title: "Histórico", logoId: null, header: [], footer: [], font: "serif", logoPosition: "topo-esquerda", orientation: "retrato" };
const spec = (o: Partial<BuilderSpec> = {}): BuilderSpec => ({ sourceId: "ciece-historico", fields: [], filters: [], groupBy: [], measures: [], sort: [], chart: null, layout, ...o });
const rows = [
  { ano: "2026", etapa: "matricula-inicial", dataRef: "2026-05-27", versao: 1, substitui: null, regra: "r", oficial: "sim", pessoas: 10, matriculas: 11, excluidos: 0, digest: "d1", conhecidoAte: "x" },
  { ano: "2026", etapa: "situacao-do-aluno", dataRef: "2026-12-31", versao: 1, substitui: null, regra: "r", oficial: "não", pessoas: null, matriculas: 9, excluidos: 2, digest: "d2", conhecidoAte: "x" },
];

describe("CIECE L14 gerador avançado", () => {
  it("23 tipos de gráfico do motor existente; fontes só com capacidade", () => {
    expect(SUPPORTED_CHARTS).toHaveLength(23);
    expect(authorizedSources(new Set())).toEqual([]);
    expect(validateSpec(spec(), new Set())).toContain("fonte-nao-autorizada");
  });
  it("recusa SQL, linhas gravadas, coluna sensível, logo fora do catálogo e conteúdo ativo", () => {
    expect(validateSpec({ ...spec(), sql: "select 1" } as unknown as BuilderSpec, caps)).toContain("campo-proibido:sql");
    expect(validateSpec({ ...spec(), rows: [] } as unknown as BuilderSpec, caps)).toContain("campo-proibido:rows");
    expect(validateSpec(spec({ sourceId: "ciece-resultados", fields: ["matricula"] }), caps)).toContain("coluna-sensivel:matricula");
    expect(validateSpec(spec({ layout: { ...layout, logoId: "http://x" } }), caps)).toContain("logo-fora-do-catalogo");
    expect(validateSpec(spec({ layout: { ...layout, title: "<script>x</script>" } }), caps)).toContain("campo-proibido:conteudo-ativo");
    expect(validateSpec(spec({ measures: [{ column: "etapa", agg: "soma" }] }), caps)).toContain("agregacao-exige-numero:etapa");
  });
  it("gráfico incompatível degrada para tabela com motivo; compatível é mantido", () => {
    expect(resolveChart(spec({ chart: "pie" })).kind).toBe("table");
    expect(resolveChart(spec({ chart: "pie" })).reason).toBeTruthy();
    expect(resolveChart(spec({ chart: "map", groupBy: ["etapa"], measures: [{ column: "pessoas", agg: "soma" }] })).kind).toBe("table");
    expect(resolveChart(spec({ chart: "bar", groupBy: ["etapa"], measures: [{ column: "pessoas", agg: "soma" }] })).kind).toBe("bar");
  });
  it("prévia fiel = exportação; ausente fica fora e é contado", () => {
    const s = spec({ groupBy: ["ano"], measures: [{ column: "pessoas", agg: "soma" }, { column: "matriculas", agg: "soma" }], chart: "bar" });
    const now = new Date("2026-10-11T00:00:00Z");
    const full = render(s, caps, rows, { year: 2026 }, now);
    const prev = render(s, caps, rows, { year: 2026 }, now, 20);
    expect(prev.result.rows).toEqual(full.result.rows);
    expect(full.result.rows).toEqual([["2026", 10, 20]]);
    expect(full.excluded).toBe(1);
  });
  it("modelo salvo guarda só escolhas e é revalidado ao abrir", () => {
    const m = saveModel("meu", "u1", spec({ fields: ["ano", "versao"] }), caps, "t");
    expect(Object.keys(m)).toEqual(["name", "owner", "spec", "savedAt"]);
    expect(openModel(m, new Set()).errors).toContain("fonte-nao-autorizada");
    expect(() => saveModel("x", "u1", spec({ fields: ["inexistente"] }), caps, "t")).toThrow("coluna-desconhecida");
  });
});

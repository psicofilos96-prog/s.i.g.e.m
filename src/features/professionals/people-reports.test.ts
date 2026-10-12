import { describe, expect, it } from "vitest";
import { PEOPLE_REPORTS, peopleReportRows, runPeopleReport } from "./people-reports";

const params = { asOf: "2026-03-02", knownAt: "2026-03-02T12:00:00Z", scope: "escola" };

describe("relatórios de Gestão de Pessoas", () => {
  it("são 22, ids únicos, com data de referência e conhecido-até obrigatórios", () => {
    expect(PEOPLE_REPORTS).toHaveLength(22);
    expect(new Set(PEOPLE_REPORTS.map((r) => r.id)).size).toBe(22);
    for (const r of PEOPLE_REPORTS) {
      expect(r.params.find((p) => p.id === "asOf")?.required).toBe(true);
      expect(r.params.find((p) => p.id === "knownAt")?.required).toBe(true);
    }
    expect(PEOPLE_REPORTS.map((r) => r.id)).toEqual(expect.arrayContaining(["total-aulas-ofertadas", "total-aulas-rede", "necessidade-de-professor", "quadro-de-pessoal", "lotacao", "exercicio", "disponibilidade", "cobertura-docente", "movimentacoes"]));
  });
  it("ausência fica null com motivo; matrícula funcional sai por padrão", () => {
    const r = runPeopleReport("jornadas-cargas", { params }, [{ pessoa: "P1", vinculo: "123", item: "contratual", valor: null }]);
    expect(r.columns.map((c) => c.id)).not.toContain("vinculo");
    const row = Object.fromEntries(r.columns.map((c, i) => [c.id, r.rows[0]![i]]));
    expect(row["valor"]).toBeNull();
    expect(row["motivo"]).toBe("valor não disponível na fonte");
    expect(row["natureza"]).toBe("projeção dinâmica (não oficial)");
  });
  it("sem data de referência é recusado", () => {
    expect(() => runPeopleReport("lotacao", { params: { scope: "escola" } }, [])).toThrow();
  });
  it("cenário simulado nunca vira relatório", () => {
    expect(() => peopleReportRows([], { simulated: true })).toThrow("report:simulation-not-admitted");
  });
  it("relatório com fonte não persistida é recusado", () => {
    expect(() => runPeopleReport("afastamentos", { params }, [])).toThrow(/indisponível/);
    expect(() => runPeopleReport("dimensionamento-nao-docente", { params }, [])).toThrow(/indisponível/);
  });
  it("oferece CSV, XLSX e PDF nos relatórios novos", () => {
    expect(PEOPLE_REPORTS.find((r) => r.id === "quadro-de-pessoal")!.formats).toEqual(["csv", "xlsx", "pdf"]);
  });
});

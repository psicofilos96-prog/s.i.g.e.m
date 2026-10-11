import { describe, expect, it } from "vitest";
import { PROGRAM_CATALOG, validateDataPoint, aggregateMean, registrationState, type DataPoint } from "./program-catalog";

const base = (o: Partial<DataPoint> = {}): DataPoint => ({ program: "cnca-caed", edition: "2026-c1", source: "CAEd", instrument: "lp", schoolId: "s", year: 2026, classId: "c", studentId: "a",
  date: "2026-04-01", value: 700, population: "2º ano", matrix: null, method: "TRI", revision: 1, scaleKey: "cnca-caed", ...o });

describe("catálogo A&A", () => {
  it("tem os 10 programas pedidos, sem escala oficial presumida", () => {
    expect(PROGRAM_CATALOG).toHaveLength(10);
    expect(PROGRAM_CATALOG.every((p) => p.officialScale === null && p.officialMatrix === null)).toBe(true);
    expect(new Set(PROGRAM_CATALOG.map((p) => p.scaleKey)).size).toBe(10);
  });
  it("Saber Ler declara semanas 4/8/12/16 e CNCA ciclos I/II/III", () => {
    expect(PROGRAM_CATALOG.find((p) => p.key === "saber-ler")!.cycles).toEqual(["semana 4", "semana 8", "semana 12", "semana 16"]);
    expect(PROGRAM_CATALOG.find((p) => p.key === "cnca-caed")!.cycles).toEqual(["Ciclo I", "Ciclo II", "Ciclo III"]);
  });
  it("ponto completo é válido", () => expect(validateDataPoint(base())).toEqual([]));
  it("recusa estudante no SAEB/IDEB", () => expect(validateDataPoint(base({ program: "saeb-ideb", scaleKey: "saeb-proficiencia" }))).toContain("estudante-nao-legitimo"));
  it("recusa escala divergente", () => expect(validateDataPoint(base({ scaleKey: "saeb-proficiencia" }))).toContain("escala-divergente"));
  it("taxa sem denominador é recusada", () => expect(validateDataPoint(base({ program: "infrequencia", scaleKey: "infrequencia-taxa", value: 0.1 }))).toContain("denominador-ausente"));
  it("numerador maior que denominador é recusado", () => expect(validateDataPoint(base({ program: "infrequencia", scaleKey: "infrequencia-taxa", numerator: 5, denominator: 4 }))).toContain("numerador-maior"));
  it("valor ausente não vira zero", () => expect(validateDataPoint(base({ value: null }))).toContain("valor-ausente"));
  it("sem fonte/edição/revisão é recusado", () => expect(validateDataPoint(base({ source: null, edition: null, revision: 0 }))).toEqual(expect.arrayContaining(["source-ausente", "edition-ausente", "revision-invalida"])));
  it("programa desconhecido", () => expect(validateDataPoint(base({ program: "x" }))).toEqual(["programa-desconhecido"]));
  it("não mistura escalas na média", () => {
    const r = aggregateMean([base(), base({ program: "avalia-rj", scaleKey: "avalia-rj" })]);
    expect(r.ok).toBe(false);
  });
  it("média ignora ausentes e conta-os", () => expect(aggregateMean([base({ value: 600 }), base({ value: 800 }), base({ value: null })])).toEqual({ ok: true, mean: 700, n: 2, missing: 1 }));
  it("estado de registro por nome exato", () => {
    const s = registrationState(["SAEB/IDEB"]);
    expect(s.filter((x) => x.registered).map((x) => x.spec.key)).toEqual(["saeb-ideb"]);
  });
});

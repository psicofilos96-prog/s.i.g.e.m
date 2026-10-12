import { describe, expect, it } from "vitest";
import { coverageGrid, dashboard, filterRoster } from "./people-hub-model";
import type { PersonPicture } from "./functional-life";
import type { ClassResult } from "@/features/staffing/staffing-model";

const person = (id: string, o: Partial<PersonPicture> = {}): PersonPicture => ({
  personId: id, qualifications: [], engagements: [], exerciseWithoutPosting: [],
  links: [{ link: { logical_id: `L-${id}`, version: 1 } as any, validity: "vigente", postings: [{ posting: { logical_id: `P-${id}` } as any, validity: "vigente" }], exercises: [], events: [], processes: [] }], ...o,
});
const cls = (state: ClassResult["state"], cells: Partial<ClassResult["cells"][number]>[] = []): ClassResult => ({
  classId: "T1", label: "1º A", state, cells: cells.map((c) => ({ classId: "T1", componentId: "MAT", lessons: 5, demandMinutes: 250, coveredMinutes: 250, uncoveredMinutes: 0, reasons: [], refs: [], ...c })) as any,
});

describe("Gestão de Pessoas — painel", () => {
  it("dado de demonstração nunca vira indicador", () => {
    expect(dashboard("demonstracao", [person("a")], [])).toEqual({ indicators: [], alerts: [], refused: true });
  });
  it("fonte não lida ⇒ null, nunca zero", () => {
    const d = dashboard("institucional", null, null);
    expect(d.indicators.every((i) => i.value === null)).toBe(true);
  });
  it("conta só o que foi lido e gera alertas com evidência", () => {
    const d = dashboard("institucional", [person("a", { exerciseWithoutPosting: ["L-a"] })], [cls("ok", [{}, { componentId: "POR", coveredMinutes: 0, uncoveredMinutes: 250 }])]);
    expect(d.indicators.find((i) => i.id === "pessoas")!.value).toBe(1);
    expect(d.indicators.find((i) => i.id === "aulas")!.value).toBe(10);
    expect(d.indicators.find((i) => i.id === "componentes-descobertos")!.value).toBe(1);
    expect(d.alerts.map((a) => a.kind).sort()).toEqual(["aulas-descobertas", "exercicio-sem-lotacao", "sem-atuacao"]);
  });
  it("turma ilegível deixa total de aulas aberto", () => {
    expect(dashboard("institucional", [], [cls("grade-ilegivel")]).indicators.find((i) => i.id === "aulas")!.value).toBeNull();
  });
  it("filtros do quadro e cobertura por célula", () => {
    const names = new Map([["a", "Ana"], ["b", "Bruno"]]);
    expect(filterRoster([person("a"), person("b")], names, { text: "an", situation: "todos" }).map((p) => p.personId)).toEqual(["a"]);
    expect(filterRoster([person("a", { links: [] })], names, { text: "", situation: "sem-lotacao" })).toHaveLength(1);
    expect(coverageGrid([cls("ok", [{}, { coveredMinutes: 100, uncoveredMinutes: 150 }, { coveredMinutes: 0, uncoveredMinutes: 250 }, { coveredMinutes: null }])]).map((c) => c.state))
      .toEqual(["integral", "parcial", "ausente", "indeterminada"]);
  });
});

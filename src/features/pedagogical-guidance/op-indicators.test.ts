import { describe, it, expect } from "vitest";
import { OP_INDICATORS, computeOpIndicator, buildSeries, validateFilters, alertsFor, prioritySuggestions, guardSuggestionText, type Reading } from "./op-indicators";

const def = (k: string) => OP_INDICATORS.find((d) => d.key === k)!;
const rd = (n: number, total: number, period = "2026-04", filters: Record<string, string> = {}): Reading =>
  ({ status: "lido", readAt: "2026-04-30T10:00", scope: { schoolId: "s1", period, filters }, observations: Array.from({ length: total }, (_, i) => ({ subjectId: `x${i}`, inNumerator: i < n })) });

describe("OP Lote 20 — indicadores e inteligência pedagógica", () => {
  it("catálogo cobre os 11 indicadores com fórmula, fonte e limitações", () => {
    expect(OP_INDICATORS).toHaveLength(11);
    expect(OP_INDICATORS.every((d) => d.source && d.limitations.length > 0 && d.version === 1)).toBe(true);
  });
  it("valor pelo motor 14.2 com numerador/denominador/fonte/data", () => {
    const v = computeOpIndicator(def("aulas-registradas"), rd(30, 40));
    expect(v).toMatchObject({ status: "disponivel", value: 75, numerator: 30, denominator: 40, readAt: "2026-04-30T10:00", source: "op-lesson-execution" });
    expect(v.formula).toMatch(/aulas previstas/);
    expect(computeOpIndicator(def("projetos-em-execucao"), rd(3, 7)).value).toBe(3);
  });
  it("fonte não lida = indisponível; denominador zero = indeterminado; nunca zero", () => {
    expect(computeOpIndicator(def("aulas-registradas"), { status: "nao-lido", reason: "Sem grade" })).toMatchObject({ status: "indisponivel", value: null });
    expect(computeOpIndicator(def("aulas-registradas"), rd(0, 0))).toMatchObject({ status: "indeterminado", value: null });
    expect(computeOpIndicator(def("aulas-registradas"), rd(2, 40), { aggregateForCentral: true }).status).toBe("suprimido");
  });
  it("série só com mesma versão e recorte; filtros só declarados", () => {
    const s = buildSeries(def("reunioes-com-ata"), [{ reading: rd(3, 4, "2026-05"), defVersion: 1 }, { reading: rd(1, 4, "2026-04"), defVersion: 1 },
      { reading: rd(1, 4, "2026-06", { turma: "A" }), defVersion: 1 }, { reading: rd(1, 4, "2026-07"), defVersion: 2 }]);
    expect(s.series.map((p) => p.period)).toEqual(["2026-04", "2026-05"]);
    expect(s.excluded).toHaveLength(2);
    expect(validateFilters({ turma: "A", raca: "x" })).toEqual(["Filtro não previsto: raca."]);
  });
  it("alerta só com limiar homologado e com fonte; ambíguo bloqueia", () => {
    const v = [computeOpIndicator(def("aulas-registradas"), rd(20, 40))];
    expect(alertsFor(v, []).alerts).toEqual([]);
    expect(alertsFor(v, [{ indicatorKey: "aulas-registradas", version: 1, below: 80, homologated: false, sourceRef: "x" }]).blocked).toHaveLength(1);
    expect(alertsFor(v, [{ indicatorKey: "aulas-registradas", version: 1, below: 80, homologated: true, sourceRef: "a" }, { indicatorKey: "aulas-registradas", version: 2, below: 70, homologated: true, sourceRef: "b" }]).blocked[0]).toMatch(/mais de um/);
    const a = alertsFor(v, [{ indicatorKey: "aulas-registradas", version: 1, below: 80, homologated: true, sourceRef: "ato-1" }]);
    expect(a.alerts[0]).toMatchObject({ thresholdVersion: 1, sourceRef: "ato-1" });
  });
  it("sugestão de prioridade explica fatos e deixa a decisão ao orientador", () => {
    const v = [computeOpIndicator(def("aulas-registradas"), rd(20, 40)), computeOpIndicator(def("devolutivas-respondidas"), rd(1, 10))];
    const th = [{ indicatorKey: "aulas-registradas", version: 1, below: 80, homologated: true, sourceRef: "a" }, { indicatorKey: "devolutivas-respondidas", version: 1, below: 50, homologated: true, sourceRef: "b" }];
    const s = prioritySuggestions(alertsFor(v, th).alerts, v);
    expect(s[0]!.key).toBe("devolutivas-respondidas");
    expect(s.every((x) => x.decision === "orientador" && x.automaticAction === null)).toBe(true);
    expect(s[0]!.why).toMatch(/1\/10/);
    expect(guardSuggestionText("ranking dos professores")).not.toBeNull();
  });
});

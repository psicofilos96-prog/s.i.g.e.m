/**
 * Saneamento pós-12I — frequência multiescopo e declarativa (refinamentos 1–6).
 *
 * Todos os cenários usam a MESMA infraestrutura: mudam apenas a configuração
 * declarada (unidade, escopo, universo, agregação). Nenhum cenário exige
 * alteração do motor, e nenhuma etapa/modalidade aparece no código avaliador.
 */
import { describe, expect, it } from "vitest";
import {
  evaluateAttendanceFormula,
  evaluateAttendanceFormulaOverScopes,
  type AttendanceFrequencyFormula,
  type AttendanceScopeMeasures,
} from "./attendance-formula";
import {
  ATTENDANCE_SCOPE_DIMENSIONS,
  resolveAttendanceAccountingUnit,
  type AttendanceScopeDimension,
} from "./attendance-scope-dimensions";

const base: AttendanceFrequencyFormula = {
  id: "ffr-teste",
  version: 1,
  label: "Fórmula demonstrativa",
  status: "rascunho",
  unitId: "unidades",
  scopeDimensionId: "ciclo",
  aggregation: "escopo-unico",
  denominator: [{ measureId: "unidades-aplicaveis" }],
  numerator: [{ measureId: "presencas" }],
  incompleteData: "impede-conclusao",
  resultFactId: "proporcao-de-presenca-por-unidades",
};

const formula = (over: Partial<AttendanceFrequencyFormula> = {}): AttendanceFrequencyFormula => ({
  ...base,
  ...over,
});

const scope = (
  kind: string,
  id: string,
  measures: Record<string, number | null>,
): AttendanceScopeMeasures => ({ scope: { kind, id, label: id }, measures });

describe("frequência: política global por unidades", () => {
  it("apura no escopo do ciclo sem conhecer etapa ou modalidade", () => {
    const result = evaluateAttendanceFormulaOverScopes({
      formula: formula(),
      scopes: [scope("ciclo", "cic-1", { presencas: 180, "unidades-aplicaveis": 200 })],
    });
    expect(result.value).toBeCloseTo(0.9);
    expect(result.perScope[0]!.algorithm).toContain("presencas");
  });
});

describe("frequência: política por componente", () => {
  const scopes = [
    scope("ciclo", "cic-1", { presencas: 150, "unidades-aplicaveis": 200 }),
    scope("componente-ou-campo", "mat", { presencas: 90, "unidades-aplicaveis": 100 }),
    scope("componente-ou-campo", "cie", { presencas: 60, "unidades-aplicaveis": 100 }),
  ];

  it("a mesma infraestrutura apura por componente apenas trocando a configuração", () => {
    const result = evaluateAttendanceFormulaOverScopes({
      formula: formula({ scopeDimensionId: "componente-ou-campo", aggregation: "media-dos-escopos" }),
      scopes,
    });
    expect(result.perScope).toHaveLength(2);
    expect(result.value).toBeCloseTo(0.75);
  });

  it("dois componentes com frequências diferentes preservam valores distintos", () => {
    const result = evaluateAttendanceFormulaOverScopes({
      formula: formula({ scopeDimensionId: "componente-ou-campo", aggregation: "menor-dos-escopos" }),
      scopes,
    });
    expect(result.perScope.map((p) => p.value)).toEqual([0.9, 0.6]);
    expect(result.value).toBeCloseTo(0.6);
  });

  it("política global e política por componente coexistem sobre os mesmos fatos", () => {
    const global = evaluateAttendanceFormulaOverScopes({ formula: formula(), scopes });
    const byComponent = evaluateAttendanceFormulaOverScopes({
      formula: formula({ scopeDimensionId: "componente-ou-campo", aggregation: "soma-das-medidas" }),
      scopes,
    });
    expect(global.value).toBeCloseTo(0.75);
    expect(byComponent.value).toBeCloseTo(0.75);
    expect(global.perScope[0]!.scopeDimensionId).toBe("ciclo");
    expect(byComponent.perScope[0]!.scopeDimensionId).toBe("componente-ou-campo");
  });
});

describe("frequência: unidade declarada", () => {
  it("apura por carga horária declarando minutos como unidade", () => {
    const result = evaluateAttendanceFormula({
      formula: formula({
        unitId: "minutos",
        numerator: [{ measureId: "minutos-presentes" }],
        denominator: [{ measureId: "minutos-aplicaveis" }],
        resultFactId: "proporcao-de-presenca-por-carga-horaria",
      }),
      measures: { "minutos-presentes": 2700, "minutos-aplicaveis": 3000 },
    });
    expect(result.unitId).toBe("minutos");
    expect(result.value).toBeCloseTo(0.9);
  });

  it("os fatos brutos não são substituídos pela proporção", () => {
    const measures = { presencas: 180, ausencias: 20, "unidades-aplicaveis": 200 };
    const result = evaluateAttendanceFormula({ formula: formula(), measures });
    expect(measures.presencas).toBe(180);
    expect(result.numerator).toBe(180);
    expect(result.denominator).toBe(200);
  });
});

describe("frequência: elegibilidade parcial e dado incompleto", () => {
  it("aluno elegível em parte do ciclo apura sobre o universo aplicável a ele", () => {
    const result = evaluateAttendanceFormula({
      formula: formula(),
      measures: { presencas: 45, "unidades-aplicaveis": 50 },
    });
    expect(result.denominator).toBe(50);
    expect(result.value).toBeCloseTo(0.9);
  });

  it("dado incompleto não vira zero nem conclusão", () => {
    const result = evaluateAttendanceFormula({
      formula: formula(),
      measures: { presencas: 45, "unidades-aplicaveis": null },
    });
    expect(result.value).toBeNull();
    expect(result.numerator).toBe(45);
    expect(result.unavailableReason).toContain("impede");
  });

  it("universo zero não produz proporção arbitrária", () => {
    const result = evaluateAttendanceFormula({
      formula: formula(),
      measures: { presencas: 0, "unidades-aplicaveis": 0 },
    });
    expect(result.value).toBeNull();
  });

  it("ocorrência registrada só altera a apuração quando o tratamento é declarado", () => {
    const measures = { presencas: 80, "unidades-aplicaveis": 100, "unidades-com-ocorrencia": 10 };
    const sem = evaluateAttendanceFormula({ formula: formula(), measures });
    const com = evaluateAttendanceFormula({
      formula: formula({
        occurrenceTreatments: [
          { measureId: "unidades-com-ocorrencia", effect: "remover-do-denominador" },
        ],
      }),
      measures,
    });
    expect(sem.value).toBeCloseTo(0.8);
    expect(com.denominator).toBe(90);
  });
});

describe("extensibilidade de escopo", () => {
  it("uma nova dimensão configurada é apurada sem lógica específica de etapa", () => {
    const result = evaluateAttendanceFormulaOverScopes({
      formula: formula({ scopeDimensionId: "area-de-conhecimento", aggregation: "media-dos-escopos" }),
      scopes: [
        scope("area-de-conhecimento", "linguagens", { presencas: 80, "unidades-aplicaveis": 100 }),
        scope("area-de-conhecimento", "exatas", { presencas: 100, "unidades-aplicaveis": 100 }),
      ],
    });
    expect(result.value).toBeCloseTo(0.9);
  });

  it("dimensão nova entra no registro como dado; o resolvedor não a codifica", () => {
    const dimension: AttendanceScopeDimension = {
      id: "area-de-conhecimento",
      label: "Área de conhecimento",
      resolve: (context) => context.extra?.["area"] ?? null,
    };
    const resolved = resolveAttendanceAccountingUnit({
      scopeKind: dimension.id,
      context: { extra: { area: { id: "linguagens", label: "Área declarada" } } },
      dimensions: [...ATTENDANCE_SCOPE_DIMENSIONS, dimension],
    });
    expect(resolved).toEqual({
      kind: "area-de-conhecimento",
      id: "linguagens",
      label: "Área declarada",
    });
  });

  it("dimensão não resolvível no contexto não é substituída por outra", () => {
    expect(
      resolveAttendanceAccountingUnit({
        scopeKind: "componente-ou-campo",
        context: { classId: "tur-001", classLabel: "Turma" },
      }),
    ).toBeNull();
    expect(
      resolveAttendanceAccountingUnit({ scopeKind: "dimensao-inexistente", context: {} }),
    ).toBeNull();
  });
});

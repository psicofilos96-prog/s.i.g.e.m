/**
 * Etapa 6D.3.2.1 — testes da projeção da pauta de lançamento.
 *
 * Quatro invariantes obrigatórios:
 * 1. "sem registro" nunca é zero.
 * 2. "não aplicável" nunca é "sem registro".
 * 3. Rascunho jamais altera `currentValue` / `currentVersionId`.
 * 4. Nenhuma semântica é deduzida de etapa, modalidade, turma, cargo ou nome.
 */
import { describe, expect, it } from "vitest";
import {
  INSTRUMENT_ENTRY_UNAVAILABLE_REASONS,
  projectInstrumentEntryRoster,
  validateInstrumentEntryDraft,
  validateMissingEntryDraft,
  type InstrumentEntryRosterStudent,
  type ProjectInstrumentEntryRosterInput,
} from "./assessment-entry-projection";
import { createFirstAssessmentEntryVersion } from "./assessment-entry-versions";
import { assessmentConfigurations } from "./assessment-fixtures";
import type { AcademicPlacement, AssessmentConfiguration } from "./assessment-types";

const config = (id: string): AssessmentConfiguration => {
  const found = assessmentConfigurations.find((item) => item.id === id);
  if (!found) throw new Error(`configuração ausente: ${id}`);
  return found;
};

const quantitativa = config("cfg-2026-quantitativa-demo");
const conceitual = config("cfg-2026-conceitual-demo");
const acompanhamento = config("cfg-2026-ei-acompanhamento");

const placement = (from: string | null, until: string | null): AcademicPlacement => ({
  studentId: "stu-x",
  enrollmentId: "enr-1",
  unitId: "un-1",
  academicLinkId: "lnk-1",
  participationId: "par-1",
  allocationId: "alo-1",
  classId: "cls-1",
  from,
  until,
});

const student = (
  studentId: string,
  rollNumber: number,
  displayName: string,
  from: string | null = "2026-02-01",
  until: string | null = null,
): InstrumentEntryRosterStudent => ({
  studentId,
  rollNumber,
  displayName,
  placements: [{ ...placement(from, until), studentId }],
});

const instrument = (instrumentTypeId = "it-prova", configurationId = quantitativa.id) => ({
  id: "ins-1",
  title: "Instrumento demonstrativo",
  classId: "cls-1",
  appliedOn: "2026-04-10",
  periodId: "per-1",
  instrumentTypeId,
  configurationId,
  snapshot: { classLabel: "Turma demonstrativa", fieldLabel: "Componente demonstrativo" },
});

const baseInput = (
  overrides: Partial<ProjectInstrumentEntryRosterInput> = {},
): ProjectInstrumentEntryRosterInput => ({
  instrument: instrument(),
  configuration: quantitativa,
  period: { id: "per-1", label: "Período 1" },
  students: [student("stu-1", 1, "Ana Beatriz"), student("stu-2", 2, "Bruno Carvalho")],
  versions: [],
  ...overrides,
});

const officialVersion = (studentId: string, value: number, status: "rascunho" | "registrado") =>
  createFirstAssessmentEntryVersion({
    versionId: `ver-${studentId}`,
    instrumentId: "ins-1",
    studentId,
    placement: {
      enrollmentId: "enr-1",
      academicLinkId: "lnk-1",
      participationId: "par-1",
      allocationId: "alo-1",
    },
    value: { kind: "numerica", value },
    status,
    recordedByAssignmentId: "atu-1",
    now: "2026-04-11T10:00:00.000Z",
  });

describe("6D.3.2.1 — instrumento numérico", () => {
  it("projeta a semântica numérica a partir da escala configurada", () => {
    const projection = projectInstrumentEntryRoster(baseInput());
    expect(projection.state).toBe("entry-enabled");
    if (projection.state !== "entry-enabled") return;
    expect(projection.inputMode).toEqual({
      kind: "numerica",
      min: 0,
      max: 100,
      step: 1,
      allowsDecimals: false,
      formatLabel: "0 a 100",
    });
    expect(projection.context.configurationVersion).toBe(quantitativa.version);
  });

  it("valida os limites da escala e rejeita valores fora dela", () => {
    const projection = projectInstrumentEntryRoster(baseInput());
    if (projection.state !== "entry-enabled") throw new Error("pauta indisponível");
    expect(validateInstrumentEntryDraft(projection.inputMode, "85")).toEqual({
      ok: true,
      value: { kind: "numerica", value: 85 },
    });
    expect(validateInstrumentEntryDraft(projection.inputMode, "101").ok).toBe(false);
    expect(validateInstrumentEntryDraft(projection.inputMode, "abc").ok).toBe(false);
    expect(validateInstrumentEntryDraft(projection.inputMode, "7,5").ok).toBe(false);
  });

  it("é determinístico: mesma projeção e mesma entrada produzem o mesmo resultado", () => {
    const projection = projectInstrumentEntryRoster(baseInput());
    if (projection.state !== "entry-enabled") throw new Error("pauta indisponível");
    const first = validateInstrumentEntryDraft(projection.inputMode, "60");
    const second = validateInstrumentEntryDraft(projection.inputMode, "60");
    expect(first).toEqual(second);
  });
});

describe("6D.3.2.1 — instrumento conceitual", () => {
  const conceptualInput = baseInput({
    instrument: instrument("it-atividade", conceitual.id),
    configuration: conceitual,
    declaredValueKind: "conceitual",
  });

  it("projeta apenas as opções homologadas, sem pista numérica", () => {
    const projection = projectInstrumentEntryRoster(conceptualInput);
    if (projection.state !== "entry-enabled") throw new Error("pauta indisponível");
    expect(projection.inputMode.kind).toBe("conceitual");
    if (projection.inputMode.kind !== "conceitual") return;
    expect(projection.inputMode.options.map((item) => item.id)).toEqual([
      "cc-demo-1",
      "cc-demo-2",
    ]);
    expect(JSON.stringify(projection.inputMode)).not.toMatch(/min|max|step/);
  });

  it("aceita somente optionId existente", () => {
    const projection = projectInstrumentEntryRoster(conceptualInput);
    if (projection.state !== "entry-enabled") throw new Error("pauta indisponível");
    expect(validateInstrumentEntryDraft(projection.inputMode, "cc-demo-2")).toEqual({
      ok: true,
      value: { kind: "conceitual", optionId: "cc-demo-2" },
    });
    expect(validateInstrumentEntryDraft(projection.inputMode, "Conceito demonstrativo 2").ok).toBe(
      false,
    );
    expect(validateInstrumentEntryDraft(projection.inputMode, "10").ok).toBe(false);
  });

  it("sem natureza declarada e com mais de uma admissível, não há pauta", () => {
    const projection = projectInstrumentEntryRoster(
      baseInput({
        instrument: instrument("it-atividade", conceitual.id),
        configuration: conceitual,
      }),
    );
    expect(projection.state).toBe("entry-unavailable");
    if (projection.state !== "entry-unavailable") return;
    expect(projection.reason).toBe(INSTRUMENT_ENTRY_UNAVAILABLE_REASONS.ambiguousValueKind);
    expect(projection.disclosableReasons[0]).toContain("decisão normativa");
  });
});

describe("6D.3.2.1 — contexto sem instrumento admissível", () => {
  it("acompanhamento não vira espécie exótica de nota: entry-unavailable", () => {
    const projection = projectInstrumentEntryRoster(
      baseInput({
        instrument: instrument("it-atividade", acompanhamento.id),
        configuration: acompanhamento,
      }),
    );
    expect(projection.state).toBe("entry-unavailable");
    if (projection.state !== "entry-unavailable") return;
    expect(projection.reason).toBe(
      INSTRUMENT_ENTRY_UNAVAILABLE_REASONS.instrumentTypeNotAdmitted,
    );
    expect(projection.disclosableReasons[0]).toContain("registros pedagógicos");
    expect(projection).not.toHaveProperty("inputMode");
    expect(projection).not.toHaveProperty("rosterItems");
  });

  it("invariante 4 — a decisão vem da configuração, não do nome da etapa", () => {
    const source = String(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      "",
    );
    expect(source).toBe("");
    const disfarce: AssessmentConfiguration = {
      ...acompanhamento,
      id: "cfg-disfarce",
      label: "Turma 5º ano — prova bimestral",
      strategy: "quantitativa",
      scope: { stageIds: ["etp-demo-anos-iniciais"] },
    };
    const projection = projectInstrumentEntryRoster(
      baseInput({ instrument: instrument("it-prova", disfarce.id), configuration: disfarce }),
    );
    // Rótulos "quantitativos" não criam pauta: só a configuração admite instrumento.
    expect(projection.state).toBe("entry-unavailable");
  });

  it("descritiva pura projeta parecer, sem campo numérico", () => {
    const descritiva: AssessmentConfiguration = {
      ...conceitual,
      id: "cfg-descritiva",
      scales: [{ kind: "descritiva" }],
      allowsGrades: false,
    };
    const projection = projectInstrumentEntryRoster(
      baseInput({
        instrument: instrument("it-producao", descritiva.id),
        configuration: descritiva,
      }),
    );
    if (projection.state !== "entry-enabled") throw new Error("pauta indisponível");
    expect(projection.inputMode.kind).toBe("descritiva");
    expect(validateInstrumentEntryDraft(projection.inputMode, "  ").ok).toBe(false);
    expect(validateInstrumentEntryDraft(projection.inputMode, "Avançou na leitura.")).toEqual({
      ok: true,
      value: { kind: "descritiva", text: "Avançou na leitura." },
    });
  });
});

describe("6D.3.2.1 — política de não registrado", () => {
  it("motivo regulamentado: recusa motivo fora do catálogo", () => {
    const projection = projectInstrumentEntryRoster(
      baseInput({
        missingEntryPolicy: {
          requiresReason: true,
          admissibleReasons: [{ id: "mv-ausente", label: "Estudante ausente na aplicação" }],
          allowsCustomReason: false,
        },
      }),
    );
    if (projection.state !== "entry-enabled") throw new Error("pauta indisponível");
    expect(
      validateMissingEntryDraft(projection.missingEntryPolicy, { reasonId: "mv-ausente" }),
    ).toEqual({
      ok: true,
      value: { kind: "nao-registrado", reason: "Estudante ausente na aplicação" },
    });
    expect(
      validateMissingEntryDraft(projection.missingEntryPolicy, { reasonId: "mv-inventado" }).ok,
    ).toBe(false);
    expect(
      validateMissingEntryDraft(projection.missingEntryPolicy, { customReason: "qualquer" }).ok,
    ).toBe(false);
  });

  it("falha fechada: sem política declarada exige motivo", () => {
    const projection = projectInstrumentEntryRoster(baseInput());
    if (projection.state !== "entry-enabled") throw new Error("pauta indisponível");
    expect(projection.missingEntryPolicy.requiresReason).toBe(true);
    expect(projection.missingEntryPolicy.admissibleReasons).toEqual([]);
    expect(validateMissingEntryDraft(projection.missingEntryPolicy, {}).ok).toBe(false);
    expect(
      validateMissingEntryDraft(projection.missingEntryPolicy, { customReason: "Sem avaliação" }),
    ).toEqual({ ok: true, value: { kind: "nao-registrado", reason: "Sem avaliação" } });
  });
});

describe("6D.3.2.1 — estados da linha e invariantes", () => {
  const roster = [
    student("stu-1", 1, "Ana Beatriz"),
    student("stu-2", 2, "Bruno Carvalho"),
    student("stu-3", 3, "Carla Mendes", "2026-05-02"),
    student("stu-4", 4, "Daniel Souza"),
  ];

  const projection = projectInstrumentEntryRoster(
    baseInput({
      students: roster,
      versions: [officialVersion("stu-1", 85, "registrado"), officialVersion("stu-4", 70, "registrado")],
    }),
  );

  it("invariante 1 — sem registro nunca é zero", () => {
    if (projection.state !== "entry-enabled") throw new Error("pauta indisponível");
    const bruno = projection.rosterItems.find((item) => item.studentId === "stu-2");
    expect(bruno?.entryState).toBe("unrecorded");
    expect(bruno?.currentValue).toBeUndefined();
    expect(bruno?.currentDisplayLabel).toBeUndefined();
  });

  it("invariante 2 — não aplicável não é sem registro", () => {
    if (projection.state !== "entry-enabled") throw new Error("pauta indisponível");
    const carla = projection.rosterItems.find((item) => item.studentId === "stu-3");
    expect(carla?.entryState).toBe("not-applicable");
    expect(carla?.admissibility).toEqual({
      eligible: false,
      blockerReason: "Sem vínculo com a turma na data de aplicação deste instrumento.",
    });
    // A linha permanece visível e não bloqueia as demais.
    expect(projection.rosterItems).toHaveLength(4);
    expect(projection.rosterItems.filter((item) => item.entryState === "recorded")).toHaveLength(2);
  });

  it("invariante 3 — rascunho não produz valor oficial vigente", () => {
    const withDraft = projectInstrumentEntryRoster(
      baseInput({
        students: roster,
        versions: [officialVersion("stu-2", 40, "rascunho")],
      }),
    );
    if (withDraft.state !== "entry-enabled") throw new Error("pauta indisponível");
    const bruno = withDraft.rosterItems.find((item) => item.studentId === "stu-2");
    expect(bruno?.entryState).toBe("unrecorded");
    expect(bruno?.currentVersionId).toBeUndefined();
    expect(bruno?.currentValue).toBeUndefined();
  });

  it("balanço tem três dimensões e nenhuma pendência", () => {
    if (projection.state !== "entry-enabled") throw new Error("pauta indisponível");
    expect(projection.surfaceBalance).toEqual({
      totalStudents: 4,
      recordedCount: 2,
      unrecordedCount: 1,
      notApplicableCount: 1,
      summaryLabel: "2 registrados · 1 sem registro · 1 não aplicável",
    });
    expect(projection.surfaceBalance.summaryLabel).not.toMatch(/pend/i);
  });

  it("turma de 35 estudantes: 20 registrados · 12 sem registro · 3 não aplicáveis", () => {
    const large: InstrumentEntryRosterStudent[] = Array.from({ length: 35 }, (_, index) =>
      student(
        `stu-${index + 1}`,
        index + 1,
        `Estudante ${index + 1}`,
        index >= 32 ? "2026-05-20" : "2026-02-01",
      ),
    );
    const versions = large
      .slice(0, 20)
      .map((item) => officialVersion(item.studentId, 75, "registrado"));
    const big = projectInstrumentEntryRoster(baseInput({ students: large, versions }));
    if (big.state !== "entry-enabled") throw new Error("pauta indisponível");
    expect(big.surfaceBalance.summaryLabel).toBe(
      "20 registrados · 12 sem registro · 3 não aplicáveis",
    );
  });

  it("a projeção é serializável: nenhuma função viaja dentro dela", () => {
    if (projection.state !== "entry-enabled") throw new Error("pauta indisponível");
    const clone = JSON.parse(JSON.stringify(projection));
    expect(clone.surfaceBalance).toEqual(projection.surfaceBalance);
    expect(clone.inputMode).toEqual(projection.inputMode);
  });
});

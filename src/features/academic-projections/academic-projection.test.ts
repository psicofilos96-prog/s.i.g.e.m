/**
 * Etapa 12L — testes de CONTRATO da fronteira acadêmica.
 *
 * Quatro consumidores fictícios independentes consomem a MESMA projeção sem
 * conhecer 12G, 12H, 12H.1, 12I, 12J ou 12K. Nenhum deles importa tipos internos
 * das etapas anteriores nem decide efeito institucional.
 */
import { describe, expect, it } from "vitest";
import type {
  ClassCycleClosingSnapshot,
  ClosingDiagnosis,
  ClosingMaterializedFact,
  StudentCycleClosingRecord,
} from "@/features/cycle-closing/cycle-closing-types";
import type { FactProvenance } from "@/features/assessment/academic-standing-types";
import {
  ACADEMIC_PROJECTION_SCHEMA_VERSION,
  type ClassAcademicCycleProjection,
  type StudentAcademicCycleProjection,
} from "./academic-projection-types";
import {
  dimensionsOfKind,
  findProjectionFact,
  issuesOfType,
  numericProjectionFact,
  projectClassCycle,
  projectClosingChain,
  projectStudentCycle,
} from "./academic-projection-service";
import { projectToAnalyticRows } from "./academic-projection-analytics";
import { demonstrationProjectionOptions } from "./academic-projection-fixtures";

const now = "2027-12-18T12:00:00.000Z";

const provenance: FactProvenance = {
  sources: [{ kind: "fechamento-avaliativo-periodo", id: "fec-1", version: 2 }],
  algorithm: "materializacao-demonstrativa",
  materializedAt: now,
};

const fact = (
  factId: string,
  scopeKey: string,
  value: ClosingMaterializedFact["value"],
  extra: Partial<ClosingMaterializedFact> = {},
): ClosingMaterializedFact => ({
  factId,
  scopeKey,
  label: `Rótulo de ${factId}`,
  value,
  provenance,
  ...extra,
});

const diagnosis = (overrides: Partial<ClosingDiagnosis> = {}): ClosingDiagnosis => ({
  policyId: "pol-demo",
  policyVersion: 1,
  evaluatedAt: now,
  classRequirements: [],
  students: [],
  counts: {
    satisfeito: 1,
    "nao-satisfeito": 0,
    "nao-aplicavel": 0,
    inconclusivo: 0,
    "erro-configuracao": 0,
  },
  applicableMandatory: 1,
  satisfiedMandatory: 1,
  closable: true,
  impediments: [],
  ...overrides,
});

const snapshot = (
  overrides: Partial<ClassCycleClosingSnapshot> = {},
): ClassCycleClosingSnapshot => ({
  id: "enc-t1-c1-v1",
  version: 1,
  classId: "turma-1",
  cycleId: "ciclo-1",
  unitId: "unid-1",
  cycleStartDate: "2027-02-01",
  cycleEndDate: "2027-12-17",
  policyId: "pol-demo",
  policyVersion: 1,
  institutionalState: "encerrado",
  act: {
    id: "ato-t1-c1-v1",
    kindId: "encerramento",
    kindLabel: "Ato de encerramento do ciclo e da turma",
    declaredAt: now,
    declaredBy: {
      actorId: "perfil-lavratura",
      actorName: "Perfil demonstrativo",
      profileLabel: "Lavratura",
      at: now,
    },
  },
  diagnosis: diagnosis(),
  students: [],
  sources: [{ kind: "consolidacao-ciclo", id: "cons-1", version: 3 }],
  facts: [],
  materializedAt: now,
  ...overrides,
});

const quantitativeStudent: StudentCycleClosingRecord = {
  studentId: "alu-1",
  studentName: "Estudante Demonstrativo",
  cycleId: "ciclo-1",
  resolutionSourceTypeId: "regra-academica",
  terminalStandingId: "aprovado",
  completeness: "satisfeito",
  reason: "Cadeia conferida.",
  diagnoses: [],
  facts: [
    fact("resultado-final", "componente=mat", 72),
    fact("resultado-recuperacao", "componente=mat", 60),
    fact("resultado-final", "componente=port", null, {
      unavailableReason: "Fechamento do 4º período não registrado.",
    }),
    fact("frequencia-percentual", "frequencia=mat", 81),
    fact("frequencia-global-percentual", "", 88),
    fact("frequencia-global-ausencias", "", 24),
  ],
  sources: [
    { kind: "fechamento-avaliativo-periodo", id: "fec-1", version: 2 },
    { kind: "deliberacao", id: "delib-1", version: 1 },
  ],
};

const qualitativeStudent: StudentCycleClosingRecord = {
  studentId: "alu-2",
  studentName: "Criança Demonstrativa",
  cycleId: "ciclo-1",
  resolutionSourceTypeId: "percurso-qualitativo-demonstrativo",
  completeness: "satisfeito",
  reason: "Percurso registrado; a política não exige situação terminal.",
  diagnoses: [],
  facts: [
    fact("parecer-descritivo", "campo-de-experiencia=o-eu-o-outro-e-o-nos", "Registro descritivo."),
  ],
  sources: [{ kind: "registro-de-percurso", id: "perc-1", version: 1 }],
};

const pendingStudent: StudentCycleClosingRecord = {
  studentId: "alu-3",
  cycleId: "ciclo-1",
  completeness: "inconclusivo",
  reason: "Frequência do ciclo sem fechamento oficial.",
  diagnoses: [
    {
      requirementId: "req-demo-cobertura-frequencia",
      label: "Fechamento de frequência de todos os períodos",
      evaluatorId: "cobertura-de-fontes",
      mandatory: true,
      perStudent: true,
      status: "nao-satisfeito",
      reason: "Período 4 sem fechamento de frequência.",
      evidence: [{ kind: "fechamento-frequencia-periodo", id: "frq-4", state: "ausente" }],
    },
  ],
  facts: [],
  sources: [],
};

const options = demonstrationProjectionOptions;

describe("12L — projeção canônica", () => {
  it("publica dimensionalidade sem achatar o percurso quantitativo", () => {
    const projection = projectClassCycle(
      snapshot({ students: [quantitativeStudent] }),
      options,
    );
    const student = projection.students[0]!;

    const components = dimensionsOfKind(student.dimensions, "componente");
    expect(components).toHaveLength(2);
    const math = components.find((dimension) => dimension.dimensionId === "mat")!;
    expect(numericProjectionFact(math.facts, "resultado-final")).toBe(72);
    expect(numericProjectionFact(math.facts, "resultado-recuperacao")).toBe(60);

    // Frequência global e dimensional continuam abertas, em fatos e dimensões.
    expect(numericProjectionFact(student.attendance.facts, "frequencia-global-percentual")).toBe(88);
    expect(student.attendance.dimensions).toHaveLength(1);
    expect(
      numericProjectionFact(student.attendance.dimensions[0]!.facts, "frequencia-percentual"),
    ).toBe(81);
  });

  it("preserva ausência como ausência e nunca como zero", () => {
    const projection = projectClassCycle(snapshot({ students: [quantitativeStudent] }), options);
    const portuguese = projection.students[0]!.dimensions.find(
      (dimension) => dimension.dimensionId === "port",
    )!;
    const missing = findProjectionFact(portuguese.facts, "resultado-final")!;
    expect(missing.value).toBeNull();
    expect(missing.unavailableReason).toMatch(/não registrado/i);
    expect(numericProjectionFact(portuguese.facts, "resultado-final")).toBeNull();
    expect(numericProjectionFact(portuguese.facts, "fato-inexistente")).toBeNull();
  });

  it("não inventa situação acadêmica em percurso qualitativo", () => {
    const projection = projectClassCycle(snapshot({ students: [qualitativeStudent] }), options);
    const student = projection.students[0]!;
    expect(student.resolution.standingId).toBeUndefined();
    expect(student.resolution.sourceTypeId).toBe("percurso-qualitativo-demonstrativo");
    expect(dimensionsOfKind(student.dimensions, "campo-de-experiencia")).toHaveLength(1);
    // Nenhum indicador derivável duplicado no contrato.
    expect(Object.keys(student)).not.toContain("hasTerminalStanding");
  });

  it("publica pendências estruturadas, consultáveis sem interpretar texto", () => {
    const projection = projectClassCycle(snapshot({ students: [pendingStudent] }), options);
    const student = projection.students[0]!;
    const issues = issuesOfType(student.issues, "req-demo-cobertura-frequencia");
    expect(issues).toHaveLength(1);
    expect(issues[0]!.status).toBe("nao-satisfeito");
    expect(issues[0]!.scopeReference.dimensions['studentId']).toBe("alu-3");
    expect(issues[0]!.sourceReference?.kind).toBe("fechamento-frequencia-periodo");
  });

  it("publica deliberações declaradas pela configuração", () => {
    const projection = projectClassCycle(snapshot({ students: [quantitativeStudent] }), options);
    expect(projection.students[0]!.deliberations.map((item) => item.id)).toEqual(["delib-1"]);
  });

  it("acolhe dimensão acadêmica inédita sem alterar o projetor", () => {
    const novel: StudentCycleClosingRecord = {
      ...qualitativeStudent,
      studentId: "alu-4",
      facts: [fact("horas-integralizadas", "itinerario-formativo=oficina-robotica", 40)],
    };
    const projection = projectClassCycle(snapshot({ students: [novel] }), options);
    const dimension = projection.students[0]!.dimensions[0]!;
    expect(dimension.dimensionKindId).toBe("itinerario-formativo");
    expect(dimension.dimensionId).toBe("oficina-robotica");
    expect(numericProjectionFact(dimension.facts, "horas-integralizadas")).toBe(40);
  });

  it("deriva vigência da cadeia e preserva a versão histórica intacta", () => {
    const v1 = snapshot({ students: [quantitativeStudent] });
    const v2 = snapshot({
      id: "enc-t1-c1-v2",
      version: 2,
      precedingClosingId: v1.id,
      students: [{ ...quantitativeStudent, terminalStandingId: "reprovado" }],
      act: { ...v1.act, id: "ato-t1-c1-v2", supersedesClosingId: v1.id, kindId: "retificacao" },
    });

    const chain = projectClosingChain([v2, v1], options);
    expect(chain.map((item) => [item.closingVersion, item.isCurrentClosingVersion])).toEqual([
      [1, false],
      [2, true],
    ]);
    expect(chain[0]!.students[0]!.resolution.standingId).toBe("aprovado");
    expect(chain[1]!.students[0]!.resolution.standingId).toBe("reprovado");
    expect(chain[1]!.act.supersedesClosingId).toBe(v1.id);
  });

  it("carrega temporalidade genérica e proveniência rastreável", () => {
    const projection = projectClassCycle(snapshot({ students: [quantitativeStudent] }), options);
    expect(projection.cycleStartDate).toBe("2027-02-01");
    expect(projection.cycleEndDate).toBe("2027-12-17");
    expect(projection.academicYearId).toBeUndefined();
    expect(projection.projectionSchemaVersion).toBe(ACADEMIC_PROJECTION_SCHEMA_VERSION);
    expect(projection.provenance.closingSnapshotId).toBe("enc-t1-c1-v1");
    expect(projection.provenance.sourceReferences[0]!.version).toBe(3);
  });

  it("projeta o percurso individual isoladamente", () => {
    const base = snapshot({ students: [quantitativeStudent, qualitativeStudent] });
    expect(projectStudentCycle(base, "alu-2", options)?.studentId).toBe("alu-2");
    expect(projectStudentCycle(base, "inexistente", options)).toBeNull();
  });

  it("não expõe campos de apresentação", () => {
    const projection = projectClassCycle(snapshot({ students: [quantitativeStudent] }), options);
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toMatch(
      /textoBoletim|linhaHistorico|colunaAta|campoEducacenso|labelDashboard/i,
    );
    expect(serialized).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

// --------------------------------------------- Consumidores fictícios (12L.11)

describe("12L — quatro consumidores fictícios independentes", () => {
  const base = snapshot({
    students: [quantitativeStudent, qualitativeStudent, pendingStudent],
    diagnosis: diagnosis({ closable: false, impediments: ["Percurso inconclusivo."] }),
  });
  const projection = projectClassCycle(base, options);

  /** Consumidor 1 — Vida Escolar (Cap. 13): apenas LÊ fatos; não decide nada. */
  it("vida escolar obtém resolução, dimensões afetadas e proveniência", () => {
    const read = (student: StudentAcademicCycleProjection) => ({
      standingId: student.resolution.standingId ?? null,
      sourceTypeId: student.resolution.sourceTypeId ?? null,
      affectedDimensions: student.dimensions.map((dimension) => dimension.dimensionId),
      provenance: student.provenance.closingSnapshotId,
      issueTypes: student.issues.map((issue) => issue.issueTypeId),
    });

    const rows = projection.students.map(read);
    expect(rows[0]!.standingId).toBe("aprovado");
    expect(rows[1]!.standingId).toBeNull();
    expect(rows[2]!.issueTypes).toContain("req-demo-cobertura-frequencia");
    expect(rows.every((row) => row.provenance === "enc-t1-c1-v1")).toBe(true);
  });

  /** Consumidor 2 — Documentos (Cap. 15): estrutura sem perda dimensional. */
  it("documentos montam estrutura por dimensão sem converter ausência", () => {
    const structure = projection.students.map((student) => ({
      studentId: student.studentId,
      lines: [...student.dimensions, ...student.attendance.dimensions].map((dimension) => ({
        dimensionId: dimension.dimensionId,
        values: dimension.facts.map((item) => item.value),
      })),
      globalAttendance: numericProjectionFact(
        student.attendance.facts,
        "frequencia-global-percentual",
      ),
    }));

    const first = structure[0]!;
    expect(first.lines.length).toBe(3);
    expect(first.lines.flatMap((line) => line.values)).toContain(null);
    expect(first.globalAttendance).toBe(88);
    expect(structure[2]!.globalAttendance).toBeNull();
  });

  /** Consumidor 3 — CIECE (Cap. 14): fatos atômicos, sem taxas. */
  it("CIECE deriva linhas atômicas da projeção, nunca do encerramento", () => {
    const rows = projectToAnalyticRows([projection]);
    expect(rows.some((row) => row.category === "fato-dimensional")).toBe(true);
    expect(rows.some((row) => row.category === "pendencia")).toBe(true);
    const keys = rows.flatMap((row) => Object.keys(row.dimensions)).join(" ");
    expect(keys).not.toMatch(/taxa|aprovacao|reprovacao|abandono|indice/i);
    expect(
      rows.every((row) => row.provenance['projectionSchemaVersion'] !== undefined),
    ).toBe(true);
  });

  /** Consumidor 4 — Portal Família/Aluno (Cap. 18): versão vigente x histórica. */
  it("portal distingue versão vigente de versão superada", () => {
    const v2 = snapshot({
      id: "enc-t1-c1-v2",
      version: 2,
      precedingClosingId: base.id,
      students: [quantitativeStudent],
      act: { ...base.act, id: "ato-v2", supersedesClosingId: base.id, kindId: "retificacao" },
    });
    const chain = projectClosingChain([base, v2], options);
    const view = chain.map((item: ClassAcademicCycleProjection) => ({
      version: item.closingVersion,
      superseded: !item.isCurrentClosingVersion,
    }));
    expect(view).toEqual([
      { version: 1, superseded: true },
      { version: 2, superseded: false },
    ]);
  });
});

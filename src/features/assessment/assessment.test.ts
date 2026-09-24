import { describe, expect, it } from "vitest";
import { getPedagogicalAssignment } from "@/features/pedagogical/pedagogical-data";
import { getDemonstrationStudent } from "@/features/students/students-data";
import {
  academicYears,
  assessmentConfigurations,
  instrumentFixtures,
  periodStructures,
  PENDING_NORMATIVE_RULES,
} from "./assessment-fixtures";
import {
  academicStanding,
  deriveResult,
  eligibilityInPeriod,
  placementOn,
  recordingReadiness,
  resolveConfiguration,
  studentPlacements,
  validateEntryValue,
  validatePeriodStructure,
} from "./assessment-rules";
import { createInMemoryAssessmentRepository } from "./assessment-repository";
import { documentDependencies } from "./document-dependencies";
import type { AssessmentConfiguration, AssessmentEntry } from "./assessment-types";

const cfg = (id: string) => assessmentConfigurations.find((c) => c.id === id)!;
const structure = (id: string) => periodStructures.find((s) => s.id === id)!;
const year = (id: string) => academicYears.find((y) => y.id === id)!;
const student = (id: string) => getDemonstrationStudent(id)!;
const instrument = instrumentFixtures[0]!;

describe("períodos avaliativos", () => {
  it("aceitam qualquer quantidade sem pressupor bimestres", () => {
    for (const s of periodStructures) {
      expect(validatePeriodStructure(s, year(s.academicYearId))).toEqual([]);
    }
    expect(structure("est-2026-a").periods).toHaveLength(3);
    expect(structure("est-2026-unico").periods).toHaveLength(1);
    expect(JSON.stringify(periodStructures)).not.toMatch(/bimestre/i);
  });

  it("detectam sobreposição e datas fora do ano letivo", () => {
    const broken = {
      ...structure("est-2026-a"),
      periods: [
        {
          id: "x1",
          structureId: "e",
          sequence: 1,
          label: "A",
          start: "2026-01-01",
          end: "2026-06-01",
        },
        {
          id: "x2",
          structureId: "e",
          sequence: 2,
          label: "B",
          start: "2026-05-01",
          end: "2026-12-18",
        },
      ],
    };
    const messages = validatePeriodStructure(broken, year("ano-2026")).map((i) => i.message);
    expect(messages).toContain("Fora do ano letivo.");
    expect(messages).toContain("Sobreposição com o período anterior.");
  });
});

describe("estratégias pela configuração", () => {
  it("quantitativa aceita valor numérico na escala demonstrativa", () => {
    const c = cfg("cfg-2026-quantitativa-demo");
    expect(validateEntryValue(c, { kind: "numerica", value: 50 })).toEqual([]);
    expect(validateEntryValue(c, { kind: "numerica", value: 500 })).not.toEqual([]);
    expect(
      c.scales.every((s) => s.kind === "descritiva" || s.normativeStatus !== "homologado"),
    ).toBe(true);
  });

  it("conceitual aceita apenas conceitos configurados", () => {
    const c = cfg("cfg-2026-conceitual-demo");
    expect(validateEntryValue(c, { kind: "conceitual", optionId: "cc-demo-1" })).toEqual([]);
    expect(validateEntryValue(c, { kind: "conceitual", optionId: "A" })).not.toEqual([]);
    expect(validateEntryValue(c, { kind: "numerica", value: 7 })).not.toEqual([]);
  });

  it("Educação Infantil é descritiva, sem nota nem aprovação", () => {
    const r = resolveConfiguration("tur-009", "ano-2026", assessmentConfigurations);
    expect(r.status).toBe("resolvida");
    const c = (r as { configuration: AssessmentConfiguration }).configuration;
    expect(c.strategy).toBe("acompanhamento");
    expect(c.allowsGrades).toBe(false);
    expect(validateEntryValue(c, { kind: "numerica", value: 1 })).not.toEqual([]);
    expect(validateEntryValue(c, { kind: "descritiva", text: "Registro demonstrativo." })).toEqual(
      [],
    );
    expect(academicStanding(c, {}).status).toBe("nao-aplicavel");
  });

  it("contexto sem configuração permanece pendente", () => {
    expect(resolveConfiguration("tur-001", "ano-2025", assessmentConfigurations).status).toBe(
      "pendente",
    );
  });
});

describe("vínculo temporal do aluno", () => {
  const p1 = structure("est-2026-a").periods[0]!;
  it("trajetória contínua cobre o período integralmente", () => {
    expect(eligibilityInPeriod(studentPlacements(student("alu-001")), "tur-001", p1).coverage).toBe(
      "integral",
    );
  });
  it("ingresso posterior é sinalizado sem regra de aproveitamento", () => {
    const e = eligibilityInPeriod(
      studentPlacements(student("alu-004")),
      "tur-004",
      structure("est-2026-unico").periods[0]!,
    );
    expect(e.coverage).toBe("ingresso-posterior");
    expect(e.pendingRuleIds).toContain("pn-movimentacao");
  });
  it("aluno transferido mantém o vínculo histórico na turma de origem", () => {
    const e = eligibilityInPeriod(
      studentPlacements(student("alu-003")),
      "tur-003",
      structure("est-2025-unico").periods[0]!,
    );
    expect(e.coverage).toBe("saida-anterior");
    expect(e.placements[0].allocationId).toBe("alu-003-a1");
  });
  it("mudança de turma preserva a alocação anterior e não depende da turma atual", () => {
    const placements = studentPlacements(student("alu-005"));
    expect(eligibilityInPeriod(placements, "tur-001", p1).coverage).toBe("saida-anterior");
    expect(student("alu-005").currentClassId).not.toBe("tur-001");
    expect(placementOn(placements, "tur-001", "2026-03-10")?.allocationId).toBe("alu-005-a1");
    expect(placementOn(placements, "tur-001", "2026-04-10")).toBeNull();
  });
});

describe("atuação docente", () => {
  const period = structure("est-2026-a").periods[0]!;
  it("atuação vigente e coerente está pronta, sem autorização definitiva", () => {
    const r = recordingReadiness({
      professionalId: getPedagogicalAssignment("atp-001")!.professionalId,
      assignment: getPedagogicalAssignment("atp-001"),
      instrument,
      period,
    });
    expect(r).toEqual({ ready: true, reasons: [], authorizationFinal: false });
  });
  it("atuação encerrada não está pronta", () => {
    const a = getPedagogicalAssignment("atp-003")!;
    const r = recordingReadiness({
      professionalId: a.professionalId,
      assignment: a,
      instrument: {
        ...instrument,
        classId: a.classId,
        snapshot: { classLabel: "", fieldLabel: a.field ?? "" },
      },
      period,
    });
    expect(r.ready).toBe(false);
    expect(r.reasons).toContain("Atuação fora da vigência na data do instrumento.");
  });
  it("outro profissional não está pronto", () => {
    const r = recordingReadiness({
      professionalId: "pro-inexistente",
      assignment: getPedagogicalAssignment("atp-001"),
      instrument,
      period,
    });
    expect(r.ready).toBe(false);
  });
});

describe("instrumento × lançamento × resultado", () => {
  const entry: AssessmentEntry = {
    id: "lan-demo-001",
    instrumentId: instrument.id,
    studentId: "alu-001",
    placement: {
      enrollmentId: "alu-001-me1",
      academicLinkId: "alu-001-vl1",
      participationId: "alu-001-p1",
      allocationId: "alu-001-a1",
    },
    value: { kind: "numerica", value: 70 },
    recordedAt: "2026-03-11",
    recordedByAssignmentId: "atp-001",
  };

  it("são entidades distintas e o repositório impede lançamento duplicado", () => {
    const repo = createInMemoryAssessmentRepository({ instruments: instrumentFixtures });
    repo.saveEntry(entry);
    expect(repo.listEntries(instrument.id)).toHaveLength(1);
    expect(() => repo.saveEntry({ ...entry, id: "lan-demo-002" })).toThrow();
    expect(() => repo.saveEntry({ ...entry, id: "x", instrumentId: "ins-x" })).toThrow();
  });

  it("não calcula resultado sem regra homologada", () => {
    const c = cfg("cfg-2026-quantitativa-demo");
    for (const level of ["instrumento", "periodo", "componente", "final"] as const) {
      const r = deriveResult(c, level, [entry]);
      expect(r.status).toBe("sem-regra-homologada");
      expect(r.official).toBe(false);
      expect(r).not.toHaveProperty("value");
    }
  });

  it("frequência demonstrativa não produz situação acadêmica oficial", () => {
    const s = academicStanding(cfg("cfg-2026-quantitativa-demo"), { attendancePreviewPercent: 10 });
    expect(s).toEqual(expect.objectContaining({ status: "nao-determinada", official: false }));
  });

  it("identidade por IDs sobrevive à troca de rótulos", () => {
    const repo = createInMemoryAssessmentRepository({ instruments: instrumentFixtures });
    repo.saveEntry(entry);
    const renamed = {
      ...instrument,
      title: "Outro nome",
      snapshot: { classLabel: "Turma renomeada", fieldLabel: instrument.snapshot.fieldLabel },
    };
    repo.saveInstrument(renamed);
    expect(repo.listInstruments()).toHaveLength(1);
    expect(repo.listEntries("ins-demo-001")[0].id).toBe("lan-demo-001");
    expect(repo.listInstruments({ classId: "tur-001" })[0].title).toBe("Outro nome");
  });
});

describe("invariantes normativas", () => {
  it("nenhuma fixture declara regra homologada", () => {
    const text = JSON.stringify({ assessmentConfigurations, periodStructures, academicYears });
    expect(text).not.toContain('"homologado"');
  });
  it("toda pendência referenciada existe", () => {
    const ids = new Set(PENDING_NORMATIVE_RULES.map((r) => r.id));
    for (const c of assessmentConfigurations)
      c.pendingRuleIds.forEach((id) => expect(ids.has(id)).toBe(true));
  });
  it("documentos oficiais dependem de dados ainda inexistentes", () => {
    for (const name of ["Boletim", "Folha Final", "Ficha Individual"]) {
      const d = documentDependencies.find((x) => x.document === name)!;
      expect(d.requires.some((r) => r.state === "inexistente")).toBe(true);
    }
  });
});

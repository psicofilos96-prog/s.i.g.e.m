/**
 * 6D.1.1 — testes do desacoplamento dos ciclos, do versionamento da chamada e
 * do Attendance Correction Resolver.
 *
 * Verificam: marcações não inventadas, rito derivado da regra canônica,
 * imutabilidade da versão anterior, e projeções de fase sem estado persistido.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { attendanceStore, type AttendanceRecord } from "./attendance";
import { attendanceCycleView, lessonCyclePhase } from "./diary-journey";
import type { LessonEntry } from "./lesson-records";
import type { PeriodAttendanceClosingRecord } from "./attendance-closing-types";
import {
  ATTENDANCE_CORRECTION_MARKS,
  attendanceCorrectionSubmissionIssues,
  resolveAttendanceCorrection,
} from "./attendance-correction";

const entry = {
  id: "aula-x",
  professionalId: "pro-006",
  assignmentId: "atp-001",
  classId: "tur-001",
  className: "6º ano A",
  field: "Matemática",
  date: "2026-09-21",
  blockIds: ["bl-001"],
  quantity: 1,
  status: "Registrada demonstrativamente",
} as unknown as LessonEntry;

const actorWithoutCapability = {
  id: "ator-prof",
  name: "Professor Fictício",
  profileLabel: "Professor",
  capabilities: [],
} as const;

const actorWithCapability = {
  ...actorWithoutCapability,
  id: "ator-secretaria",
  capabilities: ["executar-retificacao-de-frequencia"],
} as const;

const concluded: AttendanceRecord = {
  entryId: entry.id,
  origin: "local",
  concluded: true,
  marks: { "bl-001": { "alu-001": "Presente" } },
};

const closing: PeriodAttendanceClosingRecord = {
  id: "fec-001",
  version: 1,
  factKind: "fatos-oficiais-de-frequencia-do-periodo",
  scope: {
    classId: "tur-001",
    academicYearId: "ano-2026",
    periodId: "per-1",
    accountingUnit: { kind: "componente-ou-campo", id: "mat", label: "Matemática" },
  },
  policyId: "pol-1",
  policyVersion: 1,
  unitKind: "aula",
  calendarId: "cal-2026",
  periodLabel: "1º período",
  periodStart: "2026-02-01",
  periodEnd: "2026-04-30",
  closedBy: { actorId: "a", actorName: "b", profileLabel: "Supervisão", at: "2026-05-02" },
  closedAt: "2026-05-02",
  lessonEntryIds: [entry.id],
  totals: {
    plannedUnits: 1,
    plannedMinutes: 50,
    taughtUnits: 1,
    taughtMinutes: 50,
    plannedWithoutExecutionUnits: 0,
    taughtWithoutAttendanceUnits: 0,
    taughtWithoutAttendanceMinutes: 0,
  },
  students: [],
};

beforeEach(() => attendanceStore.reset());

describe("ciclos irmãos (projeção, não estado persistido)", () => {
  it("o registro pedagógico em elaboração não altera a fase da frequência", () => {
    expect(lessonCyclePhase("Rascunho em elaboração")).toBe("Em elaboração");
    expect(attendanceCycleView(concluded).phase).toBe("Concluída");
    expect(attendanceCycleView(undefined).phase).toBe("Pendente");
  });

  it("versão vigente e retificação são lidas do registro, sem campo de estado", () => {
    const view = attendanceCycleView({ ...concluded, version: 2, rectification: {
      at: "2026-09-22",
      actorId: "ator-secretaria",
      actorName: "Secretaria",
      changes: [{ slotKey: "bl-001", studentId: "alu-001", from: "Presente", to: "Ausente" }],
    } });
    expect(view).toMatchObject({ phase: "Concluída", version: 2, rectified: true });
  });
});

describe("Attendance Correction Resolver", () => {
  it("não admite correção de chamada em elaboração: reversão pertence ao rascunho", () => {
    const resolution = resolveAttendanceCorrection({
      entry,
      record: { ...concluded, concluded: false },
      actor: actorWithCapability,
      operatingProfessionalId: "pro-006",
    });
    expect(resolution.admissible).toBe(false);
    if (!resolution.admissible)
      expect(resolution.impediments.map((i) => i.code)).toContain("chamada-em-elaboracao");
  });

  it("sem chamada registrada não há o que corrigir", () => {
    const resolution = resolveAttendanceCorrection({
      entry,
      record: undefined,
      actor: actorWithCapability,
      operatingProfessionalId: "pro-006",
    });
    expect(resolution.admissible).toBe(false);
  });

  it("chamada concluída sem fechamento não exige motivo nem capacidade inventada", () => {
    const resolution = resolveAttendanceCorrection({
      entry,
      record: concluded,
      actor: actorWithoutCapability,
      operatingProfessionalId: "pro-006",
    });
    expect(resolution.admissible).toBe(true);
    if (resolution.admissible) {
      expect(resolution.requirements).toEqual([]);
      expect(resolution.requiredCapability).toBeUndefined();
      expect(resolution.admissibleMarks).toEqual(ATTENDANCE_CORRECTION_MARKS);
      expect(resolution.effect.nextVersion).toBe(2);
    }
  });

  it("não oferece marcação fora do domínio", () => {
    expect(ATTENDANCE_CORRECTION_MARKS).toEqual(["Presente", "Ausente"]);
    expect(ATTENDANCE_CORRECTION_MARKS).not.toContain("Falta justificada");
  });

  it("fechamento vigente exige capacidade e justificativa, com proveniência", () => {
    const blocked = resolveAttendanceCorrection({
      entry,
      record: concluded,
      actor: actorWithoutCapability,
      operatingProfessionalId: "pro-006",
      closings: [closing],
    });
    expect(blocked.admissible).toBe(false);
    if (!blocked.admissible)
      expect(blocked.impediments.map((i) => i.code)).toContain("capacidade-ausente");

    const allowed = resolveAttendanceCorrection({
      entry,
      record: concluded,
      actor: actorWithCapability,
      operatingProfessionalId: "pro-006",
      closings: [closing],
    });
    expect(allowed.admissible).toBe(true);
    if (allowed.admissible) {
      expect(allowed.requirements.map((r) => r.code)).toEqual(["justificativa"]);
      expect(allowed.requirements[0]!.provenance).toContain("fec-001");
      expect(allowed.effect.affectedClosing?.closingId).toBe("fec-001");
    }
  });

  it("atuação de outro profissional impede a correção", () => {
    const resolution = resolveAttendanceCorrection({
      entry,
      record: concluded,
      actor: actorWithCapability,
      operatingProfessionalId: "pro-003",
    });
    expect(resolution.admissible).toBe(false);
  });

  it("a submissão só passa quando as exigências projetadas são atendidas", () => {
    const resolution = resolveAttendanceCorrection({
      entry,
      record: concluded,
      actor: actorWithCapability,
      operatingProfessionalId: "pro-006",
      closings: [closing],
    });
    expect(attendanceCorrectionSubmissionIssues(resolution, { mark: null })).not.toEqual([]);
    expect(attendanceCorrectionSubmissionIssues(resolution, { mark: "Ausente" })).toEqual([
      "Informe a justificativa exigida para a retificação.",
    ]);
    expect(
      attendanceCorrectionSubmissionIssues(resolution, {
        mark: "Ausente",
        justification: "Conferência do registro físico.",
      }),
    ).toEqual([]);
  });
});

describe("versão encadeada da chamada", () => {
  it("retificar preserva a versão anterior e cria a seguinte", () => {
    attendanceStore.save(entry.id, concluded.marks, true);
    const next = attendanceStore.rectify(
      entry.id,
      { "bl-001": { "alu-001": "Ausente" } },
      {
        at: "2026-09-22",
        actorId: "ator-secretaria",
        actorName: "Secretaria",
        justification: "Conferência do registro físico.",
        changes: [{ slotKey: "bl-001", studentId: "alu-001", from: "Presente", to: "Ausente" }],
      },
    );
    expect(next.version).toBe(2);
    const history = attendanceStore.history(entry.id);
    expect(history).toHaveLength(1);
    expect(history[0]!.marks["bl-001"]!["alu-001"]).toBe("Presente");
    expect(attendanceStore.get(entry.id)!.marks["bl-001"]!["alu-001"]).toBe("Ausente");
  });

  it("chamada em elaboração não é retificada", () => {
    attendanceStore.save(entry.id, concluded.marks, false);
    expect(() =>
      attendanceStore.rectify(entry.id, concluded.marks, {
        at: "2026-09-22",
        actorId: "x",
        actorName: "y",
        changes: [],
      }),
    ).toThrow();
  });
});

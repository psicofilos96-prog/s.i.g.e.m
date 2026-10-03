/**
 * Etapa 12H.1 — testes do fechamento oficial da frequência.
 *
 * Verificam os invariantes normativos: previsto ≠ ministrado ≠ aplicável,
 * preservação de carga horária, vocabulário neutro, bloqueio por chamada
 * ausente, temporalidade do vínculo, imutabilidade e versionamento.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { DemonstrationStudent } from "@/features/students/students-data";
import { attendanceStore, setAttendanceEditGuard, type AttendanceRecord } from "./attendance";
import type { LessonEntry } from "./lesson-records";
import {
  attendanceAnalyticalFacts,
  attendanceBlocking,
  attendanceChainIssues,
  attendanceClosingPendencies,
  attendanceDeliveryPendencies,
  attendanceEditLockReason,
  attendanceIntegrityIssues,
  attendanceScopeKey,
  currentAttendanceClosing,
  plannedUnits,
  scopeTotals,
  slotDurationMinutes,
  studentAttendanceFacts,
  sumMinutes,
  taughtUnits,
  type AttendanceClosingContext,
} from "./attendance-closing";
import {
  createAttendanceClosingStore,
  type AttendanceClosingStore,
} from "./attendance-closing-store";
import { attendanceDemonstrationActor } from "./attendance-closing";
import { demonstrationOccurrenceTypes } from "./attendance-closing-fixtures";
import type {
  AttendanceAccountingPolicy,
  AttendanceClosingScope,
  PlannedUnitFact,
  StudentAttendanceOccurrence,
} from "./attendance-closing-types";

// ------------------------------------------------------------------ Fixtures

const CLASS_ID = "turma-teste-12h1";

function lesson(
  id: string,
  date: string,
  quantity = 1,
  status: LessonEntry["status"] = "Registrada demonstrativamente",
): LessonEntry {
  return {
    id,
    origin: "fixture",
    status,
    date,
    classId: CLASS_ID,
    className: "Turma de teste",
    unitId: "uni-teste",
    unitName: "Unidade de teste",
    assignmentId: "atp-teste",
    field: "Componente de teste",
    role: "Docente",
    professionalId: "pro-teste",
    professionalName: "Docente de teste",
    quantity,
    blockIds: [],
    contentMode: "shared",
    contents: { shared: "Conteúdo de teste" },
    summary: "Conteúdo de teste",
    planningRelation: "Não informado",
    extraordinary: { justification: "Teste", start: "07:00", end: "07:50" },
    optional: {},
  };
}

function student(id: string, name: string, from: string, until: string | null): DemonstrationStudent {
  return {
    id,
    personName: name,
    enrollments: [
      {
        id: `mat-${id}`,
        academicLinks: [
          {
            id: `vin-${id}`,
            unitId: "uni-teste",
            participations: [
              {
                id: `par-${id}`,
                nature: "Regular",
                allocations: [
                  {
                    id: `alo-${id}`,
                    classId: CLASS_ID,
                    classLabel: "Turma de teste",
                    from,
                    until,
                    situation: until ? "Encerrada" : "Vigente",
                    note: "",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  } as unknown as DemonstrationStudent;
}

const policy = (
  overrides: Partial<AttendanceAccountingPolicy> = {},
): AttendanceAccountingPolicy => ({
  id: "pol-teste",
  version: 1,
  label: "Política de teste",
  status: "homologada",
  unitKind: "aula",
  scopeKind: "componente-ou-campo",
  requiresConcludedAttendance: true,
  preservesDurationMinutes: true,
  appliesTo: { academicYearId: "ano-2026" },
  ...overrides,
});

const scope = (
  overrides: Partial<AttendanceClosingScope> = {},
): AttendanceClosingScope => ({
  classId: CLASS_ID,
  academicYearId: "ano-2026",
  periodId: "per-1",
  calendarPeriodId: "cal-per-1",
  accountingUnit: { kind: "componente-ou-campo", id: "comp-001", label: "Componente de teste" },
  ...overrides,
});

const occurrence: StudentAttendanceOccurrence = {
  id: "ocr-teste",
  studentId: "alu-a",
  occurrenceTypeId: "toc-001",
  from: "2026-09-22",
  until: "2026-09-22",
  source: "prontuario-do-aluno-secretaria-escolar",
  documentRef: "PRT-TESTE",
  registeredAt: "2026-09-22T10:00:00.000Z",
  registeredBy: "Secretaria de teste",
};

function context(overrides: Partial<AttendanceClosingContext> = {}): AttendanceClosingContext {
  return {
    scope: scope(),
    policy: policy(),
    period: { id: "per-1", label: "1º Período", start: "2026-09-01", end: "2026-09-30" },
    officialPeriod: true,
    calendarId: "cal-2026-regular",
    lessons: [lesson("aula-1", "2026-09-21"), lesson("aula-2", "2026-09-22")],
    attendance: [
      {
        entryId: "aula-1",
        origin: "local",
        concluded: true,
        marks: { "aula-1": { "alu-a": "Presente", "alu-b": "Ausente" } },
      },
      {
        entryId: "aula-2",
        origin: "local",
        concluded: true,
        marks: { "aula-1": { "alu-a": "Ausente", "alu-b": "Presente" } },
      },
    ] satisfies AttendanceRecord[],
    planned: [],
    students: [student("alu-a", "Aluna A", "2026-09-01", null), student("alu-b", "Aluno B", "2026-09-01", null)],
    occurrences: [occurrence],
    occurrenceTypes: demonstrationOccurrenceTypes,
    stage: "em-andamento",
    ...overrides,
  };
}

// --------------------------------------------------- Previsto vs. ministrado

describe("12H.1 — previsto, ministrado e aplicável são fatos distintos", () => {
  it("registro de aula em rascunho não produz unidade de frequência", () => {
    const ctx = context({
      lessons: [lesson("aula-1", "2026-09-21"), lesson("aula-r", "2026-09-23", 1, "Rascunho local")],
    });
    const units = taughtUnits(ctx.lessons, ctx.attendance);
    expect(units.every((u) => u.lessonEntryId !== "aula-r")).toBe(true);
  });

  it("unidade prevista sem execução nunca gera presença ou ausência", () => {
    const planned: PlannedUnitFact[] = [
      {
        plannedKey: "2026-09-23::bl-x",
        date: "2026-09-23",
        blockId: "bl-x",
        label: "07:00–07:50",
        durationMinutes: 50,
        executed: false,
      },
    ];
    const ctx = context({ planned });
    const totals = scopeTotals(ctx);
    expect(totals.plannedUnits).toBe(1);
    expect(totals.plannedWithoutExecutionUnits).toBe(1);
    const facts = studentAttendanceFacts(ctx);
    expect(facts.every((row) => row.units.every((u) => u.date !== "2026-09-23"))).toBe(true);
    const pendencies = attendanceDeliveryPendencies(ctx);
    expect(pendencies.some((p) => p.code === "unidade-prevista-sem-execucao")).toBe(true);
    expect(
      pendencies.filter((p) => p.code === "unidade-prevista-sem-execucao")[0]?.severity,
    ).toBe("aviso");
  });

  it("aulas previstas são projetadas apenas para conferência, sem fatos de aluno", () => {
    const list = plannedUnits({
      professionalId: "pro-inexistente",
      assignmentId: "atp-inexistente",
      start: "2026-09-01",
      end: "2026-09-05",
      lessons: [],
      isSchoolDay: () => true,
    });
    expect(list).toEqual([]);
  });

  it("B4.6.2b.3 — sem fonte de dias letivos, previsto é indisponível (null), nunca todos os dias nem zero", () => {
    expect(plannedUnits({ professionalId: "p", assignmentId: "a", start: "2026-09-01", end: "2026-09-05", lessons: [] })).toBeNull();
    const ctx = context({ planned: null, stage: "em-conferencia" });
    const blocking = attendanceBlocking(attendanceClosingPendencies(ctx)).map((p) => p.code);
    expect(blocking).toContain("unidades-previstas-indisponiveis");
    expect(scopeTotals(ctx).plannedMinutes).toBeNull();
    // B4.6.2b.3.1 — o motor também: indisponível é null, nunca 0.
    expect(scopeTotals(ctx).plannedUnits).toBeNull();
    expect(scopeTotals(ctx).plannedWithoutExecutionUnits).toBeNull();
    // Lista conhecida vazia continua 0.
    const known = scopeTotals(context({ planned: [], stage: "em-conferencia" }));
    expect([known.plannedUnits, known.plannedWithoutExecutionUnits]).toEqual([0, 0]);
  });
});

// -------------------------------------------------------- Carga horária

describe("12H.1 — carga horária preservada", () => {
  it("lê a duração do horário e preserva o desconhecido como nulo", () => {
    expect(slotDurationMinutes("07:00–07:50")).toBe(50);
    expect(slotDurationMinutes("07:00–07:50 (fora da previsão)")).toBe(50);
    expect(slotDurationMinutes("Sem bloco da grade")).toBeNull();
    expect(sumMinutes([50, 50])).toBe(100);
    expect(sumMinutes([50, null])).toBeNull();
  });

  it("preserva minutos aplicáveis, frequentados e ausentes por aluno", () => {
    const facts = studentAttendanceFacts(context());
    const a = facts.find((row) => row.studentId === "alu-a")!;
    expect(a.applicableUnits).toBe(2);
    expect(a.applicableMinutes).toBe(100);
    expect(a.presenceMinutes).toBe(50);
    expect(a.absenceMinutes).toBe(50);
  });
});

// ------------------------------------------------- Fatos neutros/integridade

describe("12H.1 — fatos neutros e integridade", () => {
  it("separa ausência com e sem ocorrência registrada, sem atribuir efeito", () => {
    const facts = studentAttendanceFacts(context());
    const a = facts.find((row) => row.studentId === "alu-a")!;
    const b = facts.find((row) => row.studentId === "alu-b")!;
    expect(a.absences).toBe(1);
    expect(a.absencesWithRegisteredOccurrence).toBe(1);
    expect(a.absencesWithoutRegisteredOccurrence).toBe(0);
    expect(a.occurrenceRefs[0]?.occurrenceId).toBe("ocr-teste");
    expect(b.absences).toBe(1);
    expect(b.absencesWithRegisteredOccurrence).toBe(0);
    expect(b.absencesWithoutRegisteredOccurrence).toBe(1);
  });

  it("aplicáveis = presenças + ausências (com e sem ocorrência) + sem registro", () => {
    const ctx = context({
      attendance: [
        {
          entryId: "aula-1",
          origin: "local",
          concluded: true,
          marks: { "aula-1": { "alu-a": "Presente" } },
        },
      ],
      policy: policy({ requiresConcludedAttendance: false }),
    });
    const facts = studentAttendanceFacts(ctx);
    expect(attendanceIntegrityIssues(facts)).toEqual([]);
    const a = facts.find((row) => row.studentId === "alu-a")!;
    expect(a.applicableUnits).toBe(2);
    expect(a.presences).toBe(1);
    expect(a.unitsWithoutAttendanceRecord).toBe(1);
  });

  it("ausência de chamada nunca vira presença nem falta", () => {
    const ctx = context({ attendance: [] });
    const facts = studentAttendanceFacts(ctx);
    for (const row of facts) {
      expect(row.presences).toBe(0);
      expect(row.absences).toBe(0);
      expect(row.unitsWithoutAttendanceRecord).toBe(row.applicableUnits);
    }
  });
});

// --------------------------------------------------------------- Bloqueios

describe("12H.1 — bloqueios do fechamento", () => {
  it("aula ministrada sem chamada concluída bloqueia quando a política exige", () => {
    const ctx = context({ attendance: [], stage: "em-conferencia" });
    const blocking = attendanceBlocking(attendanceClosingPendencies(ctx));
    expect(blocking.some((p) => p.code === "aula-ministrada-sem-chamada-concluida")).toBe(true);
  });

  it("política não homologada e calendário não homologado bloqueiam", () => {
    const ctx = context({
      policy: policy({ status: "rascunho" }),
      officialPeriod: false,
      stage: "em-conferencia",
    });
    const codes = attendanceBlocking(attendanceClosingPendencies(ctx)).map((p) => p.code);
    expect(codes).toContain("politica-de-apuracao-nao-homologada");
    expect(codes).toContain("calendario-nao-homologado");
  });

  it("B4.6.2b.3 — calendário institucional indisponível bloqueia por extenso e NUNCA afirma 'não homologado'", () => {
    const ctx = context({ officialPeriod: false, calendarDependency: "indisponivel", stage: "em-conferencia" });
    const list = attendanceBlocking(attendanceClosingPendencies(ctx));
    const codes = list.map((p) => p.code);
    expect(codes).toContain("calendario-institucional-indisponivel");
    expect(codes).not.toContain("calendario-nao-homologado");
    expect(list.find((p) => p.code === "calendario-institucional-indisponivel")!.message).toMatch(/indisponível para consulta/);
  });
});

// ------------------------------------------------------------ Temporalidade

describe("12H.1 — temporalidade do vínculo", () => {
  it("aluno de ingresso posterior não recebe unidades anteriores à alocação", () => {
    const ctx = context({
      students: [student("alu-c", "Aluna C", "2026-09-22", null)],
      attendance: [
        {
          entryId: "aula-1",
          origin: "local",
          concluded: true,
          marks: { "aula-1": { "alu-c": "Ausente" } },
        },
        {
          entryId: "aula-2",
          origin: "local",
          concluded: true,
          marks: { "aula-1": { "alu-c": "Presente" } },
        },
      ],
    });
    const row = studentAttendanceFacts(ctx)[0]!;
    expect(row.coverage).toBe("ingresso-posterior");
    expect(row.applicableUnits).toBe(1);
    expect(row.absences).toBe(0);
    expect(row.presences).toBe(1);
  });

  it("saída no curso do período encerra a apuração na data de saída", () => {
    const ctx = context({ students: [student("alu-d", "Aluno D", "2026-09-01", "2026-09-21")] });
    const row = studentAttendanceFacts(ctx)[0]!;
    expect(row.coverage).toBe("saida-anterior");
    expect(row.applicableUnits).toBe(1);
    expect(
      attendanceDeliveryPendencies(ctx).some((p) => p.code === "cobertura-parcial-do-periodo"),
    ).toBe(true);
  });
});

// --------------------------------------------- Granularidade configurável

describe("12H.1 — granularidade vem da política, não do código", () => {
  it("a chave do escopo reflete a unidade de apuração configurada", () => {
    const byComponent = attendanceScopeKey(scope());
    const byDay = attendanceScopeKey(
      scope({ accountingUnit: { kind: "dia-escolar", id: CLASS_ID, label: "Dia escolar" } }),
    );
    expect(byComponent).not.toBe(byDay);
    expect(byDay).toContain("dia-escolar");
  });
});

// ------------------------------------------- Ciclo, versões e imutabilidade

describe("12H.1 — ciclo, versionamento e imutabilidade", () => {
  let store: AttendanceClosingStore;

  beforeEach(() => {
    store = createAttendanceClosingStore();
  });

  const docente = attendanceDemonstrationActor("perfil-docente");
  const gestao = attendanceDemonstrationActor("perfil-gestao-escolar");
  const secretaria = attendanceDemonstrationActor("perfil-secretaria-escolar");
  const supervisao = attendanceDemonstrationActor("perfil-supervisao");

  const close = (store: AttendanceClosingStore, ctx = context()) => {
    expect(store.act({ ctx, actor: docente, action: "entrega-docente" }).ok).toBe(true);
    expect(store.act({ ctx, actor: gestao, action: "inicio-conferencia" }).ok).toBe(true);
    return store.act({ ctx, actor: secretaria, action: "fechamento-oficial" });
  };

  it("exige capacidade: gestão não homologa fechamento", () => {
    const ctx = context();
    store.act({ ctx, actor: docente, action: "entrega-docente" });
    store.act({ ctx, actor: gestao, action: "inicio-conferencia" });
    const result = store.act({ ctx, actor: gestao, action: "fechamento-oficial" });
    expect(result.ok).toBe(false);
  });

  it("homologa a versão 1 com fatos materializados e totais do escopo", () => {
    const result = close(store);
    expect(result.ok).toBe(true);
    const record = store.current(scope())!;
    expect(record.version).toBe(1);
    expect(record.factKind).toBe("fatos-oficiais-de-frequencia-do-periodo");
    expect(record.students).toHaveLength(2);
    expect(record.totals.taughtUnits).toBe(2);
    expect(record.lessonEntryIds).toEqual(["aula-1", "aula-2"]);
    expect(attendanceChainIssues(store.allRecords(), attendanceScopeKey(scope()))).toEqual([]);
  });

  it("retificação gera a versão 2 e preserva a versão 1 intacta", () => {
    close(store);
    const v1 = store.current(scope())!;
    const snapshot = JSON.stringify(v1);
    const result = store.act({
      ctx: context(),
      actor: secretaria,
      action: "retificacao-pontual",
      justification: "Correção de registro conferido pela Secretaria.",
      authorizer: supervisao,
      studentId: "alu-b",
    });
    expect(result.ok).toBe(true);
    const current = store.current(scope())!;
    expect(current.version).toBe(2);
    expect(current.precedingClosingId).toBe(v1.id);
    expect(current.revision?.justification).toContain("Correção");
    const chain = store.chain(scope());
    expect(JSON.stringify(chain.find((r) => r.version === 1))).toBe(snapshot);
    expect(attendanceChainIssues(store.allRecords(), attendanceScopeKey(scope()))).toEqual([]);
  });

  it("retificação sem justificativa é recusada", () => {
    close(store);
    const result = store.act({
      ctx: context(),
      actor: secretaria,
      action: "retificacao-pontual",
      authorizer: supervisao,
    });
    expect(result.ok).toBe(false);
  });

  it("chamada coberta por fechamento vigente exige retificação formal", () => {
    close(store);
    const reason = attendanceEditLockReason(store.allRecords(), "aula-1");
    expect(reason).toContain("retificação formal");
    expect(attendanceEditLockReason(store.allRecords(), "aula-999")).toBeNull();
  });

  it("a trava impede sobrescrever a chamada pelo repositório do Diário", () => {
    close(store);
    const release = setAttendanceEditGuard((entryId) =>
      attendanceEditLockReason(store.allRecords(), entryId),
    );
    expect(() => attendanceStore.save("aula-1", {}, false)).toThrow(/retificação formal/);
    release();
    attendanceStore.reset();
  });

  it("gera fatos analíticos atômicos com proveniência e versão", () => {
    close(store);
    const record = store.current(scope())!;
    const facts = attendanceAnalyticalFacts(record, "uni-teste");
    expect(facts).toHaveLength(2);
    expect(facts[0]).toMatchObject({
      closingId: record.id,
      closingVersion: 1,
      policyId: "pol-teste",
      policyVersion: 1,
      calendarId: "cal-2026-regular",
      accountingUnitId: "comp-001",
      unitKind: "aula",
    });
  });

  it("não fecha duas vezes sem reabertura formal", () => {
    close(store);
    const again = store.act({ ctx: context(), actor: secretaria, action: "fechamento-oficial" });
    expect(again.ok).toBe(false);
  });

  it("reabertura formal encadeia nova versão preservando o histórico", () => {
    close(store);
    expect(
      store.act({
        ctx: context(),
        actor: supervisao,
        action: "reabertura-integral",
        justification: "Reabertura autorizada para conferência de registros.",
      }).ok,
    ).toBe(true);
    expect(store.stage(scope())).toBe("reaberto");
    const closed = store.act({ ctx: context(), actor: secretaria, action: "fechamento-oficial" });
    expect(closed.ok).toBe(true);
    const chain = store.chain(scope());
    expect(chain.map((r) => r.version)).toEqual([1, 2]);
    expect(currentAttendanceClosing(store.allRecords(), attendanceScopeKey(scope()))?.version).toBe(2);
  });
});

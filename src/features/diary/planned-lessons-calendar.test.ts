/**
 * B4.6.3d — aula prevista exige dia letivo resolvido pelo calendário institucional. Com sessão (ou
 * pendente) e sem calendário aplicável declarado, a grade NUNCA vira aula prevista; o motivo real
 * do adaptador central é devolvido e o previsto da frequência é indisponível (nunca zero).
 * Laboratório confirmado mantém o comportamento demonstrativo existente.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as diaryData from "./diary-data";
import { setDiaryPersistenceMode } from "./diary-persistence-mode";
import { setDiarySessionState } from "./diary-session-state";
import { dailyAgenda, plannedLessonsFor, plannedLessonsResolution, scheduleBlocksFor } from "./lesson-records";
import { frequencyIndicators } from "./attendance";
import { journeyState, lessonCyclePhase, nextAction } from "./diary-journey";

const enterCloud = (knownAt: string | null) => {
  setDiarySessionState({
    phase: "pronto",
    key: "u1#1@2026-09-23",
    userId: "u1",
    ...(knownAt ? { reference: { validOn: "2026-09-23", knownAt, source: "informada", operationalToday: "2026-10-04" } } : {}),
  } as never);
  setDiaryPersistenceMode("cloud");
};

afterEach(() => {
  vi.restoreAllMocks();
  setDiaryPersistenceMode("laboratorio");
  setDiarySessionState({ phase: "sem-fronteira", key: null, userId: null });
});

describe("B4.6.3d — aulas previstas pelo calendário", () => {
  it("laboratório confirmado: grade demonstrativa continua prevista (contraste)", () => {
    setDiaryPersistenceMode("laboratorio");
    expect(plannedLessonsFor("pro-006", "2026-09-23").map((p) => p.blockId)).toEqual(["bl-006"]);
    expect(plannedLessonsResolution("pro-006", "2026-09-23").kind).toBe("determinado");
  });

  it("sessão sem calendário aplicável: nenhuma aula prevista, motivo real, sem fixture", () => {
    enterCloud("2026-10-04T07:00:00.000000Z");
    const r = plannedLessonsResolution("pro-006", "2026-09-23");
    expect(r.kind).toBe("indeterminado");
    if (r.kind === "indeterminado") expect(r.reason).toMatch(/Nada foi contado como zero|ainda está sendo lido/);
    expect(plannedLessonsFor("pro-006", "2026-09-23")).toEqual([]);
    // Grade de laboratório nunca aparece com sessão.
    expect(scheduleBlocksFor("pro-006", "2026-09-23").some((b) => b.blockId === "bl-006")).toBe(false);
    expect(dailyAgenda("pro-006", "2026-09-23", []).some((i) => i.state === "Prevista")).toBe(false);
  });

  it("sem referência aceita do controlador: instante inválido, nada previsto", () => {
    enterCloud(null);
    const r = plannedLessonsResolution("pro-006", "2026-09-23");
    expect(r.kind === "indeterminado" && r.reason).toMatch(/instante de consulta é inválido/);
  });

  it("grade institucional presente continua visível, sem virar previsão, e preserva registro", () => {
    enterCloud("2026-10-04T07:00:00.000000Z");
    // Contexto aceito sintético: dados institucionais na fronteira do consumidor, sem banco ou fixture de laboratório.
    vi.spyOn(diaryData, "diaryContext").mockReturnValue({
      assignments: [{
        record: { id: "eng-institutional", role: "role-id" },
        classId: "class-institutional", className: "Turma institucional",
        unitId: "school-institutional", unitName: "Escola institucional", field: "Componente",
        stage: null,
        blocks: [{ id: "block-institutional", day: "wed", kind: "Aula", start: "08:00", end: "09:00" }],
      }],
    } as never);
    expect(scheduleBlocksFor("person-institutional", "2026-09-23").map((b) => b.blockId)).toEqual(["block-institutional"]);
    expect(plannedLessonsResolution("person-institutional", "2026-09-23").kind).toBe("indeterminado");
    expect(plannedLessonsFor("person-institutional", "2026-09-23")).toEqual([]);
    expect(dailyAgenda("person-institutional", "2026-09-23", []).map((b) => b.state)).toEqual(["Na grade"]);
    const records = [{
      id: "record-institutional", professionalId: "person-institutional", assignmentId: "eng-institutional",
      date: "2026-09-23", blockIds: ["block-institutional"], status: "Registrado oficialmente",
      contentMode: "shared", contents: { shared: "Conteúdo efetivamente ministrado" }, quantity: 1,
    }];
    expect(dailyAgenda("person-institutional", "2026-09-23", records as never)).toMatchObject([
      { state: "Registrada", entryId: "record-institutional", blockId: "block-institutional" },
    ]);
    expect(records[0]!.status).toBe("Registrado oficialmente");
    expect(records[0]!.contents.shared).toBe("Conteúdo efetivamente ministrado");
  });

  it("modo pendente nunca devolve grade de laboratório como prevista", () => {
    setDiaryPersistenceMode("pendente");
    expect(plannedLessonsFor("pro-006", "2026-09-23")).toEqual([]);
  });

  it("frequência com sessão: previsto indisponível com motivo, nunca zero", () => {
    enterCloud("2026-10-04T07:00:00.000000Z");
    const scopes = frequencyIndicators("pro-006", "2026-09-21", "2026-09-25", [
      {
        id: "aul-x", professionalId: "pro-006", assignmentId: "atu-x", classId: "tur-x", className: "Turma X",
        field: "Língua Portuguesa", date: "2026-09-22", blockIds: ["b1"], status: "Concluído",
      } as never,
    ], []);
    expect(scopes).toHaveLength(1);
    expect(scopes[0]!.planned).toBeNull();
    expect(scopes[0]!.plannedUnavailableReason).toMatch(/Nada foi contado como zero/);
  });

  it("frequência no laboratório mantém número de previstas", () => {
    const scopes = frequencyIndicators("pro-006", "2026-09-21", "2026-09-25", [], []);
    expect(scopes.every((s) => typeof s.planned === "number")).toBe(true);
  });

  it("bloco 'Na grade' não é prevista, mas permite registrar o que ocorreu", () => {
    const state = journeyState("histórica", "Na grade", null);
    expect(state).toBe("Na grade · não confirmada pelo calendário");
    expect(lessonCyclePhase("Na grade")).toBe("Pendente");
    expect(nextAction(state, { infant: false, search: {}, date: "2026-09-23", assignmentId: "a" }).kind).toBe("registrar");
  });
});

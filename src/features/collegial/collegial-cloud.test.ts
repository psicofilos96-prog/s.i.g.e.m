import { describe, expect, it } from "vitest";
import { collegialCommands, collegialStateFromRows } from "./collegial-cloud";
import { standingOperations } from "@/features/assessment/academic-standing-cloud";
import type { CollegialSession, StructuredMinute } from "./collegial-types";
import type { AcademicStandingRecord } from "@/features/assessment/academic-standing-types";

const session = { id: "s1", bodyId: "b", bodyConfigurationVersion: 1, natureId: "n", scope: { classId: "t1" },
  scheduledFor: "2026-01-01", state: "agendada", participants: [], agenda: [],
  createdBy: { actorId: "a", actorName: "A", profileLabel: "", at: "x" } } as unknown as CollegialSession;
const empty = { configurations: [], sessions: [], deliberations: [], minutes: [] };

describe("adaptador Cloud do Conselho", () => {
  it("sessão nova vira ato de abertura; composição vira ato de composição", () => {
    expect(collegialCommands(empty, { ...empty, sessions: [session] })[0]).toMatchObject({ rpc: "session", kind: "abertura" });
    const withP = { ...session, participants: [{ name: "P", present: true }] };
    expect(collegialCommands({ ...empty, sessions: [session] }, { ...empty, sessions: [withP] })[0]).toMatchObject({ kind: "composicao" });
  });

  it("encerrar ata não gera ato de sessão: só a versão da ata", () => {
    const minute = { id: "ata-s1-v1", sessionId: "s1", version: 1 } as StructuredMinute;
    const cmds = collegialCommands(
      { ...empty, sessions: [session] },
      { ...empty, sessions: [{ ...session, state: "concluida", closedAt: "y" }], minutes: [minute] },
    );
    expect(cmds.map((c) => c.rpc)).toEqual(["minute"]);
  });

  it("estado concluído é projeção da ata; ata vigente é a não superada", () => {
    const { state, meta } = collegialStateFromRows({
      configurations: [],
      events: [{ id: "e1", session_id: "s1", sequence: 1, document: session }],
      deliberations: [],
      minutes: [
        { id: "m1", session_id: "s1", version: 1, preceding_minute_id: null, document: { sessionId: "s1", closedAt: "z" } },
        { id: "m2", session_id: "s1", version: 2, preceding_minute_id: "m1", document: { sessionId: "s1", closedAt: "w" } },
      ],
    });
    expect(state.sessions[0]!.state).toBe("concluida");
    expect(meta.currentMinuteIdBySession["s1"]).toBe("m2");
    expect(meta.lastEventIdBySession["s1"]).toBe("e1");
  });

  it("lote de situação leva a versão-base vigente por estudante", () => {
    const v1 = { id: "r1", scopeKey: "k", version: 1 } as AcademicStandingRecord;
    const v2 = { id: "new", scopeKey: "k", version: 2 } as AcademicStandingRecord;
    const n = { id: "new2", scopeKey: "k2", version: 1 } as AcademicStandingRecord;
    expect(standingOperations([v1], [v2, n]).map((o) => o.expectedBaseVersionId)).toEqual(["r1", null]);
  });
});

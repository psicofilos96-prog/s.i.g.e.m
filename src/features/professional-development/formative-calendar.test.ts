import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { calendarFindings, currentMeetings, meetingProblems, noticeState, type MeetingVersion } from "./formative-calendar";

const m = (o: Partial<MeetingVersion>): MeetingVersion => ({ meetingId: "m1", classId: "c1", version: 1, status: "agendado", on: "2026-03-07",
  starts: "08:00", ends: "12:00", location: "Auditório", trainerEngagements: ["e1"], reason: null, ...o });

describe("L09 calendário formativo", () => {
  it("alteração vira versão nova; vigente = maior; lacuna = ambígua", () => {
    const r = currentMeetings([m({}), m({ version: 2, starts: "13:00", ends: "17:00", reason: "Mudança de local" }), m({ meetingId: "m2", version: 2 })]);
    expect(r.current.map((x) => x.starts)).toEqual(["13:00"]); expect(r.ambiguous).toEqual(["m2"]);
  });
  it("dia letivo é sinalizado; calendário não lido nunca vira 'sem choque'", () => {
    expect(calendarFindings([m({})], [{ on: "2026-03-07", schoolDay: true, label: "Sábado letivo" }], new Map(), [])[0]!.kind).toBe("dia-letivo");
    expect(calendarFindings([m({})], null, new Map(), [])[0]!.kind).toBe("calendario-nao-lido");
    expect(calendarFindings([m({})], [{ on: "2026-03-07", schoolDay: false, label: "Sábado" }], new Map(), [])).toEqual([]);
  });
  it("choque com grade do participante e formador em dois encontros", () => {
    const days = [{ on: "2026-03-09", schoolDay: false, label: "x" }];
    const f = calendarFindings([m({ on: "2026-03-09" }), m({ meetingId: "m2", on: "2026-03-09", starts: "10:00", ends: "11:00" })], days,
      new Map([["c1", ["p1"]]]), [{ personId: "p1", weekday: 1, starts: "07:30", ends: "09:00", source: "grade" }]);
    expect(f.map((x) => x.kind).sort()).toEqual(["choque-com-grade", "formador-em-dois-encontros"]);
  });
  it("cancelado não gera choque", () => expect(calendarFindings([m({ status: "cancelado" })], null, new Map(), [])).toEqual([]));
  it("aviso sem regra de entrega fica pendente, nunca enviado", () => expect(noticeState(false, false)).toBe("pendente-sem-regra"));
  it("validações do encontro", () => {
    expect(meetingProblems({ on: "2026-08-01", starts: "08:00", ends: "07:00", location: "", trainers: 0, version: 1, reason: "" }, { startsOn: "2026-03-01", endsOn: "2026-06-30" })).toHaveLength(5);
  });
  it("migration 0437: não toca calendário oficial, append-only, outbox na mesma transação", () => {
    const sql = readFileSync("drizzle/migrations/0437_dev09_formative_calendar.sql", "utf8");
    expect(sql).not.toMatch(/INSERT INTO public\.(calendar_|aa_calendar|class_schedule)/);
    expect(sql).toMatch(/devmv_immutable BEFORE UPDATE OR DELETE/);
    expect(sql).toMatch(/INSERT INTO public.dev_meeting_notices/);
    expect(sql).toMatch(/dev:trainer-not-active/);
  });
});

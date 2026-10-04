import { describe, it, expect } from "vitest";
import {
  CalendarReaderShapeError, countSchoolDaysStrict, dayEffectFromRows, parseCalendarDays, parseDayTypes, parseNorm, type CalendarDayRead,
} from "./institutional-calendar-readers";

const K = "2026-10-04T12:00:00.123456Z";
const exp = { calendarId: "c", from: "2026-04-20", to: "2026-04-21", knownAt: K };
const row = (eff: boolean | null, id: string | null = "d") => ({ day_state: id ? "declarado" : "nao-declarado", version_id: "v", reference_issue: null,
  homologation_state: "homologada", declaration_kind: id ? "faixa" : null, declaration_id: id, starts_on: null, ends_on: null, event_label: null,
  day_type_id: id ? "t" : null, day_type_version_id: id ? "tv" : null, day_type_version: id ? 1 : null, day_type_label: null, school_day_effect: id ? eff : null });
const days = (o: Record<string, unknown> = {}, list: unknown[] = [{ on: "2026-04-20", state: "homologada", rows: [row(true)] }, { on: "2026-04-21", state: "nao-homologado-na-data" }]) =>
  ({ contract: "b4.6.6/1", state: "lido", audience: "homologados", snapshot: { from: exp.from, to: exp.to, knownAt: "2026-10-04 09:00:00.123456-03" }, calendarId: "c", days: list, ...o });
const d = (rows: unknown[]): CalendarDayRead => parseCalendarDays(days({}, [{ on: "2026-04-20", state: "homologada", rows }, { on: "2026-04-21", state: "nao-homologado-na-data" }]), exp).kind === "lido"
  ? (parseCalendarDays(days({}, [{ on: "2026-04-20", state: "homologada", rows }, { on: "2026-04-21", state: "nao-homologado-na-data" }]), exp) as { days: readonly CalendarDayRead[] }).days[0]! : (null as never);

describe("calendar_days_at estrito", () => {
  it("aceita forma SQL com knownAt equivalente em µs e congela", () => {
    const r = parseCalendarDays(days(), exp);
    expect(r.kind).toBe("lido");
    expect(Object.isFrozen(r)).toBe(true);
  });
  it.each([
    ["µs divergente", days({ snapshot: { from: exp.from, to: exp.to, knownAt: "2026-10-04T12:00:00.123457Z" } })],
    ["calendário divergente", days({ calendarId: "x" })],
    ["chave extra", days({ autorizado: true })],
    ["dias não contíguos", days({}, [{ on: "2026-04-21", state: "nao-homologado-na-data" }])],
    ["estado de construção para homologados", days({}, [{ on: "2026-04-20", state: "nao-homologada", rows: [row(true)] }, { on: "2026-04-21", state: "nao-homologado-na-data" }])],
    ["linhas em dia não homologado", days({}, [{ on: "2026-04-20", state: "homologada", rows: [row(true)] }, { on: "2026-04-21", state: "nao-homologado-na-data", rows: [] }])],
    ["efeito não booleano", days({}, [{ on: "2026-04-20", state: "homologada", rows: [{ ...row(true), school_day_effect: "true" }] }, { on: "2026-04-21", state: "nao-homologado-na-data" }])],
    ["declarado sem ID", days({}, [{ on: "2026-04-20", state: "homologada", rows: [{ ...row(true), declaration_id: null }] }, { on: "2026-04-21", state: "nao-homologado-na-data" }])],
  ])("recusa %s", (_n, p) => { expect(() => parseCalendarDays(p, exp)).toThrow(CalendarReaderShapeError); });
  it("access-denied com metadado é recusado", () => {
    expect(parseCalendarDays({ contract: "b4.6.6/1", state: "access-denied" }, exp)).toEqual({ kind: "access-denied" });
    expect(() => parseCalendarDays({ contract: "b4.6.6/1", state: "access-denied", calendarId: "c" }, exp)).toThrow(CalendarReaderShapeError);
  });
});

describe("efeito de um calendário (regra 0034)", () => {
  it("true+NULL declarado ⇒ efeito-nao-declarado; false+NULL idem; true×false conflito", () => {
    expect(dayEffectFromRows(d([row(true), row(null, "e")])).kind).toBe("efeito-nao-declarado");
    expect(dayEffectFromRows(d([row(false), row(null, "e")])).kind).toBe("efeito-nao-declarado");
    expect(dayEffectFromRows(d([row(true), row(false, "e"), row(null, "f")])).kind).toBe("conflito");
    expect(dayEffectFromRows(d([row(false)])).kind).toBe("nao-letivo");
    expect(dayEffectFromRows(d([row(null, null)])).kind).toBe("nao-declarado");
  });
  it("contagem só com todos determinados; nunca zero", () => {
    expect(countSchoolDaysStrict([d([row(true)]), d([row(false)])])).toEqual({ count: 1, nonSchool: 1, reason: null });
    expect(countSchoolDaysStrict([d([row(true)]), d([row(null, null)])]).count).toBeNull();
  });
});

describe("tipos e norma", () => {
  it("tipo com efeito NULL permanece NULL", () => {
    const r = parseDayTypes({ contract: "b4.6.6/1", state: "lido", knownAt: K, versions: [{ dayTypeId: "t", versionId: "v", version: 1, changeKind: "constituicao",
      label: "Sem efeito", schoolDayEffect: null, actId: "a", recordedAt: "2026-01-01T00:00:00Z" }] }, { knownAt: K });
    expect(r.kind === "lido" && r.versions[0]!.schoolDayEffect).toBeNull();
  });
  it("norma não homologada nunca chega a público 'homologados'", () => {
    const base = { contract: "b4.6.6/1", state: "lido", audience: "homologados", snapshot: { on: "2026-04-01", knownAt: K }, finalState: "norma-homologada" };
    const v = { normId: "n", versionId: "nv", state: "nao-homologada", detail: null, version: 1, validFrom: "2026-01-01", validTo: null, actId: "a",
      multiplicity: "exigir-exclusividade", dimensionRules: [], effectBindings: [], lastHomologationId: null };
    expect(() => parseNorm({ ...base, versions: [v] }, { on: "2026-04-01", knownAt: K })).toThrow(CalendarReaderShapeError);
    expect(parseNorm({ ...base, versions: [{ ...v, state: "homologada" }] }, { on: "2026-04-01", knownAt: K }).kind).toBe("lido");
  });
});

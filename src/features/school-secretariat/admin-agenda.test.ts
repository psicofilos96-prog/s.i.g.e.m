import { describe, expect, it } from "vitest";
import { agendaFor, alertState, calendarNote, nextYearReference, validDeadline, type Deadline } from "./admin-agenda";

const base: Deadline = { id: "m", kind: "matricula", year: 2026, scope: { level: "rede", id: null }, from: "2026-11-03", to: "2026-11-14",
  origin: { type: "ato-normativo", ref: "Portaria SEMED 1/2026", authorizedBy: "sint-rede" }, responsibleEngagementId: "eng1", escalation: { afterDays: 3, toEngagementId: "eng2" } };

describe("agenda administrativa", () => {
  it("prazo sem origem ou sem datas não entra; vira pendência", () => {
    expect(validDeadline({ ...base, origin: null })).toMatchObject({ code: "agenda:origin-required" });
    const a = agendaFor([{ ...base, id: "x", from: null }], { level: "rede" }, 2026);
    expect(a.visible).toEqual([]);
    expect(a.unconfigured).toEqual([{ id: "x", code: "agenda:dates-not-declared" }]);
  });
  it("escola A não vê prazo da escola B; vê rede e próprio setor", () => {
    const list = [base, { ...base, id: "a", scope: { level: "escola" as const, id: "A" } }, { ...base, id: "b", scope: { level: "escola" as const, id: "B" } }, { ...base, id: "s", scope: { level: "setor" as const, id: "S1" } }];
    expect(agendaFor(list, { level: "escola", schoolId: "A", sectorId: "S1" }, 2026).visible.map((d) => d.id).sort()).toEqual(["a", "m", "s"]);
  });
  it("calendário só anota, nunca desloca", () => {
    expect(calendarNote(base, () => "nao-letivo")).toMatch(/data mantida/);
    expect(calendarNote(base, () => null)).toMatch(/não resolvido/);
  });
  it("alerta e escalonamento só com responsável/regra", () => {
    expect(alertState({ ...base, responsibleEngagementId: null }, "2026-11-20", false)).toEqual({ level: "sem-responsavel" });
    expect(alertState(base, "2026-11-16", false)).toEqual({ level: "vencido" });
    expect(alertState(base, "2026-11-18", false)).toEqual({ level: "escalonado", to: "eng2" });
    expect(alertState(base, "2026-11-18", true)).toBeNull();
  });
  it("mudança de ano não copia datas nem origem", () => {
    const [r] = nextYearReference([base], 2027);
    expect(r).toMatchObject({ year: 2027, from: null, to: null, origin: null });
    expect(agendaFor([base], { level: "rede" }, 2027).visible).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { compareScheduleSources, stageProfessionalSchedules, type CanonicalRefs, type ScheduleSourceRow } from "./educacenso-professional-schedule-staging";

const refs: CanonicalRefs = {
  persons: new Set(["pA", "pB"]),
  links: new Map([
    ["L1", { personKey: "pA", contractualWeeklyMinutes: 1200, schoolIneps: ["33094756"] }],
    ["L2", { personKey: "pA", contractualWeeklyMinutes: null, schoolIneps: ["33100012"] }],
    ["L3", { personKey: "pB", contractualWeeklyMinutes: 600, schoolIneps: ["33094756"] }],
  ]),
  schools: new Set(["33094756", "33100012"]),
  classes: new Map([["T1", "33094756"]]),
};
let n = 0;
const row = (p: Partial<ScheduleSourceRow>): ScheduleSourceRow => ({
  locator: `j.xlsx!A!${++n}`, personKey: "pA", linkKey: "L1", schoolInep: "33094756", classExternalId: null,
  weekday: 1, start: "07:00", end: "11:00", declaredWeeklyMinutes: null, ...p,
});
const codes = (r: { evidence: { code: string }[] }) => r.evidence.map((e) => e.code);

describe("jornadas profissionais (sintético)", () => {
  it("nada é criado: pessoa, vínculo, escola e turma inexistentes viram evidência", () => {
    const r = stageProfessionalSchedules([
      row({ personKey: "pX" }), row({ linkKey: "LX" }), row({ linkKey: "L3" }), row({ schoolInep: "99999999" }),
      row({ classExternalId: "TX" }), row({ classExternalId: "T1", linkKey: "L2", schoolInep: "33100012" }),
    ], refs);
    expect(r.slots).toHaveLength(0);
    expect(codes(r)).toEqual(["pessoa-sem-correspondencia", "vinculo-sem-correspondencia", "vinculo-de-outra-pessoa",
      "escola-sem-correspondencia", "turma-sem-correspondencia", "turma-de-outra-escola"]);
  });
  it("vínculo múltiplo da mesma pessoa: sobreposição detectada pela pessoa", () => {
    const r = stageProfessionalSchedules([row({}), row({ linkKey: "L2", schoolInep: "33100012", start: "10:00", end: "12:00" })], refs);
    expect(r.slots.every((s) => s.status === "divergente")).toBe(true);
    expect(codes(r).filter((c) => c === "sobreposicao")).toHaveLength(2);
  });
  it("homônimos: pessoas distintas não colidem", () => {
    const r = stageProfessionalSchedules([row({}), row({ personKey: "pB", linkKey: "L3" })], refs);
    expect(r.slots.every((s) => s.status === "confirmado")).toBe(true);
  });
  it("ausência ≠ zero: horário ausente é incompleto; carga só comparada quando ambas existem", () => {
    const r = stageProfessionalSchedules([
      row({ start: null }), row({ declaredWeeklyMinutes: 0 }), row({ linkKey: "L2", schoolInep: "33100012", weekday: 2, declaredWeeklyMinutes: 300 }),
    ], refs);
    expect(codes(r)).toContain("horario-incompleto");
    expect(codes(r).filter((c) => c === "carga-divergente-da-contratual")).toHaveLength(1);
    expect(r.totalsBySchool["33094756"]!.incompleto).toBe(1);
  });
  it("lotação ausente na escola marca divergente", () => {
    const r = stageProfessionalSchedules([row({ schoolInep: "33100012" })], refs);
    expect(r.slots[0]!.status).toBe("divergente");
    expect(codes(r)).toContain("vinculo-sem-lotacao-na-escola");
  });
  it("duas fontes divergentes viram evidência; evidências não expõem chave completa", () => {
    const a = stageProfessionalSchedules([row({})], refs).slots;
    const b = stageProfessionalSchedules([row({ end: "12:00" })], refs).slots;
    const ev = compareScheduleSources(a, b);
    expect(ev.map((e) => e.code)).toEqual(["fontes-divergentes"]);
    expect(compareScheduleSources(a, a)).toEqual([]);
  });
});

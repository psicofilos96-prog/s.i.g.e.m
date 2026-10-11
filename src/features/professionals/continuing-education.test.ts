import { describe, expect, it } from "vitest";
import { attendancePct, certificateEligibility, certificatePublicView, externalRecognized, individualHours, seatAllocation } from "./continuing-education";

const o = { id: "c", seats: 2, hours: 40, minAttendancePct: 75 };
describe("formação continuada", () => {
  it("vagas por ordem e espera; duplicata conta uma vez", () => {
    const e = [{ personId: "a", at: "1", state: "inscrita" as const }, { personId: "b", at: "2", state: "inscrita" as const }, { personId: "a", at: "3", state: "inscrita" as const }, { personId: "c", at: "4", state: "inscrita" as const }];
    expect(seatAllocation(o, e)).toEqual({ ok: true, confirmed: ["b", "a"].sort((x, y) => (x === "b" ? 1 : -1)), waitlist: ["c"] });
    expect(seatAllocation({ ...o, seats: null }, e).ok).toBe(false);
  });
  it("frequência só sobre sessões realizadas e completas", () => {
    expect(attendancePct([{ held: true, present: true }, { held: false, present: null }, { held: true, present: false }])).toBe(50);
    expect(attendancePct([{ held: true, present: null }])).toBeNull();
  });
  it("certificado exige configuração e mínimo", () => {
    expect(certificateEligibility({ ...o, minAttendancePct: null }, 100).ok).toBe(false);
    expect(certificateEligibility(o, 74.9)).toEqual({ ok: false, reason: "frequencia-insuficiente" });
    expect(certificateEligibility(o, 75)).toEqual({ ok: true, hours: 40 });
  });
  it("externo só com validação de outra pessoa", () => {
    expect(externalRecognized({ submittedBy: "p", validatedBy: "p", decision: "aceito" })).toBe(false);
    expect(externalRecognized({ submittedBy: "p", validatedBy: "q", decision: "aceito" })).toBe(true);
  });
  it("histórico ignora externo não reconhecido", () =>
    expect(individualHours([{ kind: "interno", hours: 40, recognized: false }, { kind: "externo", hours: 20, recognized: false }])).toBe(40));
  it("verificação pública sem dado pessoal", () =>
    expect(certificatePublicView({ codigo: "X", curso: "A", cpf: "1", matricula: "2" })).toEqual({ codigo: "X", curso: "A" }));
});

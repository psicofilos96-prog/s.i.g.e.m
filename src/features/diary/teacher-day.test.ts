import { describe, expect, it } from "vitest";
import { TEACHER_DAY_STEPS } from "./teacher-day";
describe("NDOC.UX — sequência do dia", () => {
  it("segue próxima aula → registrar → chamada → planejamento → pendências", () => {
    expect(TEACHER_DAY_STEPS.map((s) => s.id)).toEqual(["proxima", "aula", "chamada", "planejamento", "pendencias"]);
  });
  it("cada passo tem destino", () => {
    for (const s of TEACHER_DAY_STEPS) expect(Boolean(s.anchor) !== Boolean(s.to)).toBe(true);
  });
});

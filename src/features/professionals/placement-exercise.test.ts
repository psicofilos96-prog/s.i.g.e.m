import { describe, expect, it } from "vitest";
import { checkExercise, checkPlacement, divergencesOn, maxSchools, movementHistory, pictureOn, type Exercise, type Placement } from "./placement-exercise";

const p = (o: Partial<Placement>): Placement => ({ id: "p1", linkLogicalId: "L1", personId: "P1", schoolId: "E1", validFrom: "2026-01-01", validUntil: null, actRef: "port-1", reason: null, authorUserId: "u1", technical: false, recordedAt: "2026-01-01", ...o });
const x = (o: Partial<Exercise>): Exercise => ({ id: "x1", linkLogicalId: "L1", personId: "P1", schoolId: "E1", validFrom: "2026-01-01", validUntil: null, functionLabel: null, weeklyHours: 20, authorUserId: "u1", technical: false, recordedAt: "2026-01-01", ...o });

describe("lotação", () => {
  it("sem política homologada, só uma escola por vínculo", () => {
    expect(maxSchools(null)).toBe(1);
    expect(maxSchools({ maxSchoolsPerLink: 2, homologated: false })).toBe(1);
    expect(checkPlacement(p({ id: "p2", schoolId: "E2" }), [p({})], null)).toBe("excede-escolas-autorizadas");
  });
  it("múltiplas escolas quando autorizado", () => {
    const pol = { maxSchoolsPerLink: 2, homologated: true };
    expect(checkPlacement(p({ id: "p2", schoolId: "E2" }), [p({})], pol)).toBeNull();
    expect(checkPlacement(p({ id: "p3", schoolId: "E3" }), [p({}), p({ id: "p2", schoolId: "E2" })], pol)).toBe("excede-escolas-autorizadas");
  });
  it("mesma escola sobreposta, sem ato, sem autor ou técnico são recusados", () => {
    expect(checkPlacement(p({ id: "p2" }), [p({})], null)).toBe("mesma-escola-sobreposta");
    expect(checkPlacement(p({ actRef: null }), [], null)).toBe("sem-ato");
    expect(checkPlacement(p({ authorUserId: null }), [], null)).toBe("sem-autor");
    expect(checkPlacement(p({ technical: true }), [], null)).toBe("executor-tecnico");
  });
  it("movimentação sequencial é aceita e vira histórico", () => {
    const a = p({ validUntil: "2026-06-30" });
    const b = p({ id: "p2", schoolId: "E2", validFrom: "2026-07-01", actRef: "port-2", reason: "remoção" });
    expect(checkPlacement(b, [a], null)).toBeNull();
    expect(movementHistory("L1", [a, b])).toEqual([
      { date: "2026-01-01", linkLogicalId: "L1", from: null, to: "E1", actRef: "port-1", reason: null },
      { date: "2026-07-01", linkLogicalId: "L1", from: "E1", to: "E2", actRef: "port-2", reason: "remoção" },
    ]);
  });
});

describe("exercício", () => {
  it("distinto da lotação: divergência é sinalizada, não corrigida", () => {
    expect(checkExercise(x({ schoolId: "E9" }), [])).toBeNull();
    expect(divergencesOn("2026-03-01", [p({})], [x({ schoolId: "E9" })]).map((d) => d.kind).sort())
      .toEqual(["exercicio-sem-lotacao-na-escola", "lotacao-sem-exercicio"]);
  });
  it("sobreposição na mesma escola e jornada inválida recusadas", () => {
    expect(checkExercise(x({ id: "x2" }), [x({})])).toBe("sobreposto-na-mesma-escola");
    expect(checkExercise(x({ weeklyHours: 0 }), [])).toBe("jornada-invalida");
  });
  it("sem registro ⇒ ausência (null), respeitando knownAt", () => {
    expect(pictureOn("P1", "2026-03-01", "2025-12-31", [p({})], [x({})])).toEqual({ placementSchools: null, exerciseSchools: null });
    expect(pictureOn("P1", "2026-03-01", "2026-12-31", [p({})], [x({})])).toEqual({ placementSchools: ["E1"], exerciseSchools: ["E1"] });
  });
});

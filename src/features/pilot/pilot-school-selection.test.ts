import { describe, expect, it } from "vitest";
import { choosePilotSchool, rankPilotSchools } from "./pilot-school-selection";

const base = { infrastructureFacts: 54, classes: 10, schoolEnrollments: 100, professionalExercises: 5 };

describe("escolha da escola piloto", () => {
  it("desempata por INEP crescente", () => {
    expect(choosePilotSchool([{ inep: "33000002", ...base }, { inep: "33000001", ...base }])?.inep).toBe("33000001");
  });
  it("ausência não vira zero e reduz cobertura", () => {
    const r = rankPilotSchools([
      { inep: "1", ...base, professionalExercises: null, schoolEnrollments: 99999 },
      { inep: "2", ...base },
    ]);
    expect(r[0]?.inep).toBe("2");
    expect(r[1]?.covered).toBe(3);
  });
  it("é determinística", () => {
    const rows = [{ inep: "b", ...base }, { inep: "a", ...base, classes: 11 }];
    expect(rankPilotSchools(rows)).toEqual(rankPilotSchools([...rows].reverse()));
  });
  it("lista vazia não escolhe", () => expect(choosePilotSchool([])).toBeNull());
});

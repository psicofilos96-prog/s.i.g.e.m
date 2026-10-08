import { describe, expect, it } from "vitest";
import { currentSchoolNames } from "./current-school-names";

const municipal = [
  { school_id: "inep-1", official_name: "E. M. Antiga", version_number: 1, valid_from: "2020-01-01" },
  { school_id: "inep-1", official_name: "E. M. Nova", version_number: 2, valid_from: "2027-02-01" },
];
const conveniada = [{ school_id: "inep-2", official_name: "Creche Conveniada", version_number: 1, valid_from: "2021-03-01" }];

describe("NSCHOOL.1 nome vigente", () => {
  it("renomeação futura não aparece antes da vigência", () => {
    expect(currentSchoolNames([...municipal, ...conveniada], "2026-10-08").get("inep-1")).toBe("E. M. Antiga");
  });
  it("na data da vigência vale o nome novo", () => {
    expect(currentSchoolNames(municipal, "2027-02-01").get("inep-1")).toBe("E. M. Nova");
  });
  it("conveniada segue a mesma regra", () => {
    expect(currentSchoolNames(conveniada, "2026-10-08").get("inep-2")).toBe("Creche Conveniada");
    expect(currentSchoolNames(conveniada, "2020-01-01").has("inep-2")).toBe(false);
  });
});

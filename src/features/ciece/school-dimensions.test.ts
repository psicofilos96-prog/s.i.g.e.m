import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  appendSchoolVersion, currentSchoolVersion, resolveSchool, schoolVersionAt, validateIdentifiers, type SchoolUnit,
} from "@/features/schools/school-registry";
import { projectSchoolDimensions } from "./school-dimensions";
import { isDimensionAvailable } from "./institutional-dimension-gaps";
import { episodeFacts } from "./fact-adapters";

const v1 = { id: "v1", schoolId: "esc-1", versionNumber: 1, supersedesVersionId: null, officialName: "Escola A", address: null, district: "Centro", locationKind: "urbana" as const, active: true, validFrom: "2026-01-01", originatingActRef: "ato-1" };
const unit: SchoolUnit = { schoolId: "esc-1", identifiers: [{ schoolId: "esc-1", kind: "inep", value: "03309475" }], versions: [v1] };

describe("14.1.1 cadastro de unidades", () => {
  it("identidade estável e INEP exato (zeros preservados)", () => {
    const r = appendSchoolVersion(unit, "v1", { ...v1, officialName: "Escola A Renomeada" }, "v2");
    if (!("unit" in r)) throw new Error();
    expect(r.unit.schoolId).toBe("esc-1");
    expect(projectSchoolDimensions([r.unit], "esc-1", "2026-06-01")!.schoolInep.value).toBe("03309475");
  });
  it("ausência não vira valor", () => {
    const d = projectSchoolDimensions([unit], "esc-1", "2026-06-01")!;
    expect(d.schoolAddress).toEqual({ value: null, availability: "ausente" });
    expect(d.schoolRedeCode.availability).toBe("ausente");
  });
  it("unidade inativa segue recuperável e fato antigo lê versão da época", () => {
    const r = appendSchoolVersion(unit, "v1", { ...v1, active: false, district: "Norte", validFrom: "2027-01-01" }, "v2");
    if (!("unit" in r)) throw new Error();
    expect(currentSchoolVersion(r.unit)!.active).toBe(false);
    expect(schoolVersionAt(r.unit, "2026-05-01")!.district).toBe("Centro");
    expect(projectSchoolDimensions([r.unit], "esc-1", "2026-05-01")!.schoolDistrict.value).toBe("Centro");
  });
  it("base superada falha fechada", () => {
    expect("violation" in appendSchoolVersion(unit, null, v1, "x")).toBe(true);
  });
  it("nome não resolve escola", () => {
    expect(resolveSchool([unit], { name: "Escola A" })).toBeNull();
    expect(resolveSchool([unit], { inep: "03309475" })?.schoolId).toBe("esc-1");
  });
  it("INEP duplicado entre unidades é rejeitado", () => {
    const other: SchoolUnit = { schoolId: "esc-2", identifiers: [{ schoolId: "esc-2", kind: "inep", value: "03309475" }], versions: [] };
    expect(validateIdentifiers([unit, other])[0].code).toBe("duplicate-identifier");
  });
  it("fatos referenciam só schoolId; CIECE não copia atributos", () => {
    const [f] = episodeFacts([{ id: "e", student_id: "s", school_id: "esc-1", class_id: "t", cycle_id: null, enrollment_id: "m", valid_from: "2026-02-01", originating_act_ref: null }]);
    expect(Object.keys(f.dimensions)).not.toContain("schoolInep");
    const src = readFileSync("src/features/ciece/school-dimensions.ts", "utf8");
    expect(src).not.toMatch(/supabase|insert|upsert/i);
  });
  it("dimensões escolares deixam de ser lacuna; sem indicadores", () => {
    for (const d of ["schoolInep", "schoolRedeCode", "schoolAddress", "schoolDistrict", "schoolLocation"]) expect(isDimensionAvailable(d)).toBe(true);
    const reg = readFileSync("src/features/schools/school-registry.ts", "utf8");
    expect(reg).not.toMatch(/studentCount|classCount|enrollmentCount|visitCount/);
  });
});

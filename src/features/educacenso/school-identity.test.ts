import { describe, expect, it } from "vitest";
import { projectIdentity, identityDuplicates, schoolCategory, summarizeIdentities } from "./school-identity";
import type { SchoolUnit, SchoolRecordVersion } from "@/features/schools/school-registry";

const ver = (o: Partial<SchoolRecordVersion> = {}): SchoolRecordVersion => ({ id: "v1", schoolId: "s1", versionNumber: 1, supersedesVersionId: null, officialName: "E M AGUAS CLARAS", address: null, district: null, locationKind: "urbana", active: true, validFrom: "2026-01-01", originatingActRef: null, administrativeDependency: "municipal", ...o });
const unit = (v: SchoolRecordVersion[], ineps = ["33094756"]): SchoolUnit => ({ schoolId: "s1", identifiers: ineps.map((value) => ({ schoolId: "s1", kind: "inep", value })), versions: v });
const field = (r: ReturnType<typeof projectIdentity>, n: number) => r.fields.find((f) => f.n === n)!;

describe("identidade censitária da escola", () => {
  it("mapeia zona e dependência só de literais conhecidos", () => {
    const r = projectIdentity(unit([ver()]), "2026-05-27", null, 10);
    expect(field(r, 19).value).toBe("1");
    expect(field(r, 21).value).toBe("3");
    expect(field(r, 2).value).toBe("33094756");
  });
  it("endereço ausente é pendência, nunca valor presumido", () => {
    const r = projectIdentity(unit([ver()]), "2026-05-27", null, 10);
    expect(field(r, 10).state).toBe("pendente");
    expect(r.pendencies.some((p) => p.startsWith("10 "))).toBe(true);
  });
  it("conveniada exige privada com poder público parceiro declarado", () => {
    expect(schoolCategory(ver({ administrativeDependency: "privada", partnershipPublicAuthority: "Municipal" }))).toBe("conveniada");
    expect(schoolCategory(ver({ administrativeDependency: "privada" }))).toBe("desconhecida");
    expect(schoolCategory(ver())).toBe("municipal");
  });
  it("campos de privada não se aplicam à municipal", () => {
    expect(field(projectIdentity(unit([ver()]), "2026-05-27", null, 1), 47).state).toBe("nao-aplicavel");
  });
  it("divergência com o recibo é exibida, não resolvida", () => {
    const r = projectIdentity(unit([ver()]), "2026-05-27", { censusYear: 2026, declared: { name: "E M Águas Claras", dependencia: "Municipal", localizacao: "Rural" }, recordedAt: "2026-10-05", sourceRef: null }, 1);
    expect(field(r, 6).state).toBe("informado");
    expect(field(r, 19).state).toBe("divergente");
    expect(field(r, 19).value).toBe("1");
  });
  it("respeita a validade temporal da versão", () => {
    const r = projectIdentity(unit([ver({ validFrom: "2026-08-31" })]), "2026-05-27", null, 1);
    expect(r.pendencies[0]).toBe("Sem versão cadastral vigente na data");
    expect(field(r, 6).value).toBeNull();
  });
  it("sinaliza INEP duplicado sem escolher", () => {
    expect(identityDuplicates([unit([ver()], ["1", "2"])])).toHaveLength(1);
    expect(identityDuplicates([unit([ver()]), { ...unit([ver()]), schoolId: "s2" }])).toEqual(["INEP 33094756 em 2 escolas"]);
  });
  it("resumo conta categorias", () => {
    const s = summarizeIdentities([projectIdentity(unit([ver()]), "2026-12-31", null, 1)]);
    expect(s).toMatchObject({ total: 1, municipal: 1, conveniada: 0 });
  });
});

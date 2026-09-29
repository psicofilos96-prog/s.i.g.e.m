import { describe, expect, it } from "vitest";
import { formInstitutionalLogin, generateProvisionalPassword } from "./login-rule";

describe("regra oficial de login", () => {
  it("forma login por matrícula, INEP e setor", () => {
    expect(formInstitutionalLogin("matricula", " 60777-0 ")).toBe("60777-0@sigem.itap.gov.br");
    expect(formInstitutionalLogin("inep", "33094756")).toBe("33094756@sigem.itap.gov.br");
    expect(formInstitutionalLogin("setor", "Secretaria Escolar")).toBe("secretariaescolar@sigem.itap.gov.br");
  });
  it("recusa valor vazio ou INEP inválido", () => {
    expect(formInstitutionalLogin("matricula", "  ")).toBeNull();
    expect(formInstitutionalLogin("inep", "123")).toBeNull();
  });
  it("senha provisória é aleatória", () => {
    const a = generateProvisionalPassword();
    expect(a).toHaveLength(14);
    expect(a).not.toBe(generateProvisionalPassword());
  });
});

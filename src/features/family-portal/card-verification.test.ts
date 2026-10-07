import { describe, expect, it } from "vitest";
import { verifyCard } from "./card-verification";
const c = (version: number, kind: "emissao" | "reemissao" | "cancelamento") => ({ publicId: "P", version, kind, academicYear: "2027", validUntil: "2027-12-31", studentName: "Ana", schoolName: "E", classLabel: "1º A", reason: null, cpf: "000", address: "rua" });
describe("N9.2 verificação pública", () => {
  it("válida mostra só campos permitidos", () => {
    const v = verifyCard([c(1, "emissao")], "P", 1, "2027-03-01");
    expect(v.status).toBe("valida"); expect(Object.keys(v).sort()).toEqual(["academicYear", "classLabel", "publicId", "schoolName", "status", "studentName"]);
  });
  it("reemissão substitui, cancelamento cancela, expira, inexistente indisponível", () => {
    expect(verifyCard([c(1, "emissao"), c(2, "reemissao")], "P", 1, "2027-03-01").status).toBe("substituida");
    expect(verifyCard([c(1, "emissao"), c(2, "cancelamento")], "P", 1, "2027-03-01").status).toBe("cancelada");
    expect(verifyCard([c(1, "emissao")], "P", 1, "2028-01-01").status).toBe("expirada");
    expect(verifyCard([c(1, "emissao")], "X", 1, "2027-03-01")).toEqual({ status: "indisponivel" });
  });
});

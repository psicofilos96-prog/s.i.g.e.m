import { describe, expect, it } from "vitest";
import { publicCardView } from "./card-public-code";
import { issuedValidity, verifyUrlFor } from "./card-issuance";

const row = { student_name: "A", school_name: "E", class_label: "T", academic_year: "2027", public_id: "ABCDEFGHIJ" };

describe("N9.2.5 — verificação pública da carteirinha", () => {
  it("status desconhecido do servidor vira 'não encontrada' sem nenhum dado", () => {
    expect(publicCardView({ ...row, status: "rascunho" })).toEqual({ status: "indisponivel", student_name: null, school_name: null, class_label: null, academic_year: null, public_id: null });
    expect(publicCardView({ ...row, status: "__proto__" }).student_name).toBeNull();
  });
  it("indisponível e resposta vazia nunca mostram dados", () => {
    expect(publicCardView({ ...row, status: "indisponivel" }).student_name).toBeNull();
    expect(publicCardView(undefined).status).toBe("indisponivel");
  });
  it("status conhecido mantém só a allowlist", () => {
    const v = publicCardView({ ...row, status: "valida", cpf: "x" } as never);
    expect(v.status).toBe("valida");
    expect(Object.keys(v).sort()).toEqual(["academic_year", "class_label", "public_id", "school_name", "status", "student_name"]);
  });
  it("QR só com origem https", () => {
    expect(verifyUrlFor("http://x", "ABCDEFGHIJ", 1)).toBeNull();
    expect(verifyUrlFor("https://x", "ABCDEFGHIJ", 1)).toContain("/verificar/carteirinha/ABCDEFGHIJ.1");
  });
  it("validade impressa vem só da emissão", () => {
    expect(typeof issuedValidity({ status: "valida", valid_until: "2027-12-31" } as never)).toBe("string");
  });
});

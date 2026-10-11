import { describe, expect, it } from "vitest";
import { publicCardView } from "./card-public-code";
import { issuedValidity, verifyUrlFor } from "./card-issuance";

const row = { school_name: "E", academic_year: "2027", public_id: "ABCDEFGHIJ", version: 1, valid_until: "2027-12-31", issued_on: "2027-02-01" };

describe("N9.2.5 — verificação pública da carteirinha", () => {
  it("status desconhecido do servidor vira 'não encontrada' sem nenhum dado", () => {
    expect(publicCardView({ ...row, status: "rascunho" })).toEqual({ status: "indisponivel", public_id: null, version: null, school_name: null, academic_year: null, valid_until: null, issued_on: null });
    expect(publicCardView({ ...row, status: "__proto__" }).public_id).toBeNull();
  });
  it("indisponível e resposta vazia nunca mostram dados", () => {
    expect(publicCardView({ ...row, status: "indisponivel" }).public_id).toBeNull();
    expect(publicCardView(undefined).status).toBe("indisponivel");
  });
  it("status conhecido mantém só a allowlist", () => {
    const v = publicCardView({ ...row, status: "valida", cpf: "x" } as never);
    expect(v.status).toBe("valida");
    expect(Object.keys(v).sort()).toEqual(["academic_year", "issued_on", "public_id", "school_name", "status", "valid_until", "version"]);
  });
  it("QR só com origem https", () => {
    expect(verifyUrlFor("http://x", "ABCDEFGHIJ", 1)).toBeNull();
    expect(verifyUrlFor("https://x", "ABCDEFGHIJ", 1)).toContain("/verificar/carteirinha/ABCDEFGHIJ.1");
  });
  it("validade impressa vem só da emissão", () => {
    expect(typeof issuedValidity({ status: "valida", valid_until: "2027-12-31" } as never)).toBe("string");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { redactText } from "@/lib/observability/telemetry";
import { maskCpf } from "@/features/professionals/professional-identity-draft";
import { verifyCard } from "@/features/family-portal/card-verification";

describe("NPRIV.1 minimização", () => {
  it("servidor não imprime erro cru (só via telemetria redigida)", () => {
    const src = readFileSync("src/server.ts", "utf8");
    expect(src).not.toMatch(/console\.(error|log|warn)\(/);
  });
  it("redação remove CPF de mensagem de erro do banco", () => {
    expect(redactText('Key (cpf)=(123.456.789-09) already exists')).not.toContain("123.456.789-09");
  });
  it("CPF na tela mostra só os 2 últimos dígitos", () => {
    expect(maskCpf("12345678909")).toBe("•••.•••.•••-09");
  });
  it("verificação pública da carteirinha não devolve CPF/endereço", () => {
    const c = { publicId: "P", version: 1, kind: "emissao" as const, academicYear: "2027", validUntil: "2027-12-31", studentName: "A", schoolName: "E", classLabel: null, reason: null, cpf: "1", address: "r" };
    const v = verifyCard([c as never], "P", 1, "2027-03-01");
    expect(Object.keys(v)).not.toContain("cpf");
    expect(Object.keys(v)).not.toContain("address");
  });
});

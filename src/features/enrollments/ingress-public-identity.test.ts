import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { campaignWindow, normalizeProtocolInput, validProtocolInput } from "./ingress-public";
import { checkRecovery, planIdentification, RECOVERY_MAX_ATTEMPTS, recoveryResponse, validCpf } from "./ingress-identity";

const sql = readFileSync("drizzle/migrations/0457_enr04_public_portal_readers.sql", "utf8");
const route = readFileSync("src/routes/publico.matriculas.tsx", "utf8");
const h = (v: string) => `h(${v})`;

describe("Matrículas L04 — portal público", () => {
  it("prazo segue a versão publicada; suspensa prevalece", () => {
    const c = { state: "publicada", period_from: "2027-01-10", period_to: "2027-01-20" };
    expect(campaignWindow(c, "2027-01-09")).toBe("em-breve");
    expect(campaignWindow(c, "2027-01-20")).toBe("aberta");
    expect(campaignWindow(c, "2027-01-21")).toBe("encerrada");
    expect(campaignWindow({ ...c, state: "suspensa" }, "2027-01-15")).toBe("suspensa");
  });
  it("protocolo exige número e código; entrada inválida nunca chega ao banco", () => {
    expect(validProtocolInput("prot-2027-12", "ABCDEF 123456")).toBe(true);
    expect(normalizeProtocolInput(" prot-2027-12 ", "ab-cd")).toEqual({ number: "PROT-2027-12", code: "abcd" });
    expect(validProtocolInput("PROT-2027-12", "")).toBe(false);
  });
  it("consulta responde igual para inexistente e código errado, sem assunto/pessoa/unidade", () => {
    expect(sql.match(/'indisponivel'::text, NULL::date, NULL::date/g)?.length).toBe(2);
    const fn = sql.slice(sql.indexOf("enr_public_protocol_status"));
    expect(fn).not.toMatch(/RETURN QUERY SELECT[^;]*(subject|interested|origin_unit|registered_by)/);
  });
  it("só lê funções públicas e só mostra publicada/suspensa", () => {
    expect(route).not.toMatch(/\.from\(/);
    expect(route).toMatch(/PublicLayout/);
    expect(sql).toContain("p.st IN ('publicada','suspensa')");
    expect(sql).not.toMatch(/GRANT (SELECT|INSERT|UPDATE|DELETE)/);
  });
});

describe("Matrículas L05 — identificação e recuperação", () => {
  const base = { kind: "responsavel" as const, fullName: "Maria da Silva", cpf: "529.982.247-25", birthDate: "1990-05-01", contacts: [{ channel: "email" as const, value: "Maria@Ex.com" }], kinship: "mãe" };
  it("parentesco declarado nunca cria vínculo autorizado e CPF/contato só como HMAC", () => {
    const r = planIdentification(base, "2027-01-01", 18, h);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.kinship).toEqual({ declared: "mãe", status: "declarado" });
    expect(r.value.createsGuardianLink).toBe(false);
    expect(JSON.stringify(r.value)).not.toContain("52998224725");
    expect(r.value.contacts[0]).toMatchObject({ hmac: "h(maria@ex.com)", masked: "m***@ex.com", verified: false });
  });
  it("estudante adulto exige idade configurada; sem configuração recusa", () => {
    const a = { ...base, kind: "estudante-adulto" as const, kinship: null, birthDate: "2010-01-01" };
    expect(planIdentification(a, "2027-01-01", null, h).ok).toBe(false);
    expect(planIdentification(a, "2027-01-01", 18, h).ok).toBe(false);
    expect(planIdentification({ ...a, birthDate: "2000-01-01" }, "2027-01-01", 18, h).ok).toBe(true);
  });
  it("CPF inválido e sem contato recusam", () => {
    expect(validCpf("111.111.111-11")).toBe(false);
    expect(planIdentification({ ...base, contacts: [] }, "2027-01-01", 18, h).ok).toBe(false);
  });
  it("recuperação: resposta uniforme, uso único, expiração e limite de tentativas", () => {
    expect(recoveryResponse(true)).toEqual(recoveryResponse(false));
    const ch = { codeHash: "abc", expiresAt: 1000, attempts: 0, usedAt: null };
    const ok = checkRecovery(ch, "abc", 10);
    expect(ok.ok).toBe(true);
    expect(checkRecovery(ok.next, "abc", 20).ok).toBe(false);
    expect(checkRecovery(ch, "abc", 2000).ok).toBe(false);
    expect(checkRecovery({ ...ch, attempts: RECOVERY_MAX_ATTEMPTS }, "abc", 10).ok).toBe(false);
  });
});

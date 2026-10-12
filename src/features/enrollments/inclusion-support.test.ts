import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { decisionFactorsAllowed, destinationAllowed, destinationsFor, looksClinical, minimalReferral } from "./inclusion-support";

const sql = readFileSync("drizzle/migrations/0475_enr22_inclusion_support.sql", "utf8");
const decisionMigrations = readdirSync("drizzle/migrations").filter((f) => /^04(6[5-9]|7[0-4])_/.test(f));

describe("L22 inclusão e acessibilidade no ingresso", () => {
  it("encaminha só ao destino compatível", () => {
    expect(destinationsFor("transporte-adaptado")).toEqual(["transporte"]);
    expect(destinationAllowed("acessibilidade-fisica", "nei")).toBe(false);
    expect(destinationAllowed("apoio-pedagogico-especializado", "nei")).toBe(true);
    expect(sql).toMatch(/'destino-incompativel'/);
  });
  it("destino recebe o mínimo: sem nome, nascimento, CPF ou contato", () => {
    expect(minimalReferral({ application_code: "INS-1", student_name: "X", requester_phone: "1", need_kind: "transporte-adaptado" }))
      .toEqual({ application_code: "INS-1", need_kind: "transporte-adaptado" });
    const reader = sql.slice(sql.indexOf("FUNCTION public.enr_support_referrals_for"));
    expect(reader).not.toMatch(/student_name|birth|cpf|email|phone/);
  });
  it("sem CID/laudo/texto livre; texto clínico detectado", () => {
    expect(sql).not.toMatch(/\b(cid|laudo|diagnos|notes|description)\b\s+text/i);
    expect(looksClinical("CID F84")).toBe(true);
    expect(looksClinical("rampa de acesso")).toBe(false);
  });
  it("apoio e pendência documental nunca pesam em classificação, distribuição, reserva ou confirmação", () => {
    expect(decisionMigrations.length).toBeGreaterThanOrEqual(8);
    for (const f of decisionMigrations) expect(readFileSync(`drizzle/migrations/${f}`, "utf8")).not.toMatch(/enr_support|deficien/i);
    expect(decisionFactorsAllowed(["data-inscricao", "need_kind"])).toBe(false);
    expect(decisionFactorsAllowed(["data-inscricao"])).toBe(true);
  });
  it("autoria real, capacidade, append-only, sem anon", () => {
    expect(sql.match(/current_person_id\(\)/g)?.length).toBe(2);
    expect(sql).toMatch(/'registrar-apoio-de-ingresso'/);
    expect(sql).toMatch(/doc_numbering_append_only/);
    expect(sql).toMatch(/FROM PUBLIC, anon/);
  });
});

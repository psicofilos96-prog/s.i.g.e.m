import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { proposeConsolidations } from "./account-consolidation";
import { passwordProblem } from "./password-policy";
import { AREAS, PROPOSED_AREA_KINDS } from "./institutional-profiles";

const v8 = JSON.parse(readFileSync("docs/data/l43-policy-v8-rules.json", "utf8")) as { rules: [string, string, string[]][] };

describe("L44 consolidação de logins", () => {
  it("dupla matrícula sem ligação comprovada: nunca consolida (estado atual: 0 ligações)", () => {
    const r = proposeConsolidations([{ userId: "a", registrationNorm: "1-1" }, { userId: "b", registrationNorm: "2-2" }], []);
    expect(r.proposals).toEqual([]);
    expect(r.refused.map((x) => x.reason)).toEqual(["sem-ligacao-comprovada", "sem-ligacao-comprovada"]);
  });
  it("duas matrículas ligadas à mesma pessoa ⇒ proposta (não execução)", () => {
    const r = proposeConsolidations([{ userId: "a", registrationNorm: "1-1" }, { userId: "b", registrationNorm: "2-2" }],
      [{ registrationNorm: "1-1", personId: "p", revoked: false }, { registrationNorm: "2-2", personId: "p", revoked: false }]);
    expect(r.proposals).toEqual([{ personId: "p", userIds: ["a", "b"], registrations: ["1-1", "2-2"] }]);
  });
  it("ligação revogada não conta; ligação a duas pessoas é ambígua", () => {
    const r = proposeConsolidations([{ userId: "a", registrationNorm: "1-1" }, { userId: "b", registrationNorm: "2-2" }],
      [{ registrationNorm: "1-1", personId: "p", revoked: true }, { registrationNorm: "2-2", personId: "p", revoked: false }, { registrationNorm: "2-2", personId: "q", revoked: false }]);
    expect(r.proposals).toEqual([]);
    expect(r.refused.map((x) => x.reason)).toEqual(["sem-ligacao-comprovada", "ligacao-ambigua"]);
  });
  it("conta de setor (sem matrícula) nunca consolida com pessoa", () => {
    expect(proposeConsolidations([{ userId: "s", registrationNorm: null }], []).refused[0]!.reason).toBe("sem-matricula");
  });
});

describe("L44 senha inicial", () => {
  it("regra mínima da nova senha", () => {
    expect(passwordProblem("curta1", "curta1")).not.toBeNull();
    expect(passwordProblem("semnumeroaqui", "semnumeroaqui")).not.toBeNull();
    expect(passwordProblem("abcdefgh12", "abcdefgh13")).not.toBeNull();
    expect(passwordProblem("abcdefgh12", "abcdefgh12")).toBeNull();
  });
  it("migration 0512 exige troca para contas em massa e não toca senha", () => {
    const sql = readFileSync("drizzle/migrations/0512_l44_bulk_login_password_change.sql", "utf8");
    expect(sql).toMatch(/'servant-login','sector'/);
    expect(sql).not.toMatch(/encrypted_password|UPDATE auth|DELETE/i);
  });
  it("o portão de troca envolve a área de trabalho", () => {
    expect(readFileSync("src/components/app-shell/app-shell.tsx", "utf8")).toMatch(/<PasswordChangeGate>/);
  });
});

describe("L44 propostas separadas da política vigente", () => {
  it("nenhum tipo proposto existe na política homologada (proposta ≠ vigente)", () => {
    const kinds = new Set(v8.rules.map((r) => r[0]));
    for (const k of Object.values(PROPOSED_AREA_KINDS)) expect(kinds.has(k)).toBe(false);
  });
  it("toda área bloqueada tem tipo proposto, e proposta não entra em kinds (default deny)", () => {
    for (const a of AREAS.filter((x) => !x.kinds.length && x.id !== "familia" && x.id !== "importacao-tecnica")) {
      expect(PROPOSED_AREA_KINDS[a.id]).toBeTruthy();
      expect(a.kinds).not.toContain(PROPOSED_AREA_KINDS[a.id]);
    }
  });
});

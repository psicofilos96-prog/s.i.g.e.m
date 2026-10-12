import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { currentDestinations, buildMinimalPacket, validateReferral, projectReferral, type Destination } from "./referrals";

const d = (o: Partial<Destination> = {}): Destination => ({ id: "D2", destKey: "conselho-tutelar", version: 2, label: "Conselho Tutelar", legalBasis: "ECA art. 56",
  allowedFields: ["iniciais", "escola", "faltas"], agreementRef: null, authorPerson: "a", approvedBy: "b", decisionRef: "Dec", ...o });
const sha = "f".repeat(64);

describe("L13 encaminhamentos", () => {
  it("só destino vigente aprovado por outra pessoa e sem campo vetado", () => {
    expect(currentDestinations([d()])).toHaveLength(1);
    expect(currentDestinations([d(), d({ id: "D3", version: 3, approvedBy: null, decisionRef: null })])).toHaveLength(0);
    expect(currentDestinations([d({ approvedBy: "a" })])).toHaveLength(0);
    expect(currentDestinations([d({ allowedFields: ["prontuario"] })])).toHaveLength(0);
    expect(validateReferral({ purpose: "curto", destination: d() })).toMatch(/finalidade/);
  });
  it("pacote mínimo nunca leva prontuário nem campos fora da allowlist", () => {
    const src = { iniciais: "AB", escola: "E1", faltas: 12, prontuario: "x", cpf: "y" };
    const ok = buildMinimalPacket(d(), ["iniciais", "faltas"], src);
    expect(ok.ok && ok.packet).toEqual({ iniciais: "AB", faltas: 12 });
    expect(buildMinimalPacket(d(), ["prontuario"], src).ok).toBe(false);
    expect(buildMinimalPacket(d(), [], src).ok).toBe(false);
  });
  it("enviado só com comprovante; retorno registrado", () => {
    expect(projectReferral([{ referralId: "R", seq: 1, kind: "envio-comprovado", evidenceRef: "OF 1", evidenceSha256: null, note: null }]).state).toBe("registrado");
    const p = projectReferral([{ referralId: "R", seq: 1, kind: "envio-comprovado", evidenceRef: "OF 1", evidenceSha256: sha, note: null },
      { referralId: "R", seq: 2, kind: "retorno", evidenceRef: null, evidenceSha256: null, note: "acompanhamento iniciado" }]);
    expect([p.state, p.sentProof, p.returnNote]).toEqual(["retornado", "OF 1", "acompanhamento iniciado"]);
  });
  it("banco veta prontuário e exige comprovante", () => {
    const sql = readFileSync("drizzle/migrations/0401_perm13_referrals.sql", "utf8");
    expect(sql).toMatch(/'prontuario','prontuario-integral','laudo','cid','cpf'/);
    expect(sql).toMatch(/permref:fields-not-allowed/);
    expect(sql).toMatch(/evidence_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/);
  });
});

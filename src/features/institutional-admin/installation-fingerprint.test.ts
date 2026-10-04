import { describe, expect, it } from "vitest";
import { buildInstallArgs, parseInstallationReview } from "./institutional-admin-page";

const fp = "a".repeat(64);
const policy = { id: "p1", logicalPolicyId: "pol", version: 2, status: "draft", fingerprint: fp, rules: [{ engagementKindId: "k", capabilityId: "c", scope: [] }] };

describe("revisão da instalação por impressão digital (B4.6.7e)", () => {
  it("lê o contrato novo com impressão válida", () => {
    const r = parseInstallationReview({ contract: "b4.6.7e/1", state: "lido", installation: "nao-instalado", emailConfirmed: true, policies: [policy] });
    expect(r.state).toBe("lido");
  });
  it("recusa contrato antigo por contagem e impressão ausente/malformada", () => {
    expect(parseInstallationReview({ contract: "b4.6.7d/1", state: "lido", policies: [] }).state).toBe("erro");
    expect(parseInstallationReview({ contract: "b4.6.7e/1", state: "lido", policies: [{ ...policy, fingerprint: undefined }] })).toEqual({ state: "erro", reason: "impressao-digital" });
    expect(parseInstallationReview({ contract: "b4.6.7e/1", state: "lido", policies: [{ ...policy, fingerprint: "ABC" }] }).state).toBe("erro");
  });
  it("envia exatamente a impressão revisada e nunca a contagem", () => {
    const a = buildInstallArgs(policy, { act: "ato", name: "n", identifier: "i", label: "l" }, "k", true);
    expect(a._expected_fingerprint).toBe(fp);
    expect(a._policy_id).toBe("p1");
    expect(a._confirm_all_rules_reviewed).toBe(true);
    expect(a).not.toHaveProperty("_reviewed_rule_count");
  });
});

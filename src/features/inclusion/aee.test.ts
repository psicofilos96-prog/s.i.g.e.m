import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CREATABLE_RECORD_TYPES, inclusionMessage } from "./inclusion-model";
import { WEEKDAYS, aeeEligibilityNote, eligibilityLabel } from "./aee-model";

const mig = readFileSync("drizzle/migrations/0167_ah_inclusive_education_aee_mediation.sql", "utf8");

describe("AH — AEE e mediação", () => {
  it("AEE não nasce como registro genérico", () => {
    expect(CREATABLE_RECORD_TYPES.map((t) => t.id)).not.toContain("atendimento-aee");
    expect(CREATABLE_RECORD_TYPES.map((t) => t.id)).not.toContain("participacao-aee");
  });
  it("elegibilidade fica pendente, nunca calculada", () => {
    expect(eligibilityLabel("regra-institucional-pendente")).toBe("INSTITUTIONAL_ELIGIBILITY_RULES_PENDING");
    expect(aeeEligibilityNote).toMatch(/não decide nem sugere/);
  });
  it("esquema não modela diagnóstico, CID ou condição", () => {
    const ddl = mig.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(ddl).not.toMatch(/\b(cid|diagnos|deficien|laudo|condicao|risco)\w*/i);
  });
  it("frequência do AEE não toca a frequência da turma regular", () => {
    expect(mig).not.toMatch(/attendance_record_versions/);
  });
  it("automação não tem writer nem DML nas tabelas novas", () => {
    expect(mig).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.inclusion_records/);
    expect(mig).not.toMatch(/GRANT (ALL|INSERT|UPDATE|DELETE)[^;]*aee_/);
    expect(mig).not.toMatch(/GRANT EXECUTE[^;]*TO[^;]*service_role/);
  });
  it("mensagens explicam recusas", () => {
    expect(inclusionMessage("inclusion:aee-is-own-entity")).toMatch(/seção própria/);
    expect(inclusionMessage("inclusion:mediation-overlap")).toMatch(/já tem vínculo/);
    expect(WEEKDAYS).toHaveLength(7);
  });
});

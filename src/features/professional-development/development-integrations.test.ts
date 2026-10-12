import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { DEV_INTEGRATIONS, FORBIDDEN_EFFECT_TERMS, certificateEffects, partnerProblems } from "./development-integrations";

const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
const devMigrations = readdirSync("drizzle/migrations").filter((f) => /^04(3[1-9]|[4-9]\d)_dev/.test(f));

describe("L22 integrações", () => {
  it("toda fonte citada existe no banco", () => {
    for (const i of DEV_INTEGRATIONS) for (const s of i.canonicalSources) expect(types, s).toContain(`      ${s}: {`);
  });
  it("certificado não gera progressão, promoção ou remuneração", () => {
    expect(certificateEffects({ status: "emitido" }).functionalEffects).toEqual([]);
    for (const f of devMigrations) {
      const cols = [...readFileSync(`drizzle/migrations/${f}`, "utf8").matchAll(/^\s+([a-z_]+)\s+(?:uuid|text|int|numeric|boolean|date)/gm)].map((m) => m[1] ?? "");
      expect(cols.filter((c) => FORBIDDEN_EFFECT_TERMS.test(c.replace(/_/g, " "))), f).toEqual([]);
    }
  });
  it("parceiro exige aprovador distinto e vigência coerente", () => {
    expect(partnerProblems({ approverPerson: "a", authorPerson: "b", validFrom: "2026-01-01", validUntil: null, reason: "Convênio vigente juntado" })).toEqual([]);
    expect(partnerProblems({ approverPerson: "a", authorPerson: "a", validFrom: "2026-02-01", validUntil: "2026-01-01", reason: "x" })).toHaveLength(3);
  });
  it("writers de parceiro fecham DML e recusam autoaprovação", () => {
    const sql = readFileSync("drizzle/migrations/0453_dev22_partners_integration.sql", "utf8");
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.dev_partners/);
    expect(sql).toContain("dev:self-approval");
  });
});

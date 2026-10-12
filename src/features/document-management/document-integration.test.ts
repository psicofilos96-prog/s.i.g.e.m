import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { MODULE_INTEGRATIONS, NEVER_SEARCHABLE, SEARCHABLE_FIELDS, sanitizeSearchTerm, sharedRequestPlan, subjectPrivacyWarnings } from "./document-integration";
import { DOCS_CLOSURE_CRITERIA, DOCS_CLOSURE_SECTIONS, docClosureProblems } from "./documents-closure";
import { DOC_REPORTS } from "./documents-reports";

const sql = readFileSync(`drizzle/migrations/${readdirSync("drizzle/migrations").find((n) => n.includes("doc19_sensitive_grant_and_origin_links"))}`, "utf8");

describe("L15–L24 integração e fechamento", () => {
  it("L15 solicitações pelo protocolo único; sistema externo bloqueado", () => {
    expect(sharedRequestPlan("familia", "prot-1")).toMatchObject({ ok: true, channel: "digital" });
    expect(sharedRequestPlan("sistema-externo", "x").ok).toBe(false);
    expect(sql).toMatch(/origin:external-system-not-configured/);
  });
  it("L16 pesquisa não expõe metadado sensível", () => {
    for (const f of NEVER_SEARCHABLE) expect(SEARCHABLE_FIELDS as readonly string[]).not.toContain(f);
    expect(sanitizeSearchTerm("%a_b\\")).toBe("ab");
  });
  it("L20 alerta de dado sensível no assunto", () => {
    expect(subjectPrivacyWarnings("Laudo médico do servidor")).toHaveLength(1);
    expect(subjectPrivacyWarnings("Pedido 123.456.789-00")).toHaveLength(1);
  });
  it("L21–23 integração por referência; externo bloqueado", () => {
    expect(MODULE_INTEGRATIONS["sistema-externo"].status).toBe("bloqueado");
    expect(sql).toMatch(/UNIQUE \(case_id, origin_module, origin_ref\)/);
  });
  it("L24 20 relatórios, 24 lotes, 41 seções, 20 critérios, evidências em disco, sem homologado", () => {
    expect(DOC_REPORTS).toHaveLength(20);
    expect(docClosureProblems(existsSync)).toEqual([]);
    const all = [...DOCS_CLOSURE_SECTIONS, ...DOCS_CLOSURE_CRITERIA];
    expect(all.some((r) => (r.status as string) === "homologado")).toBe(false);
  });
});

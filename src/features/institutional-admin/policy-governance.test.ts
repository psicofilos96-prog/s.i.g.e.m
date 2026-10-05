import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { ADMINISTRATIVE_CAPABILITIES, diffPolicies, effectiveVersion, engagementActive, humanizePolicyError, validateDraft, type PolicyRule, type PolicyVersion } from "./policy-governance";

const admin: PolicyRule[] = ADMINISTRATIVE_CAPABILITIES.map((c) => ({ engagement_kind_id: "administrador-geral-do-sigem", capability_id: c, scope_dimensions: ["network"] }));
const v = (o: Partial<PolicyVersion>): PolicyVersion => ({ id: "a", logical_policy_id: "p", version: 1, status: "homologated", supersedes_version_id: null, valid_from: "2026-01-01", valid_until: null, homologation_origin: null, homologated_at: null, homologated_by: null, created_at: "", created_by: null, ...o });

describe("central de autorização", () => {
  it("remover a última capacidade administrativa é apontado", () => {
    const issues = validateDraft(admin.slice(1));
    expect(issues.some((i) => i.kind === "admin-removed")).toBe(true);
    expect(validateDraft(admin)).toEqual([]);
  });
  it("regra administrativa em escopo de escola não conta", () => {
    expect(validateDraft(admin.map((r) => ({ ...r, scope_dimensions: ["school"] }))).filter((i) => i.kind === "admin-removed")).toHaveLength(5);
  });
  it("curinga e duplicata recusados", () => {
    const issues = validateDraft([...admin, { engagement_kind_id: "x", capability_id: "*", scope_dimensions: [] }, admin[0]]);
    expect(issues.map((i) => i.kind)).toEqual(expect.arrayContaining(["wildcard", "duplicate"]));
  });
  it("diff independe da ordem dos escopos", () => {
    const d = diffPolicies([{ engagement_kind_id: "a", capability_id: "c", scope_dimensions: ["x", "y"] }], [{ engagement_kind_id: "a", capability_id: "c", scope_dimensions: ["y", "x"] }, { engagement_kind_id: "b", capability_id: "c", scope_dimensions: [] }]);
    expect(d).toMatchObject({ unchanged: 1, removed: [] }); expect(d.added).toHaveLength(1);
  });
  it("rascunho nunca é efetivo; sucessora iniciada encerra a anterior", () => {
    expect(effectiveVersion([v({ status: "draft" })], "2026-05-01")).toBeNull();
    const all = [v({}), v({ id: "b", version: 2, supersedes_version_id: "a", valid_from: "2026-06-01" })];
    expect(effectiveVersion(all, "2026-05-01")?.id).toBe("a");
    expect(effectiveVersion(all, "2026-07-01")?.id).toBe("b");
  });
  it("atuação expirada ou encerrada não está vigente", () => {
    expect(engagementActive({ valid_from: "2026-01-01", valid_until: "2026-03-01" }, null, "2026-04-01")).toBe(false);
    expect(engagementActive({ valid_from: "2026-01-01", valid_until: null }, "2026-02-01", "2026-04-01")).toBe(false);
    expect(engagementActive({ valid_from: "2026-01-01", valid_until: null }, null, "2026-04-01")).toBe(true);
  });
  it("erros humanizados sem vazar SQL", () => {
    expect(humanizePolicyError("policy:stale-head")).toMatch(/versão mais nova/);
    expect(humanizePolicyError("capability:homologar-politica-de-capacidades")).toMatch(/homologar-politica/);
    expect(humanizePolicyError('relation "x" violates')).not.toMatch(/relation/);
  });
  it("migration: concorrência, curinga, prévia, contas sem credencial e EXECUTE restrito", () => {
    const sql = readFileSync("drizzle/migrations/0080_admin_center_policy_governance.sql", "utf8") + readFileSync("drizzle/migrations/0081_admin_account_overview_fix.sql", "utf8");
    expect(sql).toMatch(/policy:stale-head/); expect(sql).toMatch(/policy:wildcard-forbidden/);
    expect(sql).toMatch(/has_network_capability\('homologar-politica-de-capacidades'\)/);
    expect(sql).not.toMatch(/encrypted_password|raw_app_meta|recovery_token/);
    for (const f of ["register_capability_policy_draft_expected", "homologate_capability_policy_expected", "preview_capability_policy", "admin_account_overview"])
      expect(sql).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${f}\\([^)]*\\) FROM PUBLIC, anon`));
  });
  it("a central não grava tabelas diretamente nem troca de perfil", () => {
    const ui = readFileSync("src/features/institutional-admin/access-center-page.tsx", "utf8");
    expect(ui).not.toMatch(/\.(insert|update|delete|upsert)\(/);
    expect(ui).not.toMatch(/impersonat|service_role|encrypted_|access_token|refresh_token/i);
  });
});

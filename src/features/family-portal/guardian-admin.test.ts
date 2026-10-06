import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { adminMessage, projectAuthorizations, validateDraft, type ChainRow } from "./guardian-admin";

const row = (o: Partial<ChainRow>): ChainRow => ({ id: "a1", logical_id: "L1", version: 1, event_kind: "constituicao", guardian_person_id: "p", guardian_name: "Resp. Sintético",
  relation_scheme_id: null, relation_value_id: null, sections: ["matricula"], valid_from: "2026-01-01", valid_until: null, reason: null, recorded_at: "2026-01-01T00:00:00Z", is_head: true, ...o });

describe("AC.2 gestão de autorizações", () => {
  it("estado derivado da cabeça; história preservada", () => {
    const v = projectAuthorizations([row({ is_head: false }), row({ id: "a2", version: 2, event_kind: "revogacao" })], "2026-06-01");
    expect(v).toHaveLength(1); expect(v[0]!.state).toBe("revogada"); expect(v[0]!.history).toHaveLength(2);
    expect(projectAuthorizations([row({ valid_until: "2026-02-01" })], "2026-06-01")[0]!.state).toBe("expirada");
    expect(projectAuthorizations([row({ valid_from: "2027-01-01" })], "2026-06-01")[0]!.state).toBe("futura");
    expect(projectAuthorizations([row({})], "2026-06-01")[0]!.state).toBe("vigente");
  });
  it("cadeia ambígua (duas cabeças) não é exibida como vigente", () => {
    expect(projectAuthorizations([row({}), row({ id: "a2", version: 2 })], "2026-06-01")).toHaveLength(0);
  });
  it("autorização antiga sem pessoa fica somente leitura", () => {
    expect(projectAuthorizations([row({ guardian_person_id: null })], "2026-06-01")[0]!.legacy).toBe(true);
  });
  it("validação de rascunho", () => {
    expect(validateDraft({ sections: [], validFrom: "2026-01-01", validUntil: "", reason: "" }, "constituicao")).toContain("Escolha ao menos uma seção.");
    expect(validateDraft({ sections: ["matricula"], validFrom: "2026-02-01", validUntil: "2026-01-01", reason: "" }, "substituicao").length).toBe(1);
    expect(validateDraft({ sections: [], validFrom: "", validUntil: "", reason: "" }, "revogacao")).toEqual(["Informe o motivo da revogação."]);
  });
  it("mensagens não vazam detalhes técnicos", () => {
    expect(adminMessage("ERROR: family:base-superseded")).toMatch(/Recarregue/);
    expect(adminMessage("relation guardian_authorizations does not exist")).toBe("Não foi possível concluir. Nada foi gravado.");
  });
  it("superfície usa só o writer v3 e readers governados; sem conta, sem DML, sem parentesco inventado", () => {
    const src = ["guardian-admin-page.tsx", "guardian-admin-source.ts"].map((f) => readFileSync(`src/features/family-portal/${f}`, "utf8")).join("\n");
    expect(src).toContain("record_guardian_authorization_v3");
    expect(src).not.toMatch(/record_guardian_authorization["_v2]*"/);
    expect(src).not.toMatch(/record_guardian_authorization_v2|guardian_user_id|\.(insert|update|upsert|delete)\(/);
    expect(src).not.toMatch(/from\("guardian_authorizations"\)|from\("user_person_links"\)/);
    expect(src).toMatch(/_relation_value: null/);
  });
  it("migration 0161: readers/writer fechados a anon e service_role", () => {
    const sql = readFileSync("drizzle/migrations/0161_ac2_guardian_staff_readers.sql", "utf8");
    for (const f of ["locate_guardian_person_exact", "guardian_authorization_chain", "record_guardian_authorization_v3"]) expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${f}\\([^)]*\\) FROM PUBLIC, anon, service_role`));
    expect(sql.match(/SET search_path TO ''/g)?.length).toBe(3);
  });
});

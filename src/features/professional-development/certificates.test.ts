import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { formatHours, issueProblems, validationProblems } from "./certificates";

const ok = { validated: true, isLatest: true, pdfShaNow: "a", pdfShaVersion: "a", hasPrevious: false, reason: null };

describe("L16 certificados", () => {
  it("emissão exige validação, versão atual e PDF inalterado", () => {
    expect(issueProblems(ok)).toEqual([]);
    expect(issueProblems({ ...ok, validated: false, isLatest: false, pdfShaNow: "b" })).toHaveLength(3);
  });
  it("reemissão nunca silenciosa", () => expect(issueProblems({ ...ok, hasPrevious: true }).join()).toMatch(/motivo/));
  it("validador distinto de autor, titular e confirmador", () => {
    expect(validationProblems({ validator: "v", author: "a", holder: "h", completionConfirmer: "c" })).toEqual([]);
    expect(validationProblems({ validator: "c", author: "a", holder: "h", completionConfirmer: "c" })).toHaveLength(1);
  });
  it("carga horária", () => expect([formatHours(90), formatHours(120)]).toEqual(["1h30", "2h"]));
  it("migration 0445: caminho antigo fechado, PDF oculto, verificação sem pessoa", () => {
    const sql = readFileSync("drizzle/migrations/0445_dev16_certificates.sql", "utf8");
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public.issue_dev_certification\(uuid, uuid, text\) FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/dev:not-validated/);
    expect(sql).toMatch(/dev:document-changed/);
    expect(sql).toMatch(/dev:reason-required/);
    expect(sql).toMatch(/IN \(_v.author_person, _owner, _confirmer\)/);
    expect(sql).not.toMatch(/GRANT SELECT \([^)]*pdf_document_version/);
    const verify = sql.slice(sql.indexOf("FUNCTION public.verify_dev_certificate"));
    expect(verify.slice(0, verify.indexOf("$$;"))).not.toMatch(/person_id|cpf|full_name/);
  });
  it("revogação: só por função, append-only e sem escrita direta", () => {
    const sql = readFileSync("drizzle/migrations/0445_dev16_certificates.sql", "utf8");
    expect(sql).toMatch(/FUNCTION public\.revoke_dev_certificate\(_issuance uuid, _reason text\)/);
    expect(sql).toMatch(/devcrev_immutable BEFORE UPDATE OR DELETE ON public\.dev_certificate_revocations/);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON [^;]*dev_certificate_revocations FROM authenticated, anon/);
  });
});

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import {
  ADAPTERS, auditRows, canExport, correlated, directDmlGrants, filterEvents, isRetroactive, page, provenanceFindings, redact, versionFindings, type AuditEvent,
} from "./audit-model";
import { runReport, toCsv } from "@/features/reports/report-engine";
import { AUDIT_REPORT } from "./audit-report";

const ad = (t: string) => ADAPTERS.find((a) => a.table === t)!;
const mov = (id: string, over: Record<string, unknown> = {}) => ad("student_movement_events").map({
  id, logical_id: "L1", version: 1, supersedes_id: null, movement_type_id: "transferencia", effective_on: "2027-03-01",
  correction_reason: null, recorded_by: "u1", school_scope_ids: ["E1"], created_at: "2027-03-05T10:00:00Z",
  reason_text: "CPF 123.456.789-00", origin: "casa", ...over,
});

describe("auditoria", () => {
  it("redaction remove segredos, PII e conteúdo clínico", () => {
    const r = redact("senha: abc123 token=xyz eyJa.b.c sb_secret_ZZ mail a@b.com cpf 123.456.789-00 laudo CID F84")!;
    for (const bad of ["abc123", "xyz", "eyJa.b.c", "sb_secret_ZZ", "a@b.com", "123.456.789-00", "laudo", "F84"]) expect(r).not.toContain(bad);
    expect(redact("x".repeat(500))!.length).toBeLessThan(300);
  });
  it("adaptadores não selecionam colunas sensíveis", () => {
    for (const [t, forbidden] of [["account_credential_events", "login"], ["inclusion_access_events", "purpose"], ["import_batch_events", "detail"], ["student_movement_events", "reason_text"]] as const)
      expect(ad(t).select.split(",")).not.toContain(forbidden);
    const e = mov("m1");
    expect(JSON.stringify(e)).not.toContain("123.456"); expect(JSON.stringify(e)).not.toContain("casa");
  });
  it("evento sensível de inclusão é de segurança e sem finalidade", () => {
    const e = ad("inclusion_access_events").map({ id: "x", attachment_id: "a", user_id: "u", engagement_id: null, granted: false, denial_code: "sem-capability", at: "2027-01-01T00:00:00Z", purpose: "laudo" });
    expect(e.kind).toBe("seguranca"); expect(e.action).toContain("negado"); expect(JSON.stringify(e)).not.toContain("laudo");
  });
  it("filtro por escopo/ator/knownAt e enumeração não distingue", () => {
    const evs = [mov("m1"), mov("m2", { school_scope_ids: ["E2"], created_at: "2027-04-01T00:00:00Z" })];
    expect(filterEvents(evs, { schoolId: "E1" })).toHaveLength(1);
    expect(filterEvents(evs, { knownAt: "2027-03-31T00:00:00Z" }).map((e) => e.id)).toEqual(["student_movement_events:m1"]);
    expect(filterEvents(evs, { entity: "movimentacao:inexistente" })).toEqual(filterEvents([], { entity: "movimentacao:L1" }));
  });
  it("paginação estável sem repetição", () => {
    const evs = filterEvents(Array.from({ length: 53 }, (_, i) => mov(`m${i}`, { created_at: `2027-03-${String(1 + (i % 28)).padStart(2, "0")}T00:00:00Z` })), {});
    const seen: string[] = []; let c: string | null = null;
    do { const p = page(evs, 10, c); seen.push(...p.items.map((e) => e.id)); c = p.next; } while (c);
    expect(seen).toHaveLength(53); expect(new Set(seen).size).toBe(53);
  });
  it("correlação por ref canônica e retroatividade", () => {
    const a = mov("m1"), b = mov("m2", { version: 2, supersedes_id: "m1", correction_reason: "erro" }), c = mov("m3", { logical_id: "L9" });
    expect(correlated([a, b, c], a).map((e) => e.id)).toEqual([b.id]);
    expect(b.action).toBe("movimentacao:retificacao"); expect(isRetroactive(a)).toBe(true);
    expect(isRetroactive(mov("m4", { effective_on: "2027-03-05" }))).toBe(false);
  });
  it("integridade: versão órfã, lacuna e sem proveniência", () => {
    const f = versionFindings([{ id: "a", logical: "L", version: 1, supersedes: null }, { id: "c", logical: "L", version: 3, supersedes: "b" }], "t");
    expect(f.map((x) => x.code).sort()).toEqual(["lacuna-de-versao", "versao-orfa"]);
    expect(provenanceFindings([mov("m1", { recorded_by: null })])).toHaveLength(1);
  });
  it("exportação só com capability específica e sem injection", () => {
    expect(canExport([])).toBe(false); expect(canExport(["administrar-sigem"])).toBe(false); expect(canExport(["exportar-auditoria"])).toBe(true);
    const csv = toCsv(runReport(AUDIT_REPORT, { params: {} }, auditRows([mov("m1", { correction_reason: "=cmd()" , version: 2, supersedes_id: "x"})])), { headerLines: [], title: "T" });
    expect(csv).toContain("'=cmd()");
  });
  it("writers × DML direto: nenhuma tabela de ledger com escrita direta para anon/authenticated", () => {
    const dir = "drizzle/migrations";
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(`${dir}/${f}`, "utf8"));
    const grants = directDmlGrants(files);
    for (const t of ADAPTERS.map((a) => `public.${a.table}`)) expect(grants).not.toContain(t);
    expect(directDmlGrants(["GRANT INSERT ON public.x TO authenticated;", "REVOKE INSERT ON public.x FROM authenticated;"])).toEqual([]);
  });
});
export type { AuditEvent };

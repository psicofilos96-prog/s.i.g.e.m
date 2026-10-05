import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DATA_INVENTORY, LIFECYCLE_UNDECIDED, SIGNED_URL_TTL_SECONDS, anonymizeFields, lifecycleAction } from "./data-inventory";
import { formatLog, redactText } from "@/lib/observability/telemetry";
import { redact } from "@/features/audit/audit-model";
import { runReport, toCsv, type ReportDefinition } from "@/features/reports/report-engine";
import { toPublicDetail } from "@/features/public-portal/portal-model";

const sql = ["drizzle/migrations", "supabase/migrations"].flatMap((d) => {
  try { return readdirSync(d).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(`${d}/${f}`, "utf8")); } catch { return []; }
}).join("\n");

describe("inventário", () => {
  it("toda entrada com menores ou sensível tem acesso e logs declarados", () => {
    for (const e of DATA_INVENTORY.filter((x) => x.minors || x.sensitivity === "sensivel")) {
      expect(e.access.length).toBeGreaterThan(5);
      expect(e.logs).toMatch(/nunca|trilha/);
    }
  });
  it("nenhuma decisão de retenção/base legal é inventada", () => {
    for (const d of LIFECYCLE_UNDECIDED) expect([d.legalBasis, d.retentionDays, d.disposal, d.decidedBy]).toEqual([null, null, null, null]);
    expect(lifecycleAction(LIFECYCLE_UNDECIDED[0]!, 100000)).toBe("reter");
    expect(lifecycleAction({ domain: "x", legalBasis: null, retentionDays: 10, disposal: "eliminar", decidedBy: null }, 99)).toBe("reter");
  });
  it("tabelas de menores/sensíveis nunca recebem GRANT a anon nas migrations", () => {
    for (const t of DATA_INVENTORY.filter((e) => e.minors || e.sensitivity !== "comum").flatMap((e) => e.tables)) {
      expect(sql).not.toMatch(new RegExp(`GRANT[^;]*ON\\s+(TABLE\\s+)?public\\.${t}\\b[^;]*TO[^;]*\\banon\\b`, "i"));
    }
  });
  it("URLs assinadas de anexos expiram em TTL curto e centralizado", () => {
    expect(SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(300);
    for (const f of ["src/features/inclusion/inclusion-attachments.functions.ts", "src/features/teaching-planning/planning-source.ts", "src/features/teacher-assessment/authoring-source.ts"])
      expect(readFileSync(f, "utf8")).toMatch(/createSignedUrl\([^)]*SIGNED_URL_TTL_SECONDS\)/);
  });
  it("anonimização preserva id e versão", () => {
    expect(anonymizeFields({ id: "a", version: 2, name: "Ana" }, ["name"])).toEqual({ id: "a", version: 2, name: "[anonimizado]" });
  });
});

const PII = "Ana Souza 123.456.789-09 ana@x.gov.br Bearer abc.def CID F84 diagnóstico";
describe("vazamento", () => {
  it("logs", () => {
    const line = formatLog({ event: "e", fields: { cpf: "123.456.789-09", nota: 7, msg: PII, row: { name: "Ana" } } });
    for (const leak of ["123.456.789-09", "ana@x.gov.br", "abc.def", "\"nota\":7", "Ana\""]) expect(line).not.toContain(leak);
    expect(redactText(PII)).not.toContain("ana@x");
  });
  it("auditoria redige documento, e-mail e termos clínicos", () => {
    const r = redact(PII)!;
    for (const leak of ["123.456.789-09", "ana@x.gov.br", "F84", "diagnóstico"]) expect(r).not.toContain(leak);
  });
  it("exportação omite colunas sensíveis por padrão", () => {
    const def: ReportDefinition = { id: "t", version: 1, title: "t", description: "", source: "x", params: [], columns: [{ id: "nome", label: "Nome", kind: "text" }, { id: "cpf", label: "CPF", kind: "text", sensitive: true }], formats: ["csv"], reproducible: false, syncRowLimit: 10 };
    const csv = toCsv(runReport(def, { params: {} }, [{ nome: "Ana", cpf: "123.456.789-09" }]), { headerLines: [], title: "t" });
    expect(csv).not.toContain("123.456.789-09");
  });
  it("portal público descarta campos extras e responde indisponível fora de publicado", () => {
    const d = toPublicDetail({ status: "publicado", kind: "comunicado", slug: "a", title: "t", summary: null, body: "b", published_at: "x", version: 1, student_name: "Ana", school_id: "s" });
    expect(JSON.stringify(d)).not.toMatch(/Ana|school_id/);
    expect(toPublicDetail({ status: "rascunho", kind: "comunicado" })).toEqual({ status: "indisponivel" });
  });
  it("busca não indexa campos sensíveis", () => {
    const search = sql.split(/CREATE (OR REPLACE )?FUNCTION public\.global_search/i).slice(1).join("");
    expect(search.length).toBeGreaterThan(0);
    expect(search.slice(0, 20000)).not.toMatch(/inclusion_records|dietary_restrictions|assessment_entry_versions|guardian_authorizations/);
  });
  it("Família não chega a inclusão nem alimentação por política", () => {
    expect(sql).not.toMatch(/guardian[^;]{0,200}inclusion_records/i);
  });
});

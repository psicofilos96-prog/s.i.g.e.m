import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { clinicalWarning, inclusionMessage, isActiveOn, minimizedExport, toCsv, RECORD_TYPES, type InclusionRecord } from "./inclusion-model";

const sql = readFileSync("drizzle/migrations/0072_inclusion_module.sql", "utf8") + readFileSync("drizzle/migrations/0073_inclusion_record_location.sql", "utf8");
const fnBody = (name: string) => { const i = sql.indexOf(`FUNCTION public.${name}(`); return sql.slice(i, sql.indexOf("$fn$;", i)); };

const rec = (o: Partial<InclusionRecord>): InclusionRecord => ({
  id: "r1", logical_id: "l1", version: 1, supersedes_id: null, event_kind: "registro", record_type: "plano-educacional", school_id: "s", student_id: "a",
  category_scheme_id: null, category_value_id: null, educational_purpose: "Planejar apoio de leitura", body: "Leitura com apoio visual", valid_from: "2026-01-01",
  valid_to: null, share_with_mediation: false, reason: "motivo-sigiloso", author_user_id: "u-autor", author_person_id: "p", recorded_at: "", ...o,
});

describe("inclusão — banco é a autoridade", () => {
  it("nenhuma tabela é legível/gravável diretamente por contas; anônimo sem execução", () => {
    for (const t of ["inclusion_records", "inclusion_mediation_assignments", "inclusion_attachments", "inclusion_access_events"]) {
      expect(sql).toContain(`REVOKE ALL ON public.${t} FROM PUBLIC, anon, authenticated;`);
      expect(sql).toContain(`ENABLE ROW LEVEL SECURITY`);
      expect(sql).toMatch(new RegExp(`${t}_?\\w*append_only BEFORE UPDATE OR DELETE ON public.${t}`));
    }
    for (const m of sql.matchAll(/GRANT EXECUTE ON FUNCTION public\.(\w+)/g)) expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${m[1]}(`);
    expect(sql).not.toMatch(/TO anon/);
  });
  it("escola diferente / docente não relacionado / direção sem capability: leitura exige capability da escola ou mediação vigente", () => {
    const r = fnBody("inclusion_records_at");
    expect(r).toContain("inclusion_grant('consultar-apoio-inclusivo', _school)");
    expect(r).toContain("public.inclusion_my_mediation(_student, CURRENT_DATE)");
    expect(r).toContain("RAISE EXCEPTION 'capability:consultar-apoio-inclusivo'");
    expect(r).toContain("r.school_id = _school");
    // Mediador só vê o que foi compartilhado e só necessidade/plano
    expect(r).toContain("r.share_with_mediation AND r.record_type IN ('necessidade-de-apoio','plano-educacional')");
    // capability exige escopo escola da própria escola, nunca cargo
    expect(fnBody("inclusion_grant")).toContain("c.scope_level = 'escola' AND c.school_id = _school");
    expect(sql).not.toMatch(/position_label|engagement_kind_id/);
  });
  it("mediador expirado não lê: vínculo exige vigência na data e não encerrado", () => {
    const m = fnBody("inclusion_my_mediation");
    expect(m).toContain("m.valid_from <= _on AND (m.valid_to IS NULL OR m.valid_to >= _on)");
    expect(m).toContain("m.event_kind <> 'encerramento'");
    expect(m).toContain("l.user_id = auth.uid()");
  });
  it("família e professor de outra turma não têm caminho: nenhum reader usa vínculo de responsável nem turma docente", () => {
    expect(sql).not.toMatch(/guardian_authorizations|teaching_assignment/);
  });
  it("anexo: clínico exige capability sensível, acesso sempre registrado sem conteúdo", () => {
    const a = fnBody("authorize_inclusion_attachment_access");
    expect(a).toContain("'consultar-documento-sensivel-inclusao'");
    expect(a).toContain("INSERT INTO public.inclusion_access_events");
    expect(a.indexOf("INSERT INTO public.inclusion_access_events")).toBeLessThan(a.indexOf("RETURN a.storage_path"));
    expect(sql).toMatch(/inclusion_access_events \([^;]*\);/s);
    const log = sql.slice(sql.indexOf("CREATE TABLE public.inclusion_access_events"), sql.indexOf("REVOKE ALL ON public.inclusion_access_events"));
    expect(log).not.toMatch(/body|storage_path|student_id|file_name|content/);
    expect(fnBody("inclusion_attachments_for")).toContain("a.classification = 'pedagogico' OR sens");
  });
  it("sem taxonomia médica, CID ou critério de elegibilidade; catálogos sem seed", () => {
    expect(sql).not.toMatch(/INSERT INTO public\.attribute_value_definitions/);
    expect(sql).not.toMatch(/\bcid\b|deficien|diagnos|laudo/i.source ? /\bcid_|deficiencia|diagnosis_/i : /x/);
    const cols = sql.slice(sql.indexOf("CREATE TABLE public.inclusion_records"), sql.indexOf("CREATE UNIQUE INDEX inclusion_records_one_successor"));
    expect(cols).not.toMatch(/diagn|cid|deficien|condicao|laudo/i);
    for (const t of RECORD_TYPES) expect(t.label).not.toMatch(/defici|transtorno|cid/i);
  });
  it("servidor: autoriza no banco como o usuário antes de tocar o armazenamento; sem logs", () => {
    const s = readFileSync("src/features/inclusion/inclusion-attachments.functions.ts", "utf8");
    expect(s.indexOf("authorize_inclusion_attachment_access")).toBeLessThan(s.indexOf("createSignedUrl"));
    expect(s.indexOf("register_inclusion_attachment")).toBeLessThan(s.indexOf(".upload("));
    expect(s).not.toMatch(/console\./);
    for (const f of readdirSync("src/features/inclusion")) expect(readFileSync(`src/features/inclusion/${f}`, "utf8")).not.toMatch(/console\.(log|info|debug)/);
  });
});

describe("inclusão — exportação e apresentação", () => {
  it("exportação minimizada: sem autoria, motivo, categoria, anexos ou registros encerrados", () => {
    const out = minimizedExport([rec({}), rec({ id: "r2", event_kind: "encerramento" }), rec({ id: "r3", valid_to: "2025-01-01" })], "2026-06-01");
    expect(out).toHaveLength(1);
    const csv = toCsv(out);
    expect(csv).not.toMatch(/u-autor|motivo-sigiloso|author|categoria|anexo/);
    expect(Object.keys(out[0]!)).toEqual(["tipo", "desde", "ate", "finalidade", "registro"]);
  });
  it("vigência", () => {
    expect(isActiveOn({ valid_from: "2026-01-01", valid_to: "2026-02-01", event_kind: "registro" }, "2026-03-01")).toBe(false);
  });
  it("aviso clínico e mensagens não vazam texto técnico", () => {
    expect(clinicalWarning("CID F84")).toBeTruthy();
    expect(clinicalWarning("usar apoio visual na leitura")).toBeNull();
    expect(inclusionMessage("permission denied for table inclusion_records")).toBe("Não foi possível concluir. Tente novamente.");
    expect(inclusionMessage("capability:consultar-documento-sensivel-inclusao")).toMatch(/sensíveis/);
  });
});

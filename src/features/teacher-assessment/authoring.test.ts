import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { authoringMessage, canonicalPrint, heads, itemTypes, parseOptions, printProjection, refStatus, registerItemType, shuffled, type InstrumentVersion, type ItemVersion } from "./authoring-model";

const sql = readFileSync("drizzle/migrations/0079_teacher_assessment_authoring.sql", "utf8");
const fn = (n: string) => { const i = sql.indexOf(`FUNCTION public.${n}(`); return sql.slice(i, sql.indexOf("$$;", i)); };
const item = (p: Partial<ItemVersion>): ItemVersion => ({ id: "i1", item_id: "x", version: 1, supersedes_id: null, item_type_id: "escolha", stem: "Quanto é 2+2?", options: [{ key: "A", text: "3" }, { key: "B", text: "4" }], curricular_refs: [], school_id: "s", visibility: "pessoal", status: "publicado", key_shared: false, copied_from_version_id: null, author_user_id: "u", recorded_at: "", ...p });
const ins = (p: Partial<InstrumentVersion>): InstrumentVersion => ({ id: "n1", instrument_id: "t", version: 1, supersedes_id: null, assignment_id: "a", class_id: "c", school_id: "s", period_id: null, title: "Prova", instructions: null, items: [{ item_version_id: "i1" }, { item_version_id: "i2" }], randomization: null, status: "publicado", results_instrument_id: null, author_user_id: "u", recorded_at: "", ...p });

describe("autoria — banco", () => {
  it("gabarito em tabela separada, só autor ou compartilhamento explícito", () => {
    expect(sql).toContain("CREATE TABLE public.assessment_item_keys");
    expect(sql).toMatch(/keys by author or explicitly shared[\s\S]*v\.author_user_id = auth\.uid\(\) OR \(v\.key_shared AND/);
    expect(sql).not.toMatch(/answer[^\n]*assessment_item_versions\(/);
  });
  it("publicado congelado; append-only; concorrência otimista; outro professor recusa", () => {
    const b = fn("record_teacher_instrument_version");
    for (const k of ["instrument:published-frozen", "item:stale-head", "item:not-author", "FOR UPDATE", "my_teaching_assignments_at"]) expect(b).toContain(k);
    expect(sql).toContain("assessment_item_versions_immutable BEFORE UPDATE OR DELETE");
  });
  it("instrumento só com itens publicados e legíveis (IDOR)", () => {
    const b = fn("record_teacher_instrument_version");
    expect(b).toContain("instrument:item-not-readable"); expect(b).toContain("instrument:item-not-published");
    expect(fn("record_assessment_item_version")).toContain("item:copy-source-not-readable");
  });
  it("sem peso/escala/fórmula; randomização só explícita", () => {
    expect(sql).not.toMatch(/\b(peso|weight|score|nota|escala)\b/i);
    expect(fn("record_teacher_instrument_version")).toContain("instrument:invalid-randomization");
  });
  it("mídia: tipos restritos, prefixo do usuário, sem anon, sem grants de escrita", () => {
    expect(sql).toContain("mime IN ('image/png','image/jpeg','image/webp','application/pdf')");
    expect(fn("record_assessment_item_media")).toContain("split_part(_object_path, '/', 1) <> auth.uid()::text");
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
    for (const f of ["record_assessment_item_version", "record_teacher_instrument_version", "record_assessment_item_media"]) expect(sql).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${f}\\([^)]*\\) FROM PUBLIC, anon`));
  });
  it("Família/estudante não têm caminho: nenhuma política por autorização de responsável", () => { expect(sql).not.toMatch(/guardian/); });
});

describe("autoria — modelo", () => {
  it("registro de tipos é aberto e recusa duplicidade", () => {
    expect(itemTypes().map((t) => t.id)).toEqual(expect.arrayContaining(["escolha", "resposta-curta", "discursiva"]));
    expect(() => registerItemType({ id: "escolha", label: "x", usesOptions: true, answerHint: "" })).toThrow();
  });
  it("impressão sem gabarito, ordem estável, consistente entre chamadas", () => {
    const m = new Map([["i1", item({})], ["i2", item({ id: "i2", stem: "Explique", item_type_id: "discursiva", options: [] })]]);
    const a = printProjection(ins({}), m); const b = printProjection(ins({}), m);
    expect(canonicalPrint(a)).toBe(canonicalPrint(b)); expect(a.questions.map((q) => q.itemVersionId)).toEqual(["i1", "i2"]);
    expect(JSON.stringify(a)).not.toMatch(/answer|criteria|key_shared/);
  });
  it("randomização determinística por semente", () => {
    const xs = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffled(xs, "s1")).toEqual(shuffled(xs, "s1")); expect(shuffled(xs, "s1")).not.toEqual(xs);
  });
  it("item ausente é sinalizado, não inventado", () => { expect(printProjection(ins({}), new Map([["i1", item({})]])).missing).toEqual(["i2"]); });
  it("habilidade removida na base futura continua referenciada", () => { expect(refStatus(["r1", "r2"], new Set(["r1"]))).toEqual([{ id: "r1", found: true }, { id: "r2", found: false }]); });
  it("XSS: conteúdo é texto; opções inválidas descartadas", () => {
    const src = readFileSync("src/features/teacher-assessment/authoring-page.tsx", "utf8");
    expect(src).not.toContain("dangerouslySetInnerHTML");
    expect(parseOptions([{ key: "A", text: "<img onerror=x>" }, { key: 1 }])).toEqual([{ key: "A", text: "<img onerror=x>" }]);
  });
  it("versões preservadas; cabeça é a última", () => { expect(heads([item({}), item({ id: "i9", version: 2, supersedes_id: "i1" })]).map((x) => x.id)).toEqual(["i9"]); });
  it("mensagens humanas", () => { expect(authoringMessage("x instrument:published-frozen")).toMatch(/congelado/); });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { copyDraft, parseRefs, planHeads, planHistory, planMessage, plansOn, type PlanVersion } from "./planning-model";

const sql = readFileSync("drizzle/migrations/0078_teaching_planning.sql", "utf8");
const fn = (name: string) => sql.slice(sql.indexOf(`FUNCTION public.${name}(`), sql.indexOf("$$;", sql.indexOf(`FUNCTION public.${name}(`)));
const v = (p: Partial<PlanVersion>): PlanVersion => ({ id: "v1", plan_id: "p1", version: 1, supersedes_id: null, assignment_id: "a1", class_id: "c1", school_id: "s1", matrix_version_id: "m1", level_value_id: null, covers_from: null, covers_until: null, title: "T", blocks: [], curricular_refs: [], status: "rascunho", copied_from_version_id: null, change_reason: null, author_user_id: "u1", recorded_at: "2026-01-01", ...p });

describe("planejamento docente — banco", () => {
  it("regência precisa estar vigente para o próprio usuário (encerrada/outro professor recusa)", () => {
    expect(fn("record_teaching_plan_version")).toContain("my_teaching_assignments_at(current_date, now())");
    expect(fn("record_teaching_plan_version")).toContain("plan:assignment-not-current");
  });
  it("concorrência otimista, autor único, regência imutável na cadeia", () => {
    const b = fn("record_teaching_plan_version");
    for (const k of ["plan:stale-head", "plan:not-author", "plan:assignment-immutable", "FOR UPDATE"]) expect(b).toContain(k);
  });
  it("matriz e BNCC só por ID canônico; matriz da versão congelada no plano", () => {
    const b = fn("record_teaching_plan_version");
    expect(b).toContain("plan:matrix-item-not-applicable"); expect(b).toContain("curricular_reference_items");
    expect(sql).toContain("matrix_version_id uuid NOT NULL");
    expect(sql).not.toMatch(/official_text\s*=|UPDATE public\.curricular_reference_items/);
  });
  it("rascunho só do autor; publicado só com capability de escola; ver não é editar", () => {
    const b = fn("can_read_teaching_plan_version");
    expect(b).toContain("_author = auth.uid()"); expect(b).toContain("_status = 'publicado' AND public.has_school_capability('consultar-planejamento-docente'");
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*teaching_plan/);
  });
  it("append-only e sem execução anônima", () => {
    expect(sql).toContain("plan:append-only");
    for (const f of ["record_teaching_plan_version", "link_lesson_to_plan", "record_teaching_plan_attachment"]) expect(sql).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${f}\\([^)]*\\) FROM PUBLIC, anon`));
  });
  it("cópia exige leitura da origem (IDOR) e só em plano novo", () => {
    expect(fn("record_teaching_plan_version")).toContain("plan:copy-source-not-readable");
    expect(fn("record_teaching_plan_version")).toContain("plan:copy-only-on-new");
  });
  it("anexos: prefixo do próprio usuário, bucket privado, leitura só do autor", () => {
    expect(fn("record_teaching_plan_attachment")).toContain("split_part(_object_path, '/', 1) <> auth.uid()::text");
    expect(sql).toContain("(storage.foldername(name))[1] = auth.uid()::text");
  });
  it("ligação com aula não marca conteúdo como ministrado", () => {
    const b = fn("link_lesson_to_plan");
    expect(b).toContain("l.assignment_id = p.assignment_id"); expect(b).not.toMatch(/lesson_record_versions\s+SET|INSERT INTO public\.lesson_record_versions/);
  });
});

describe("planejamento docente — modelo", () => {
  it("histórico preservado; cabeça é a última", () => {
    const rows = [v({}), v({ id: "v2", version: 2, supersedes_id: "v1", status: "publicado" })];
    expect(planHeads(rows).map((r) => r.id)).toEqual(["v2"]); expect(planHistory(rows, "p1").length).toBe(2);
  });
  it("cópia é nova instância com proveniência e retira itens fora da matriz", () => {
    const src = v({ curricular_refs: [{ kind: "matrix-item", item_key: "x" }, { kind: "matrix-item", item_key: "y" }, { kind: "reference-item", item_id: "r" }], status: "publicado" });
    const c = copyDraft(src, "a2", ["y"]);
    expect(c).toMatchObject({ assignmentId: "a2", status: "rascunho", copiedFrom: "v1", droppedRefs: 1 });
    expect(c.refs).toEqual([{ kind: "matrix-item", item_key: "y" }, { kind: "reference-item", item_id: "r" }]);
  });
  it("refs desconhecidas descartadas; BNCC ausente não quebra", () => { expect(parseRefs([{ kind: "x" }, null])).toEqual([]); expect(parseRefs(undefined)).toEqual([]); });
  it("agenda não presume datas", () => {
    const hs = [v({ covers_from: "2026-03-01", covers_until: "2026-03-31" }), v({ id: "v9", plan_id: "p9" })];
    expect(plansOn(hs, "2026-03-10").map((p) => p.id)).toEqual(["v1"]);
  });
  it("mensagens humanizadas sem SQL", () => { expect(planMessage("ERROR: plan:stale-head")).toMatch(/outra janela/); expect(planMessage("duplicate key constraint x")).not.toMatch(/constraint/); });
  it("motor não conhece bimestre/trimestre nem taxonomia pedagógica fixa", () => {
    const src = readFileSync("src/features/teaching-planning/planning-model.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).not.toMatch(/bimestre|trimestre|metodologia/i);
  });
});

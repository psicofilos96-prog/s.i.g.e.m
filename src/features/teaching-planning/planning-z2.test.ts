import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { filterPlans, parseRefs, planMessage, planTargetDate, type PlanVersion } from "./planning-model";

const file = readdirSync("drizzle/migrations").find((f) => f.startsWith("0150_"))!;
const sql = readFileSync(`drizzle/migrations/${file}`, "utf8");
const fn = (name: string) => { const i = sql.indexOf(`FUNCTION public.${name}(`); return sql.slice(i, sql.indexOf("END $$;", i)); };
const v = (p: Partial<PlanVersion>): PlanVersion => ({ id: "v1", plan_id: "p1", version: 1, supersedes_id: null, assignment_id: "a1", class_id: "c1", school_id: "s1", matrix_version_id: "m1", level_value_id: null, covers_from: null, covers_until: null, title: "T", blocks: [], curricular_refs: [], status: "rascunho", copied_from_version_id: null, change_reason: null, author_user_id: "u1", recorded_at: "2026-01-01", ...p });

describe("Z.2 — writer corrigido (0150)", () => {
  const w = fn("record_teaching_plan_version_v2");
  it("período pela versão canônica aplicável à turma, não pela tabela-base", () => {
    expect(w).toContain("plan_period_window(a.class_id, _period_id, _target_date, _k)");
    expect(fn("plan_period_window")).toContain("institutional_academic_period_versions");
    expect(fn("plan_period_window")).toContain("institutional_class_period_organization_versions");
  });
  it("janela integral: data-alvo no plano, plano na atribuição e no período", () => {
    for (const k of ["plan:target-date-outside-plan", "plan:interval-outside-assignment", "plan:interval-outside-period"]) expect(w).toContain(k);
  });
  it("item validado por item_key E matrix_version_id; Y guarda edição; posição explícita", () => {
    for (const k of ["plan:matrix-version-mismatch", "'matrix_version_id',mv", "plan:reference-edition-mismatch", "'edition_id',_ed", "plan:position-not-in-class"]) expect(w).toContain(k);
  });
  it("sem CURRENT_DATE, search_path vazio, writer sem service_role", () => {
    expect(sql.toLowerCase()).not.toContain("current_date");
    expect(sql.match(/SECURITY DEFINER SET search_path TO ''/g)?.length).toBe(5);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.record_teaching_plan_version_v2\([^)]*\) FROM PUBLIC, anon, service_role/);
  });
  it("plano ≠ aula: nenhum writer de plano insere aula/frequência; vínculo é ato explícito e revogar é evento", () => {
    expect(sql).not.toMatch(/INSERT INTO public\.(lesson_record_versions|attendance_record_versions)/);
    const l = fn("link_lesson_to_plan");
    expect(l).toContain("plan:natural-person-required"); expect(l).toContain("plan:link-exists"); expect(l).toContain("revoked, supersedes_id");
    expect(l).not.toMatch(/DELETE|UPDATE public/);
  });
  it("acompanhamento só lê compartilhados com capability; sem aprovar/reprovar", () => {
    const o = fn("teaching_plans_overview_at");
    expect(o).toContain("consultar-planejamento-docente"); expect(o).toContain("p.status = 'publicado'");
    expect(o).not.toMatch(/INSERT|UPDATE|DELETE/);
    const page = readFileSync("src/features/teaching-planning/plans-overview-page.tsx", "utf8").replace(/\/\*\*[\s\S]*?\*\//, "");
    expect(page).not.toMatch(/aprovar|reprovar|savePlan|record_teaching_plan/i);
  });
});

describe("Z.2 — modelo", () => {
  it("refs preservam edição/versão/posição", () => {
    expect(parseRefs([{ kind: "reference-item", item_id: "i", edition_id: "e", position_key: "p" }, { kind: "matrix-item", item_key: "k", matrix_version_id: "m" }]))
      .toEqual([{ kind: "reference-item", item_id: "i", edition_id: "e", position_key: "p" }, { kind: "matrix-item", item_key: "k", matrix_version_id: "m" }]);
  });
  it("filtros por turma/elemento/período", () => {
    const rows = [v({ id: "a", class_id: "c1", period_id: "p1", curricular_refs: [{ kind: "matrix-item", item_key: "k1" }] }), v({ id: "b", class_id: "c2" })];
    expect(filterPlans(rows, { classId: "c1" }).map((r) => r.id)).toEqual(["a"]);
    expect(filterPlans(rows, { itemKey: "k1", periodId: "p1" }).map((r) => r.id)).toEqual(["a"]);
    expect(filterPlans(rows, {}).length).toBe(2);
  });
  it("data-alvo vem do plano ou da escolha explícita", () => {
    expect(planTargetDate("2027-03-01", "2027-02-10")).toBe("2027-03-01");
    expect(planTargetDate(null, "2027-02-10")).toBe("2027-02-10");
  });
  it("mensagens para recusas novas", () => {
    expect(planMessage("plan:reference-edition-mismatch")).toMatch(/edição/);
    expect(planMessage("plan:interval-outside-assignment")).toMatch(/atribuição/);
  });
});

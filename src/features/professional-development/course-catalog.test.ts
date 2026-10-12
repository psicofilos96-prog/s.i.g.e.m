import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { catalogEntries, draftProblems, prerequisitesMet, versionDiff, type CatalogVersion, type Draft } from "./course-catalog";

const draft: Draft = { courseId: null, code: "FC-ALF.01", existingCode: null, title: "Alfabetização na idade certa", minutes: 2400,
  minAttendancePct: 75, syllabus: "Fundamentos e práticas de alfabetização inicial.", contents: ["Consciência fonológica"],
  modality: "presencial", assessment: "Portfólio de práticas", completionCriteria: "Frequência mínima e portfólio entregue",
  prerequisiteCourseIds: [], reason: "", expectedVersion: 0 };
const v = (o: Partial<CatalogVersion>): CatalogVersion => ({ id: "v1", courseId: "c1", version: 1, code: "FC-ALF.01", title: "T", minutes: 60,
  minAttendancePct: 75, syllabus: "s", contents: ["a"], modality: "presencial", assessment: "x", completionCriteria: "y",
  prerequisiteCourseIds: [], approved: true, ...o });

describe("L07 catálogo de cursos", () => {
  it("rascunho completo passa", () => expect(draftProblems(draft)).toEqual([]));
  it("carga horária ausente é recusada, nunca zero", () => expect(draftProblems({ ...draft, minutes: null }).join()).toMatch(/carga/));
  it("código não muda entre versões", () => expect(draftProblems({ ...draft, courseId: "c1", existingCode: "OUTRO", expectedVersion: 1, reason: "ajuste de ementa" }).join()).toMatch(/não muda/));
  it("nova versão exige motivo", () => expect(draftProblems({ ...draft, courseId: "c1", existingCode: "FC-ALF.01", expectedVersion: 1 }).join()).toMatch(/motivo/));
  it("curso não é pré-requisito de si", () => expect(draftProblems({ ...draft, courseId: "c1", prerequisiteCourseIds: ["c1"] }).join()).toMatch(/si mesmo/));
  it("vigente = maior versão; histórico preservado; não aprovada não é ofertável", () => {
    const [e] = catalogEntries([v({}), v({ id: "v2", version: 2, approved: false })]);
    expect(e!.current.id).toBe("v2"); expect(e!.history).toHaveLength(2); expect(e!.offerable).toBe(false);
  });
  it("versão legada sem catálogo não é ofertável", () => expect(catalogEntries([v({ syllabus: null })])[0]!.legacyWithoutCatalog).toBe(true));
  it("diff aponta campos mudados", () => expect(versionDiff(v({}), v({ minutes: 90, contents: ["b"] }))).toEqual(["minutes", "contents"]));
  it("pré-requisito só por conclusão registrada", () => {
    expect(prerequisitesMet(v({ prerequisiteCourseIds: ["c0"] }), new Set()).missing).toEqual(["c0"]);
    expect(prerequisitesMet(v({ prerequisiteCourseIds: ["c0"] }), new Set(["c0"])).met).toBe(true);
  });
  it("migration 0435: conteúdo imutável, sem DML de cliente e writer antigo fechado", () => {
    const sql = readFileSync("drizzle/migrations/0435_dev07_course_catalog.sql", "utf8");
    expect(sql).toMatch(/devccc_immutable BEFORE UPDATE OR DELETE/);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_course_codes/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public.record_dev_course_version\(.*\) FROM authenticated/);
    expect(sql).toMatch(/dev:code-immutable/);
  });
});

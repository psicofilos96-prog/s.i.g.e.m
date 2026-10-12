import { describe, expect, it } from "vitest";
import { canGrant, canRead, currentVersion, nextVersion, searchLibrary, validateActivity, type ActivityDraft, type MaterialVersion } from "./activities-materials";

const asg = { id: "a1", classId: "t1", start: "2026-02-01", end: "2026-12-20" };
const act: ActivityDraft = { kind: "exercício", title: "Frações", classId: "t1", assignmentId: "a1", skillRefs: [{ itemId: "i1", editionId: "e" }],
  assignedOn: "2026-03-02", dueOn: "2026-03-09", instructions: "Resolva", criteria: [{ label: "Acerto", weight: null }], attachments: ["prof/x.pdf"] };
const ctx = { authorId: "prof", assignment: asg, knownKinds: ["exercício", "recuperação", "projeto"] };

describe("atividades (Docente L09)", () => {
  it("válida passa; sem atribuição, prazo invertido, anexo alheio e recuperação sem origem recusam", () => {
    expect(validateActivity(act, ctx)).toEqual([]);
    expect(validateActivity(act, { ...ctx, assignment: null }).join()).toMatch(/atribuição/);
    expect(validateActivity({ ...act, dueOn: "2026-03-01" }, ctx).join()).toMatch(/prazo/);
    expect(validateActivity({ ...act, attachments: ["outro/x.pdf"] }, ctx).join()).toMatch(/Anexo/);
    expect(validateActivity({ ...act, kind: "recuperação" }, ctx).join()).toMatch(/original/);
  });
});

const v1: Omit<MaterialVersion, "version"> = { materialId: "m1", authorId: "prof", schoolId: "s", title: "Lista de frações", folder: "Matemática", tags: ["6ano"], license: "cc-by", filePath: "prof/m1v1.pdf", createdAt: "x" };

describe("biblioteca (Docente L09)", () => {
  it("versões append-only com cabeça esperada e só da autoria", () => {
    const a = nextVersion([], v1, 0);
    const b = nextVersion([a], { ...v1, filePath: "prof/m1v2.pdf" }, 1);
    expect(currentVersion([a, b], "m1")!.version).toBe(2);
    expect(() => nextVersion([a, b], v1, 1)).toThrow(/recarregue/);
    expect(() => nextVersion([a], { ...v1, authorId: "outro", filePath: "outro/f" }, 1)).toThrow(/autor/);
  });
  it("pesquisa por pasta, etiqueta e texto sem acento", () => {
    const a = nextVersion([], v1, 0);
    expect(searchLibrary([a], { text: "fracoes" })).toHaveLength(1);
    expect(searchLibrary([a], { tag: "7ano" })).toHaveLength(0);
  });
  it("compartilhamento autorizado: colega da escola; família só com licença aberta e turma própria; revogação corta", () => {
    const m = nextVersion([], v1, 0);
    const c = { colleaguesInSchool: ["p2"], myClasses: ["t1"] };
    expect(canGrant(m, { materialId: "m1", to: "docente", personId: "p9", grantedBy: "prof", at: "x" }, c).ok).toBe(false);
    expect(canGrant(m, { materialId: "m1", to: "familias", classId: "t1", grantedBy: "prof", at: "x" }, c).ok).toBe(true);
    expect(canGrant({ ...m, license: "desconhecida" }, { materialId: "m1", to: "familias", classId: "t1", grantedBy: "prof", at: "x" }, c).ok).toBe(false);
    const g = [{ materialId: "m1", to: "docente" as const, personId: "p2", grantedBy: "prof", at: "x" }];
    expect(canRead(m, g, { personId: "p2" })).toBe(true);
    expect(canRead(m, [{ ...g[0]!, revokedAt: "y" }], { personId: "p2" })).toBe(false);
    expect(canRead(m, [], { personId: "fam", familyClassIds: ["t1"] })).toBe(false);
  });
});

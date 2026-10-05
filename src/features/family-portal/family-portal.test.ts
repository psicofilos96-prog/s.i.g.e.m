import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveSelected, sectionState, type FamilyStudent, type FamilySummary } from "./family-portal";

const st = (id: string): FamilyStudent => ({ student_id: id, display_name: id, sections: ["matricula"], valid_until: null });
const sum = (p: Partial<FamilySummary>): FamilySummary => ({ sections: [], enrollments: null, documents: null, ...p });
const sql = readFileSync("drizzle/migrations/0069_family_portal_authorizations.sql", "utf8");

describe("Portal da Família", () => {
  it("troca de aluno por URL: só aceita educando autorizado; não escolhe outro em silêncio", () => {
    expect(resolveSelected([st("a")], "b")).toEqual({ id: null, rejected: true });
    expect(resolveSelected([st("a"), st("b")], "b")).toEqual({ id: "b", rejected: false });
    expect(resolveSelected([st("a"), st("b")], undefined).id).toBeNull();
    expect(resolveSelected([], undefined)).toEqual({ id: null, rejected: false });
  });
  it("seção não autorizada some; frequência/avaliação sem publicação nunca mostram dado interno nem zero", () => {
    const s = sum({ sections: ["matricula", "frequencia", "avaliacao"], enrollments: [] });
    expect(sectionState(s, "documentos").kind).toBe("nao-autorizada");
    expect(sectionState(s, "frequencia").kind).toBe("sem-publicacao");
    expect(sectionState(s, "avaliacao").kind).toBe("sem-publicacao");
    expect(sectionState(s, "matricula")).toEqual({ kind: "vazia", message: "Nenhuma matrícula registrada." });
  });
  it("banco é a autoridade: IDOR, vigência, revogação, cadeia e minimização", () => {
    expect(sql).toMatch(/guardian_user_id = auth\.uid\(\)/);
    expect(sql).toMatch(/event_kind <> 'revogacao'/);
    expect(sql).toMatch(/valid_until IS NULL OR a\.valid_until >= CURRENT_DATE/);
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.guardian_authorizations s WHERE s\.supersedes_id = a\.id\)/);
    expect(sql).toMatch(/RAISE EXCEPTION 'family:not-authorized'/);
    expect(sql).toMatch(/REVOKE ALL ON public\.guardian_authorizations FROM PUBLIC, anon, authenticated/);
    const readers = sql.slice(sql.indexOf("CREATE FUNCTION public.family_students"));
    expect(readers).not.toMatch(/birth_date|snapshot|address|phone|health|saude|nee/i);
  });
  it("autorização é por educando: nenhuma inferência por irmão, sobrenome ou endereço", () => {
    expect(sql).not.toMatch(/sobrenome|surname|irm[aã]o|sibling/i);
    expect(sql).toMatch(/a\.student_id = _student AND a\.guardian_user_id = auth\.uid\(\)/);
  });
});

import { describe, expect, it } from "vitest";
import { compareStudentSources, stageStudents, type StudentRefs, type StudentSourceRow } from "./educacenso-student-staging";

const refs: StudentRefs = {
  schools: new Set(["33000001", "33000002"]),
  classes: new Map([
    ["T1", { schoolInep: "33000001", multiStage: false }],
    ["T2", { schoolInep: "33000001", multiStage: true }],
    ["T3", { schoolInep: "33000002", multiStage: false }],
    ["T9", { schoolInep: "33000001", multiStage: false }],
  ]),
  situationCatalog: new Set(["Cursando"]),
};
let n = 0;
const row = (p: Partial<StudentSourceRow>): StudentSourceRow => ({
  locator: `alunos!${++n}`, personKey: "fpA", inepStudentId: null, schoolInep: "33000001", classExternalId: "T1",
  situationRaw: null, positionAxis: null, movementKind: null, movementDate: null, ...p,
});
const codes = (r: { evidence: { code: string }[] }) => r.evidence.map((e) => e.code);

describe("alunos EducaCenso (sintético)", () => {
  it("homônimos são pessoas distintas pela chave, nunca pelo nome", () => {
    const r = stageStudents([row({}), row({ personKey: "fpB" })], refs);
    expect(r.counts.persons).toBe(2);
  });
  it("ID INEP duplicado entre pessoas é recusado", () => {
    const r = stageStudents([row({ inepStudentId: "111" }), row({ personKey: "fpB", inepStudentId: "111" })], refs);
    expect(codes(r)).toContain("inep-aluno-duplicado");
    expect(r.counts.persons).toBe(1);
  });
  it("aluno sem turma tem matrícula mas não participação; turma sem aluno é listada", () => {
    const r = stageStudents([row({ classExternalId: null })], refs);
    expect(r.counts).toMatchObject({ enrollments: 1, participations: 0 });
    expect(r.emptyClasses).toContain("T9");
  });
  it("referência órfã e outra escola não criam nada", () => {
    const r = stageStudents([row({ classExternalId: "TX" }), row({ classExternalId: "T3" }), row({ schoolInep: "99" })], refs);
    expect(r.counts.participations).toBe(0);
    expect(codes(r)).toEqual(["turma-sem-correspondencia", "turma-de-outra-escola", "escola-sem-correspondencia"]);
  });
  it("multietapa sem posição gera evidência; EJA preserva fase literal", () => {
    const r = stageStudents([row({ classExternalId: "T2" }), row({ personKey: "fpB", classExternalId: "T2", positionAxis: "Fase II" })], refs);
    expect(codes(r)).toEqual(["posicao-ausente-em-multietapa"]);
    expect(r.participations[1]!.positionAxis).toBe("Fase II");
  });
  it("situação estranha não vira fato; ausente fica null", () => {
    const r = stageStudents([row({ situationRaw: "#REF!" }), row({ personKey: "fpB", situationRaw: "Cursando" })], refs);
    expect(r.participations.map((p) => p.situation)).toEqual([null, "Cursando"]);
    expect(codes(r)).toContain("situacao-fora-do-catalogo");
  });
  it("movimento só quando declarado e datado; preserva origem", () => {
    const r = stageStudents([row({}), row({ classExternalId: "T9", movementKind: "remanejamento", movementDate: "2026-05-02" }), row({ personKey: "fpC", movementKind: "x" })], refs);
    expect(r.movements).toEqual([expect.objectContaining({ fromClassId: "T1", toClassId: "T9" })]);
    expect(codes(r)).toContain("movimento-sem-data");
  });
  it("reprocessar o mesmo snapshot não duplica participação", () => {
    const rows = [row({}), row({})];
    expect(stageStudents(rows, refs).counts.participations).toBe(1);
  });
  it("fontes divergentes viram evidência mascarada", () => {
    const a = stageStudents([row({ personKey: "fingerprint-long-A" })], refs).participations;
    const b = stageStudents([row({ personKey: "fingerprint-long-A", classExternalId: "T9" })], refs).participations;
    const ev = compareStudentSources(a, b);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.ref).toBe("fingerpr");
  });
});

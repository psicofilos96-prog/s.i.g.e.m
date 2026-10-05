import { describe, expect, it } from "vitest";
import { isPiiHeader, lineage, reconcileSources, splitComposite, stageClasses, type ColumnMapping } from "./educacenso-class-staging";

const known = new Set(["33094756", "33100012"]);
const mapping: ColumnMapping = {
  inep_escola: "CO_ENTIDADE", codigo_turma_educacenso: "ID_TURMA", nome_turma: "NO_TURMA", turno: "TURNO",
  tipos_atendimento: "ATENDIMENTO", multisseriada: "MULTI", matriculas: "QT_MAT",
};
const headers = ["CO_ENTIDADE", "ID_TURMA", "NO_TURMA", "TURNO", "ATENDIMENTO", "MULTI", "QT_MAT", "CPF_PROFESSOR", "NOME_ALUNO"];
const row = (locator: string, c: Record<string, unknown>) => ({ locator, cells: { CO_ENTIDADE: "33094756", NO_TURMA: "Turma A", ...c } });

describe("staging de turmas EducaCenso (sintético, sem PII)", () => {
  it("descarta colunas pessoais e recusa mapeá-las", () => {
    expect(isPiiHeader("CPF_PROFESSOR")).toBe(true);
    const r = stageClasses({ headers, rows: [], mapping: { ...mapping, nome_turma: "NOME_ALUNO" }, knownIneps: known });
    expect(r.droppedPiiColumns).toEqual(["CPF_PROFESSOR", "NOME_ALUNO"]);
    expect(r.issues[0]!.code).toBe("coluna-pessoal-recusada");
  });
  it("escola inexistente, código EducaCenso duplicado e INEP inválido viram erro por linha", () => {
    const r = stageClasses({ headers, mapping, knownIneps: known, rows: [
      row("l2", { ID_TURMA: "1" }), row("l3", { ID_TURMA: "1" }), row("l4", { CO_ENTIDADE: "99999999" }), row("l5", { CO_ENTIDADE: "x" }),
    ] });
    expect(r.issues.map((i) => i.code)).toEqual(["codigo-educacenso-duplicado", "escola-inexistente", "inep-invalido"]);
    expect(r.classes).toHaveLength(1);
    expect(r.classes[0]!.school_id).toBe("inep-33094756");
    expect(r.classes[0]!.external_ids).toEqual([{ kind: "educacenso-turma", value: "1" }]);
  });
  it("ausência ≠ zero; composição preservada; nome nunca vira semântica", () => {
    const r = stageClasses({ headers, mapping, knownIneps: known, rows: [
      row("l2", { NO_TURMA: "EJA Fase II Multi", ATENDIMENTO: "AEE; Escolarização", QT_MAT: "0" }),
      row("l3", { ID_TURMA: "9" }),
    ] });
    const [a, b] = r.classes;
    expect(a!.matriculas).toBe(0);
    expect(b!.matriculas).toBeNull();
    expect(a!.tipos_atendimento).toEqual(["AEE", "Escolarização"]);
    expect(a!.etapa).toBeNull();
    expect(a!.modalidade).toBeNull();
    expect(a!.multisseriada).toBeNull();
    expect(r.totals.byShift["não informado"]).toBe(2);
    expect(splitComposite("")).toEqual([]);
  });
  it("reconciliação expõe divergências e linhagem", () => {
    const s = (rows: ReturnType<typeof row>[]) => stageClasses({ headers, mapping, knownIneps: known, rows }).classes;
    const a = s([row("l2", { ID_TURMA: "1", TURNO: "Manhã" }), row("l3", { ID_TURMA: "2" })]);
    const b = s([row("l2", { ID_TURMA: "1", TURNO: "Tarde" }), row("l3", { ID_TURMA: "3" })]);
    const rec = reconcileSources(a, b);
    expect(rec.divergences.map((d) => d.kind).sort()).toEqual(["campo-divergente", "so-em-a", "so-em-b"]);
    expect(lineage("h", "h", rec)).toBe("mesmo-arquivo");
    expect(lineage("h1", "h2", reconcileSources(a, a))).toBe("conteudo-equivalente");
    expect(lineage("h1", "h2", rec)).toBe("fontes-distintas");
  });
});

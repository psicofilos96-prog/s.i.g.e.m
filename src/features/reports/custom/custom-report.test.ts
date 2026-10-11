import { describe, expect, it } from "vitest";
import { availableJoins, emptySpec, gapsFor, pruneSpec, sourcesInQuery, toResult, toServerSpec, validateSpec, type Catalog, type CustomSpec } from "./custom-report";
import { layoutProblems, defaultLayout } from "./custom-layout";
import { latestCustom } from "./custom-templates";

const cat: Catalog = {
  sources: {
    vinculos: { label: "Vínculos", grain: "vínculo", fields: { student_id: { label: "Estudante", type: "id" }, class_id: { label: "Turma", type: "id" }, school_id: { label: "Escola", type: "id" } } },
    turmas: { label: "Turmas", grain: "turma", fields: { class_id: { label: "ID", type: "id" }, turma: { label: "Turma", type: "text" }, school_id: { label: "Escola", type: "id" } } },
    escolas: { label: "Escolas", grain: "escola", fields: { school_id: { label: "ID", type: "id" }, nome: { label: "Escola", type: "text" }, salas: { label: "Salas", type: "number" } } },
    estudantes: { label: "Estudantes", grain: "estudante", fields: { student_id: { label: "ID", type: "id" }, nome: { label: "Nome", type: "text", sensitive: true } } },
    servidores: { label: "Servidores", grain: "registro", fields: { cargo: { label: "Cargo", type: "text" } } },
  },
  joins: [
    { id: "vinculo_turma", from: "vinculos", to: "turmas", on: ["class_id", "class_id"], card: "N:1" },
    { id: "turma_escola", from: "turmas", to: "escolas", on: ["school_id", "school_id"], card: "N:1" },
    { id: "vinculo_escola", from: "vinculos", to: "escolas", on: ["school_id", "school_id"], card: "N:1" },
    { id: "vinculo_estudante", from: "vinculos", to: "estudantes", on: ["student_id", "student_id"], card: "N:1" },
  ],
  gaps: [{ from: "servidores", to: "jornadas", reason: "sem fonte" }],
};
const three = (): CustomSpec => ({ ...emptySpec("vinculos"), joins: ["vinculo_turma", "turma_escola", "vinculo_estudante"] });

describe("gerador personalizado", () => {
  it("cruza três fontes encadeadas e não oferece fonte repetida", () => {
    expect(sourcesInQuery(cat, three())).toEqual(["vinculos", "turmas", "escolas", "estudantes"]);
    expect(availableJoins(cat, three()).map((j) => j.id)).toEqual([]);
  });
  it("remover cruzamento intermediário desconecta o seguinte e tira seus campos", () => {
    const s = pruneSpec(cat, { ...three(), joins: ["turma_escola", "vinculo_estudante"], groupBy: ["escolas.nome"] });
    expect(s.joins).toEqual(["vinculo_estudante"]);
    expect(s.groupBy).toEqual([]);
  });
  it("trocar o cálculo para um que pede campo mantém o cálculo, aguardando o campo", () => {
    const s = pruneSpec(cat, { ...three(), groupBy: ["escolas.nome"], measures: [{ agg: "count_distinct" }] });
    expect(s.measures).toEqual([{ agg: "count_distinct", field: undefined }]);
    expect(validateSpec(cat, s).join()).toMatch(/Cálculo 1/);
  });
  it("dado pessoal exige consentimento explícito", () => {
    expect(validateSpec(cat, { ...three(), columns: ["estudantes.nome"] }).join()).toMatch(/dado pessoal/);
    expect(validateSpec(cat, { ...three(), includeSensitive: true, columns: ["estudantes.nome"] })).toEqual([]);
  });
  it("soma exige campo numérico e subtotal exige agrupamento", () => {
    const s = { ...three(), groupBy: [], measures: [{ agg: "sum" as const, field: "turmas.turma" }], subtotals: true };
    const e = validateSpec(cat, s).join(" ");
    expect(e).toMatch(/numérico/); expect(e).toMatch(/Subtotais/);
  });
  it("filtro E/OU vira valores tipados para o servidor", () => {
    const s: CustomSpec = { ...three(), columns: ["escolas.nome"], filter: { op: "and", items: [{ field: "escolas.salas", operator: "between", value: ["2", "10"] }, { op: "or", items: [{ field: "escolas.nome", operator: "in", value: "A; B" }] }] } };
    const out = toServerSpec(cat, s, { limit: 50, offset: 0 });
    expect(out.filter.items[0]).toEqual({ field: "escolas.salas", operator: "between", value: [2, 10] });
    expect((out.filter.items[1] as { items: unknown[] }).items[0]).toEqual({ field: "escolas.nome", operator: "in", value: ["A", "B"] });
  });
  it("linhas de subtotal e total geral recebem rótulo, e ausência fica null", () => {
    const s: CustomSpec = { ...three(), groupBy: ["escolas.nome", "turmas.turma"], measures: [{ agg: "count" }], subtotals: true };
    const cols = [{ id: "c1", field: "escolas.nome", kind: "group" as const }, { id: "c2", field: "turmas.turma", kind: "group" as const }, { id: "c3", agg: "count" as const, kind: "measure" as const }];
    const r = toResult(cat, s, { columns: cols }, [{ c1: "E1", c2: "T1", c3: 3, _nivel: 0 }, { c1: "E1", c2: null, c3: 3, _nivel: 1 }, { c1: null, c2: null, c3: 3, _nivel: 3 }, { c1: "E2", c2: null, c3: 1, _nivel: 0 }]);
    expect(r.rows.map((x) => x.slice(0, 2))).toEqual([["E1", "T1"], ["E1", "SUBTOTAL"], ["TOTAL GERAL", ""], ["E2", null]]);
  });
  it("lacuna de ligação aparece só quando a fonte está na consulta", () => {
    expect(gapsFor(cat, three())).toEqual([]);
    expect(gapsFor(cat, emptySpec("servidores")).length).toBe(1);
  });
  it("A4 retrato aceita até 9 colunas; A3 paisagem até 28", () => {
    expect(layoutProblems(defaultLayout(), 10).join()).toMatch(/não cabem/);
    expect(layoutProblems({ ...defaultLayout(), paper: "A3", orientation: "paisagem" }, 28)).toEqual([]);
  });
  it("modelo: vale a última versão e arquivado some", () => {
    const c = { kind: "custom-v1", spec: emptySpec("escolas"), layout: defaultLayout() };
    const rows = [{ name: "a", version: 1, archived: false, choice: c, recorded_at: "1" }, { name: "a", version: 2, archived: true, choice: c, recorded_at: "2" }, { name: "b", version: 3, archived: false, choice: c, recorded_at: "3" }];
    expect(latestCustom(rows).map((t) => [t.name, t.version])).toEqual([["b", 3]]);
  });
});

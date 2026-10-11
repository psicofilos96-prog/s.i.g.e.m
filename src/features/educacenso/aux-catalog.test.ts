import { describe, expect, it } from "vitest";
import { codeExists, record00AuxIssues, resourceAllowed, stageAllowed, type AuxCode, type AuxRule } from "./aux-catalog";

const rules: AuxRule[] = [
  { reference_year: "2025", rule_kind: "deficiencia-recurso", left_key: "Baixa visão", right_key: "Auxílio ledor", attrs: {} },
  { reference_year: "2026", rule_kind: "transtorno-recurso", left_key: "Dislexia", right_key: "Tempo adicional", attrs: {} },
  { reference_year: "2026", rule_kind: "etapa-tipo-turma", left_key: "Curricular (etapa de ensino)", right_key: "14", attrs: { mediacao: "Presencial", tipo_turma: "Curricular (etapa de ensino)" } },
];
const codes: AuxCode[] = [
  { reference_year: "2026", table_key: "municipios", code: "3302205", label: "Itaperuna", parent_code: "33" },
  { reference_year: "2026", table_key: "distritos", code: "330220535", label: "Raposo", parent_code: "3302205" },
  { reference_year: "2026", table_key: "orgaos_regionais", code: "11011", label: "NOROESTE", parent_code: "3302205" },
];

describe("tabelas auxiliares", () => {
  it("tabela de 2025 nunca é aplicada a 2026", () => {
    expect(resourceAllowed(rules, "2026", "deficiencia-recurso", "Baixa visão", "Auxílio ledor")).toBe("sem-tabela-do-ano");
    expect(resourceAllowed(rules, "2025", "deficiencia-recurso", "Baixa visão", "Auxílio ledor")).toBe("permitido");
  });
  it("transtorno × recurso positivo e negativo", () => {
    expect(resourceAllowed(rules, "2026", "transtorno-recurso", "dislexia", "tempo adicional")).toBe("permitido");
    expect(resourceAllowed(rules, "2026", "transtorno-recurso", "Dislexia", "Prova ampliada (Fonte 18)")).toBe("nao-previsto");
  });
  it("etapa × tipo de turma × mediação", () => {
    expect(stageAllowed(rules, "2026", "Presencial", "Curricular (etapa de ensino)", "14")).toBe("permitido");
    expect(stageAllowed(rules, "2026", "EAD", "Curricular (etapa de ensino)", "14")).toBe("nao-habilitado");
  });
  it("códigos preservam zeros e pertencem ao município", () => {
    expect(codeExists(codes, "2026", "distritos", "330220535", "3302205")).toBe("permitido");
    expect(codeExists(codes, "2026", "distritos", "330220535", "3300100")).toBe("nao-pertence");
    expect(codeExists(codes, "2027", "municipios", "3302205")).toBe("sem-tabela-do-ano");
  });
  it("Registro 00: distrito de outro município é impeditivo", () => {
    const v = Array(53).fill(""); v[0] = "00"; v[7] = "3302205"; v[8] = "99"; v[17] = "11011";
    const is = record00AuxIssues([{ record: "00", values: v }], codes, "2026");
    expect(is.map((i) => i.code)).toEqual(["distrito-fora-do-municipio"]);
    v[8] = "35"; expect(record00AuxIssues([{ record: "00", values: v }], codes, "2026")).toEqual([]);
  });
});

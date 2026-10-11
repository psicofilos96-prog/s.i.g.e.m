import { describe, expect, it } from "vitest";
import { SEMED_TABLES_2026, editableKeys, validateValues } from "./semed-catalog";

const t09 = SEMED_TABLES_2026.find((d) => d.code === "09")!;

describe("Tabela 09 — infraestrutura", () => {
  it("seções nomeadas e sem repetição", () => {
    const ids = t09.sections.map((s) => s.id), titles = t09.sections.map((s) => s.title);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(titles).size).toBe(titles.length);
    for (const id of ["gestao", "predial", "acessibilidade", "transporte", "aee", "espacos", "seguranca", "matricula", "salas", "sanitarios", "equip", "cozinha", "instalacoes", "manutencao", "outras", "rodape"]) expect(ids).toContain(id);
  });
  it("matrícula por etapa vem do cadastro central, nunca digitada", () => {
    const k = editableKeys(t09);
    expect(Object.keys(k).filter((x) => x.startsWith("matricula."))).toEqual([]);
  });
  it("ano de construção fora de 1800–2100 é recusado; Sim/Não só aceita as duas opções", () => {
    expect(validateValues(t09, { "predial.ano_construcao": 1750 })).toHaveLength(1);
    expect(validateValues(t09, { "predial.ano_construcao": 1985 })).toHaveLength(0);
    expect(validateValues(t09, { "acessibilidade.rampas": "Talvez" })).toHaveLength(1);
    expect(validateValues(t09, { "id.turnos": 5 })).toHaveLength(1);
  });
});

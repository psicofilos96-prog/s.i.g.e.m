import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { inventoryReady, publicationState, quantity } from "./operation-model";

const ev = (seq: number, action: "publicacao" | "retirada", v: string) => ({ menu_logical_id: "L", menu_version_id: v, sequence: seq, action, current_version: true });

describe("AI — operação de alimentação", () => {
  it("publicação vale só para a versão vigente e só a última ação conta", () => {
    expect(publicationState([], "L", "v1").kind).toBe("nao-publicado");
    expect(publicationState([ev(1, "publicacao", "v1")], "L", "v1")).toEqual({ kind: "publicado", nextSequence: 1 });
    expect(publicationState([ev(1, "publicacao", "v1")], "L", "v2").kind).toBe("versao-desatualizada");
    expect(publicationState([ev(1, "publicacao", "v1"), ev(2, "retirada", "v1")], "L", "v1").kind).toBe("retirado");
  });
  it("ausência nunca vira zero; zero explícito é zero", () => {
    expect(quantity(null)).toBe("não informado");
    expect(quantity(0)).toBe("0");
  });
  it("estoque exige catálogos aprovados de item e unidade", () => {
    expect(inventoryReady([], [{}])).toBe(false);
    expect(inventoryReady([{}], [{}])).toBe(true);
  });
  it("migration 0170 não semeia catálogos nem regra nutricional e tira DML da automação", () => {
    const sql = readFileSync("drizzle/migrations/0170_ai_school_meals_operation.sql", "utf8").replace(/--.*$/gm, "");
    expect(sql).not.toMatch(/INSERT INTO public\.attribute_value_definitions/i);
    expect(sql).not.toMatch(/per[_ ]?capita|pnae_|estoque_minimo/i);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.%I FROM service_role/);
  });
});

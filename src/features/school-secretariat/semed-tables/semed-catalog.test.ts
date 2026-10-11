import { describe, expect, it } from "vitest";
import { SEMED_TABLES_2026, editableKeys, nextState, sumPresent, t06Final, pct, validateValues, actWho } from "./semed-catalog";
import { documentBlocks } from "./semed-export";

const t = (c: string) => SEMED_TABLES_2026.find((d) => d.code === c)!;

describe("Tabelas SEMED", () => {
  it("cobre exatamente as tabelas 04, 06, 09, 10 e 11", () => {
    expect(SEMED_TABLES_2026.map((d) => d.code)).toEqual(["04", "06", "09", "10", "11"]);
  });
  it("Tabela 04 tem 26 faixas etárias (colunas D–AC do guia) e 21 linhas de etapa", () => {
    const g = t("04").sections.find((s) => s.kind === "grid")!;
    expect(g.kind === "grid" && [g.cols.length, g.rows.length]).toEqual([26, 21]);
  });
  it("Tabela 10 limita a 30 servidores", () => {
    expect(Object.keys(editableKeys(t("10"))).filter((k) => k.endsWith(".nome")).length).toBe(30);
  });
  it("campo do cadastro central não é digitável", () => {
    const k = editableKeys(t("09"));
    expect(k["id.inep"]).toBeUndefined();
    expect(k["id.turnos"]).toEqual({ type: "int", max: 4 });
    expect(validateValues(t("09"), { "id.inep": "123" })).toHaveLength(1);
  });
  it("ausência nunca vira zero", () => {
    expect(sumPresent([null, null])).toBeNull();
    expect(sumPresent([null, 3, 2])).toBe(5);
    expect(pct(5, 0)).toBeNull();
  });
  it("Tabela 06: matrícula final = inicial + recebidos − transf − canc − evasão, só com todas as parcelas", () => {
    const v = { "m.ef1.inicial": 30, "m.ef1.recebidos": 2, "m.ef1.transferencia": 3, "m.ef1.cancelamento": 1, "m.ef1.evasao": 0 };
    expect(t06Final(v, "ef1")).toBe(28);
    expect(t06Final({ ...v, "m.ef1.evasao": null }, "ef1")).toBeNull();
    expect(pct(28, 28)).toBe("100,0%");
  });
  it("Tabela 11: matrícula inicial = masculino + feminino", () => {
    const b = documentBlocks(t("11"), { "m.ef1.masc": 10, "m.ef1.fem": 12 }, {}).find((x) => x.title.includes("gênero"))!;
    expect(b.body.find((r) => r[0] === "1º Ano")!.at(-1)).toBe(22);
  });
  it("rejeita inteiro negativo e opção fora da lista", () => {
    expect(validateValues(t("06"), { "m.ef1.inicial": -1 })).toHaveLength(1);
    expect(validateValues(t("09"), { "predial.situacao": "Comodato" })).toHaveLength(1);
  });
  it("ciclo: fechamento só após recebimento; conferência só pela escola; recebimento só pela rede", () => {
    expect(nextState("rascunho", "fechar")).toBeNull();
    expect(nextState("recebido", "fechar")).toBe("fechado");
    expect(nextState("fechado", "salvar")).toBeNull();
    expect(nextState("revisao-solicitada", "salvar")).toBe("rascunho");
    expect(actWho("conferir")).toBe("confere");
    expect(actWho("receber")).toBe("rede");
  });
});

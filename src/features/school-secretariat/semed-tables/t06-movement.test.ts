import { describe, expect, it } from "vitest";
import { t06Divergences } from "./t06-movement";
import { pct, t06Final } from "./semed-catalog";

const rows = [{ key: "ef1" }, { key: "ef2" }];

describe("Tabela 06 — apuração e divergência", () => {
  it("coluna sem apuração não gera divergência (não apurado ≠ zero)", () => {
    expect(t06Divergences({ "m.ef1.inicial": 10 }, rows, {})).toEqual([]);
  });
  it("total digitado diferente da apuração determinada é divergência", () => {
    expect(t06Divergences({ "m.ef1.inicial": 10, "m.ef2.inicial": 5 }, rows, { inicial: 14 })).toEqual([{ col: "inicial", typed: 15, computed: 14 }]);
  });
  it("apuração 0 com coluna vazia não diverge; apuração 3 com coluna vazia diverge", () => {
    expect(t06Divergences({}, rows, { evasao: 0 })).toEqual([]);
    expect(t06Divergences({}, rows, { evasao: 3 })).toEqual([{ col: "evasao", typed: null, computed: 3 }]);
  });
  it("matrícula final = inicial + recebidos − transferência − cancelamento − evasão, só com todas as parcelas", () => {
    const v = { "m.ef1.inicial": 30, "m.ef1.recebidos": 2, "m.ef1.transferencia": 3, "m.ef1.cancelamento": 1, "m.ef1.evasao": 0 };
    expect(t06Final(v, "ef1")).toBe(28);
    expect(t06Final({ "m.ef1.inicial": 30 }, "ef1")).toBeNull();
  });
  it("denominador zero não produz percentual", () => {
    expect(pct(0, 0)).toBeNull();
    expect(pct(7, 28)).toBe("25,0%");
  });
});

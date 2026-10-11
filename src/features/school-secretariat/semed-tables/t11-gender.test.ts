import { describe, expect, it } from "vitest";
import { t11Compare, t11Complete, type T11Apur } from "./t11-gender";

const rows = [{ key: "a1" }, { key: "a2" }];
const ap = (t: T11Apur["totals"]): T11Apur => ({ rule_version: 1, cutoff: "2026-03-31", totals: t, gaps: [] });

describe("Tabela 11 — gênero", () => {
  it("sem regra não apura nada", () => {
    expect(t11Compare({}, rows, { rule_version: null, cutoff: null, totals: {}, gaps: ["regra-ausente"] }).every((c) => c.status === "não apurado")).toBe(true);
  });
  it("sexo não informado torna a apuração incompleta (nunca atribui gênero)", () => {
    expect(t11Complete(ap({ masc: 3, fem: 2, nao_informado: 1, fora_do_mapa: 0, sem_data: 0 }))).toBe(false);
  });
  it("compara total digitado com o apurado", () => {
    const c = t11Compare({ "m.a1.masc": 2, "m.a2.masc": 1, "m.a1.fem": 1 }, rows, ap({ masc: 3, fem: 2, nao_informado: 0, fora_do_mapa: 0, sem_data: 0 }));
    expect(c.map((x) => x.status)).toEqual(["confere", "divergente"]);
  });
});

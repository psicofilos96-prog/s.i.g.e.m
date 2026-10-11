import { describe, expect, it } from "vitest";
import { availablePanels, cpfDigits, needsManualDecision, type QueueItem } from "./docserv-model";

describe("DocServ — painéis por capacidade", () => {
  it("sem contexto não há painel", () => expect(availablePanels(null)).toEqual([]));
  it("servidor exige pessoa canônica", () => {
    expect(availablePanels({ person_id: null, servidor: true, escola_schools: [], nie: false })).toEqual([]);
    expect(availablePanels({ person_id: "p", servidor: true, escola_schools: [], nie: false })).toEqual(["servidor"]);
  });
  it("escola só com escola autorizada; rede só com capability de rede", () => {
    expect(availablePanels({ person_id: null, servidor: false, escola_schools: ["s1"], nie: true })).toEqual(["escola", "rede"]);
  });
});

describe("DocServ — identidade", () => {
  it("CPF só com 11 dígitos", () => { expect(cpfDigits("123.456.789-01")).toBe("12345678901"); expect(cpfDigits("123")).toBeNull(); });
  it("ambíguo exige decisão manual; vinculado não", () => {
    const base = { key: "k", seq: 1, kind: "servidor", matricula: null, cpf: true, inep: null, candidates: [], masked_names: null, manual: false, recorded_at: "" } as const;
    expect(needsManualDecision({ ...base, outcome: "ambiguo" } as QueueItem)).toBe(true);
    expect(needsManualDecision({ ...base, outcome: "vinculado" } as QueueItem)).toBe(false);
  });
});

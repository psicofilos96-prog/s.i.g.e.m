import { describe, expect, it } from "vitest";
import { applyFilter, counters, linkLabel, validationQueue, type Roster, type RosterPerson } from "./school-portal";

const p = (o: Partial<RosterPerson>): RosterPerson => ({ person_id: "a", masked_name: "Ana S.", sources: ["atuacao:professor"], functions: [], other_schools: 0, docs: {}, ...o });
const doc = (status: string) => ({ document_id: "d", version: 1, seq: 1, path: "x", valid_until: null, by_school: false, status });
const R = (people: RosterPerson[], can_validate = false): Roster => ({ school_id: "s", season: "2026", can_validate, staff_records_without_person: 0, people, requests: [] });

describe("painel da escola", () => {
  it("pessoa com atuação e lotação conta uma vez e entra em múltiplos vínculos", () => {
    const c = counters(R([p({ sources: ["atuacao:professor", "lotacao"] }), p({})]));
    expect(c.servidores).toBe(1); expect(c.multiplos).toBe(1); expect(c["sem-envio"]).toBe(1);
  });
  it("servidor que atua em outra escola também é múltiplo", () => expect(counters(R([p({ other_schools: 1 })])).multiplos).toBe(1));
  it("titular/dobra/AJT nunca é presumido", () => {
    expect(linkLabel(p({}))).toContain("sem lotação registrada");
    expect(linkLabel(p({ sources: ["lotacao"], functions: ["dobra"] }))).toContain("dobra");
  });
  it("filtros por situação da certidão criminal", () => {
    const r = R([p({ person_id: "1", docs: { antecedente_criminal: doc("valido") } }), p({ person_id: "2", docs: { antecedente_criminal: doc("rejeitado") } }), p({ person_id: "3" })]);
    expect(applyFilter(r, "valido", "").map((x) => x.person_id)).toEqual(["1"]);
    expect(applyFilter(r, "problema", "").map((x) => x.person_id)).toEqual(["2"]);
    expect(applyFilter(r, "sem-envio", "").map((x) => x.person_id)).toEqual(["3"]);
  });
  it("fila de validação só existe com permissão", () => {
    const people = [p({ docs: { antecedente_criminal: doc("pendente_validacao") } })];
    expect(validationQueue(R(people, false))).toHaveLength(0);
    expect(validationQueue(R(people, true))).toHaveLength(1);
  });
});

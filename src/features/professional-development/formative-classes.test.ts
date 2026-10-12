import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { allowedTransitions, classDraftProblems, currentState, freeSeats, transitionProblems, type ClassDraft } from "./formative-classes";

const d: ClassDraft = { courseHasCatalog: true, seats: 30, startsOn: "2026-03-01", endsOn: "2026-06-30", label: "Turma A",
  location: "Auditório SEMED", audience: "Professores alfabetizadores", trainers: [{ validFrom: "2026-01-01", validUntil: null }] };

describe("L08 turmas formativas", () => {
  it("rascunho completo passa", () => expect(classDraftProblems(d)).toEqual([]));
  it("sem formador ou formador sem atuação vigente é recusado", () => {
    expect(classDraftProblems({ ...d, trainers: [] }).join()).toMatch(/formador/);
    expect(classDraftProblems({ ...d, trainers: [{ validFrom: "2026-04-01", validUntil: null }] }).join()).toMatch(/vigente/);
  });
  it("sem vagas configuradas é recusado e vaga livre fica desconhecida", () => {
    expect(classDraftProblems({ ...d, seats: null }).join()).toMatch(/vagas/);
    expect(freeSeats(null, 3)).toBeNull(); expect(freeSeats(30, 3)).toBe(27);
  });
  it("curso sem catálogo não gera turma", () => expect(classDraftProblems({ ...d, courseHasCatalog: false }).join()).toMatch(/catálogo/));
  it("estado = último evento; lacuna = ambíguo", () => {
    expect(currentState([{ seq: 1, status: "planejada", reason: null, at: "" }, { seq: 2, status: "inscricoes-abertas", reason: null, at: "" }]).state).toBe("inscricoes-abertas");
    expect(currentState([{ seq: 1, status: "planejada", reason: null, at: "" }, { seq: 3, status: "concluida", reason: null, at: "" }]).ambiguous).toBe(true);
  });
  it("transições fechadas; concluída e cancelada são finais", () => {
    expect(allowedTransitions("concluida")).toEqual([]);
    expect(transitionProblems("planejada", "concluida", "").length).toBe(1);
    expect(transitionProblems("em-andamento", "cancelada", "").join()).toMatch(/motivo/);
    expect(transitionProblems("em-andamento", "cancelada", "Formador afastado sem substituto")).toEqual([]);
  });
  it("migration 0436: separada da turma acadêmica, append-only, writer antigo fechado", () => {
    const sql = readFileSync("drizzle/migrations/0436_dev08_formative_classes.sql", "utf8");
    expect(sql).not.toMatch(/INSERT INTO public\.institutional_classes/);
    expect(sql).toMatch(/devcs_immutable BEFORE UPDATE OR DELETE/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public.record_dev_class\(.*\) FROM authenticated/);
    expect(sql).toMatch(/dev:stale/);
  });
});

import { describe, expect, it } from "vitest";
import { conferSituation, tally, rectificationHistory, type SituationRule, type EnrollmentInput } from "./student-situation-conference";

const ef: SituationRule = { id: "sa-ef", version: 1, year: "2026", segment: "EF", officialSource: "regra da rede v1", cutoff: "2026-12-31",
  map: { aprovado: "aprovado", retido: "reprovado", "transf-externa": "transferido", abandono: "abandono" }, admitted: ["aprovado", "reprovado", "transferido", "abandono"] };
const ei: SituationRule = { ...ef, id: "sa-ei", segment: "EI", map: { aprovado: "aprovado", frequentou: "sem-movimento" }, admitted: ["sem-movimento", "transferido"] };
const inp = (o: Partial<EnrollmentInput> = {}): EnrollmentInput => ({ enrollmentId: "m1", segment: "EF", closingRecorded: true, standing: { value: "aprovado", version: 1, actRef: "ata-1", recordedAt: "" }, movements: [], teacherEvidence: [], ...o });

describe("CIECE L10 Situação do Aluno", () => {
  it("situação oficial conferida; sem registro nunca vira resultado", () => {
    expect(conferSituation("2026", [ef], inp()).status).toBe("conferida");
    const r = conferSituation("2026", [ef], inp({ standing: null }));
    expect(r.category).toBeNull(); expect(r.reasons).toContain("sem-situacao-oficial-registrada");
  });
  it("EI não admite aprovação; segmento sem regra é não verificável", () => {
    expect(conferSituation("2026", [ef, ei], inp({ segment: "EI" })).status).toBe("inconsistente");
    expect(conferSituation("2026", [ef], inp({ segment: "EJA" })).reasons).toEqual(["sem-regra-do-segmento"]);
    expect(conferSituation("2026", [{ ...ef, cutoff: null }], inp()).status).toBe("nao-verificavel");
  });
  it("movimentação homologada com data prevalece; aprovação simultânea é inconsistente", () => {
    const mv = [{ typeId: "transf-externa", homologated: true, effectiveOn: "2026-08-01", ref: "mov-1" }];
    expect(conferSituation("2026", [ef], inp({ standing: null, movements: mv })).category).toBe("transferido");
    expect(conferSituation("2026", [ef], inp({ movements: mv })).status).toBe("inconsistente");
    const r = conferSituation("2026", [ef], inp({ movements: [{ typeId: "x", homologated: false, effectiveOn: null, ref: "mov-2" }] }));
    expect(r.status).toBe("pendente");
    expect(conferSituation("2026", [ef], inp({ movements: null })).status).toBe("nao-verificavel");
  });
  it("registro docente ausente e fechamento não registrado são pendências; total só soma conferidas", () => {
    const p = conferSituation("2026", [ef], inp({ enrollmentId: "m2", closingRecorded: false, teacherEvidence: [{ kind: "frequencia", present: false }] }));
    expect(p.reasons).toEqual(["situacao-sem-fechamento-do-ciclo", "registro-docente-ausente:frequencia"]);
    const t = tally([conferSituation("2026", [ef], inp()), p], () => "EF");
    expect(t.bySegment["EF"]).toEqual({ aprovado: 1 }); expect(t.excluded.pendente).toBe(1); expect(t.complete).toBe(false);
  });
  it("retificação exige ato oficial e preserva versão anterior", () => {
    const a = conferSituation("2026", [ef], inp());
    const n2 = inp({ standing: { value: "retido", version: 2, actRef: "ata-2", recordedAt: "" } });
    const h = rectificationHistory([a], [conferSituation("2026", [ef], n2)], [n2]);
    expect(h).toEqual([{ enrollmentId: "m1", fromVersion: 1, toVersion: 2, actRef: "ata-2", reason: "aprovado→reprovado" }]);
  });
});

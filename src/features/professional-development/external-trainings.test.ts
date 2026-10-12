import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canResubmit, reviewProblems, versionState, type ExtReview } from "./external-trainings";

const g = "Fundamentação detalhada da etapa";
const conf: ExtReview = { seq: 1, stage: "conferencia", outcome: "conforme", reviewer: "c" };
const an: ExtReview = { seq: 2, stage: "analise", outcome: "favoravel", reviewer: "a" };

describe("L18 formações externas", () => {
  it("estado projetado do ledger", () => {
    expect(versionState([])).toBe("submetida");
    expect(versionState([conf, an, { seq: 3, stage: "decisao", outcome: "validado", reviewer: "d" }])).toBe("validado");
  });
  it("ordem e segregação", () => {
    expect(reviewProblems([conf, an], { stage: "decisao", outcome: "validado", reviewer: "d", owner: "o", grounds: g })).toEqual([]);
    expect(reviewProblems([], { stage: "decisao", outcome: "validado", reviewer: "o", owner: "o", grounds: "x" })).toHaveLength(3);
    expect(reviewProblems([conf], { stage: "analise", outcome: "favoravel", reviewer: "c", owner: "o", grounds: g }).join()).toMatch(/distinta/);
  });
  it("divergência impede validação", () =>
    expect(reviewProblems([{ ...conf, outcome: "divergente" }, an], { stage: "decisao", outcome: "validado", reviewer: "d", owner: "o", grounds: g }).join()).toMatch(/contradiz/));
  it("reenvio só após devolução/indeferimento", () => expect([canResubmit("devolvido"), canResubmit("analisada")]).toEqual([true, false]));
  it("migration 0448: sem efeito de progressão, certificado da própria pessoa, fundamentação", () => {
    const sql = readFileSync("drizzle/migrations/0448_dev18_external_trainings.sql", "utf8");
    expect(sql).not.toMatch(/progression_|recognized|reconhecid[oa]\s*boolean/i);
    expect(sql).toMatch(/person_id = _p AND mime_type = 'application\/pdf'/);
    expect(sql).toMatch(/dev:self-review/);
    expect(sql).toMatch(/dev:grounds-contradict/);
    expect(sql).toMatch(/length\(btrim\(grounds\)\) >= 20/);
  });
});

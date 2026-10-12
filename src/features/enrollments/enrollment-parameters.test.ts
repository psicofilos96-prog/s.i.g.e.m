import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PARAMETER_GATED_ACTIONS, parameterInForce, publicationBlockers, type ParameterVersion } from "./enrollment-parameters";

const sql = readFileSync("drizzle/migrations/0501_enr14_official_parameters.sql", "utf8");
const v = (version: number, approved: boolean, validFrom = "2026-01-01"): ParameterVersion => ({ id: `v${version}`, key: "supressao-territorial", version, validFrom, approved });

describe("lote 14 — parâmetros oficiais de Matrículas", () => {
  it("sem versão aprovada a publicação fica bloqueada", () => {
    expect(publicationBlockers(["supressao-territorial"], [v(1, false)], "2026-10-12")).toEqual(["supressao-territorial"]);
  });
  it("versão posterior não aprovada não derruba a aprovada", () => {
    expect(parameterInForce([v(1, true), v(2, false)], "supressao-territorial", "2026-10-12")?.version).toBe(1);
  });
  it("versão aprovada com vigência futura ainda não vale", () => {
    expect(publicationBlockers(["supressao-territorial"], [v(1, true, "2027-01-01")], "2026-10-12")).toEqual(["supressao-territorial"]);
  });
  it("só publicar/retomar são bloqueados", () => {
    expect([...PARAMETER_GATED_ACTIONS]).toEqual(["publicar", "retomar"]);
    expect(sql).toMatch(/NEW\.action IN \('publicar','retomar'\)/);
  });
  it("o banco exige ato assinado e aprovador diferente do autor", () => {
    expect(sql).toMatch(/admin_act_signatures s WHERE s\.act_version_id = _act/);
    expect(sql).toMatch(/_c\.person_id = _p THEN RAISE EXCEPTION 'enr:self-authorization'/);
  });
  it("não toca inscrição nem atendimento e não semeia valores", () => {
    expect(sql).not.toMatch(/enr_submit_application|assisted|INSERT INTO public\.enr_parameter_versions\s*\(.*\)\s*VALUES\s*\('/s);
  });
});

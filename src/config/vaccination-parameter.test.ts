import { describe, expect, it } from "vitest";
import { SECTOR_PARAMETERS } from "./sector-parameters";
import { readFileSync } from "node:fs";

const migration = readFileSync("drizzle/migrations/0566_vaccination_configurable_deadline.sql", "utf8");

describe("prazo vacinal configurável sem reescrever fatos", () => {
  it("prazo padrão permanece em 30 dias quando não há versão", () => {
    expect(migration).toContain("coalesce(public.sector_parameter_value('secretaria.prazo-vacinacao'), '30'::jsonb)");
  });
  it("novos registros calculam a data com o parâmetro, sem atualizar eventos anteriores", () => {
    expect(migration).toContain("days := public.secretariat_vaccination_deadline_days()");
    expect(migration).toContain("THEN _declared_on + days END");
    expect(migration).not.toMatch(/UPDATE\s+public\.student_vaccination_status_events/i);
  });
  it("declara consumidor real do prazo em Parâmetros da Secretaria", () => {
    const parameter = SECTOR_PARAMETERS.secretaria?.find((p) => p.key === "secretaria.prazo-vacinacao");
    expect(parameter?.readBy).toBe("secretariat_vaccination_deadline_days");
    expect(parameter?.input).toEqual({ kind: "dias" });
  });
});
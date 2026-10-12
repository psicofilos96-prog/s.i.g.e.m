import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { completedHours, itemSituation, recordProblems } from "./formation-record";

describe("L17 histórico formativo", () => {
  it("inscrição, participação e conclusão são situações distintas", () => {
    expect(itemSituation({ last_event: null, completion: null })).toBe("Inscrição solicitada");
    expect(itemSituation({ last_event: "confirmacao", completion: null })).toBe("Participando");
    expect(itemSituation({ last_event: "conclusao", completion: "conclusao" })).toBe("Concluído");
  });
  it("carga só de conclusões confirmadas", () =>
    expect(completedHours([{ completion: "conclusao", nominal_hours_minutes: 60 }, { completion: null, nominal_hours_minutes: 600 }])).toBe(60));
  it("consulta administrativa exige capacidade e finalidade", () => {
    expect(recordProblems({ own: true, hasCapability: false, purpose: null })).toEqual([]);
    expect(recordProblems({ own: false, hasCapability: false, purpose: "curto" })).toHaveLength(2);
  });
  it("migration 0446: projeção, vínculo de época, trilha de acesso", () => {
    const sql = readFileSync("drizzle/migrations/0446_dev17_formation_record.sql", "utf8");
    expect(sql).toMatch(/consultar-historico-formativo/);
    expect(sql).toMatch(/dev:purpose-required/);
    expect(sql).toMatch(/INSERT INTO public.dev_history_access_log/);
    expect(sql).toMatch(/l.id = e.functional_link_id/);
    expect(sql).toMatch(/FILTER \(WHERE completion = 'conclusao'\)/);
    expect(sql).not.toMatch(/CREATE TABLE public.dev_(person|formation)_(history|record)s?\b/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public.dev_formation_record\(uuid, text\) FROM PUBLIC, anon/);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0277_aud2026_jornada_intervals_staff_reconciliation.sql", "utf8");

describe("AUD2026.2 — normalizações derivadas", () => {
  it("nenhuma tabela derivada é legível por anon", () => {
    expect(sql).not.toMatch(/TO\s+anon/i);
  });
  it("as duas tabelas são append-only por trigger", () => {
    expect(sql).toMatch(/student_school_day_intervals_no_update BEFORE UPDATE OR DELETE/);
    expect(sql).toMatch(/staff_reconciliation_candidates_no_update BEFORE UPDATE OR DELETE/);
  });
  it("jornada só é normalizada quando todas as partes do literal são inequívocas", () => {
    expect(sql).toMatch(/WHERE n = ok/);
  });
  it("conciliação de pessoal nunca grava vínculo, lotação ou atuação", () => {
    expect(sql).not.toMatch(/INSERT INTO public\.(professional_functional_links|professional_postings|institutional_engagements)/);
  });
  it("candidato só existe quando há exatamente uma pessoa", () => {
    expect(sql).toMatch(/CHECK \(\(outcome = 'candidato-unico'\) = \(candidate_person_id IS NOT NULL\)\)/);
  });
});

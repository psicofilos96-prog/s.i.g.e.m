import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const m509 = readFileSync("drizzle/migrations/0509_l39_payroll_import_hardening.sql", "utf8");
const m510 = readFileSync("drizzle/migrations/0510_l39_switch_revoke_sandbox.sql", "utf8");
const script = readFileSync("scripts/lote38-payroll-import.py", "utf8");

describe("L39 — carga da folha só pelo executor técnico", () => {
  it("revoga escrita direta de todos os papéis, inclusive service_role", () => {
    expect(m509).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public\.payroll_functional_registrations FROM PUBLIC, anon, authenticated, service_role/);
    expect(m509).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public\.payroll_registration_person_links FROM PUBLIC, anon, authenticated, service_role/);
    expect(m510).toMatch(/REVOKE ALL ON public\.payroll_import_switch_events FROM PUBLIC, anon, authenticated, service_role/);
  });
  it("carregador sem EXECUTE para papéis de aplicação e com switch no banco", () => {
    expect(m509).toMatch(/REVOKE ALL ON FUNCTION public\.technical_import_payroll_functional_registrations\(text,jsonb\) FROM PUBLIC, anon, authenticated, service_role/);
    expect(m509).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.technical_import_payroll_functional_registrations/);
    expect(m509).toMatch(/IF NOT public\.payroll_import_enabled\(\) THEN RAISE EXCEPTION 'technical:payroll-import-disabled'/);
  });
  it("matrícula só é chave no formato <dígitos>-<DV>", () => {
    expect(m509).toMatch(/'\^\[0-9\]\+-\[0-9\]\$'/);
    expect(m509).not.toMatch(/regexp_replace\([^)]*\[\^0-9\]/);
  });
  it("uma matrícula por período de referência, em qualquer arquivo", () => {
    expect(m509).toMatch(/UNIQUE INDEX IF NOT EXISTS pfr_period_registration_uq ON public\.payroll_functional_registrations \(reference_period, registration_norm\)/);
  });
  it("idempotência compara o payload antes de devolver ja-registrado", () => {
    expect(m509).toMatch(/RAISE EXCEPTION 'idempotencia-payload-divergente'/);
  });
  it("nome e nascimento só para consultar-registro-funcional", () => {
    const policy = m509.slice(m509.indexOf('CREATE POLICY "pfr leitura registro funcional"'));
    expect(policy.split(";")[0]).not.toContain("consultar-quadro-profissional-da-rede");
  });
  it("o script não grava e não usa credencial de serviço", () => {
    expect(script).not.toMatch(/SERVICE_ROLE|urlopen|\/rest\/v1/);
  });
});

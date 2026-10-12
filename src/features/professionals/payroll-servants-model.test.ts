import { describe, expect, it } from "vitest";
import { filterPayrollServants, groupPayrollServants, payrollSummary, type PayrollRegRow } from "./payroll-servants-model";

const r = (raw: string, key: string, name: string, birth: string | null, cargo = "PROF", hours: number | null = 100): PayrollRegRow => ({
  registration_id: raw, servant_key: key, reference_period: "2026-08", registration_raw: raw, full_name: name, birth_date: birth,
  admission_date: "2010-01-01", monthly_hours: hours, weekly_workload_text: null, cargo_code: cargo, cargo_label: cargo, linked_person_id: null,
});

describe("L41 folha agrupada por servidor", () => {
  it("dupla matrícula: mesmo nome+nascimento = 1 servidor com 2 vínculos, cada um com cargo e jornada próprios", () => {
    const s = groupPayrollServants([r("200-1", "k1", "ANA", "1980-01-01", "PROF I", 100), r("100-2", "k1", "ANA", "1980-01-01", "PROF II", 200)]);
    expect(s).toHaveLength(1);
    expect(s[0]!.registrations.map((x) => [x.registration_raw, x.cargo_label, x.monthly_hours])).toEqual([["100-2", "PROF II", 200], ["200-1", "PROF I", 100]]);
  });
  it("homônimos com nascimento diferente nunca se fundem", () => {
    const s = groupPayrollServants([r("1-1", "k1", "ANA", "1980-01-01"), r("2-2", "k2", "ANA", "1990-01-01")]);
    expect(s).toHaveLength(2);
  });
  it("nenhuma matrícula é eliminada e contagens fecham", () => {
    const s = groupPayrollServants([r("1-1", "a", "A", "1980-01-01"), r("2-2", "a", "A", "1980-01-01"), r("3-3", "b", "B", null)]);
    expect(payrollSummary(s)).toEqual({ vinculos: 3, servidores: 2, comMaisDeUmVinculo: 1, ligadosAPessoa: 0 });
  });
  it("filtro por matrícula e só múltiplos", () => {
    const s = groupPayrollServants([r("1-1", "a", "A", "x"), r("2-2", "a", "A", "x"), r("3-3", "b", "B", "y")]);
    expect(filterPayrollServants(s, "3-3", false).map((x) => x.key)).toEqual(["b"]);
    expect(filterPayrollServants(s, "", true).map((x) => x.key)).toEqual(["a"]);
  });
});

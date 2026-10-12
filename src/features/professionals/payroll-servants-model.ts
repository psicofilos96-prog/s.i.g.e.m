/** L41 — agrupa vínculos da folha por servidor (chave do banco: nome+nascimento). Cada matrícula fica com seus próprios dados; nada de salário. */
export type PayrollRegRow = {
  registration_id: string;
  servant_key: string;
  reference_period: string;
  registration_raw: string;
  full_name: string;
  birth_date: string | null;
  admission_date: string | null;
  monthly_hours: number | null;
  weekly_workload_text: string | null;
  cargo_code: string | null;
  cargo_label: string | null;
  linked_person_id: string | null;
};
export type PayrollServant = { key: string; name: string; birthDate: string | null; linkedPersonIds: string[]; registrations: PayrollRegRow[] };

export function groupPayrollServants(rows: readonly PayrollRegRow[]): PayrollServant[] {
  const m = new Map<string, PayrollServant>();
  for (const r of rows) {
    let s = m.get(r.servant_key);
    if (!s) { s = { key: r.servant_key, name: r.full_name, birthDate: r.birth_date, linkedPersonIds: [], registrations: [] }; m.set(r.servant_key, s); }
    s.registrations.push(r);
    if (r.linked_person_id && !s.linkedPersonIds.includes(r.linked_person_id)) s.linkedPersonIds.push(r.linked_person_id);
  }
  for (const s of m.values()) s.registrations.sort((a, b) => a.registration_raw.localeCompare(b.registration_raw));
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.key.localeCompare(b.key));
}

export function payrollSummary(servants: readonly PayrollServant[]) {
  const vinculos = servants.reduce((n, s) => n + s.registrations.length, 0);
  return {
    vinculos,
    servidores: servants.length,
    comMaisDeUmVinculo: servants.filter((s) => s.registrations.length > 1).length,
    ligadosAPessoa: servants.filter((s) => s.linkedPersonIds.length > 0).length,
  };
}

export function filterPayrollServants(servants: readonly PayrollServant[], text: string, onlyMultiple: boolean) {
  const t = text.trim().toLocaleUpperCase("pt-BR");
  return servants.filter((s) => (!onlyMultiple || s.registrations.length > 1)
    && (!t || s.name.toLocaleUpperCase("pt-BR").includes(t) || s.registrations.some((r) => r.registration_raw.includes(t))));
}

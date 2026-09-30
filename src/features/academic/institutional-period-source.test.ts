import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  queried: [] as string[],
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      database.queried.push(table);
      let rows = database.rows[table] ?? [];
      const query = {
        select() { return query; },
        eq(key: string, value: unknown) { rows = rows.filter((row) => row[key] === value); return query; },
        lte(key: string, value: string) { rows = rows.filter((row) => String(row[key]) <= value); return query; },
        in(key: string, values: unknown[]) { rows = rows.filter((row) => values.includes(row[key])); return query; },
        order(key: string, options?: { ascending?: boolean }) {
          rows = [...rows].sort((a, b) => (Number(a[key]) - Number(b[key])) * (options?.ascending === false ? -1 : 1));
          return query;
        },
        maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
        then(resolve: (result: { data: Record<string, unknown>[]; error: null }) => void) {
          resolve({ data: rows, error: null });
        },
      };
      return query;
    },
  },
}));

import { loadOfficialTimelineForClass } from "./institutional-period-source";

beforeEach(() => { database.rows = {}; database.queried = []; });

describe("B2.4 — leitura institucional da organização da turma", () => {
  it("falha fechada sem associação; não consulta todos os períodos do ano", async () => {
    const result = await loadOfficialTimelineForClass("turma-1", "ano-1", "2026-06-01");
    expect(result.kind).toBe("unavailable");
    expect(database.queried).toEqual(["institutional_class_period_organization_versions"]);
  });

  it("não reativa associação anterior se a última já terminou", async () => {
    database.rows["institutional_class_period_organization_versions"] = [
      { class_id: "turma-1", organization_id: "org-1", version: 1, valid_from: "2025-01-01", valid_until: null },
      { class_id: "turma-1", organization_id: "org-2", version: 2, valid_from: "2026-01-01", valid_until: "2026-05-31" },
    ];
    const result = await loadOfficialTimelineForClass("turma-1", "ano-1", "2026-06-01");
    expect(result.kind).toBe("unavailable");
    expect(database.queried).toEqual(["institutional_class_period_organization_versions"]);
  });

  it("usa apenas os períodos oficiais da organização explicitamente vinculada", async () => {
    database.rows["institutional_class_period_organization_versions"] = [
      { class_id: "turma-1", organization_id: "org-1", version: 1, valid_from: "2025-01-01", valid_until: null },
    ];
    database.rows["institutional_period_organizations"] = [{ id: "org-1", academic_year_id: "ano-1" }];
    database.rows["institutional_academic_year_versions"] = [
      { academic_year_id: "ano-1", official_name: "Ano oficial", starts_on: "2026-01-01", ends_on: "2026-12-31", is_active: true, version: 1, valid_from: "2025-01-01" },
    ];
    database.rows["institutional_period_organization_versions"] = [
      { organization_id: "org-1", official_name: "Organização oficial", is_active: true, version: 1, valid_from: "2025-01-01" },
    ];
    database.rows["institutional_academic_periods"] = [
      { id: "p1", academic_year_id: "ano-1", period_organization_id: "org-1" },
      { id: "p2", academic_year_id: "ano-1", period_organization_id: "org-2" },
    ];
    database.rows["institutional_academic_period_versions"] = [
      { period_id: "p1", official_name: "Período oficial", starts_on: "2026-02-01", ends_on: "2026-05-31", is_active: true, version: 1, valid_from: "2025-01-01" },
      { period_id: "p2", official_name: "Período de outra organização", starts_on: "2026-02-01", ends_on: "2026-05-31", is_active: true, version: 1, valid_from: "2025-01-01" },
    ];
    const result = await loadOfficialTimelineForClass("turma-1", "ano-1", "2026-06-01");
    expect(result.kind).toBe("ready");
    if (result.kind === "ready") {
      expect(result.organization.id).toBe("org-1");
      expect(result.periods.map((period) => period.id)).toEqual(["p1"]);
    }
  });
});

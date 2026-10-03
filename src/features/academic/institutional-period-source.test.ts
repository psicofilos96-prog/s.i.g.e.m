import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  links: [] as Record<string, unknown>[],
  linksByDate: null as Record<string, Record<string, unknown>[]> | null,
  linkError: null as { message: string } | null,
  rpcArgs: null as Record<string, unknown> | null,
  queried: [] as string[],
  knownAts: [] as string[],
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc(name: string, args: Record<string, unknown>) {
      database.queried.push(name);
      database.rpcArgs = args;
      return Promise.resolve({ data: database.linksByDate?.[String(args["_valid_on"])] ?? database.links, error: database.linkError });
    },
    from(table: string) {
      database.queried.push(table);
      let rows = database.rows[table] ?? [];
      const query = {
        select() { return query; },
        eq(key: string, value: unknown) { rows = rows.filter((row) => row[key] === value); return query; },
        lte(key: string, value: string) { if (key === "created_at") database.knownAts.push(value); rows = rows.filter((row) => row[key] !== undefined && String(row[key]) <= value); return query; },
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

beforeEach(() => {
  database.rows = {}; database.links = []; database.linksByDate = null; database.linkError = null;
  database.rpcArgs = null; database.queried = []; database.knownAts = [];
});

describe("B2.5.3 — leitura institucional da organização da turma", () => {
  it("falha fechada sem associação; não consulta todos os períodos do ano", async () => {
    const result = await loadOfficialTimelineForClass("turma-1", "ano-1", "2026-06-01");
    expect(result.kind).toBe("unavailable");
    expect(database.queried).toEqual(["class_period_organization_at"]);
  });

  it("repassa validOn e knownAt ao resolvedor, sem escolher versão local", async () => {
    const result = await loadOfficialTimelineForClass("turma-1", "ano-1", "2026-06-01", "2026-07-01T12:00:00Z");
    expect(result.kind).toBe("unavailable");
    expect(database.rpcArgs).toEqual({
      _class_id: "turma-1", _valid_on: "2026-06-01", _known_at: "2026-07-01T12:00:00Z",
    });
    expect(database.queried).toEqual(["class_period_organization_at"]);
  });

  it("usa apenas os períodos oficiais da organização explicitamente vinculada", async () => {
    database.links = [{ id: "assoc-org-1", version: 1, organization_id: "org-1" }];
    database.rows["institutional_period_organizations"] = [{ created_at: "2025-01-01T00:00:00Z", id: "org-1", academic_year_id: "ano-1" }];
    database.rows["institutional_academic_year_versions"] = [
      { created_at: "2025-01-01T00:00:00Z", academic_year_id: "ano-1", official_name: "Ano oficial", starts_on: "2026-01-01", ends_on: "2026-12-31", is_active: true, version: 1, valid_from: "2025-01-01" },
    ];
    database.rows["institutional_period_organization_versions"] = [
      { created_at: "2025-01-01T00:00:00Z", organization_id: "org-1", official_name: "Organização oficial", is_active: true, version: 1, valid_from: "2025-01-01" },
    ];
    database.rows["institutional_academic_periods"] = [
      { created_at: "2025-01-01T00:00:00Z", id: "p1", academic_year_id: "ano-1", period_organization_id: "org-1" },
      { created_at: "2025-01-01T00:00:00Z", id: "p2", academic_year_id: "ano-1", period_organization_id: "org-2" },
    ];
    database.rows["institutional_academic_period_versions"] = [
      { created_at: "2025-01-01T00:00:00Z", period_id: "p1", official_name: "Período oficial", starts_on: "2026-02-01", ends_on: "2026-05-31", is_active: true, version: 1, valid_from: "2025-01-01" },
      { created_at: "2025-01-01T00:00:00Z", period_id: "p2", official_name: "Período de outra organização", starts_on: "2026-02-01", ends_on: "2026-05-31", is_active: true, version: 1, valid_from: "2025-01-01" },
    ];
    const result = await loadOfficialTimelineForClass("turma-1", "ano-1", "2026-06-01");
    expect(result.kind).toBe("ready");
    if (result.kind === "ready") {
      expect(result.organization.id).toBe("org-1");
      expect(result.periods.map((period) => period.id)).toEqual(["p1"]);
      // B4.6.2b.3 — proveniência: versões lidas + valid_on + um único known_at em todas as leituras.
      expect(result.provenance).toMatchObject({
        kind: "institucional-b2.4", classAssociation: { id: "assoc-1", version: 1 }, validOn: "2026-06-01",
        academicYear: { id: "ano-1", version: 1 }, organization: { id: "org-1", version: 1 },
        periods: [{ id: "p1", version: 1 }],
      });
      expect(new Set([database.rpcArgs?.["_known_at"], ...database.knownAts])).toEqual(new Set([result.provenance.knownAt]));
      expect(database.knownAts.length).toBe(5);
    }
  });

  it("a data acadêmica pode resolver organizações e períodos oficiais diferentes", async () => {
    database.linksByDate = {
      "2026-03-01": [{ id: "assoc-org-a", version: 1, organization_id: "org-a" }],
      "2026-07-01": [{ id: "assoc-org-b", version: 1, organization_id: "org-b" }],
    };
    database.rows["institutional_period_organizations"] = [
      { created_at: "2025-01-01T00:00:00Z", id: "org-a", academic_year_id: "ano-1" }, { created_at: "2025-01-01T00:00:00Z", id: "org-b", academic_year_id: "ano-1" },
    ];
    database.rows["institutional_academic_year_versions"] = [
      { created_at: "2025-01-01T00:00:00Z", academic_year_id: "ano-1", official_name: "Ano", starts_on: "2026-01-01", ends_on: "2026-12-31", is_active: true, version: 1, valid_from: "2026-01-01" },
    ];
    database.rows["institutional_period_organization_versions"] = [
      { created_at: "2025-01-01T00:00:00Z", organization_id: "org-a", official_name: "A", is_active: true, version: 1, valid_from: "2026-01-01" },
      { created_at: "2025-01-01T00:00:00Z", organization_id: "org-b", official_name: "B", is_active: true, version: 1, valid_from: "2026-01-01" },
    ];
    database.rows["institutional_academic_periods"] = [
      { created_at: "2025-01-01T00:00:00Z", id: "p-a", academic_year_id: "ano-1", period_organization_id: "org-a" },
      { created_at: "2025-01-01T00:00:00Z", id: "p-b", academic_year_id: "ano-1", period_organization_id: "org-b" },
    ];
    database.rows["institutional_academic_period_versions"] = [
      { created_at: "2025-01-01T00:00:00Z", period_id: "p-a", official_name: "A", starts_on: "2026-01-01", ends_on: "2026-06-30", is_active: true, version: 1, valid_from: "2026-01-01" },
      { created_at: "2025-01-01T00:00:00Z", period_id: "p-b", official_name: "B", starts_on: "2026-07-01", ends_on: "2026-12-31", is_active: true, version: 1, valid_from: "2026-01-01" },
    ];
    const a = await loadOfficialTimelineForClass("turma-1", "ano-1", "2026-03-01");
    const b = await loadOfficialTimelineForClass("turma-1", "ano-1", "2026-07-01");
    expect(a.kind === "ready" && [a.organization.id, a.periods.map((p) => p.id)]).toEqual(["org-a", ["p-a"]]);
    expect(b.kind === "ready" && [b.organization.id, b.periods.map((p) => p.id)]).toEqual(["org-b", ["p-b"]]);
    expect(database.rpcArgs).toEqual({ _class_id: "turma-1", _valid_on: "2026-07-01", _known_at: expect.any(String) });
  });

  it("exige data explícita e falha fechado em ambiguidade", async () => {
    expect((await loadOfficialTimelineForClass("turma-1", "ano-1", undefined)).kind).toBe("unavailable");
    expect(database.queried).toEqual([]);
    database.linkError = { message: "class-period:ambiguous-temporal-state" };
    expect((await loadOfficialTimelineForClass("turma-1", "ano-1", "2026-06-01")).kind).toBe("unavailable");
    expect(database.rpcArgs).toEqual({ _class_id: "turma-1", _valid_on: "2026-06-01", _known_at: expect.any(String) });
    expect(database.queried).toEqual(["class_period_organization_at"]);
    database.linkError = null;
    database.links = [{ id: "assoc-org-1", version: 1, organization_id: "org-1" }, { id: "assoc-org-2", version: 1, organization_id: "org-2" }];
    database.queried = [];
    expect((await loadOfficialTimelineForClass("turma-1", "ano-1", "2026-06-01")).kind).toBe("unavailable");
    expect(database.queried).toEqual(["class_period_organization_at"]);
  });

  it("B4.6.2b.3.1 — data/instante inválidos falham antes de qualquer RPC", async () => {
    expect((await loadOfficialTimelineForClass("turma-1", "ano-1", "2026-02-30")).kind).toBe("unavailable");
    expect((await loadOfficialTimelineForClass("turma-1", "ano-1", "2026-06-01", "2026-02-30T00:00:00Z")).kind).toBe("unavailable");
    expect((await loadOfficialTimelineForClass("turma-1", "ano-1", "2026-06-01", "2026-06-01T12:00:00")).kind).toBe("unavailable");
    expect(database.queried).toEqual([]);
  });

  const seed = (extraPeriodCreatedAt: string) => {
    database.links = [{ id: "assoc-1", version: 3, organization_id: "org-1" }];
    database.rows["institutional_period_organizations"] = [{ created_at: "2025-01-01T00:00:00Z", id: "org-1", academic_year_id: "ano-1" }];
    database.rows["institutional_academic_year_versions"] = [
      { created_at: "2025-01-01T00:00:00Z", academic_year_id: "ano-1", official_name: "Ano", starts_on: "2026-01-01", ends_on: "2026-12-31", is_active: true, version: 1, valid_from: "2025-01-01" },
    ];
    database.rows["institutional_period_organization_versions"] = [
      { created_at: "2025-01-01T00:00:00Z", organization_id: "org-1", official_name: "Org", is_active: true, version: 1, valid_from: "2025-01-01" },
    ];
    database.rows["institutional_academic_periods"] = [
      { created_at: "2025-01-01T00:00:00Z", id: "p1", academic_year_id: "ano-1", period_organization_id: "org-1" },
      { created_at: extraPeriodCreatedAt, id: "p-futuro", academic_year_id: "ano-1", period_organization_id: "org-1" },
    ];
    database.rows["institutional_academic_period_versions"] = [
      { created_at: "2025-01-01T00:00:00Z", period_id: "p1", official_name: "P1", starts_on: "2026-02-01", ends_on: "2026-05-31", is_active: true, version: 1, valid_from: "2025-01-01" },
      { created_at: extraPeriodCreatedAt, period_id: "p-futuro", official_name: "PF", starts_on: "2026-06-01", ends_on: "2026-08-31", is_active: true, version: 1, valid_from: "2025-01-01" },
    ];
  };

  it("identidade de período criada depois do snapshot não entra nem torna o resultado indisponível", async () => {
    seed("2026-09-01T00:00:00Z");
    const r = await loadOfficialTimelineForClass("turma-1", "ano-1", "2026-04-01", "2026-07-01T00:00:00Z");
    expect(r.kind).toBe("ready");
    if (r.kind === "ready") {
      expect(r.periods.map((p) => p.id)).toEqual(["p1"]);
      expect(r.provenance.classAssociation).toEqual({ id: "assoc-1", version: 3 });
      expect(r.provenance.knownAt).toBe("2026-07-01T00:00:00Z");
    }
  });

  it("organização criada depois do snapshot não é lida", async () => {
    seed("2025-01-01T00:00:00Z");
    database.rows["institutional_period_organizations"]![0]!["created_at"] = "2026-09-01T00:00:00Z";
    expect((await loadOfficialTimelineForClass("turma-1", "ano-1", "2026-04-01", "2026-07-01T00:00:00Z")).kind).toBe("unavailable");
  });

  it("associação sem id/versão não fabrica referência: indisponível", async () => {
    seed("2025-01-01T00:00:00Z");
    database.links = [{ organization_id: "org-1" }];
    const r = await loadOfficialTimelineForClass("turma-1", "ano-1", "2026-04-01", "2026-07-01T00:00:00Z");
    expect(r).toEqual({ kind: "unavailable", reason: "Associação de períodos da turma sem identificação de versão." });
  });
});

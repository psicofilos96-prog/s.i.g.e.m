import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildSchoolProposal, importSelectedSchools, SCHOOL_STAGING, unitKindLabel, writerArgs, type SchoolStaging } from "./school-source-import";

const rows = SCHOOL_STAGING.escolas;

describe("staging EducaCenso 2026 — unidades escolares", () => {
  it("fonte e contagens auditadas", () => {
    expect(SCHOOL_STAGING.fonte.sha256).toBe("fd2e288bf598fcedce527470a54601eabf96d46a19e85ce03672254954a3d494");
    expect(SCHOOL_STAGING.valid_from).toBe("2026-08-31");
    expect(rows).toHaveLength(55);
    expect(rows.filter((r) => r.administrative_dependency === "municipal")).toHaveLength(40);
    expect(rows.filter((r) => r.administrative_dependency === "privada" && r.partnership_public_authority === "Municipal")).toHaveLength(15);
    expect(rows.filter((r) => r.location_kind === "urbana")).toHaveLength(41);
    expect(rows.filter((r) => r.location_kind === "rural")).toHaveLength(14);
    expect(new Set(rows.map((r) => r.inep)).size).toBe(55);
    expect(rows.every((r) => r.active && /^\d{8}$/.test(r.inep) && r.school_id === `inep-${r.inep}`)).toBe(true);
    expect(new Set(rows.map((r) => r.official_name)).size).toBe(55);
  });
  it("sem dado pessoal nem campo inferido", () => {
    const raw = readFileSync("docs/data/educacenso-2026-school-staging.json", "utf8");
    expect(raw).not.toMatch(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
    expect(raw).not.toMatch(/cpf|nascimento|aluno|docente|gestor/i);
    const keys = new Set(rows.flatMap((r) => Object.keys(r)));
    expect([...keys].sort()).toEqual(["active", "address", "administrative_dependency", "classroom_count", "district", "hard_access", "inep", "institutional_email", "location_kind", "network_code", "official_name", "own_building", "partnership_public_authority", "phone", "private_school_category", "school_id", "source_line", "source_sheet"]);
    for (const r of rows as unknown as Record<string, unknown>[])
      expect([r.address, r.district, r.network_code, r.own_building, r.hard_access, r.classroom_count]).toEqual(Array(6).fill(null));
  });
  it("municipal não tem categoria privada; conveniada distinta na apresentação", () => {
    expect(rows.filter((r) => r.administrative_dependency === "municipal").every((r) => r.private_school_category === null && r.partnership_public_authority === null)).toBe(true);
    expect(unitKindLabel("municipal", null)).toBe("unidade municipal");
    expect(unitKindLabel("privada", "Municipal")).toMatch(/conveniada/);
  });
  it("writer recebe classificação como na fonte, sem codigo-rede e com proveniência", () => {
    const p = buildSchoolProposal(SCHOOL_STAGING, new Set());
    const a = writerArgs(p.find((r) => r.inep === "33100012")!, { act: "", validFrom: "2026-08-31" }, SCHOOL_STAGING);
    expect(a).toMatchObject({ _school: "inep-33100012", _network_code: null, _administrative_dependency: "privada", _private_school_category: "Confessional", _partnership_public_authority: "Municipal", _valid_from: "2026-08-31", _address: null });
    expect(String(a._act_ref)).toContain(SCHOOL_STAGING.fonte.sha256);
  });
  it("já cadastrado/duplicado não é regravado; falha parcial preservada", async () => {
    const src: SchoolStaging = { ...SCHOOL_STAGING, escolas: [rows[0]!, rows[0]!, rows[1]!, rows[2]!] };
    const p = buildSchoolProposal(src, new Set([rows[1]!.inep]));
    expect(p.map((r) => r.status)).toEqual(["novo", "duplicado-na-fonte", "ja-cadastrado", "novo"]);
    let n = 0;
    const out = await importSelectedSchools(p, { act: "", validFrom: "2026-08-31" }, async () => (++n === 2 ? { data: null, error: { message: "capability: negada" } } : { data: "v", error: null }), src);
    expect(out.map((o) => o.ok)).toEqual([true, false, false, false]);
    expect(n).toBe(2);
    await expect(importSelectedSchools(p, { act: "", validFrom: "" }, async () => ({ data: null, error: null }))).rejects.toThrow();
  });
});

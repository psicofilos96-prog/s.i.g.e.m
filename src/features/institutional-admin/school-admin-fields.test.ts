import { describe, expect, it } from "vitest";
import { adminCoherenceWarnings, adminFieldArgs, resultingAdmin } from "./school-admin-fields";

const prev = { administrative_dependency: "privada", private_school_category: "Confessional", partnership_public_authority: "Municipal" };

describe("campos administrativos: herdar × alterar × limpar", () => {
  it("omitido/manter envia tudo nulo e nenhum clear (o banco herda)", () => {
    expect(adminFieldArgs({})).toEqual({ ok: true, args: { _administrative_dependency: null, _private_school_category: null, _partnership_public_authority: null, _clear_administrative: null } });
  });
  it("alterar envia o valor aparado", () => {
    const r = adminFieldArgs({ private_school_category: { mode: "alterar", value: " Filantropica " } });
    expect(r.ok && r.args._private_school_category).toBe("Filantropica");
  });
  it("alterar com vazio acidental é recusado, nunca vira limpeza", () => {
    expect(adminFieldArgs({ administrative_dependency: { mode: "alterar", value: "  " } })).toEqual({ ok: false, field: "administrative_dependency" });
  });
  it("limpar exige intenção explícita e vai em _clear_administrative", () => {
    const r = adminFieldArgs({ administrative_dependency: { mode: "alterar", value: "municipal" }, private_school_category: { mode: "limpar" }, partnership_public_authority: { mode: "limpar" } });
    expect(r.ok && r.args).toEqual({ _administrative_dependency: "municipal", _private_school_category: null, _partnership_public_authority: null, _clear_administrative: ["private_school_category", "partnership_public_authority"] });
  });
  it("avisa incoerência ao mudar a dependência, sem inventar valores", () => {
    const next = resultingAdmin(prev, { administrative_dependency: { mode: "alterar", value: "municipal" } });
    expect(next).toEqual({ ...prev, administrative_dependency: "municipal" });
    expect(adminCoherenceWarnings(next)).toHaveLength(2);
    expect(adminCoherenceWarnings(resultingAdmin(prev, { administrative_dependency: { mode: "alterar", value: "municipal" }, private_school_category: { mode: "limpar" }, partnership_public_authority: { mode: "limpar" } }))).toEqual([]);
  });
});

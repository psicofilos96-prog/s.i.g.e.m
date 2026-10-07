import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { actorLabel, exportRows, filterInventory, groupDetail, isInstitutionalPrincipal, originLabel, type InventoryRow } from "./access-inventory";

const row = (o: Partial<InventoryRow>): InventoryRow => ({ user_id: "u", login: "x@sigem.itap.gov.br", account_kind: "setorial", station_code: "secretaria_escolar", scope_kind: "school", school_id: "A", school_name: "Escola A", inep: "1", revoked: false, banned: false, last_sign_in_at: null, created_at: null, origin: null, person_name: null, ...o });

describe("NACCESS.1", () => {
  it("principal institucional nunca é rotulado como pessoa", () => {
    expect(isInstitutionalPrincipal("setorial")).toBe(true);
    expect(isInstitutionalPrincipal("orgao")).toBe(true);
    expect(isInstitutionalPrincipal("humano")).toBe(false);
    expect(actorLabel("setorial")).toMatch(/não é pessoa/);
    expect(actorLabel("humano")).toBe("Pessoa natural");
  });
  it("filtro por escola separa A de B", () => {
    const rows = [row({ user_id: "a", school_id: "A" }), row({ user_id: "b", school_id: "B", school_name: "Escola B" })];
    expect(filterInventory(rows, { school: "A" }).map((r) => r.user_id)).toEqual(["a"]);
    expect(filterInventory(rows, { text: "escola b" }).map((r) => r.user_id)).toEqual(["b"]);
  });
  it("exportação nunca leva senha, hash ou token", () => {
    const out = JSON.stringify(exportRows([row({})]));
    expect(out).not.toMatch(/password|senha"|hash|token|secret/i);
    expect(out).toContain("Principal institucional");
  });
  it("origem e histórico agrupados", () => {
    expect(originLabel("estacao:secretaria_escolar@v2")).toBe("Regras da estação Secretaria Escolar (versão 2)");
    expect(originLabel("politica:v3 · atuacao:professor")).toBe("Política homologada v3 · atuação professor");
    const g = groupDetail([
      { entry_kind: "capacidade", capability_id: "b", origin: "estacao:ciece@v1", scope: "rede", school_id: null, on_date: null, detail: null },
      { entry_kind: "capacidade", capability_id: "a", origin: "estacao:ciece@v1", scope: "rede", school_id: null, on_date: null, detail: null },
      { entry_kind: "revogacao", capability_id: null, origin: "estacao:ciece", scope: null, school_id: null, on_date: "2026-01-01", detail: "x" },
      { entry_kind: "provisionamento", capability_id: null, origin: "op", scope: null, school_id: null, on_date: "2026-05-01", detail: "ok" },
    ]);
    expect(g.capabilities).toHaveLength(1);
    expect(g.capabilities[0]!.list.map((x) => x.capability_id)).toEqual(["a", "b"]);
    expect(g.history.map((h) => h.entry_kind)).toEqual(["provisionamento", "revogacao"]);
  });
  it("detalhe é só leitura, exige titular e não toca política", () => {
    const sql = readFileSync("drizzle/migrations/0239_naccess1_account_detail.sql", "utf8");
    expect(sql).toMatch(/access_center_holder\(\)/);
    expect(sql).toMatch(/REVOKE ALL .* FROM PUBLIC, anon/);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
  });
});

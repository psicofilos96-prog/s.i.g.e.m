import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { compare, coverage, mealMessage, shown, type Forecast, type Menu, type Service } from "./meals-model";

const sql = readFileSync("drizzle/migrations/0074_school_meals_module.sql", "utf8");
const body = (n: string) => { const i = sql.indexOf(`FUNCTION public.${n}(`); return sql.slice(i, sql.indexOf("$fn$;", i)); };
const menu = (o: Partial<Menu> = {}): Menu => ({ id: "m1", logical_id: "L", version: 1, event_kind: "registro", school_id: "e", service_group_value_id: null, starts_on: "2026-03-01", ends_on: "2026-03-31",
  entries: [{ date: "2026-03-02", slot: "almoco", preparations: ["arroz"] }, { date: "2026-03-03", slot: "almoco", preparations: ["feijao"] }], reason: null, recorded_at: "", ...o });
const fc = (o: Partial<Forecast> = {}): Forecast => ({ id: "f", logical_id: "F", version: 1, event_kind: "registro", served_on: "2026-03-02", meal_slot_value_id: "almoco", forecast_count: 100, basis: "declarada", ...o });
const sv = (o: Partial<Service> = {}): Service => ({ id: "s", logical_id: "S", version: 1, event_kind: "registro", served_on: "2026-03-02", meal_slot_value_id: "almoco", offered_count: null, served_count: 87, source_note: null, ...o });

describe("alimentação — projeções", () => {
  it("escola sem cardápio: cobertura sem base (null), nunca 0%", () => {
    expect(coverage(compare([], [], [], null))).toEqual({ plannedSlots: null, withService: null, ratio: null });
  });
  it("previsão ≠ servido: diferença só com os dois lados; ausência é não informado", () => {
    const rows = compare([menu()], [fc()], [sv()], null);
    expect(rows[0]).toMatchObject({ forecast: 100, served: 87, difference: -13, offered: null });
    expect(rows[1]).toMatchObject({ forecast: null, served: null, difference: null });
    expect(shown(rows[1]!.served)).toBe("não informado");
    expect(coverage(rows)).toMatchObject({ plannedSlots: 2, withService: 1 });
  });
  it("calendário alterado: dia que passou a não letivo vira divergência; sem calendário, nada é presumido", () => {
    const before = compare([menu()], [], [], new Map([["2026-03-02", "letivo" as const]]));
    const after = compare([menu()], [], [], new Map([["2026-03-02", "nao-letivo" as const]]));
    expect(before[0]!.divergence).toBeNull();
    expect(after[0]!.divergence).toMatch(/não letivo/);
    expect(before[1]!.calendar).toBe("indeterminado");
    expect(compare([menu()], [], [], null)[0]!.calendar).toBeNull();
  });
  it("versionamento: revogado não entra; execução sem cardápio é sinalizada", () => {
    expect(compare([menu({ event_kind: "revogacao" })], [], [], null)).toEqual([]);
    expect(compare([], [], [sv()], null)[0]!.divergence).toMatch(/sem cardápio/);
  });
  it("mensagens não vazam texto técnico", () => {
    expect(mealMessage("permission denied for table meal_menu_versions")).toBe("Não foi possível concluir. Tente novamente.");
  });
});

describe("alimentação — banco é a autoridade", () => {
  it("tabelas sem acesso direto, append-only, sem anon", () => {
    for (const t of ["meal_menu_versions", "meal_forecasts", "meal_service_records", "dietary_restrictions"]) expect(sql).toContain(`'${t}'`);
    expect(sql).toContain("REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("EXECUTE FUNCTION public.import_append_only()");
    expect(sql).not.toMatch(/TO anon/);
  });
  it("acesso entre escolas: capability exige a própria escola ou alcance de rede", () => {
    expect(body("meal_grant")).toContain("(c.scope_level = 'escola' AND c.school_id = _school) OR c.scope_level = 'rede'");
    for (const r of ["meal_menus_at", "meal_forecasts_at", "meal_services_at"]) expect(body(r)).toContain("meal_grant('consultar-alimentacao-escolar', _school)");
  });
  it("restrição sensível: capability própria, sem diagnóstico, consultar alimentação não basta", () => {
    expect(body("dietary_restrictions_at")).toContain("meal_grant('consultar-restricao-alimentar', _school)");
    expect(body("dietary_restrictions_at")).not.toContain("consultar-alimentacao-escolar");
    const t = sql.slice(sql.indexOf("CREATE TABLE public.dietary_restrictions"), sql.indexOf("DO $$"));
    expect(t).not.toMatch(/diagn|cid|laudo|doenca|alergia_/i);
  });
  it("sem PNAE, nutrição, estoque nem compra; catálogos sem seed", () => {
    const code = sql.replace(/--.*$/gm, "");
    expect(code).not.toMatch(/kcal|caloria|nutri|pnae|estoque|stock|compra|purchase/i);
    expect(sql).not.toMatch(/INSERT INTO public\.attribute_value_definitions/);
    const ts = readFileSync("src/features/school-meals/meals-model.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(ts).not.toMatch(/kcal|caloria|pnae/i);
  });
  it("execução e previsão: duplicidade exige correção; servida no futuro recusada", () => {
    expect(body("record_meal_service")).toContain("meal:duplicate-use-rectification");
    expect(body("record_meal_service")).toContain("meal:service-in-future");
    expect(body("record_meal_forecast")).toContain("meal:duplicate-use-rectification");
  });
});

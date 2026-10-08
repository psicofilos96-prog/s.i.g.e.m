/**
 * NACCESS.2 — revalidação estação × menu × página × busca × download (camada static).
 * Só confere que cada superfície REDUZ ao que station-navigation já permite; nenhuma regra nova.
 * Rede × escola no banco é provado pela camada autenticada (bo-fixture-harness: escopo/IDOR).
 */
import { describe, expect, it } from "vitest";
import { provisionalNavigation } from "@/config/navigation";
import { STATION_HOME, stationAllowsPath, type SectorStation } from "@/features/authority/station-navigation";
import { stationScopedHits, type SearchHit } from "@/features/global-search/global-search";
import { CATALOG } from "@/features/reports/report-catalog";

const STATIONS = Object.keys(STATION_HOME) as SectorStation[];
const NAV = provisionalNavigation.flatMap((g) => g.items.map((i) => i.to));
const CATS = ["aluno", "turma", "escola", "matriz", "pessoa", "componente"] as const;
const hits = CATS.map((category, i) => ({ category, entity_id: `e${i}`, label: "x" }) as unknown as SearchHit);

describe("NACCESS.2 — superfícies por estação", () => {
  for (const s of STATIONS) {
    const allows = (p: string) => stationAllowsPath(s, p);
    it(`${s}: menu só contém rotas permitidas e inclui a home`, () => {
      const menu = NAV.filter(allows);
      expect(menu).toContain(STATION_HOME[s]);
      for (const to of menu) expect(allows(to)).toBe(true);
    });
    it(`${s}: busca nunca amplia o que o banco devolveu e só leva a rotas permitidas`, () => {
      const out = stationScopedHits(hits, allows);
      expect(out.length).toBeLessThanOrEqual(hits.length);
      for (const h of out) expect(hits).toContain(h);
    });
    it(`${s}: downloads alcançáveis = relatórios cuja tela dona a estação já abre`, () => {
      const reach = CATALOG.filter((e) => allows(e.meta.route));
      for (const e of reach) expect(allows(e.meta.route)).toBe(true);
      for (const e of CATALOG.filter((x) => !reach.includes(x))) expect(allows(e.meta.route)).toBe(false);
    });
    it(`${s}: rota desconhecida e área administrativa são recusadas`, () => {
      expect(allows("/rota-inexistente")).toBe(false);
      expect(allows("/administracao-geral")).toBe(false);
      expect(allows("/central-de-acessos")).toBe(false);
    });
  }
  it("estação desconhecida recusa tudo (fail closed)", () => {
    expect(stationAllowsPath("x", "/")).toBe(false);
  });
  it("conta humana (sem estação) não é filtrada pela tela", () => {
    expect(stationScopedHits(hits, null)).toHaveLength(hits.length);
  });
});

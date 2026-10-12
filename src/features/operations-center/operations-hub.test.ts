import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dashboardBySector, operationalMap } from "./operations-hub-model";
import { OPS_EXPORT_CAP, OPS_NOMINAL_CAP, OPS_REPORTS, exportOpsReport, runOpsReport } from "./operations-reports";

const ALL_SQL = ["drizzle/migrations", "supabase/migrations"].flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(`${d}/${f}`, "utf8"))).join("\n");
const PAGE = readFileSync("src/features/operations-center/operations-hub-page.tsx", "utf8");
const REQ = { params: { asOf: "2026-10-12", knownAt: "2026-10-12T12:00:00Z", scope: "rede" } } as never;

describe("Centro de Operações L23 — painel, mapa e relatórios", () => {
  it("16 + 15 + 18 relatórios com fonte, metodologia e unidade; ids únicos", () => {
    const n = (s: string) => OPS_REPORTS.filter((r) => r.sector === s).length;
    expect([n("transporte"), n("infraestrutura"), n("patrimonio")]).toEqual([16, 15, 18]);
    expect(new Set(OPS_REPORTS.map((r) => r.id)).size).toBe(49);
    for (const r of OPS_REPORTS) { expect(r.source.length).toBeGreaterThan(3); expect(r.methodology.length).toBeGreaterThan(10); expect(r.unit).toBeTruthy(); }
  });
  it("fontes de tabela existem nas migrations", () => {
    const tables = new Set(OPS_REPORTS.flatMap((r) => r.source.split(/\s*\+\s*/)).filter((s) => /^ops_[a-z_]+$/.test(s)));
    for (const t of tables) expect(ALL_SQL, t).toMatch(new RegExp(`(TABLE|FUNCTION) (IF NOT EXISTS )?public\\.${t}\\b`));
  });
  it("nominal e exportação exigem capacidade", async () => {
    expect(() => runOpsReport("ops-transporte-equipe", { ...(REQ as object), includeSensitive: true } as never, [], new Set())).toThrow("report:nominal-not-authorized");
    const { def, result } = runOpsReport("ops-transporte-viagens", REQ, [{ escola: "E1", valor: 3 }], new Set());
    await expect(exportOpsReport(def, result, {} as never, "csv", new Set())).rejects.toThrow("report:export-not-authorized");
    expect([OPS_EXPORT_CAP, OPS_NOMINAL_CAP]).toEqual(["exportar-relatorios-de-operacoes", "ler-relatorio-nominal-de-operacoes"]);
  });
  it("painel por setor e mapa restrito", () => {
    const d = dashboardBySector([{ id: "1", sector: "transporte", schoolId: "a", createdAt: "" }, { id: "2", sector: "transporte", schoolId: "a", createdAt: "" }], 500);
    expect(d.sectors[0]).toEqual({ sector: "transporte", requests: 2, schools: 1 });
    expect(operationalMap([{ schoolId: "a", lat: 1, lng: 1, source: "INEP", count: 9 }], null).status).toBe("bloqueado");
    expect(operationalMap([{ schoolId: "a", lat: 1, lng: 1, source: "INEP", count: 1 }, { schoolId: "b", lat: null, lng: null, source: null, count: 9 }], 3).points).toEqual([{ schoolId: "a", lat: 1, lng: 1, count: "suprimido" }]);
  });
  it("tela só lê após sessão e não grava", () => {
    expect(PAGE.indexOf("signed-out")).toBeLessThan(PAGE.indexOf("<Hub"));
    expect(PAGE).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/);
  });
});

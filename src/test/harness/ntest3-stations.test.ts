/**
 * NTEST.3 — Supervisão, Avaliação e Alimentação na suíte institucional.
 * Camada: static (regra pura + código-fonte). Nenhum tipo sintético destas estações existe
 * na política homologada v8, por isso bo_fixture_prepare as recusa (ASSIGNMENT_PENDING);
 * os dados aqui são linhas em memória, descartadas ao fim de cada caso.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { provisionalNavigation } from "@/config/navigation";
import { STATION_HOME, stationAllowsPath } from "@/features/authority/station-navigation";
import { runReport, toCsv, type CellValue } from "@/features/reports/report-engine";
import { REPORTS, SUPERVISAO_ACOMPANHAMENTO, NETWORK_BRANDING } from "@/features/reports/report-registry";
import { REPORTING_REPORTS } from "@/features/school-meals/reporting-model";
import { STATION_REPORTS, MIN_EVOLUTION_EDITIONS } from "@/features/performance/performance-station";
import { SUPERVISION_TOOLS, supervisionHome } from "@/features/school-supervision/supervision-home";
import { STATION_FLOWS } from "./station-flows";

const NAV = provisionalNavigation.flatMap((g) => g.items.map((i) => i.to));
const menuFor = (station: string) => NAV.filter((to) => stationAllowsPath(station, to));
const src = (p: string) => readFileSync(p, "utf8");

const CASES = [
  { station: "supervisao", home: "/supervisao-escolar", allowed: ["/supervisao-escolar", "/unidades"], denied: ["/alunos", "/secretaria", "/ciece", "/alimentacao-escolar", "/avaliacao-desempenho", "/profissionais", "/administracao-geral"] },
  { station: "avaliacao", home: "/avaliacao-desempenho", allowed: ["/avaliacao-desempenho", "/paineis", "/alunos"], denied: ["/secretaria", "/supervisao-escolar", "/alimentacao-escolar", "/profissionais", "/administracao-geral"] },
  { station: "alimentacao", home: "/alimentacao-escolar", allowed: ["/alimentacao-escolar", "/alimentacao-escolar/cozinha", "/unidades"], denied: ["/alunos", "/secretaria", "/supervisao-escolar", "/avaliacao-desempenho", "/profissionais", "/administracao-geral"] },
] as const;

describe("NTEST.3 — menus e rotas", () => {
  for (const c of CASES) {
    it(`${c.station}: home da estação é a rota declarada e alcançável`, () => {
      expect(STATION_HOME[c.station]).toBe(c.home);
      expect(stationAllowsPath(c.station, c.home)).toBe(true);
    });
    it(`${c.station}: menu contém a home e nenhuma rota negada`, () => {
      const m = menuFor(c.station);
      expect(m).toContain(c.home);
      for (const d of c.denied) expect(m, d).not.toContain(d);
    });
    for (const r of c.allowed) it(`${c.station}: permite ${r}`, () => expect(stationAllowsPath(c.station, r)).toBe(true));
    for (const r of c.denied) it(`${c.station}: nega ${r} (deep link)`, () => expect(stationAllowsPath(c.station, r)).toBe(false));
  }
  it("estação desconhecida nega tudo (fail closed)", () => expect(stationAllowsPath("nae-inventado", "/alimentacao-escolar")).toBe(false));
});

describe("NTEST.3 — exports", () => {
  it("relatórios das três áreas estão no registro único", () => {
    const ids = new Set(REPORTS.map((r) => r.id));
    expect(ids.has(SUPERVISAO_ACOMPANHAMENTO.id)).toBe(true);
    for (const d of Object.values(REPORTING_REPORTS)) expect(ids.has(d.id), d.id).toBe(true);
  });
  it("Supervisão: coluna sensível (responsável) sai por padrão; CSV neutraliza fórmula", () => {
    const rows: Record<string, CellValue>[] = [{ school: "=HYPERLINK(1)", occurredOn: "2026-10-01", modality: "visita", subject: "s", referral: null, responsible: "Função X", returnOn: null, state: "aberto", version: 1, visibleToSchool: "sim", recordedAt: "t" }];
    const res = runReport(SUPERVISAO_ACOMPANHAMENTO, { params: { school: "E1" } }, rows);
    expect(res.columns.some((c) => c.id === "responsible")).toBe(false);
    const csv = toCsv(res, NETWORK_BRANDING);
    expect(csv).not.toMatch(/(^|[;,"])=HYPERLINK/m);
  });
  it("Alimentação: ausência fica vazia no export, nunca zero", () => {
    const def = REPORTING_REPORTS.movimentos;
    const res = runReport(def, { params: { from: "2026-10-01", to: "2026-10-31" } }, [{ date: "2026-10-01", class: "consumo", item: "i", unit: "kg", quantity: null, direction: "saida", lot: null, expires: null, reason: null }]);
    const qi = res.columns.findIndex((c) => c.id === "quantity");
    expect(res.rows[0]?.[qi]).toBeNull();
  });
  it("Avaliação: BNCC×SAEB catalogado sem formato (DEPENDE_DADO); evolução exige ≥3 edições", () => {
    const bncc = STATION_REPORTS.find((r) => r.id === "avaliacao-bncc-saeb")!;
    expect(bncc.formats).toEqual([]);
    expect(bncc.dependency).toMatch(/DEPENDE_DADO/);
    expect(MIN_EVOLUTION_EDITIONS).toBe(3);
  });
});

describe("NTEST.3 — ações principais (writers canônicos)", () => {
  it("Supervisão grava só por record_school_supervision e lê por school_supervision_records_at", () => {
    const s = src("src/features/school-supervision/supervision-source.ts");
    expect(s).toContain('"record_school_supervision"');
    expect(s).toContain('"school_supervision_records_at"');
    expect(s).not.toMatch(/\.from\("school_supervision[a-z_]*"\)\.(insert|update|delete|upsert)/);
  });
  it("Supervisão: sem capacidade nenhuma ferramenta fica 'pode-agir'", () =>
    expect(supervisionHome(new Set()).some((t) => t.state === "pode-agir")).toBe(false));
  it("Supervisão: toda ferramenta aponta para uma tela existente", () => {
    const files = readdirSync("src/routes");
    for (const t of SUPERVISION_TOOLS) {
      const base = t.to.slice(1);
      expect(files.some((f) => f === `${base}.tsx` || f.startsWith(`${base}.index`) || f.startsWith(`${base}.`)), t.to).toBe(true);
    }
  });
  it("Alimentação: cozinha e execução usam writers canônicos, sem DML direto", () => {
    const k = src("src/features/school-meals/kitchen-station.tsx");
    expect(k).toContain('"record_meal_execution"');
    expect(k).toContain('"record_meal_stock_movement"');
    for (const f of ["kitchen-station.tsx", "school-meals-page.tsx", "orders-section.tsx", "receiving-section.tsx", "closing-section.tsx"])
      expect(src(`src/features/school-meals/${f}`), f).not.toMatch(/\.from\("meal_[a-z_]+"\)\.(insert|update|delete|upsert)/);
  });
  it("Avaliação: oficialização e conferência só pelos writers de governança", () => {
    const g = src("src/features/assessment/assessment-governance.ts");
    expect(g).toContain('"record_assessment_officialization"');
    expect(g).toContain('"record_assessment_conference"');
  });
});

describe("NTEST.3 — matriz de cenários", () => {
  it("três áreas têm fluxos de menu, export e ação, todos static (sem perfil sintético)", () => {
    for (const area of ["Supervisão", "Avaliação", "Alimentação"] as const) {
      const fs = STATION_FLOWS.filter((f) => f.area === area);
      expect(fs.length, area).toBeGreaterThanOrEqual(3);
      expect(fs.every((f) => f.proof === "static" && f.profile === null)).toBe(true);
    }
  });
  it("o harness BO continua recusando tipos fora da allowlist v8", () =>
    expect(src("scripts/bo-fixture-harness.mjs")).toContain("prepare recusa tipo fora da allowlist"));
});

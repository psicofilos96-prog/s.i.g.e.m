import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { NAV_REQUIRED_CAPABILITY, navItemAllowed, pathAllowed } from "./nav-capabilities";
import { STATION_HOME, stationAllowsPath } from "./station-navigation";
import { provisionalNavigation } from "@/config/navigation";

const cap = (capabilityId: string) => ({ capabilityId, engagementId: "e", policyId: "p", policyVersion: 1, classId: null, periodId: null, schoolId: "a", componentId: null });
const routeFile = (to: string) => { const b = to === "/" ? "index" : to.slice(1); return [`src/routes/${b}.tsx`, `src/routes/${b}.index.tsx`, `src/routes/${b}`].find(existsSync); };

describe("NPERM.3 — menu × rota × capacidade", () => {
  it("permissões de professor não abrem Gestão Escolar nem as estações de outros setores", () => {
    const teacher = { status: "signed-in" as const, capabilities: [cap("registrar-aula"), cap("consultar-estudantes-da-turma"), cap("consultar-frequencia"), cap("consultar-resultado-avaliativo")] };
    for (const path of ["/gestao-escolar", "/gestao-escolar/detalhe", "/direcao", "/orientacao", "/supervisao-escolar", "/secretaria", "/ciece", "/mapa-estatistico", "/inclusao", "/alimentacao-escolar", "/departamento-pessoal", "/profissionais", "/importacoes", "/alunos", "/turmas", "/unidades"])
      expect(pathAllowed(teacher, path), path).toBe(false);
    expect(pathAllowed(teacher, "/diario/turmas")).toBe(true);
  });
  it("mantém acesso à Gestão Escolar quando há competência própria, inclusive vínculo acumulado", () => {
    expect(pathAllowed({ status: "signed-in", capabilities: [cap("registrar-aula"), cap("consultar-supervisao-da-propria-escola")] }, "/gestao-escolar")).toBe(true);
    expect(pathAllowed({ status: "signed-in", capabilities: [] }, "/gestao-escolar")).toBe(false);
  });
  it("professor não abre consultas administrativas; competência explícita preserva cada área", () => {
    const teacher = { status: "signed-in" as const, capabilities: [cap("registrar-aula"), cap("consultar-estudantes-da-turma")] };
    for (const path of ["/central-de-acessos", "/central-de-acessos/detalhe", "/estacao-administrativa"]) expect(pathAllowed(teacher, path)).toBe(false);
    expect(pathAllowed({ status: "signed-in", capabilities: [cap("manter-contas-institucionais")] }, "/central-de-acessos")).toBe(true);
    expect(pathAllowed({ status: "signed-in", capabilities: [cap("manter-contas-institucionais")] }, "/estacao-administrativa")).toBe(false);
    expect(pathAllowed({ status: "signed-in", capabilities: [cap("registrar-politica-de-capacidades")] }, "/estacao-administrativa")).toBe(true);
  });
  it("consulta e fragmento não contornam a capacidade da rota", () => {
    for (const p of ["/central-de-acessos?aba=contas", "/central-de-acessos#pessoas", "/integracoes?origem=menu"]) {
      expect(navItemAllowed(p, [])).toBe(false);
    }
    expect(navItemAllowed("/central-de-acessos?aba=contas", [cap("manter-contas-institucionais")])).toBe(true);
  });
  it("parâmetros não bloqueiam a própria estação nem liberam outra", () => {
    const authority = { status: "signed-in" as const, principal: { id: "p", station: "alimentacao" as const, scope: "network" as const, schoolId: null }, capabilities: [cap("consultar-alimentacao-escolar")] };
    expect(pathAllowed(authority, "/alimentacao-escolar?aba=refeicoes")).toBe(true);
    expect(pathAllowed(authority, "/central-de-acessos?aba=contas")).toBe(false);
  });
  it("Publicações só aparece com a capacidade de publicar", () => {
    expect(navItemAllowed("/publicacoes", [])).toBe(false);
    expect(navItemAllowed("/publicacoes", [cap("outra")])).toBe(false);
    expect(navItemAllowed("/publicacoes", [cap("publicar-conteudo-publico")])).toBe(true);
    expect(navItemAllowed("/alunos", [])).toBe(false);
    expect(navItemAllowed("/alunos", [cap("consultar-identidade-cadastral-do-estudante")])).toBe(true);
  });
  it("toda regra de menu é a mesma capacidade que a tela exige (sem segunda verdade)", () => {
    const src = readFileSync("src/features/public-portal/publications-admin-page.tsx", "utf8");
    for (const c of NAV_REQUIRED_CAPABILITY["/publicacoes"]!) expect(src).toContain(`"${c}"`);
  });
  it("todo item de menu tem rota real (nenhum link morto)", () => {
    for (const g of provisionalNavigation) for (const i of g.items) expect(routeFile(i.to), i.to).toBeTruthy();
  });
  it("início de cada estação é permitido à própria estação e recusado às demais (deep link)", () => {
    for (const [st, home] of Object.entries(STATION_HOME)) {
      expect(stationAllowsPath(st, home)).toBe(true);
      for (const other of Object.keys(STATION_HOME)) if (other !== st && !home.startsWith("/unidades")) {
        // BQ.1: Direção opera a Alimentação da própria escola (o banco restringe à escola).
        const shared = other === "direcao_escolar" && st === "alimentacao";
        if (stationAllowsPath(other, home) && !shared) expect(["/mapa-estatistico", "/paineis"].some((r) => home.startsWith(r))).toBe(true);
      }
    }
    expect(stationAllowsPath("desconhecida", "/")).toBe(false);
    expect(stationAllowsPath("secretaria_escolar", "/central-de-acessos")).toBe(false);
    expect(stationAllowsPath("secretaria_escolar", "/alunos/123")).toBe(true);
  });
  it("NPERM.4 — Integrações só aparecem com administrar-integracoes em alcance de rede", () => {
    const net = { ...cap("administrar-integracoes"), schoolId: null };
    for (const p of ["/integracoes", "/central-de-integracoes"]) {
      expect(navItemAllowed(p, [])).toBe(false);
      expect(navItemAllowed(p, [cap("administrar-integracoes")])).toBe(false);
      expect(navItemAllowed(p, [net])).toBe(true);
    }
    expect(readFileSync("src/features/integration/integration-page.tsx", "utf8")).toContain('pathAllowed(authority, "/integracoes")');
    expect(readFileSync("src/features/integration/institutional-page.tsx", "utf8")).toContain("administrar-integracoes");
    expect(readFileSync("drizzle/migrations/0091_integration_api_webhooks.sql", "utf8")).toContain("has_network_capability('administrar-integracoes')");
  });
  it("o bloqueio de estação envolve o conteúdo da rota, não só o menu", () => {
    const shell = readFileSync("src/components/app-shell/app-shell.tsx", "utf8");
    expect(shell).toMatch(/<StationGate pathname=\{pathname\}>/);
  });
});

/**
 * NDEMO.2 — varredura de TODAS as rotas: rota cujo grafo de imports alcança um módulo de
 * demonstração (fixtures, *-data.ts com dados fictícios, laboratório) precisa ser laboratório,
 * ter portão de sessão na própria rota/tela ou num layout ancestral, ou estar na lista revisada
 * com motivo. Rota nova que alcance demonstração sem portão quebra este teste.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = "src";
const files: string[] = [];
(function walk(d: string) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) && !p.includes("routeTree.gen")) files.push(p);
  }
})(ROOT);

const text = new Map(files.map((f) => [f, fs.readFileSync(f, "utf8")]));
/** Calendário 2027 do código é fonte REAL (decisão do proprietário), não demonstração. */
const REAL_SOURCES = new Set(["src/features/calendar/calendar-fixtures.ts"]);
const DEMO_NAME = /(fixture|-demo\b|demo\.ts|demonstration|students-data|laborat)/i;
export const DEMO_MODULES = files.filter((f) => !REAL_SOURCES.has(f) && (DEMO_NAME.test(path.basename(f)) || /export const demonstration\w*\s*[:=]/.test(text.get(f)!)));

const resolve = (from: string, spec: string) => {
  const b = spec.startsWith("@/") ? path.join(ROOT, spec.slice(2)) : spec.startsWith(".") ? path.join(path.dirname(from), spec) : null;
  if (!b) return null;
  for (const c of [b, `${b}.ts`, `${b}.tsx`, `${b}/index.ts`, `${b}/index.tsx`]) if (text.has(c)) return c;
  return null;
};
const imports = new Map(files.map((f) => [f, [...text.get(f)!.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)].map((m) => resolve(f, m[1]!)).filter((x): x is string => !!x)]));
const GATE = /ClassRouteGate|DemoOnlyRoute|useSessionUser|isDiaryCloud|useSessionAuthority|laboratory=|useDiaryPersistenceMode/;
const gatedNear = (f: string) => [f, ...(imports.get(f) ?? [])].some((x) => GATE.test(text.get(x) ?? ""));

/** Revisadas à mão: alcançam demonstração, mas não a renderizam com sessão. */
const REVIEWED: Record<string, string> = {
  "src/routes/identidade-institucional.tsx": "Perfil é rotulado 'demonstrativo'; a seção de escolas (identity-sections) troca as unidades fictícias por aviso quando há sessão.",
  "src/routes/tarefas.tsx": "Alcance só por `import type` do registro de estados (state-presentation, NSTATE.2); a tela lê tarefas do banco e não renderiza demonstração.",
  "src/routes/relatorios.tsx": "Alcance só por tipos/funções (report-registry → assessment-types → diary-data); a Central não lê alunos/turmas de demonstração.",
};

const routes = files.filter((f) => f.startsWith("src/routes/") && !f.endsWith("__root.tsx") && !f.includes("/api/"));
function classify(r: string) {
  const seen = new Set([r]); const st = [r]; const hits = new Set<string>();
  const demo = new Set(DEMO_MODULES);
  while (st.length) for (const n of imports.get(st.pop()!) ?? []) { if (demo.has(n)) hits.add(n); if (!seen.has(n)) { seen.add(n); st.push(n); } }
  const segs = path.basename(r, ".tsx").split(".");
  const ancestors: string[] = [];
  for (let i = 1; i < segs.length; i++) { const a = `src/routes/${segs.slice(0, i).join(".")}.tsx`; if (a !== r && text.has(a)) ancestors.push(a); }
  if (r.includes("laboratorio")) return "laboratorio";
  if (hits.size === 0) return "sem-demonstracao";
  if (gatedNear(r)) return "portao-proprio";
  if (ancestors.some(gatedNear)) return "portao-do-layout";
  if (REVIEWED[r]) return "revisada";
  return "SEM-PORTAO";
}

describe("NDEMO.2 — sessão real nunca recebe demonstração", () => {
  const result = routes.map((r) => ({ r, c: classify(r) }));
  it("cobre todas as rotas (não amostra)", () => {
    expect(result.length).toBe(routes.length);
    expect(routes.length).toBeGreaterThan(200);
  });
  it("nenhuma rota alcança demonstração sem portão de sessão", () => {
    expect(result.filter((x) => x.c === "SEM-PORTAO").map((x) => x.r)).toEqual([]);
  });
  it("lista revisada não fica obsoleta", () => {
    for (const r of Object.keys(REVIEWED)) expect(text.has(r), r).toBe(true);
  });
  it("telas só de demonstração ficam atrás de DemoOnlyRoute", () => {
    for (const f of ["alunos", "profissionais", "atuacoes-pedagogicas", "vinculos-letivos", "regras-de-situacao", "matrizes-curriculares.nova", "matrizes-curriculares.nova-versao.$id", "matrizes-curriculares.rascunho.$id", "matrizes-curriculares.impressao.$id"])
      expect(text.get(`src/routes/${f}.tsx`), f).toMatch(/<DemoOnlyRoute[^>]*>\{\(\) =>/);
  });
});

// LOTE CORRETIVO 17 — matriz evidência/pendência por setor, gerada só do que existe em disco.
// Módulo "com tela" = importado por algum .tsx fora do próprio diretório ou de um .tsx do mesmo diretório usado por rota.
// Não afirma homologação nem fluxo autenticado: só evidência de código (núcleo, teste, tela, rota).
// Uso: node scripts/sector-evidence-matrix.mjs  (grava docs/data/sector-evidence-matrix.json)
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const SECTORS = [
  ["Gestão de Pessoas", ["src/features/professionals", "src/features/staffing", "src/features/people-management"]],
  ["Organização da Rede", ["src/features/enrollments", "src/features/network-organization"]],
  ["SIGEM Documentos", ["src/features/document-management", "src/features/document-studio", "src/features/document-archive"]],
  ["Permanência", ["src/features/permanence"]],
  ["Centro de Operações", ["src/features/operations-center", "src/features/school-transport", "src/features/school-assets"]],
  ["Desenvolvimento", ["src/features/professional-development", "src/features/development"]],
  ["Docente", ["src/features/diary"]],
  ["Mediador", ["src/features/mediation", "src/features/mediator"]],
  ["NEI", ["src/features/inclusion", "src/features/nei"]],
  ["Secretaria", ["src/features/school-secretariat"]],
  ["Direção", ["src/features/school-leadership", "src/features/institutional-decisions"]],
  ["Família", ["src/features/family-portal", "src/features/communication"]],
];

const walk = (d) => existsSync(d) ? readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; }) : [];
const src = walk("src").filter((p) => /\.tsx?$/.test(p) && !/\.test\./.test(p) && !p.endsWith("routeTree.gen.ts"));
const text = new Map(src.map((p) => [p, readFileSync(p, "utf8")]));
const routes = src.filter((p) => p.startsWith("src/routes/"));
const importsOf = (p, name) => text.get(p).includes(`/${name}"`) || text.get(p).includes(`./${name}"`);

export function buildMatrix() {
  return SECTORS.map(([sector, dirs]) => {
    const present = dirs.filter(existsSync);
    const mods = present.flatMap((d) => walk(d)).filter((p) => p.endsWith(".ts") && !/\.test\.|\.d\.ts$/.test(p));
    const screens = present.flatMap((d) => walk(d)).filter((p) => p.endsWith(".tsx") && !/\.test\./.test(p));
    const routedScreens = new Set(screens.filter((s) => routes.some((r) => importsOf(r, s.split("/").pop().replace(/\.tsx$/, "")))));
    const reach = (m) => { const n = m.split("/").pop().replace(/\.ts$/, ""); return [...text.keys()].some((p) => p.endsWith(".tsx") && p !== m && importsOf(p, n) && (p.startsWith("src/routes/") || routedScreens.has(p) || !present.some((d) => p.startsWith(d)))); };
    const modules = mods.map((m) => ({ module: m, test: existsSync(m.replace(/\.ts$/, ".test.ts")), screen: reach(m) })).sort((a, b) => a.module.localeCompare(b.module));
    const sectorRoutes = routes.filter((r) => present.some((d) => text.get(r).includes(`@/${d.slice(4)}/`))).sort();
    return { sector, dirs: present, missingDirs: dirs.filter((d) => !existsSync(d)), routes: sectorRoutes,
      modules: modules.length, withTest: modules.filter((m) => m.test).length, withScreen: modules.filter((m) => m.screen).length,
      withoutScreen: modules.filter((m) => !m.screen).map((m) => m.module), withoutTest: modules.filter((m) => !m.test).map((m) => m.module) };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const m = buildMatrix();
  writeFileSync("docs/data/sector-evidence-matrix.json", JSON.stringify(m, null, 1) + "\n");
  for (const s of m) console.log(`${s.sector}: ${s.modules} módulos, ${s.withTest} com teste, ${s.withScreen} com tela, ${s.routes.length} rotas${s.missingDirs.length ? `, ausentes: ${s.missingDirs.join(",")}` : ""}`);
}

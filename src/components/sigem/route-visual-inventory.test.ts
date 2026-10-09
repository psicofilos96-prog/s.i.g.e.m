import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

/**
 * N3.4 — inventário visual de rotas. Toda rota de conteúdo precisa chegar
 * (pela própria rota ou pelos módulos que importa) a uma primitiva do design
 * system. Layouts, impressões e páginas públicas são classificados à parte.
 */
const NEW =
  /PageHeader|RegistryHero|WorkspaceHero|StationHome|WorkSurface|DecisionDesk|FollowUpWorkspace|ReviewQueue|DiaryHeader|SectionHeader|StatePanel|GuidedErrorState|SkeletonState|EmptyState/;
const EXCEPTION = /impressao|documento\.tsx|verificar|publico|^login|^auth|^primeiro-acesso/;
/** Rotas com visual próprio documentado em docs/inventario-visual-rotas.md. */
const DOCUMENTED = new Set([
  "index.tsx", // página inicial com imagem de capa própria, só tokens semânticos
  "diario.turmas.$turmaId.avaliacao.tsx", // layout com parâmetros de busca
]);

function resolve(spec: string, from: string): string | null {
  let p: string;
  if (spec.startsWith("@/")) p = join("src", spec.slice(2));
  else if (spec.startsWith(".")) p = normalize(join(dirname(from), spec));
  else return null;
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) if (existsSync(p + ext)) return p + ext;
  return null;
}
function scan(file: string, depth: number, seen: Set<string>): string {
  if (seen.has(file) || depth < 0) return "";
  seen.add(file);
  const s = readFileSync(file, "utf8");
  let t = s;
  for (const m of s.matchAll(/from "([^"]+)"/g)) {
    if (/components\/(sigem|ui)/.test(m[1] ?? "")) continue;
    const r = resolve(m[1] ?? "", file);
    if (r && /features|routes|components/.test(r)) t += scan(r, depth - 1, seen);
  }
  return t;
}
export function classifyRoutes() {
  const out: Record<string, "LAYOUT" | "EXCECAO" | "NOVA" | "ANTIGA"> = {};
  for (const b of readdirSync("src/routes").filter((f) => f.endsWith(".tsx") && f !== "__root.tsx")) {
    const f = join("src/routes", b);
    const s = readFileSync(f, "utf8");
    if (s.includes("<Outlet") && !/<(div|main|section|h1)/.test(s)) out[b] = "LAYOUT";
    else if (EXCEPTION.test(b)) out[b] = "EXCECAO";
    else out[b] = NEW.test(scan(f, 3, new Set())) ? "NOVA" : "ANTIGA";
  }
  return out;
}

describe("inventário visual das rotas (N3.4)", () => {
  it("nenhuma rota de conteúdo ficou no visual antigo", () => {
    const old = Object.entries(classifyRoutes())
      .filter(([b, k]) => k === "ANTIGA" && !DOCUMENTED.has(b))
      .map(([b]) => b);
    expect(old).toEqual([]);
  });
  it("título de página usa PageHeader, nunca h1 solto com estilo antigo", () => {
    const files = ["src/routes/tarefas.tsx", "src/routes/secretaria_.servicos.tsx", "src/routes/enturmacoes.index.tsx", "src/routes/base-de-conhecimento.tsx", "src/features/assistant/assistant-panel.tsx", "src/features/integration/integration-page.tsx", "src/features/integration/institutional-page.tsx", "src/features/institutional-rules/institutional-rules-admin.tsx", "src/features/institutional-admin/access-center-page.tsx"];
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/<h1 className="text-(xl|2xl) font-semibold/);
  });
});

describe("NROUTE.2 — título de página só pelo PageHeader nas telas principais", () => {
  it("nenhuma tela principal usa h1 com estilo antigo", () => {
    const files = ["src/routes/revisao-de-anomalias.tsx", "src/features/curriculum/institutional-matrices.tsx", "src/features/curriculum/curricular-correspondence.tsx", "src/features/calendar/institutional-calendar-pages.tsx", "src/features/student-life/institutional-enrollment-workspace.tsx", "src/features/institutional-admin/governance-station-page.tsx", "src/features/institutional-admin/general-admin-page.tsx", "src/features/school-secretariat/enrollment-wizard.tsx"];
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/<h1 className="text-(xl|2xl) font-semibold"/);
  });
});

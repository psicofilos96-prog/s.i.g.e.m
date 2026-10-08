// NLINK.1 — todo destino literal de link/navegação deve existir na árvore de rotas,
// e o topo da tela não pode ter botões sem ação.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const gen = fs.readFileSync(path.join(ROOT, "src/routeTree.gen.ts"), "utf8");
const block = gen.match(/export interface FileRoutesByFullPath \{([\s\S]*?)\n\}/)![1];
const routes = [...block.matchAll(/'([^']+)':/g)].map((m) => m[1].replace(/\/$/, "") || "/");
const patterns = routes.map(
  (r) => new RegExp("^" + r.replace(/\/\$$/, "(/.*)?").replace(/\$[^/]+/g, "[^/]+") + "$"),
);
const STATIC_ASSET = /\.(png|jpe?g|webp|svg|ico|webmanifest|pdf)$/;
const routeExists = (raw: string) => {
  const p = raw.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  return STATIC_ASSET.test(p) || p.startsWith("/api/") || patterns.some((r) => r.test(p));
};

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.|routeTree\.gen/.test(e.name) ? [p] : [];
  });
}

describe("NLINK.1 links e ações navegacionais", () => {
  it("a árvore de rotas foi lida", () => {
    expect(routes.length).toBeGreaterThan(50);
    expect(routeExists("/rota-que-nao-existe-nlink")).toBe(false);
  });

  it("todo destino literal (menus, cards, guias, breadcrumbs, relatórios, públicos) existe", () => {
    const broken: string[] = [];
    for (const f of files(path.join(ROOT, "src"))) {
      const src = fs.readFileSync(f, "utf8");
      for (const m of src.matchAll(/(?:\bto|href)\s*[:=]\s*\{?\s*["'`](\/[^"'`$]*?)["'`]/g)) {
        if (!routeExists(m[1])) broken.push(`${path.relative(ROOT, f)} → ${m[1]}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("topo da tela não tem botão de ícone sem ação nem destino", () => {
    const shell = fs.readFileSync(path.join(ROOT, "src/components/app-shell/app-shell.tsx"), "utf8");
    const dead = [...shell.matchAll(/(<\w+Trigger asChild>\s*)?<Button\b([^>]*)>/g)]
      .filter((m) => !m[1])
      .map((m) => m[2])
      .filter((attrs) => /size="icon"/.test(attrs) && !/onClick|asChild|type="submit"/.test(attrs));
    expect(dead).toEqual([]);
  });
});

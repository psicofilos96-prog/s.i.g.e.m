// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import axe from "axe-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/sigem/patterns";

async function violations(node: Element) {
  const r = await axe.run(node, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(" | ")}`);
}

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(f) && !/\.test\./.test(f) ? [p] : []; });
const files = walk("src").map((p) => [p, readFileSync(p, "utf8")] as const);

describe("acessibilidade automatizada (axe) dos componentes compartilhados", () => {
  it("formulário, botões, tabela e padrões SIGEM sem violações", async () => {
    const { container } = render(
      <div>
        <PageHeader title="Título" description="Descrição" />
        <Label htmlFor="n">Nome</Label><Input id="n" aria-invalid="true" aria-describedby="n-err" /><p id="n-err">Informe o nome.</p>
        <Button>Salvar</Button><Button size="icon" aria-label="Fechar">x</Button>
        <Table><TableHeader><TableRow><TableHead>Col</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>1</TableCell></TableRow></TableBody></Table>
        <EmptyState title="Nada" description="Sem registros." />
      </div>,
    );
    expect(await violations(container)).toEqual([]);
  });
  it("detecta botão de ícone sem nome (controle do próprio teste)", async () => {
    const { container } = render(<Button size="icon"><svg /></Button>);
    expect((await violations(container)).some((v) => v.startsWith("button-name"))).toBe(true);
  });
});

describe("auditoria estática transversal", () => {
  it("botões só de ícone têm nome acessível", () => {
    const bad: string[] = [];
    for (const [p, s] of files) for (const m of s.matchAll(/<Button\b(?:(?!<\/Button>).)*?size="icon"(?:(?!<\/Button>).)*?<\/Button>/gs))
      if (!/aria-label|aria-labelledby|title=|sr-only|\{children\}|\{\.\.\.props\}/.test(m[0])) bad.push(p);
    expect(bad).toEqual([]);
  });
  it("altura total usa dvh (sem h-screen/min-h-screen) e não há tabIndex positivo", () => {
    expect(files.filter(([, s]) => /\b(min-)?h-screen\b/.test(s)).map(([p]) => p)).toEqual([]);
    expect(files.filter(([, s]) => /tabIndex=\{?["']?[1-9]/.test(s)).map(([p]) => p)).toEqual([]);
  });
  it("imagens têm alt", () => {
    expect(files.filter(([, s]) => /<img\b(?![^>]*\balt=)[^>]*>/s.test(s)).map(([p]) => p)).toEqual([]);
  });
  it("shell tem link de pular conteúdo e um único main", () => {
    const shell = readFileSync("src/components/app-shell/app-shell.tsx", "utf8");
    expect(shell).toContain('href="#conteudo"'); expect(shell.match(/<main\b/g)).toHaveLength(1);
    expect(files.filter(([p, s]) => !["src/components/app-shell/app-shell.tsx", "src/routes/login.tsx", "src/routes/auth.tsx", "src/routes/primeiro-acesso.tsx", "src/components/ui/sidebar.tsx", "src/features/public-portal/public-layout.tsx"].includes(p) && /<main\b/.test(s)).map(([p]) => p)).toEqual([]);
  });
  it("PWA: manifest instalável e nenhum service worker", () => {
    const m = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
    expect(m.display).toBe("standalone"); expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(files.some(([, s]) => /serviceWorker\.register|virtual:pwa-register/.test(s))).toBe(false);
  });
});

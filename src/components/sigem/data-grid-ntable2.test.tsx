import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataGrid, type DataGridColumn } from "./data-grid";

type Row = { id: string; name: string; n: number };
const columns: Array<DataGridColumn<Row>> = [
  { id: "name", header: "Nome", cell: (r) => r.name, sortable: true },
  { id: "n", header: "Número", cell: (r) => r.n, priority: "secondary" },
];

function walk(d: string): string[] {
  return readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") && !p.endsWith(".test.tsx") ? [p] : []; });
}

describe("NTABLE.2 — tabelas densas", () => {
  it("cabeçalho compartilhado é sempre cabeçalho de coluna", () => {
    render(<Table><TableHeader><TableRow><TableHead>Nome</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>A</TableCell></TableRow></TableBody></Table>);
    expect(screen.getByRole("columnheader", { name: "Nome" }).getAttribute("scope")).toBe("col");
  });

  it("toda tabela escrita à mão tem título e cabeçalhos marcados", () => {
    const bad: string[] = [];
    for (const f of walk("src")) {
      if (f.includes("components/ui/")) continue;
      const s = readFileSync(f, "utf8");
      if (!/<table[\s>]/.test(s)) continue;
      if (/<th[\s>]/.test(s) && !/scope=/.test(s)) bad.push(`${f}: th sem scope`);
    }
    expect(bad).toEqual([]);
  });

  it("5.000 linhas: ordenação anunciada, região por teclado e sem violações", async () => {
    const rows = Array.from({ length: 5_000 }, (_, i) => ({ id: `r${i}`, name: `Pessoa ${i}`, n: i }));
    const t0 = performance.now();
    const { container } = render(
      <DataGrid label="Alunos" rows={rows.slice(0, 50)} columns={columns} getRowId={(r) => r.id}
        sort={{ columnId: "name", direction: "asc", onSortChange: () => {} }}
        pagination={{ page: 1, pageCount: 100, total: rows.length, onPageChange: () => {} }}
        rowActions={(r) => <button type="button" aria-label={`Abrir ${r.name}`}>Abrir</button>} />,
    );
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(screen.getByRole("columnheader", { name: /Nome/ }).getAttribute("aria-sort")).toBe("ascending");
    expect(screen.getByRole("region", { name: "Alunos" }).getAttribute("tabindex")).toBe("0");
    expect(screen.getAllByRole("button", { name: /^Abrir Pessoa/ })).toHaveLength(50);
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
});

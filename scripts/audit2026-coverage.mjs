// LOTE 8/14 — Conferência fonte-documento: gera o SQL a partir do registro único e o relatório MD.
// Somente leitura e sem PII (só contagens). Uso:
//   bun scripts/audit2026-coverage.mjs sql            -> imprime o SQL (executar no leitor somente-leitura)
//   bun scripts/audit2026-coverage.mjs report in.json out.md -> relatório a partir do resultado JSON
import { readFileSync, writeFileSync } from "node:fs";
import { COVERAGE, coverageSql, evaluateCoverage, coverageMarkdown } from "../src/features/data-import/source-coverage.ts";

const [mode, input, output] = process.argv.slice(2);
if (mode === "sql") process.stdout.write(coverageSql());
else if (mode === "report") {
  const rows = JSON.parse(readFileSync(input, "utf8"));
  const by = new Map(rows.map((r) => [r.doc, { total: Number(r.total), filled: typeof r.filled === "string" ? JSON.parse(r.filled) : r.filled }]));
  const md = coverageMarkdown(COVERAGE.map((d) => evaluateCoverage(d, by.get(d.key) ?? null)), new Date().toISOString());
  writeFileSync(output, md);
  console.log(md);
} else { console.error("uso: sql | report in.json out.md"); process.exit(2); }

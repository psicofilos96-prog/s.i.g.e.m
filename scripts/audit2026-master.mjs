// AUD2026.MASTER — executa a auditoria mestre (somente leitura) e gera relatório sem PII.
// Fail-closed: sai com código 1 se algum assert ≠ 0 ou indicador comparável divergir.
// Uso: node scripts/audit2026-master.mjs [saida.md]
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function parseAudit(out) {
  const rows = out.trim().split("\n").filter(Boolean).map((l) => l.split("|"));
  return {
    school: rows.filter((r) => r[0] === "school").map(([, inep, k, oficial, valor, status]) => ({ inep, k, oficial: oficial === "" ? null : +oficial, valor: +valor, status })),
    asserts: rows.filter((r) => r[0] === "assert").map(([, n, v]) => ({ n, v: +v })),
    totals: rows.filter((r) => r[0] === "total").map(([, k, v]) => ({ k, v: +v })),
  };
}

export function verdict({ school, asserts }) {
  const failed = asserts.filter((a) => a.v !== 0).map((a) => a.n);
  const diffs = school.filter((s) => s.status === "DIFF");
  return { ok: failed.length === 0 && diffs.length === 0, failed, diffs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = execFileSync("psql", ["-At", "-F|", "-v", "ON_ERROR_STOP=1", "-f", "scripts/audit2026/master-audit.sql"], { encoding: "utf8" });
  const a = parseAudit(out);
  const v = verdict(a);
  const by = {};
  for (const s of a.school) (by[s.k] ??= { MATCH: 0, DIFF: 0, NAO_COMPARAVEL: 0 })[s.status]++;
  const md = [
    `# Auditoria mestre 2026 (AUD2026.MASTER)`, ``, `Gerado: ${new Date().toISOString()} — somente leitura, sem PII.`, ``,
    `## Totais`, ...a.totals.map((t) => `- ${t.k}: ${t.v}`), ``,
    `## Indicadores por escola (recibo Educacenso × base)`, `| indicador | MATCH | DIFF | não comparável |`, `|---|---|---|---|`,
    ...Object.entries(by).map(([k, c]) => `| ${k} | ${c.MATCH} | ${c.DIFF} | ${c.NAO_COMPARAVEL} |`), ``,
    `## Diferenças`, ...(v.diffs.length ? v.diffs.map((d) => `- INEP ${d.inep} ${d.k}: oficial ${d.oficial}, base ${d.valor}`) : ["- nenhuma"]), ``,
    `## Asserts`, ...a.asserts.map((x) => `- ${x.v === 0 ? "OK" : "FALHA"} ${x.n} = ${x.v}`), ``,
    `Veredito: ${v.ok ? "PASS" : "FAIL"}`,
  ].join("\n");
  const dest = process.argv[2] ?? "/tmp/audit2026-master.md";
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, md);
  console.log(md);
  process.exit(v.ok ? 0 : 1);
}

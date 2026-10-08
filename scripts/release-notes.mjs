// Changelog derivado de commits: `node scripts/release-notes.mjs [desde-ref]`.
// Agrupa por prefixo semântico (feat/fix/sec/db/docs/test/chore); o resto vai para "Outros".
import { execFileSync } from "node:child_process";

const since = process.argv[2];
const range = since ? [`${since}..HEAD`] : ["-n", "200"];
let log = "";
try {
  log = execFileSync("git", ["log", "--no-merges", "--pretty=%h%x09%s", ...range], { encoding: "utf8" });
} catch {
  console.error("git indisponível: changelog não pode ser derivado aqui.");
  process.exit(1);
}
const groups = { feat: "Novidades", fix: "Correções", sec: "Segurança", db: "Banco de dados", docs: "Documentação", test: "Testes", chore: "Manutenção" };
const out = {};
for (const line of log.trim().split("\n").filter(Boolean)) {
  const [sha, subject] = line.split("\t");
  const m = /^(\w+)(\([^)]*\))?!?:\s*(.+)$/.exec(subject);
  const key = m && groups[m[1]] ? groups[m[1]] : "Outros";
  (out[key] ??= []).push(`- ${m && groups[m[1]] ? m[3] : subject} (${sha})`);
}
for (const [k, v] of Object.entries(out)) console.log(`## ${k}\n${v.join("\n")}\n`);

// NRELEASE.1: os commits da plataforma costumam vir sem prefixo ("Changes"); por isso o
// changelog técnico também lista o que mudou por natureza de arquivo no intervalo.
const filesRange = since ? [`${since}..HEAD`] : ["HEAD~200..HEAD"];
let changed = [];
try {
  changed = execFileSync("git", ["diff", "--name-only", ...filesRange], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
} catch { /* histórico raso: seção omitida */ }
const byKind = {
  "Migrations": (f) => /^(drizzle|supabase)\/migrations\/.*\.sql$/.test(f),
  "Documentos de lote": (f) => /^docs\/.*\.md$/.test(f),
  "Invariantes e testes": (f) => /\.test\.tsx?$/.test(f),
  "Regras (AGENTS.md)": (f) => /AGENTS\.md$/.test(f),
};
for (const [k, pred] of Object.entries(byKind)) {
  const list = changed.filter(pred);
  if (list.length) console.log(`## ${k} (${list.length})\n${list.map((f) => `- ${f}`).join("\n")}\n`);
}

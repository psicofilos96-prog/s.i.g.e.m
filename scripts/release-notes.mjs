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

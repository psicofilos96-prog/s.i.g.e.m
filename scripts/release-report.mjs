// NRELEASE.2 — relatório reproduzível do HEAD para homologação. Só lê o repositório:
// não publica, não executa migration, não lê .env nem segredo. `node scripts/release-report.mjs`.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";

const git = (...a) => { try { return execFileSync("git", a, { encoding: "utf8" }).trim(); } catch { return null; } };
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const sqlIn = (d) => existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".sql")).sort().map((f) => `${d}/${f}`) : [];
const all = [...sqlIn("supabase/migrations"), ...sqlIn("drizzle/migrations")];
const migs = sqlIn("drizzle/migrations").map((p) => p.split("/").pop());
const manifest = JSON.parse(readFileSync("src/test/invariants/migration-hashes.json", "utf8"));
const keys = new Set(Object.keys(manifest.hashes ?? manifest));
const unfrozen = all.filter((p) => !keys.has(p));
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === "node_modules" ? [] : walk(`${d}/${e.name}`)) : [`${d}/${e.name}`]);
const tests = walk("src").filter((f) => /\.test\.tsx?$/.test(f)).length;
const docs = readdirSync("docs").filter((f) => f.endsWith(".md")).length;
const assets = existsSync("src/assets") ? walk("src/assets").length : 0;
const destructive = migs.filter((f) => /\b(DROP\s+TABLE|DROP\s+COLUMN|RENAME\s+(COLUMN|TO))\b/i.test(readFileSync(`drizzle/migrations/${f}`, "utf8")));
const nfile = existsSync("scripts/nfile2-storage-scopes.mjs") ? /BUCKETS = \[([^\]]+)\]/.exec(readFileSync("scripts/nfile2-storage-scopes.mjs", "utf8"))?.[1].replace(/["\s]/g, "").split(",") ?? [] : [];
const buckets = [...new Set([...nfile, ...all.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/storage\.buckets[^;]*?VALUES\s*\(\s*'([a-z0-9-_]+)'/gi)].map((m) => m[1]))])];

console.log(`# Relatório de release do HEAD (gerado)

- Commit: ${git("rev-parse", "--short", "HEAD") ?? "desconhecido"} · data do commit: ${git("log", "-1", "--format=%cI") ?? "desconhecida"}
- Versão do app: ${pkg.version ?? "não definida (DEPENDE_DECISAO)"}
- Esquema: ${all.length} migrations (${migs.length} drizzle + ${all.length - migs.length} supabase), última ${migs.at(-1)}
- Manifesto congelado: ${keys.size} hashes; fora do manifesto: ${unfrozen.length ? unfrozen.join(", ") : "nenhuma"}
- Migrations com DROP TABLE/COLUMN ou RENAME (histórico, revisar se novas): ${destructive.length ? destructive.join(", ") : "nenhuma"}
- Pastas privadas esperadas (NFILE.2 + migrations; conferir privacidade com o script NFILE.2): ${buckets.length ? buckets.join(", ") : "nenhum detectado"}
- Arquivos de teste: ${tests} · documentos: ${docs} · arquivos em src/assets: ${assets}

Gates a anexar: \`npm run verify\` (PASS/FAIL/NOT RUN por etapa) e \`SIGEM_DEEP=1\`.
Nada foi publicado; 2027 não foi aberto; produção não iniciada.`);

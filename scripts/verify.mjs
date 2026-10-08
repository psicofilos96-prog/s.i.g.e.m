#!/usr/bin/env node
// Rotina única de verificação do SIGEM. Só lê e testa: não publica, não grava no banco,
// não usa nem imprime credenciais. Uso:
//   node scripts/verify.mjs              → todas as etapas
//   node scripts/verify.mjs --only=tipos,testes
//   node scripts/verify.mjs --skip=build,rotas
//   SIGEM_BASE_URL=http://localhost:8080 (padrão) para o smoke de rotas.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1]?.split(",") ?? null;
const only = arg("only"), skip = arg("skip") ?? [];
const BASE = process.env.SIGEM_BASE_URL ?? "http://localhost:8080";

// Ambiente limpo: nenhuma credencial do banco chega aos subprocessos.
const SAFE_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) =>
  !/SERVICE_ROLE|SECRET|PASSWORD|PGPASSWORD|TOKEN|PRIVATE|LOVABLE_BROWSER_/i.test(k)));

function run(cmd, args, extraEnv = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", env: { ...SAFE_ENV, ...extraEnv }, maxBuffer: 64 * 1024 * 1024, timeout: 20 * 60_000 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.replace(/\x1b\[[0-9;]*m/g, "");
  return { ok: r.status === 0, out };
}
const tail = (s, n = 6) => s.trim().split("\n").slice(-n).join("\n");
const pick = (s, re) => s.split("\n").filter((l) => re.test(l)).slice(-3).join(" | ");

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (["node_modules", ".git", "dist", ".output", ".vinxi", ".tanstack"].includes(n)) continue;
    const p = join(dir, n); const st = statSync(p);
    if (st.isDirectory()) walk(p, out); else if (/\.(ts|tsx|js|mjs|cjs|json|toml|ya?ml|sql|md|py|env)$/.test(n) && st.size < 2_000_000) out.push(p);
  }
  return out;
}

const SECRET_PATTERNS = [
  ["chave secreta do backend", /\bsb_secret_[A-Za-z0-9_-]{10,}/],
  ["JWT de service_role", /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*cm9sZSI6InNlcnZpY2Vfcm9sZS[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/],
  ["chave privada", /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["chave AWS", /\bAKIA[0-9A-Z]{16}\b/],
  ["token GitHub", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["chave OpenAI/Anthropic", /\bsk-(ant-)?[A-Za-z0-9_-]{30,}\b/],
  ["senha literal", /\b(password|senha)\s*[:=]\s*["'][^"'\s]{6,}["']/i],
];
const SECRET_ALLOW = /(\.test\.|\/test\/|scripts\/verify\.mjs|docs\/)/;

const STEPS = [
  { id: "migrations", title: "Integridade de migrations", what: "Migration congelada não foi editada; journal = arquivos; novas listadas para congelar.",
    fn: () => { const r = run("node", ["scripts/check-migrations.mjs"]); return { ok: r.ok, note: tail(r.out, 2) }; } },
  { id: "tipos", title: "Tipos (TypeScript)", what: "O projeto compila sem erro de tipo.",
    fn: () => { const r = run("npx", ["tsgo", "--noEmit", "-p", "."]); const n = (r.out.match(/error TS/g) ?? []).length; return { ok: r.ok, note: r.ok ? "0 erros" : `${n} erro(s)\n${tail(r.out, 8)}` }; } },
  { id: "testes", title: "Testes (suíte completa)", what: "Regras, modelos, telas, vocabulário, a11y por componente, snapshots e invariantes rápidas.",
    fn: () => { const r = run("npx", ["vitest", "run"]); return { ok: r.ok, note: pick(r.out, /Test Files|Tests |FAIL/) }; } },
  { id: "profundas", title: "Invariantes profundas", what: "Verificações arquiteturais caras (SIGEM_DEEP=1): writers, grants, migrations.",
    fn: () => { const r = run("npx", ["vitest", "run", "src/test/invariants"], { SIGEM_DEEP: "1" }); return { ok: r.ok, note: pick(r.out, /Test Files|Tests |FAIL/) }; } },
  { id: "acessibilidade", title: "Acessibilidade", what: "Componentes compartilhados (nomes acessíveis, rótulos, foco) e vocabulário pt-BR.",
    fn: () => { const r = run("npx", ["vitest", "run", "src/components/a11y.test.tsx", "src/config/ui-vocabulary.test.ts"]); return { ok: r.ok, note: pick(r.out, /Tests |FAIL/) }; } },
  { id: "seguranca", title: "Segurança (SQL das migrations)", what: "Inventário de funções DEFINER sem search_path seguro e tabelas sem RLS (leitura de arquivos).",
    fn: () => { const r = run("node", ["scripts/audit-sql-security.mjs"]); return { ok: r.ok, note: tail(r.out, 4) }; } },
  { id: "segredos", title: "Segredos no código", what: "Nenhuma chave secreta, JWT de service_role, chave privada, token ou senha literal em arquivos do projeto.",
    fn: () => { const hits = [];
      for (const f of walk(".")) { if (SECRET_ALLOW.test(f)) continue; const s = readFileSync(f, "utf8");
        for (const [label, re] of SECRET_PATTERNS) if (re.test(s)) hits.push(`${f}: ${label}`); }
      return { ok: hits.length === 0, note: hits.length ? hits.slice(0, 10).join("\n") : "nenhum encontrado (valores nunca são impressos)" }; } },
  { id: "diff", title: "Diferenças em relação ao último registro", what: "Lista arquivos alterados (somente leitura; nada é gravado no histórico).",
    fn: () => { const r = run("git", ["--no-pager", "diff", "--stat", "HEAD"]); return { ok: true, note: r.ok ? (tail(r.out, 1) || "sem alterações") : "histórico indisponível" }; } },
  { id: "build", title: "Build de produção", what: "O app empacota para publicação (sem publicar).",
    fn: () => { const r = run("npx", ["vite", "build"]); return { ok: r.ok, note: r.ok ? "OK" : tail(r.out, 8) }; } },
  { id: "rotas", title: "Smoke de rotas", what: "Rotas públicas e principais respondem sem erro de servidor (sem login).",
    fn: async () => {
      const routes = ["/", "/auth", "/publico", "/diario", "/secretaria", "/turmas", "/relatorios", "/auditoria", "/central-de-acessos", "/calendarios", "/rota-inexistente-verificacao"];
      const bad = []; let reached = 0;
      for (const r of routes) {
        try { const res = await fetch(BASE + r, { redirect: "manual" }); reached++; if (res.status >= 500) bad.push(`${r} → ${res.status}`); }
        catch { /* servidor fora do ar */ }
      }
      if (!reached) return { ok: null, note: `servidor em ${BASE} não respondeu — etapa não executada` };
      return { ok: bad.length === 0, note: bad.length ? bad.join(", ") : `${reached} rota(s) sem erro 5xx` };
    } },
];

const selected = STEPS.filter((s) => (!only || only.includes(s.id)) && !skip.includes(s.id));
const results = [];
console.log(`\nVerificação do SIGEM — ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}\n`);
for (const s of selected) {
  process.stdout.write(`• ${s.title}… `);
  const t0 = Date.now(); let r;
  try { r = await s.fn(); } catch (e) { r = { ok: false, note: String(e?.message ?? e).slice(0, 300) }; }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const tag = r.ok === null ? "NÃO EXECUTADA" : r.ok ? "OK" : "FALHOU";
  console.log(`${tag} (${secs}s)`); if (r.note) console.log(`    ${r.note.replace(/\n/g, "\n    ")}`);
  results.push({ ...s, ...r, tag });
}
const failed = results.filter((r) => r.ok === false), notRun = results.filter((r) => r.ok === null);
console.log("\nResumo");
for (const r of results) console.log(`  ${r.tag.padEnd(13)} ${r.title} — ${r.what}`);
console.log(`\n${failed.length ? `FALHOU: ${failed.map((r) => r.id).join(", ")}` : "TUDO OK"}${notRun.length ? ` · não executadas: ${notRun.map((r) => r.id).join(", ")}` : ""}\n`);
process.exit(failed.length ? 1 : 0);

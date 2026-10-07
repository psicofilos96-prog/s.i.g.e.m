#!/usr/bin/env node
// NOPS.1/NOPS.2 — checklist de prontidão somente leitura. Não grava, não imprime segredos, não exporta dados pessoais.
// O ensaio de restauração roda numa transação que termina em ROLLBACK (nada persiste) e só usa cadastro de escolas (sem dado pessoal).
import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
const out = [];
const step = (name, fn) => { try { out.push([name, "ok", fn()]); } catch (e) { out.push([name, "FALHA", String(e.message).slice(0, 160)]); } };
const skip = (name, why) => out.push([name, "pendente", why]);
const last = (dir) => readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().pop();

step("integridade de migrations", () => execSync("node scripts/check-migrations.mjs", { stdio: "pipe" }).toString().trim().split("\n").pop());
step("versão do schema", () => `legado ${last("supabase/migrations")} + atual ${last("drizzle/migrations")}`);
step("versão da aplicação (commit)", () => { try { return execSync("git rev-parse --short HEAD", { stdio: "pipe" }).toString().trim(); } catch { return "indisponível fora do git"; } });
step("dependências declaradas", () => Object.keys(JSON.parse(readFileSync("package.json", "utf8")).dependencies ?? {}).length + " pacotes");
// Dependências externas: só NOMES de variáveis, nunca valores.
step("dependências externas configuradas", () => {
  const names = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "LOVABLE_API_KEY"];
  return names.map((n) => `${n}=${process.env[n] ? "presente" : "ausente"}`).join(" ");
});
const base = process.env.SIGEM_HEALTH_BASE ?? "http://localhost:8080";
step("health (liveness/readiness)", () => {
  const r = execSync(`curl -s -m 5 "${base}/api/public/health?ready=1"`).toString();
  if (!/"status":"pronto"/.test(r)) throw new Error(`não pronto: ${r.slice(0, 120)}`);
  return r.slice(0, 160);
});

const psql = (sql) => execSync(`psql -X -At -v ON_ERROR_STOP=1`, { input: sql, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
if (!process.env.PGHOST) {
  skip("armazenamento", "sem conexão técnica ao banco");
  skip("ensaio de restauração", "sem conexão técnica ao banco");
} else {
  step("armazenamento (áreas privadas)", () => {
    const rows = psql("select b.id||':'||case when b.public then 'PUBLICA' else 'privada' end||':'||(select count(*) from storage.objects o where o.bucket_id=b.id) from storage.buckets b order by 1;").split("\n").filter(Boolean);
    if (rows.some((r) => r.includes("PUBLICA"))) throw new Error(`área pública: ${rows.join(", ")}`);
    return `${rows.length} áreas, todas privadas (${rows.join(", ")})`;
  });
  step("ensaio de restauração (efêmero, ROLLBACK)", () => {
    const sql = `begin;
create temp table r_src on commit drop as select * from public.institutional_school_record_versions;
create temp table r_dump on commit drop as select to_jsonb(s) j from r_src s;
create temp table r_restored (like public.institutional_school_record_versions) on commit drop;
insert into r_restored select (jsonb_populate_record(null::public.institutional_school_record_versions, j)).* from r_dump;
select (select count(*) from r_src)||'|'||(select md5(coalesce(string_agg(to_jsonb(s)::text, '' order by to_jsonb(s)::text),'')) from r_src s)
  = (select count(*) from r_restored)||'|'||(select md5(coalesce(string_agg(to_jsonb(r)::text, '' order by to_jsonb(r)::text),'')) from r_restored r), (select count(*) from r_src);
rollback;`;
    const line = psql(sql).split("\n").find((l) => /^[tf]\|/.test(l)) ?? "";
    const [same, n] = line.split("|");
    if (same !== "t") throw new Error(`restauração divergente (${line})`);
    return `${n} versões cadastrais de escolas exportadas e restauradas com mesma impressão digital; nada persistiu`;
  });
}
skip("restauração completa de backup", "INFRAESTRUTURA_PENDENTE: backups são da plataforma; sem banco efêmero separado");

for (const [n, s, d] of out) console.log(`${s === "ok" ? "✔" : s === "pendente" ? "…" : "✘"} ${n}: ${d}`);
process.exit(out.some((r) => r[1] === "FALHA") ? 1 : 0);

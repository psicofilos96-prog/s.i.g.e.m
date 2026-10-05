/**
 * Suíte rápida de invariantes arquiteturais (estática, < 2 s). Ver docs/invariantes-do-sigem.md.
 * Contratos que crescem não são testados por contagem global: novas migrations, funções e telas
 * entram livremente, desde que respeitem as regras.
 */
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import frozen from "./migration-hashes.json";

const MIG_DIRS = ["supabase/migrations", "drizzle/migrations"];
const migrations = MIG_DIRS.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".sql")).sort().map((f) => `${d}/${f}`));
const sql = (f: string) => readFileSync(f, "utf8");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const src = walk("src").filter((f) => /\.(ts|tsx)$/.test(f));
const prod = src.filter((f) => !/\.test\.|\/test\/|routeTree\.gen/.test(f));
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Última definição de cada função SQL (a vigente). */
function latestFunctions() {
  const out = new Map<string, { file: string; header: string; body: string }>();
  const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?(\w+)"?\s*\(([\s\S]*?)\$(\w*)\$([\s\S]*?)\$\3\$([\s\S]*?);/gi;
  for (const f of migrations) for (const m of sql(f).matchAll(re)) out.set(m[1]!, { file: f, header: `${m[2]} ${m[5]}`.toLowerCase(), body: m[4]!.toLowerCase() });
  return out;
}

describe("migrations", () => {
  it("migrations históricas são imutáveis (novas são permitidas)", () => {
    for (const [file, hash] of Object.entries(frozen as Record<string, string>)) {
      expect(createHash("sha256").update(readFileSync(file)).digest("hex"), file).toBe(hash);
    }
  });
  it("toda função SECURITY DEFINER vigente fixa search_path", () => {
    const bad = [...latestFunctions()].filter(([, v]) => v.header.includes("security definer") && !/set\s+search_path/.test(v.header)).map(([k]) => k);
    expect(bad).toEqual([]);
  });
  it("capacidade efetiva só vem de política homologada (rascunho não autoriza)", () => {
    const f = latestFunctions().get("effective_capabilities");
    expect(f?.body).toMatch(/status\s*=\s*'homologated'/);
  });
  it("nenhuma regra de política usa curinga", () => {
    for (const f of migrations) expect(sql(f), f).not.toMatch(/capability_policy_rules[\s\S]{0,300}values[\s\S]{0,200}'\*'/i);
    for (const f of prod) expect(stripComments(readFileSync(f, "utf8")), f).not.toMatch(/capabilityId\s*===\s*["']\*["']/);
  });
  it("documentos emitidos permanecem snapshots (append-only por trigger)", () => {
    expect(migrations.map(sql).join("\n")).toMatch(/BEFORE UPDATE OR DELETE ON public\.school_document_emissions/i);
  });
  it("tabelas de versões não recebem UPDATE/DELETE amplo para anon/authenticated", () => {
    const re = /grant\s+[^;]*\b(update|delete)\b[^;]*on\s+(?:table\s+)?public\.(\w*_versions)\s+to\s+[^;]*\b(anon|authenticated)\b/gi;
    const hits = migrations.flatMap((f) => [...sql(f).matchAll(re)].map((m) => `${f}:${m[2]}`));
    expect(hits).toEqual([]);
  });
  it("relações curriculares são muitos-para-muitos (sem unicidade de um só lado)", () => {
    const all = migrations.map(sql).join("\n");
    expect(all).not.toMatch(/curricular_reference_relations[\s\S]{0,40}unique\s*\(\s*from_item_id\s*\)/i);
  });
});

describe("frontend", () => {
  it("nenhum código de navegador usa service_role", () => {
    const bad = prod.filter((f) => !/\.server\.tsx?$/.test(f) && !f.includes("integrations/supabase/") && /service_role|SERVICE_ROLE_KEY/.test(stripComments(readFileSync(f, "utf8"))));
    expect(bad).toEqual([]);
  });
  it("capacidade ≠ cargo: rótulo de cargo nunca filtra autorização", () => {
    for (const f of prod) {
      const s = stripComments(readFileSync(f, "utf8"));
      expect(s, f).not.toMatch(/\.eq\(\s*["']position_label_snapshot["']/);
      expect(s, f).not.toMatch(/positionLabel(Snapshot)?\s*===/);
    }
  });
  it("fontes oficiais (*-source, *-cloud) não importam fixtures", () => {
    const official = prod.filter((f) => /-(source|cloud)\.tsx?$/.test(f));
    for (const f of official) expect(readFileSync(f, "utf8"), f).not.toMatch(/from\s+["'][^"']*fixtures?["']/);
  });
  it("IDs canônicos do contrato D1 não dependem de rótulos", () => {
    const c = JSON.parse(readFileSync("docs/data/d1-contrato-canonico-cme-3-2026.json", "utf8")) as { positions: { id: string; source_label: string }[] };
    for (const p of c.positions) { expect(p.id).toMatch(/^[a-z0-9-]+$/); expect(p.source_label).toBeTruthy(); }
    expect(new Set(c.positions.map((p) => p.id)).size).toBe(c.positions.length);
  });
  it("exportação da auditoria exige capacidade específica", () => {
    const s = walk("src/features/audit").filter((f) => !f.includes(".test.")).map((f) => readFileSync(f, "utf8")).join("\n");
    expect(s).toMatch(/exportar-auditoria/);
  });
  it("importadores: D1 exige preflight; framework registra confirmação antes de aplicar", () => {
    const d1 = readFileSync("src/features/curriculum/d1-import.ts", "utf8");
    expect(d1.slice(d1.indexOf("export async function executePlan"))).toMatch(/preflight\(/);
    const eng = readFileSync("src/features/data-import/import-engine.ts", "utf8");
    const body = eng.slice(eng.indexOf("export async function applyConfirmed"));
    expect(body.indexOf('"confirmacao"')).toBeLessThan(body.indexOf("adapter.apply(r"));
  });
});

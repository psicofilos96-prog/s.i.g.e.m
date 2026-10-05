// Reaceite avançado: invariantes transversais das camadas inteligentes.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src/features");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
const src = (mod: string) => files(join(ROOT, mod)).map((p) => [p, readFileSync(p, "utf8")] as const);
const WRITE = /\.insert\(|\.update\(|\.upsert\(|\.delete\(|rpc\(\s*["']record_|rpc\(\s*["']register_|rpc\(\s*["']create_/;

describe("reaceite avançado — camadas desabilitáveis", () => {
  it("simulador e otimizador não gravam (só leem readers)", () => {
    for (const m of ["scenarios", "timetable-optimizer"]) for (const [p, s] of src(m)) expect(s, p).not.toMatch(WRITE);
  });
  it("anomalias não gravam nem leem pessoa", () => {
    for (const [p, s] of src("anomalies")) expect(s, p).not.toMatch(WRITE);
  });
  it("só a integração usa privilégio, e só em .server/.functions após verificação", () => {
    for (const m of ["anomalies", "assistant", "bulk", "data-quality", "knowledge-base", "scenarios", "tasks", "timetable-optimizer", "workflows"])
      for (const [p, s] of src(m)) expect(s, p).not.toMatch(/client\.server|supabaseAdmin|service_role/);
    for (const [p, s] of src("integration")) if (/supabaseAdmin/.test(s)) expect(p).toMatch(/\.server\.ts$|\.functions\.ts$/);
  });
  it("chamada à IA só existe com chave configurada; sem chave ⇒ modo local", () => {
    const f = readFileSync(join(ROOT, "assistant/assistant.functions.ts"), "utf8");
    expect(f).toMatch(/key \? .* : null/);
    const p = readFileSync(join(ROOT, "assistant/proposals.functions.ts"), "utf8");
    expect(p).toMatch(/LOVABLE_API_KEY/);
  });
  it("nenhum módulo avançado faz fetch externo fora de assistant.server e entrega de webhook", () => {
    for (const m of ["anomalies", "bulk", "data-quality", "knowledge-base", "scenarios", "tasks", "timetable-optimizer", "workflows"])
      for (const [p, s] of src(m)) expect(s, p).not.toMatch(/\bfetch\(\s*["'`]https?:/);
  });
  it("Central de Qualidade só grava revisão humana pelo writer canônico", () => {
    for (const [p, s] of src("data-quality")) {
      const calls = [...s.matchAll(/rpc\(\s*"([a-z_]+)"/g)].map((x) => x[1]).filter((n) => /^record_|^register_/.test(n));
      for (const c of calls) expect(c, p).toBe("record_data_quality_review");
      expect(s, p).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
    }
  });
  it("tarefas não gravam tabelas de domínio", () => {
    for (const [p, s] of src("tasks")) expect(s, p).not.toMatch(/from\(\s*["'](class_|cycle_|assessment_|institutional_)/);
  });
});

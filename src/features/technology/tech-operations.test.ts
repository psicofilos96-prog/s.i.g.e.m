import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TECH_STAGES } from "./tech-operations";
import { buildArgs } from "@/features/enrollments/enrollment-operations";
import { requiresSessionBeforeRead } from "@/features/authority/session-read-gate";

const MIG = "drizzle/migrations";
const files = readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort();
const sql = files.map((f) => readFileSync(join(MIG, f), "utf8")).join("\n");

function writerArgs(fn: string): string[] {
  const re = new RegExp(`FUNCTION public\\.${fn}\\(([^)]*)\\)`, "gi");
  const all = [...sql.matchAll(re)].filter((m) => /^\s*_/.test(m[1] ?? ""));
  expect(all.length, `writer ${fn} existe`).toBeGreaterThan(0);
  return all[all.length - 1]![1]!.split(",").map((a) => a.trim().split(/\s+/)[0]!).filter(Boolean);
}

describe("Lote corretivo 08 — central operacional de tecnologia", () => {
  const actions = TECH_STAGES.flatMap((s) => s.actions);
  it("cobre as áreas pedidas", () => {
    expect(TECH_STAGES.map((s) => s.id)).toEqual(["chamados", "sla", "sessoes", "mudancas", "inventario", "conectividade", "servicos", "acessos", "incidentes", "backup", "conhecimento", "pedagogico", "licencas"]);
  });
  it("cada ação envia exatamente os argumentos do writer existente", () => {
    for (const a of actions) {
      const sent = [...a.fields.map((f) => f.arg), ...(a.keyArg ? [a.keyArg] : [])].sort();
      expect(sent, a.rpc).toEqual(writerArgs(a.rpc).sort());
    }
  });
  it("só lê tabelas nascidas em migration e nunca colunas ocultas ou texto de relato", () => {
    for (const r of TECH_STAGES.flatMap((s) => s.reads)) {
      expect(sql, r.table).toMatch(new RegExp(`CREATE TABLE (IF NOT EXISTS )?public\\.${r.table}\\b`));
      for (const c of r.columns) expect(c, `${r.table}.${c}`).not.toMatch(/_ref$|^summary$|^justification$|^note$|^reason$|_person$/);
    }
  });
  it("console não grava tabela direto", () => {
    expect(readFileSync("src/components/sigem/operations-console.tsx", "utf8")).not.toMatch(/\.(insert|update|upsert|delete)\(/);
  });
  it("número decimal, sim/não e data-hora são convertidos; inválido é recusado", () => {
    const m = actions.find((a) => a.rpc === "record_tech_connectivity_measurement")!;
    const ok = buildArgs(m, { _link: "00000000-0000-4000-8000-000000000000", _at: "2026-10-12T10:30", _method: "speedtest", _down: "95,5", _avail: "sim" }, "k");
    expect(ok.problems).toEqual([]);
    expect(ok.args["_down"]).toBe(95.5);
    expect(ok.args["_avail"]).toBe(true);
    expect(buildArgs(m, { _link: "x", _at: "ontem", _method: "a", _avail: "talvez" }, "k").problems.length).toBe(3);
  });
  it("página exige sessão antes de ler", () => {
    expect(requiresSessionBeforeRead("/tecnologia/operacao")).toBe(true);
  });
});

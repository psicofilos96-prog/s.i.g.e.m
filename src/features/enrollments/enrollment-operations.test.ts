import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OPERATION_STAGES, buildArgs } from "./enrollment-operations";
import { requiresSessionBeforeRead } from "@/features/authority/session-read-gate";

const MIG = "drizzle/migrations";
const sql = readdirSync(MIG).filter((f) => /^04(5[5-9]|6\d|7[0-6])_/.test(f)).map((f) => readFileSync(join(MIG, f), "utf8")).join("\n");

/** Argumentos da definição mais recente do writer nas migrations de Matrículas. */
function writerArgs(fn: string): string[] {
  const re = new RegExp(`FUNCTION public\\.${fn}\\(([^)]*)\\)`, "gi");
  const all = [...sql.matchAll(re)].filter((m) => /^\s*_/.test(m[1] ?? ""));
  expect(all.length, `writer ${fn} existe`).toBeGreaterThan(0);
  return all[all.length - 1]![1]!.split(",").map((a) => a.trim().split(/\s+/)[0]!).filter(Boolean);
}

describe("Lote corretivo 06 — central operacional de matrículas", () => {
  const actions = OPERATION_STAGES.flatMap((s) => s.actions);

  it("cobre as 11 etapas pedidas", () => {
    expect(OPERATION_STAGES.map((s) => s.id)).toEqual(["campanhas", "conferencia", "protocolo", "classificacao", "distribuicao", "reservas", "listas", "confirmacao", "recursos", "enturmacao", "transferencias"]);
  });

  it("cada ação envia exatamente os argumentos do writer existente", () => {
    for (const a of actions) {
      const sent = [...a.fields.map((f) => f.arg), ...(a.keyArg ? [a.keyArg] : [])].sort();
      expect(sent, a.rpc).toEqual(writerArgs(a.rpc).sort());
    }
  });

  it("toda ação usa writer do banco; tela não grava tabela direto", () => {
    const page = readFileSync("src/components/sigem/operations-console.tsx", "utf8");
    expect(page).not.toMatch(/\.(insert|update|upsert|delete)\(/);
  });

  it("leituras não pedem colunas pessoais", () => {
    const cols = OPERATION_STAGES.flatMap((s) => s.reads.flatMap((r) => r.columns));
    for (const banned of ["requester_name", "student_name", "requester_cpf_hmac", "student_cpf_hmac", "requester_email", "requester_phone", "object_path"]) expect(cols).not.toContain(banned);
  });

  it("dado inválido é recusado antes de enviar e a chave idempotente vai junto", () => {
    const evt = actions.find((a) => a.rpc === "record_enr_transfer_event")!;
    expect(buildArgs(evt, { _hold: "x", _expected_seq: "a" }, "k").problems.length).toBeGreaterThan(0);
    const ok = buildArgs(evt, { _hold: "00000000-0000-4000-8000-000000000000", _expected_seq: "0", _action: "analisar", _origin: "m1", _reason: "r" }, "k1");
    expect(ok.problems).toEqual([]);
    expect(ok.args["_key"]).toBe("k1");
    expect(ok.args["_act"]).toBeNull();
  });

  it("a central não monta sem sessão", () => {
    expect(requiresSessionBeforeRead("/matriculas/operacao")).toBe(true);
  });
});

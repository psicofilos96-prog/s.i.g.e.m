import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { failureMetrics, recordRecovery, reportGoverned, resetFailureMetrics, userErrorText } from "./governed-errors";
import { formatLog, redactText } from "./telemetry";

let lines: string[] = [];
beforeEach(() => { lines = []; resetFailureMetrics();
  for (const m of ["log", "warn", "error"] as const) vi.spyOn(console, m).mockImplementation((l: string) => { lines.push(`${m}:${l}`); }); });
afterEach(() => vi.restoreAllMocks());

const SENS = "CPF 123.456.789-00 senha=abc123 laudo de autismo CID F84 joao@x.com Bearer eyJa.b.c";

describe("NOBS.3 — observabilidade", () => {
  it.each([
    ["stale-head", new Error("enrollment:base-superseded"), "conflito", "warn"],
    ["autorização", { status: 403, message: "permission denied for table x" }, "autorizacao", "warn"],
    ["rede", new TypeError("Failed to fetch"), "sem-conexao", "error"],
    ["validação", new Error("upload:tipo-nao-permitido"), "validacao", "warn"],
    ["inesperado", new Error("boom"), "falha-tecnica", "error"],
  ])("%s: categoria, nível e correlationId coerentes", (_n, err, cat, lvl) => {
    const g = reportGoverned(err, { route: "/secretaria", operation: "salvar-matricula" });
    expect(g.category).toBe(cat);
    const line = lines.find((l) => l.includes("governed_error"))!;
    expect(line.startsWith(`${lvl}:`)).toBe(true);
    const j = JSON.parse(line.slice(line.indexOf(":") + 1));
    expect(j.requestId).toBe(g.correlationId);
    expect(j).toMatchObject({ route: "/secretaria", operation: "salvar-matricula", category: cat });
  });
  it("nunca registra CPF, senha, laudo/CID, e-mail ou token", () => {
    reportGoverned(new Error(SENS), { operation: "x" });
    const all = lines.join("\n") + redactText(SENS) + formatLog({ event: "e", fields: { motivo: SENS, cpf: "1", laudo: "z" } });
    for (const bad of ["123.456.789-00", "abc123", "autismo", "F84", "joao@x.com", "eyJa.b.c"]) expect(all).not.toContain(bad);
  });
  it("métricas de falha por rota/operação/categoria; rótulo inválido não entra", () => {
    reportGoverned(new Error("Failed to fetch"), { route: "/diario", operation: "salvar" });
    reportGoverned(new Error("Failed to fetch"), { route: "/diario", operation: "salvar" });
    reportGoverned(new Error("x"), { route: "<script> 123.456.789-00", operation: "salvar" });
    const m = failureMetrics();
    expect(m[0]).toMatchObject({ route: "/diario", operation: "salvar", category: "sem-conexao", errorClass: "incident.dependency", count: 2 });
    expect(JSON.stringify(m)).not.toContain("123.456");
  });
  it("trilha de recuperação usa o mesmo correlationId e a tela mostra o código", () => {
    const text = userErrorText(new Error("Failed to fetch"), { operation: "salvar" });
    const id = /Código: (op-[a-f0-9]{12})/.exec(text)![1]!;
    recordRecovery(id, "recuperado", { operation: "salvar" });
    const rec = JSON.parse(lines.at(-1)!.replace(/^info:|^log:/, ""));
    expect(rec).toMatchObject({ event: "recovery", requestId: id, outcome: "recuperado" });
    recordRecovery("qualquer-coisa", "desistiu");
    expect(JSON.parse(lines.at(-1)!.replace(/^log:/, "")).requestId).toBeUndefined();
  });
});

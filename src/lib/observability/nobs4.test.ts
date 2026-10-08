import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecoveryTrail } from "./recovery-trail";

let lines: string[] = [];
beforeEach(() => { lines = []; for (const m of ["log", "info", "warn", "error"] as const) vi.spyOn(console, m).mockImplementation((l: string) => { lines.push(String(l)); }); });
afterEach(() => vi.restoreAllMocks());
const rec = () => lines.filter((l) => l.includes('"recovery"')).map((l) => JSON.parse(l.slice(l.indexOf("{"))));
const SENS = "CPF 123.456.789-00 joao@x.com laudo CID F84";

describe("NOBS.4 — trilha de recuperação", () => {
  it.each([
    ["rede", new TypeError("Failed to fetch"), "sem-conexao"],
    ["stale-head", new Error("enrollment:base-superseded"), "conflito"],
    ["autorização", { status: 403, message: "permission denied" }, "autorizacao"],
    ["inesperado", new Error(`boom ${SENS}`), "falha-tecnica"],
  ])("%s: nova tentativa → recuperado com o mesmo código, sem dado pessoal", (_n, err, cat) => {
    const retry = vi.fn();
    const t = createRecoveryTrail(err, { route: "/alunos", operation: "carregar" }, { onRetry: retry });
    expect(t.governed.category).toBe(cat);
    t.retry(); t.settle();
    expect(retry).toHaveBeenCalledOnce();
    const r = rec();
    expect(r.map((x) => x.fields?.outcome ?? x.outcome)).toEqual(["nova-tentativa", "recuperado"]);
    expect(lines.join("\n")).toContain(t.governed.correlationId);
    for (const l of lines.filter((l) => l.includes('"recovery"'))) expect(l).not.toMatch(/123\.456|joao@|F84/);
  });
  it("desistiu e recarregou encerram a trilha (sem recuperado posterior)", () => {
    const a = createRecoveryTrail(new Error("x"), { operation: "o" }); a.giveUp(); a.settle();
    const b = createRecoveryTrail(new Error("x"), { operation: "o" }); b.reload(); b.settle();
    expect(rec().map((x) => x.fields?.outcome ?? x.outcome)).toEqual(["desistiu", "recarregou"]);
  });
  it("sem nova tentativa, sair da tela não afirma recuperação", () => {
    createRecoveryTrail(new Error("x")).settle();
    expect(rec()).toEqual([]);
  });
});

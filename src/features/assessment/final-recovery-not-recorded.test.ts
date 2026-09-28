import { describe, expect, it } from "vitest";
import { finalRecoveryLabScenarios } from "./recovery-laboratory";

describe("6D.3.5.7 — “Não registrado” na Recuperação Final", () => {
  const by = (id: string) => finalRecoveryLabScenarios().find((s) => s.id === id)!;
  it("resultado oficial Não registrado ≠ insuficiência ≠ ausência", () => {
    const nr = by("nao-registrado").view;
    expect(nr.status).toBe("officially-not-recorded");
    expect(nr.label).toContain("Não registrado");
    expect(nr.reason).toContain("Motivo registrado: ausente");
    expect(nr.values.recovery).toBeNull();
    expect(by("sem-resultado").view.status).toBe("eligible-without-result");
    expect(by("sem-criterio").view.status).toBe("normative-insufficiency");
  });
  it("não altera o resultado pós-recuperação (segue em aberto)", () => {
    const r = by("nao-registrado").result;
    expect(r.kind === "consolidado" && r.postRecoveryScore).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { confirmAction } from "./confirm-action";
describe("confirmAction", () => {
  it("sem consequência explícita recusa", () => {
    expect(() => confirmAction({ title: "Remover?", consequence: "", actionLabel: "Remover" })).toThrow();
  });
  it("sem host montado falha fechada (não confirma)", async () => {
    await expect(confirmAction({ title: "Remover?", consequence: "Some da lista.", actionLabel: "Remover" })).resolves.toBe(false);
  });
});

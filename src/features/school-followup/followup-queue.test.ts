import { describe, expect, it } from "vitest";
import { FOLLOWUP_AREAS, QUEUE_PRESENTATION, deadlineText } from "./followup-queue";

describe("NOP.UX — áreas e fila", () => {
  it("separa revisar, acompanhar, decidir e histórico", () => {
    expect(FOLLOWUP_AREAS.map((a) => a.id)).toEqual(["revisar", "acompanhar", "decidir", "historico"]);
  });
  it("cada pendência tem motivo e próxima ação", () => {
    for (const q of Object.values(QUEUE_PRESENTATION)) { expect(q.reason).not.toBe(""); expect(q.next).not.toBe(""); }
  });
  it("prazo não declarado nunca é inventado", () => {
    expect(deadlineText(null)).toBe("Sem prazo registrado");
    expect(Object.values(QUEUE_PRESENTATION).every((q) => q.deadline === null)).toBe(true);
  });
});

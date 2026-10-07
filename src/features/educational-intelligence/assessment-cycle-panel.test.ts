import { describe, expect, it } from "vitest";
import { countByState, cycleMessage } from "./assessment-cycle-panel";

describe("tela do ciclo", () => {
  it("edição sem evento conta como sem estado, nunca planejada", () => {
    const c = countByState([null, "planejada", "publicada", null]);
    expect(c.find((x) => x.key === "sem-estado")!.n).toBe(2);
    expect(c.find((x) => x.key === "planejada")!.n).toBe(1);
  });
  it("recusas do banco viram mensagem humana", () => {
    expect(cycleMessage("ei:cycle-head-changed")).toMatch(/Outra pessoa/);
    expect(cycleMessage("ei:cycle-transition-invalid")).toMatch(/não pode/);
  });
});

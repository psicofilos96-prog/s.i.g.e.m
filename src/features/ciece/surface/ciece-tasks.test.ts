import { describe, expect, it } from "vitest";
import { CIECE_TASKS } from "./ciece-tasks";
describe("NCIECE.UX — tarefas", () => {
  it("são exatamente: qualidade, Mapa, fontes", () => {
    expect(CIECE_TASKS.map((t) => t.id)).toEqual(["qualidade", "mapa", "fontes"]);
  });
  it("cada tarefa tem uma ação principal", () => {
    for (const t of CIECE_TASKS) expect(t.links.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import { projectTermQueue, suggestAliases } from "./term-review-queue";
describe("N8.2 fila de termos", () => {
  it("pendente até ato humano; histórico preservado", () => {
    const ev = [{ kind: "recebido" as const, termId: "t", original: "Déficit Atenção", origin: "laudo", context: "matrícula", at: "1" }];
    expect(projectTermQueue(ev)[0]).toMatchObject({ status: "pendente", categoryId: null });
    const v = projectTermQueue([...ev, { kind: "validado", termId: "t", categoryId: "c1", alias: "deficit de atencao", actor: "nei", at: "2" }])[0]!;
    expect(v).toMatchObject({ status: "validado", categoryId: "c1" }); expect(v.history).toHaveLength(2);
  });
  it("sugestão nunca confirma", () => {
    const s = suggestAliases("Déficit de atenção", [{ alias: "deficit de atencao", categoryId: "c1" }, { alias: "outro", categoryId: "c2" }]);
    expect(s).toHaveLength(1); expect(s[0]).toMatchObject({ categoryId: "c1", confirmed: false });
  });
});

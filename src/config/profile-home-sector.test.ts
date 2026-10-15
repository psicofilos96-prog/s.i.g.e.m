import { describe, expect, it } from "vitest";
import { homeActionsFor } from "./profile-home";

describe("início por setor", () => {
  it("Secretaria vê primeiro o cartão do setor e as rotas do setor", () => {
    const r = homeActionsFor(() => true, { station: "secretaria_escolar", routes: ["/secretaria", "/alunos", "/turmas"] });
    expect(r.primary.map((a) => a.to).slice(0, 3)).toEqual(["/secretaria", "/alunos", "/turmas"]);
    expect(r.primary).toHaveLength(6);
  });
  it("cartão do setor não aparece sem permissão", () => {
    const r = homeActionsFor((p) => p !== "/secretaria", { station: "secretaria_escolar", routes: ["/secretaria"] });
    expect(r.primary.some((a) => a.to === "/secretaria")).toBe(false);
  });
});

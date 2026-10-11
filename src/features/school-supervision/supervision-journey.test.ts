import { describe, it, expect } from "vitest";
import { journeyState, filterRecords } from "./supervision-journey";

describe("percurso", () => {
  it("só a etapa com writer real fica disponível; as demais aguardam decisão", () => {
    const s = journeyState(true);
    expect(s.filter((x) => x.state === "disponivel").map((x) => x.id)).toEqual(["situacao"]);
    expect(journeyState(false).find((x) => x.id === "situacao")!.state).toBe("consulta");
    expect(s.filter((x) => x.state === "aguardando-decisao")).toHaveLength(6);
  });
  it("busca sem acento sobre linhas já lidas", () => {
    expect(filterRecords([{ subject: "Visita de orientação", referral: null }, { subject: "Livro", referral: "matrícula" }], "orientacao")).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import { confront } from "./secretariat-competences";

// Recorte das regras observadas na política homologada v8 em 2026-10-11 (evidência, não fonte de autorização).
const V8: Record<string, string[]> = {
  "secretaria-escolar": ["manter-identidade-cadastral-do-estudante", "manter-matricula-e-enturmacao", "manter-cadastro-de-turmas", "registrar-movimentacao-escolar", "preparar-mapa-estatistico", "consultar-frequencia"],
  "direcao-escolar": ["oficializar-mapa-estatistico", "consultar-frequencia", "consultar-planejamento-docente"],
  "ciece-estatistica": ["consultar-mapa-estatistico"],
};

describe("Secretaria — competências × política homologada", () => {
  const f = confront(V8);
  it("auxiliar e supervisão não têm tipo de atuação: lacuna explícita, nunca herança", () => {
    expect(f.filter((x) => x.kind === "papel-sem-atuacao").map((x) => x.role)).toEqual([]);
    expect(confront({}).some((x) => x.kind === "falta")).toBe(true);
  });
  it("divergência real: secretaria consulta frequência, contra o §1 do documento", () => {
    expect(f.filter((x) => x.kind === "excesso")).toEqual([{ role: "secretario", capability: "consultar-frequencia", section: "§1 não acessa painel de Rendimento/Frequência", kind: "excesso" }]);
  });
  it("Direção não edita matrícula nem aluno; secretário tem o núcleo", () => {
    expect(f.filter((x) => x.kind === "falta")).toEqual([]);
  });
});

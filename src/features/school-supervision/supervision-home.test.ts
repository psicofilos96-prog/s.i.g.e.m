import { describe, expect, it } from "vitest";
import { supervisionHome } from "./supervision-home";

const st = (held: string[], id: string) => supervisionHome(new Set(held)).find((t) => t.id === id)!.state;

describe("NSUP.1 home da Supervisão", () => {
  it("perfil escolar sem capacidade de rede não age no calendário (pendente de atribuição)", () => {
    expect(st(["consultar-supervisao-da-propria-escola"], "calendario")).toBe("assignment-pending");
  });
  it("capacidade de construção do calendário habilita agir", () => {
    expect(st(["construir-calendario-da-rede"], "calendario")).toBe("pode-agir");
  });
  it("exportar auditoria sem política atribuída fica pendente", () => {
    expect(st([], "historico")).toBe("assignment-pending");
  });
  it("relatórios são só consulta, nunca concedem ação", () => {
    expect(st(["construir-calendario-da-rede"], "relatorios")).toBe("so-consulta");
  });
});

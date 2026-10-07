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

import { existsSync } from "node:fs";
import { SUPERVISION_TOOLS as T2, supervisionHome as home2 } from "./supervision-home";
describe("NSUP.1 — rotas e negativos", () => {
  it("toda ferramenta aponta para página existente", () => {
    for (const t of T2) {
      const base = t.to.slice(1);
      expect(existsSync(`src/routes/${base}.tsx`) || existsSync(`src/routes/${base}.index.tsx`), t.to).toBe(true);
    }
  });
  it("perfil escolar (capacidades só de escola) nunca vira 'pode-agir'", () => {
    const escolar = new Set(["manter-matricula-e-enturmacao", "consultar-supervisao-da-propria-escola"]);
    expect(home2(escolar).filter((t) => t.state === "pode-agir")).toEqual([]);
  });
  it("sem capacidades nada é concedido", () => {
    expect(home2(new Set()).some((t) => t.state === "pode-agir")).toBe(false);
  });
});

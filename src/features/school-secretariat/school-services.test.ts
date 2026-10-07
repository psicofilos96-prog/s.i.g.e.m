import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { SCHOOL_SERVICES, availableServices } from "./school-services";

describe("Serviços da escola", () => {
  it("todo serviço com link aponta para uma tela que existe", () => {
    for (const s of availableServices()) {
      expect(existsSync(`src/routes${s.to}.tsx`)).toBe(true);
    }
  });
  it("transporte, infraestrutura e atendimento domiciliar ficam indisponíveis enquanto não houver tela", () => {
    const off = SCHOOL_SERVICES.filter((s) => !s.to).map((s) => s.key);
    expect(off).toEqual(["transporte", "infraestrutura", "domiciliar"]);
  });
});

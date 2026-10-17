import { describe, expect, it } from "vitest";
import { canConfigureInfrequency, readInfrequencyConfiguration } from "./infrequency-configuration";
describe("autorização da configuração de avisos", () => {
  it("não concede edição à Secretaria com capacidade escolar", () => {
    expect(canConfigureInfrequency([{ capabilityId: "manter-comunicacao-institucional", schoolId: "inep-99999901" }])).toBe(false);
  });
  it("aceita somente capacidade efetiva de comunicação da rede", () => {
    expect(canConfigureInfrequency([{ capabilityId: "manter-comunicacao-institucional", schoolId: null }])).toBe(true);
    expect(canConfigureInfrequency([{ capabilityId: "emitir-notificacao", schoolId: null }])).toBe(false);
    expect(canConfigureInfrequency([])).toBe(false);
  });
  it("recusa estado sem versão ou ativação válidas", () => {
    expect(() => readInfrequencyConfiguration({ version: -1, enabled: "true" })).toThrow();
  });
});

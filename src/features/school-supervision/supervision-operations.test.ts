import { describe, it, expect } from "vitest";
import { inclusionView, assertMinimal, recordInspection, demandsFrom } from "./supervision-operations";

describe("inclusão", () => {
  it("suprime 1–4, ausência não é zero e recusa campo sensível", () => {
    const v = inclusionView([
      { schoolId: "E1", key: "aee-ativo", count: 3 }, { schoolId: "E1", key: "mediacao-vigente", count: null },
      { schoolId: "E2", key: "aee-ativo", count: 9 },
    ], ["E1"]);
    expect(v.map((x) => x.display)).toEqual(["1–4 (suprimido)", "não registrado"]);
    expect(assertMinimal({ schoolId: "E1", key: "aee-ativo", count: 3 })).toBe(true);
    expect(assertMinimal({ schoolId: "E1", key: "aee-ativo", count: 3, cid: "F84" })).toBe(false);
  });
});

describe("inspeção", () => {
  const ev = { schoolId: "E1", visitId: "v1", principalId: "p", isHuman: true, level: "registrar",
    observations: [{ area: "sanitarios" as const, status: "atencao" as const, note: "torneira vazando", evidencePaths: ["supervisao/E1/v1/foto.jpg"] }] };
  it("recusa laudo técnico, evidência fora do caminho e autor não humano", () => {
    expect(recordInspection([], { ...ev, observations: [{ ...ev.observations[0]!, note: "risco estrutural, interditar" }] }, 0)).toEqual({ ok: false, code: "fora-de-atribuicao" });
    expect(recordInspection([], { ...ev, observations: [{ ...ev.observations[0]!, evidencePaths: ["publico/x.jpg"] }] }, 0)).toEqual({ ok: false, code: "evidencia-fora-do-caminho-privado" });
    expect(recordInspection([], { ...ev, isHuman: false }, 0)).toEqual({ ok: false, code: "autor-nao-humano" });
  });
  it("encaminha ao setor e reaproveita ordem aberta", () => {
    const r = recordInspection([], { ...ev, observations: [...ev.observations, { area: "cozinha", status: "atencao", note: "fogão sem uso", evidencePaths: [] }] }, 0);
    if (!r.ok) throw new Error(r.code);
    const d = demandsFrom(r.value[0]!, [{ ref: "OS-9", schoolId: "E1", area: "sanitarios", open: true, sector: "manutencao" }]);
    expect(d[0]).toMatchObject({ action: "anexar-a-existente", ref: "OS-9" });
    expect(d[1]).toMatchObject({ action: "abrir-demanda", owner: "NAE/Alimentação" });
  });
});

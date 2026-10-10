import { describe, expect, it } from "vitest";
import { attendancePct, componentResult, ejaResult, finalAverage, NETWORK_MODEL_PROFILES, periodGradeFI, periodGradeFII } from "./network-model-rules";
import { BASE_PROFILES, officialResultGate, profileFor } from "./stage-engine";

describe("regras dos modelos de diário da rede", () => {
  it("Fund. II: recuperação paralela substitui AV1+AV2 só se maior", () => {
    expect(periodGradeFII({ av1: 10, av2: 10, instruments: 20, participation: 8, parallelRecovery: 40 })).toBe(68);
    expect(periodGradeFII({ av1: 25, av2: 25, instruments: 20, participation: 8, parallelRecovery: 30 })).toBe(78);
  });
  it("ausência nunca vira zero", () => {
    expect(periodGradeFII({ av1: null, av2: null, instruments: null, participation: null, parallelRecovery: null })).toBeNull();
    expect(periodGradeFI([null, null])).toBeNull();
    expect(finalAverage([60, null, 70, 80])).toBeNull();
  });
  it("média final arredondada das 4 notas", () => expect(finalAverage([50, 51, 50, 50])).toBe(50));
  it("frequência 100% com falta vira 0,99", () => {
    expect(attendancePct(200, 1)).toBe(0.99);
    expect(attendancePct(100, 25)).toBe(0.75);
  });
  it("aprovação por componente com 50 e recuperação final", () => {
    expect(componentResult("Ativo", 49, null)).toBe("REPROVADO");
    expect(componentResult("Ativo", 40, 50)).toBe("APROVADO");
    expect(componentResult("Transferido", 90, null)).toBe("TRANSFERIDO");
  });
  it("EJA exige todos os componentes e 75% de frequência", () => {
    const ok = [{ average: 60, finalRecovery: null }, { average: 45, finalRecovery: 55 }];
    expect(ejaResult("Ativo", ok, 0.75)).toBe("APROVADO");
    expect(ejaResult("Ativo", ok, 0.74)).toBe("REPROVADO");
  });
  it("perfil v2 libera resultado; EI segue sem regra de nota", () => {
    const all = [...BASE_PROFILES, ...NETWORK_MODEL_PROFILES];
    const f2 = profileFor("fundamental-anos-finais", all);
    expect(f2.ok && officialResultGate(f2.profile).state).toBe("liberado");
    const ei = profileFor("educacao-infantil", all);
    expect(ei.ok && ei.profile.version).toBe(1);
  });
});

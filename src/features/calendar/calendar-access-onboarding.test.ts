import { describe, expect, it } from "vitest";
import { calendarAccessStep, safeInstallReturn } from "./calendar-access-onboarding";

const lido = (installation: string | null, designated: boolean, caps: string[] = []) =>
  ({ status: "lido" as const, installation, designated, networkCapabilities: caps });

describe("B4.6.8 caminho de acesso ao calendário", () => {
  it("conta designada antes da instalação: instalar + prévia da fonte", () => {
    expect(calendarAccessStep(lido("nao-instalado", true))).toEqual({ kind: "instalar", sourcePreview: true });
  });
  it("conta comum antes da instalação: aguarda, sem prévia nem gestão", () => {
    expect(calendarAccessStep(lido("nao-instalado", false))).toEqual({ kind: "aguardando-instalacao" });
  });
  it("designação nunca concede gestão depois da instalação", () => {
    expect(calendarAccessStep(lido("instalado", true, []))).toEqual({ kind: "sem-capacidade-calendario" });
  });
  it("Supervisão autorizada pós-instalação: gestão", () => {
    expect(calendarAccessStep(lido("instalado", false, ["construir-calendario-da-rede"])).kind).toBe("gestao");
  });
  it("capacidade não relacionada não abre gestão", () => {
    expect(calendarAccessStep(lido("instalado", false, ["manter-cadastro-unidade-escolar"])).kind).toBe("sem-capacidade-calendario");
  });
  it("erro de leitura e estado ausente falham fechados", () => {
    expect(calendarAccessStep({ status: "erro" }).kind).toBe("erro-leitura");
    expect(calendarAccessStep(lido(null, true)).kind).toBe("estado-desconhecido");
  });
  it("B4.6.8: conta designada com autoridade do calendário vai direto à gestão mesmo sem instalação", () => {
    expect(calendarAccessStep(lido("nao-instalado", true, ["construir-calendario-da-rede"])).kind).toBe("gestao");
    expect(calendarAccessStep(lido("nao-instalado", false, ["homologar-calendario-da-rede"])).kind).toBe("gestao");
  });
  it("retorno pós-instalação só aceita o calendário", () => {
    expect(safeInstallReturn("/calendario-escolar")).toBe("/calendario-escolar");
    expect(safeInstallReturn("https://evil.example")).toBeNull();
    expect(safeInstallReturn(null)).toBeNull();
  });
});

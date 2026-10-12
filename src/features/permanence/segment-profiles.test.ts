import { describe, it, expect } from "vitest";
import { resolveProfile, contactTargetFor, fitsDeclaredAvailability, attendanceSignalAllowed, outOfSchoolSignalAllowed, type SegmentProfile } from "./segment-profiles";

const p = (o: Partial<SegmentProfile>): SegmentProfile => ({ id: "x", version: 1, stage: null, modality: null, regime: "anual", contactTarget: "responsavel", attendanceUse: "sinal-de-acompanhamento", allowsOutOfSchoolSignal: false, authorPerson: "a", approvedBy: "b", decisionRef: "d", ...o });
const ei = p({ id: "ei", stage: "educacao-infantil", attendanceUse: "nao-usar", allowsOutOfSchoolSignal: true });
const eja = p({ id: "eja", modality: "eja", regime: "semestral", contactTarget: "proprio-estudante" });
const ef = p({ id: "ef", stage: "fundamental" });

describe("L17 perfis por segmento", () => {
  it("sem perfil aprovado não aplica regra de outro segmento", () => {
    expect(resolveProfile([ef], { stage: "educacao-infantil", modality: null })).toEqual({ kind: "indeterminado", reason: "sem-perfil" });
    expect(resolveProfile([p({ ...ei, approvedBy: "a" })], { stage: "educacao-infantil", modality: null }).kind).toBe("indeterminado");
    expect(resolveProfile([ef], { stage: null, modality: null })).toEqual({ kind: "indeterminado", reason: "contexto-ausente" });
  });
  it("EI pode não usar frequência e permite sinalização sem matrícula", () => {
    const r = resolveProfile([ei, ef], { stage: "educacao-infantil", modality: null });
    expect(attendanceSignalAllowed(r, null)).toEqual({ allowed: false, reason: "perfil-nao-usa-frequencia" });
    expect(outOfSchoolSignalAllowed(r)).toBe(true);
  });
  it("EJA semestral exige calendário do semestre e fala com o próprio adulto", () => {
    const c = { stage: "fundamental", modality: "eja", adult: true };
    expect(resolveProfile([ef, eja], c)).toEqual({ kind: "indeterminado", reason: "perfis-concorrentes" });
    const r = resolveProfile([eja], c);
    expect(attendanceSignalAllowed(r, null).reason).toBe("semestre-sem-calendario");
    expect(attendanceSignalAllowed(r, { from: "2026-02-01", to: "2026-07-01" }).allowed).toBe(true);
    expect(contactTargetFor(r, c)).toBe("proprio-estudante");
    expect(contactTargetFor(r, { ...c, adult: null })).toBeNull();
  });
  it("horário de adulto só pelo declarado; sem declaração não presume", () => {
    expect(fitsDeclaredAvailability(null, { weekday: 1, time: "19:00" })).toBeNull();
    expect(fitsDeclaredAvailability([{ weekday: 1, from: "18:00", to: "22:00" }], { weekday: 1, time: "19:00" })).toBe(true);
    expect(fitsDeclaredAvailability([{ weekday: 1, from: "18:00", to: "22:00" }], { weekday: 1, time: "09:00" })).toBe(false);
  });
});

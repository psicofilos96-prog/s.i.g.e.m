import { describe, it, expect } from "vitest";
import { BASE_PROFILES, profileFor, officialResultGate, acceptsGrades, attendanceGranularity, periodsFor, type StageProfile } from "./stage-engine";
import { bulletinFor, bulletinBatch, printBulletin, performanceSample } from "./bulletin";
import { variantMap, variantAnswerKey, toCanonical, proposeCorrection, confirmCorrection } from "@/features/teacher-assessment/variant-key";
import type { InstrumentVersion, ItemVersion } from "@/features/teacher-assessment/authoring-model";

const P = (id: string) => { const r = profileFor(id); if (!r.ok) throw new Error(r.reason); return r.profile; };

describe("motor por etapa", () => {
  it("EI sem notas, por habilidades e frequência diária", () => { const p = P("educacao-infantil"); expect(acceptsGrades(p)).toBe(false); expect(p.forms).toContain("habilidades"); expect(attendanceGranularity(p)).toBe("diaria"); });
  it("Fundamental I frequência diária; II por componente", () => { expect(attendanceGranularity(P("fundamental-anos-iniciais"))).toBe("diaria"); expect(attendanceGranularity(P("fundamental-anos-finais"))).toBe("por-componente"); });
  it("EJA usa semestres do calendário oficial, sem número fixo", () => {
    const r = periodsFor(P("eja"), [{ kind: "semestre", id: "s1" }, { kind: "semestre", id: "s2" }, { kind: "periodo", id: "b1" }]);
    expect(r.ok && r.periods.map((x) => x.id)).toEqual(["s1", "s2"]);
    expect(periodsFor(P("eja"), null).ok).toBe(false);
  });
  it("sem regra homologada o resultado oficial é bloqueado em todas as etapas", () => { for (const p of BASE_PROFILES) expect(officialResultGate(p).state).toBe("bloqueado"); });
  it("só libera com regra e escala homologadas", () => {
    const p: StageProfile = { ...P("fundamental-anos-finais"), version: 2, approvalRule: { state: "homologado", ref: "regra@1" }, gradeScale: { state: "homologado", ref: "escala@1" } };
    expect(officialResultGate(p).state).toBe("liberado");
    expect(profileFor("fundamental-anos-finais", [...BASE_PROFILES, p]).ok).toBe(true);
  });
  it("etapa ausente ou desconhecida não é presumida", () => { expect(profileFor(null).ok).toBe(false); expect(profileFor("x").ok).toBe(false); });
});

describe("boletim, lote, amostra e impressão", () => {
  const periods = [{ id: "p1", label: "1º" }], comps = [{ id: "mat", label: "Matemática" }];
  const entries = [{ studentId: "s1", periodId: "p1", componentId: "mat", grade: 7, absences: 2 }, { studentId: "s2", periodId: "p1", componentId: "mat", grade: null, absences: null }];
  it("ausência fica nula, nunca zero, e resultado bloqueado é declarado", () => {
    const b = bulletinFor({ id: "s2", name: "Sintético 2" }, P("fundamental-anos-finais"), periods, comps, entries);
    expect(b.rows[0]).toEqual(["Matemática", null, null]);
    expect(String(b.params["resultado"])).toMatch(/^bloqueado/);
  });
  it("EI não tem coluna de nota", () => { const b = bulletinFor({ id: "s1", name: "S" }, P("educacao-infantil"), periods, comps, entries); expect(b.columns.some((c) => c.label.includes("nota"))).toBe(false); });
  it("lote gera um boletim por aluno", () => { expect(bulletinBatch([{ id: "s1", name: "a" }, { id: "s2", name: "b" }], P("eja"), periods, comps, entries)).toHaveLength(2); });
  it("PDF paisagem com bordas vetoriais em pt", () => {
    const h = printBulletin(bulletinFor({ id: "s1", name: "S" }, P("eja"), periods, comps, entries), { headerLines: [], title: "Boletim" });
    expect(h).toContain("size:A4 landscape"); expect(h).toContain("0.75pt solid"); expect(h).not.toContain("1px solid #999");
  });
  it("amostra separa não informados", () => { expect(performanceSample(entries, [{ label: "≥6", min: 6, max: 10 }])).toEqual({ notInformed: 1, bands: [{ label: "≥6", count: 1 }] }); });
});

describe("SIA gabarito por versão", () => {
  const items = new Map(["a", "b", "c"].map((id) => [id, { id, item_type_id: "objetiva", stem: id, options: [{ key: "A", text: "1" }, { key: "B", text: "2" }, { key: "C", text: "3" }, { key: "D", text: "4" }] } as unknown as ItemVersion]));
  const ins = { id: "v1", instrument_id: "i", version: 1, items: ["a", "b", "c"].map((x) => ({ item_version_id: x })), randomization: null, title: "P", instructions: "" } as unknown as InstrumentVersion;
  const keys = new Map([["a", "B"], ["b", "D"], ["c", "A"]]);
  it("recusa sem aprovação da OP", () => { expect(variantMap(ins, items, "A", false).ok).toBe(false); });
  it("mapeamento é reversível e gabarito acerta todas", () => {
    for (const L of "ABCDEFGH") {
      const m = variantMap(ins, items, L, true); if (!m.ok) throw new Error();
      const k = variantAnswerKey(m.map, keys);
      for (const e of m.map.entries) expect(toCanonical(m.map, e.number, k[e.number]!)?.optionKey).toBe(keys.get(e.itemVersionId));
      expect(proposeCorrection(m.map, keys, k as Record<number, string>).hits).toBe(3);
    }
  });
  it("em branco e sem gabarito não viram erro", () => {
    const m = variantMap(ins, items, "C", true); if (!m.ok) throw new Error();
    const r = proposeCorrection(m.map, new Map([["a", "B"]]), {});
    expect(r.hits).toBe(0); expect(r.undetermined).toBe(3); expect(r.status).toBe("proposta");
  });
  it("confirmação exige ato humano e recusa instrumento editado após aprovação", () => {
    expect(confirmCorrection({ confirmedByUser: true, approvedFingerprint: "x", currentFingerprint: "y" }).ok).toBe(false);
    expect(confirmCorrection({ confirmedByUser: false, approvedFingerprint: "x", currentFingerprint: "x" }).ok).toBe(false);
    expect(confirmCorrection({ confirmedByUser: true, approvedFingerprint: null, currentFingerprint: "x" }).ok).toBe(false);
    expect(confirmCorrection({ confirmedByUser: true, approvedFingerprint: "x", currentFingerprint: "x" }).ok).toBe(true);
  });
});

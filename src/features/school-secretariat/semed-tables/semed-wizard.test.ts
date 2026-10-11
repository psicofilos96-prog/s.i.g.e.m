import { describe, expect, it } from "vitest";
import { SEMED_TABLES_2026 } from "./semed-catalog";
import { blocked, checklist, fieldError, packagePlan, progress, stepOf } from "./semed-wizard";

const t09 = SEMED_TABLES_2026.find((t) => t.code === "09")!;
const t11 = SEMED_TABLES_2026.find((t) => t.code === "11")!;
const intKey = Object.entries((() => { const o: Record<string, string> = {}; for (const s of t11.sections) if (s.kind === "grid") for (const r of s.rows) for (const c of s.cols) if (c.type === "int") o[`${s.id}.${r.key}.${c.key}`] = c.type; return o; })())[0]![0];

describe("assistente Tabelas SEMED", () => {
  it("devolução volta à etapa de preencher; envio fica com o CIECE", () => {
    expect(stepOf("devolvido")).toBe("preencher");
    expect(stepOf("revisao-solicitada")).toBe("preencher");
    expect(stepOf("conferido")).toBe("conferir");
    expect(stepOf("enviado")).toBe("ciece");
    expect(stepOf("fechado")).toBe("fechado");
  });
  it("valor inválido é erro do campo; vazio não é erro", () => {
    expect(fieldError(t11, intKey, -1)).toMatch(/Entre/);
    expect(fieldError(t11, intKey, 2.5)).toMatch(/inteiro/);
    expect(fieldError(t11, intKey, null)).toBeNull();
    expect(fieldError(t11, intKey, 3)).toBeNull();
  });
  it("não salvo ou inválido bloqueia envio; vazio só avisa", () => {
    expect(blocked(checklist(t11, {}, {}, {}, { dirty: false, hasSaved: false, state: "rascunho" }))).toBe(true);
    expect(blocked(checklist(t11, {}, { [intKey]: 1 }, {}, { dirty: true, hasSaved: true, state: "rascunho" }))).toBe(true);
    const ok = checklist(t11, { [intKey]: 1 }, { [intKey]: 1 }, {}, { dirty: false, hasSaved: true, state: "rascunho" });
    expect(blocked(ok)).toBe(false);
    expect(ok.some((i) => i.level === "aviso")).toBe(true);
  });
  it("dado central ausente vira aviso, nunca valor", () => {
    const c = checklist(t09, {}, {}, { escola: "X" }, { dirty: false, hasSaved: true, state: "rascunho" });
    expect(c.some((i) => i.text.startsWith("Cadastro central sem"))).toBe(true);
  });
  it("progresso conta linha da grade uma vez, mesmo com várias colunas", () => {
    const g = t11.sections.find((s) => s.kind === "grid")!;
    if (g.kind !== "grid") throw new Error();
    const r = g.rows[0]!.key;
    const p = progress(t11, { [`${g.id}.${r}.${g.cols[0]!.key}`]: 1, [`${g.id}.${r}.${g.cols[1]!.key}`]: 2 });
    expect(p.sections.find((s) => s.id === g.id)!.filled).toBe(1);
  });
  it("pacote anual não imprime tabela sem rascunho", () => {
    expect(packagePlan(["04", "06", "09"], (c) => c !== "06")).toEqual({ include: ["04", "09"], missing: ["06"] });
  });
});

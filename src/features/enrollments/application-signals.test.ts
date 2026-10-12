import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { openSignals, resolutionProblems, type Signal } from "./application-signals";

const sql = readFileSync("drizzle/migrations/0464_enr12_application_signals.sql", "utf8");
const sig = (decision: Signal["decision"]): Signal => ({ signal_kind: "inscricao-repetida", related_key: "INS-1", evidence: "", strength: "forte", decision, decided_at: null });

describe("L12 sinais de inscrição", () => {
  it("aberto = sem decisão ou indeterminado", () => {
    expect(openSignals([sig(null), sig("indeterminado"), sig("legitimo"), sig("procede")])).toHaveLength(2);
  });
  it("decisão exige motivo de 20+ caracteres", () => {
    expect(resolutionProblems("curto")).toHaveLength(1);
    expect(resolutionProblems("Irmãos gêmeos, conferido com certidão.")).toEqual([]);
  });
  it("banco: sinal é projeção, sem exclusão/fusão; já matriculado só por reconciliação humana; chave nunca é CPF", () => {
    expect(sql).not.toMatch(/DELETE FROM|UPDATE public\.(enr_applications|institutional_students|school_enrollments)/);
    expect(sql).not.toMatch(/INSERT INTO public\.(institutional_students|school_enrollments|enr_applications)/);
    expect(sql).toContain("r.decision = 'mesmo-estudante'");
    expect(sql).toMatch(/related_key = código do outro pedido \(nunca CPF\/HMAC\)/);
    expect(sql).not.toMatch(/SELECT[^;]*cpf_hmac\s+(rk|AS)/);
    expect(sql).toContain("sinal-inexistente");
    expect(sql).toContain("enr_signal_resolutions_append_only");
    expect(sql).toContain("length(btrim(reason)) >= 20");
  });
});

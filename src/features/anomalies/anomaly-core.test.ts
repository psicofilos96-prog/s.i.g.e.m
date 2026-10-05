import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { detect, DEFAULT_PARAMS, METHOD, FORBIDDEN_LANGUAGE, type Series } from "./anomaly-core";

const s = (vals: (number | null)[]): Series => ({ id: "t", title: "Linhas por lote", population: "lotes de teste", unit: "linhas", points: vals.map((v, i) => ({ key: `p${String(i).padStart(2, "0")}`, value: v })) });

describe("detecção assistida de anomalias", () => {
  it("sinaliza queda abrupta (possível erro de importação) com evidência completa", () => {
    const o = detect(s([100, 102, 98, 101, 99, 100, 3]));
    expect(o.state).toBe("verificado");
    if (o.state !== "verificado") return;
    const x = o.signals[0]!;
    expect(x.direction).toBe("abaixo");
    expect(x.method).toBe(METHOD.id);
    expect(x.params).toEqual(DEFAULT_PARAMS);
    expect(x.reference.window).toEqual(["p00", "p05"]);
    expect(x.population).toBe("lotes de teste");
    expect(x.limitations.length).toBeGreaterThan(0);
    expect(x.explanation).toMatch(/revisar/);
  });
  it("série estável não gera sinal", () => {
    const o = detect(s([100, 101, 99, 100, 102, 98, 100, 101]));
    expect(o.state === "verificado" && o.signals.length).toBe(0);
  });
  it("grupos pequenos não geram sinal", () => {
    const o = detect(s([1, 2, 1, 1, 2, 1, 9]));
    expect(o.state === "verificado" && o.signals.length).toBe(0);
    expect(o.state === "verificado" && o.skippedSmall).toBeGreaterThan(0);
  });
  it("dado ausente não vira zero e histórico curto é não verificável", () => {
    const o = detect(s([100, null, 101, null, 99, 100, 100, 100]));
    expect(o.state === "verificado" && o.signals.length).toBe(0);
    expect(o.missing).toBe(2);
    expect(detect(s([100, null, null, 5])).state).toBe("nao-verificavel");
  });
  it("drift gradual não dispara; salto dispara", () => {
    const drift = Array.from({ length: 20 }, (_, i) => 100 + i * 3);
    expect(detect(s(drift)).state === "verificado" && (detect(s(drift)) as any).signals.length).toBe(0);
    const o = detect(s([...drift, 400]));
    expect(o.state === "verificado" && o.signals.length).toBe(1);
  });
  it("parâmetros inválidos recusam em vez de presumir", () => {
    expect(detect(s([1, 2, 3, 4, 5, 6]), { ...DEFAULT_PARAMS, minReference: 1 }).state).toBe("nao-verificavel");
  });
  it("sem pessoa, sem linguagem de culpa, sem escrita e só cliente do usuário", () => {
    const core = readFileSync("src/features/anomalies/anomaly-core.ts", "utf8");
    const src = readFileSync("src/features/anomalies/anomaly-sources.ts", "utf8");
    const ui = readFileSync("src/routes/revisao-de-anomalias.tsx", "utf8");
    expect(src).not.toMatch(/student|person|recipient_user|operator|supabaseAdmin|client\.server|\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
    expect(FORBIDDEN_LANGUAGE.test(ui.replace(/FORBIDDEN_LANGUAGE/g, ""))).toBe(false);
    expect(core).not.toMatch(/previs|predict|forecast/i);
    const o = detect(s([100, 102, 98, 101, 99, 100, 3]));
    if (o.state === "verificado") for (const x of o.signals) expect(FORBIDDEN_LANGUAGE.test(x.explanation)).toBe(false);
  });
});

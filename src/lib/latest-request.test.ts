import { describe, expect, it } from "vitest";
import { createLatestGate } from "./latest-request";

describe("NLOADING.2 — só a última leitura grava", () => {
  it("troca rápida: a resposta antiga deixa de ser corrente", () => {
    const g = createLatestGate();
    const escolaA = g.begin(); const escolaB = g.begin();
    expect(escolaA()).toBe(false);
    expect(escolaB()).toBe(true);
  });
  it("desmontar cancela a leitura em curso", () => {
    const g = createLatestGate();
    const r = g.begin(); g.cancel();
    expect(r()).toBe(false);
  });
});

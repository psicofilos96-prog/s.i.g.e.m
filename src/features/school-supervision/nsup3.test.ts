import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const page = readFileSync("src/features/school-supervision/supervision-page.tsx", "utf8");
describe("NSUP.3 — Supervisão", () => {
  it("situação de bloco e ferramenta passa por knownLabel (desconhecido nunca em branco)", () => {
    expect(page).toContain("knownLabel(STATE_LABEL, b.state)");
    expect(page).toContain("knownLabel(TOOL_STATE_LABEL, t.state)");
  });
  it("exportação sai do motor de relatórios e a página não grava capacidade", () => {
    expect(page).toContain("runReport(");
    expect(page).not.toMatch(/capability_policy|homologate_capability|record_engagement/);
  });
});

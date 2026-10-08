import { vi } from "vitest";
vi.mock("@/features/authority/session-authority", () => ({ useSessionAuthority: () => ({ status: "signed-out" }) }));
import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { render } from "@testing-library/react";
import axe from "axe-core";
import { GLOSSARY, SCREEN_MEANINGS } from "./help-content";
import { meaningForRoute } from "./help-model";
import { WhatThisMeans } from "./help-components";

const files = readdirSync("src/routes").map((f) => f.replace(/\.tsx?$/, ""));
const exists = (r: string) => { const f = r.slice(1).replace(/\//g, "."); return files.some((x) => x === f || x.startsWith(`${f}.`)); };

describe("NHELP.1 — O que isso significa?", () => {
  it("cobre as oito telas pedidas", () => {
    for (const [path, id] of [["/mapa-estatistico", "mapa"], ["/regras-avaliativas", "avaliacao"], ["/calendario-escolar/x", "calendario"], ["/matriculas/nova", "matricula"], ["/turmas/nova", "turmas"], ["/diario/chamadas", "diario"], ["/inclusao", "aee"], ["/relatorios", "relatorios"]])
      expect(meaningForRoute(path!)?.id, path).toBe(id);
  });
  it("prefixo mais específico vence; rota sem ajuda não mostra bloco", () => {
    expect(meaningForRoute("/diario/turmas/1/avaliacao")?.id).toBe("avaliacao");
    expect(meaningForRoute("/turmasx")).toBeNull();
    expect(meaningForRoute("/")).toBeNull();
  });
  it("rotas existem, termos existem no glossário e ids são únicos", () => {
    expect(new Set(SCREEN_MEANINGS.map((m) => m.id)).size).toBe(SCREEN_MEANINGS.length);
    for (const m of SCREEN_MEANINGS) { for (const r of m.routes) expect(exists(r), r).toBe(true); for (const t of m.terms ?? []) expect(GLOSSARY.some((g) => g.id === t), t).toBe(true); }
  });
  it("não afirma prazo, patamar ou número institucional", () => {
    for (const m of SCREEN_MEANINGS) expect(`${m.action["pt-BR"]} ${m.origin["pt-BR"]}`).not.toMatch(/\d/);
  });
  it("bloco sem violações de acessibilidade e com nomes acessíveis", async () => {
    const { container, getByText, getAllByRole } = render(<WhatThisMeans pathname="/turmas" />);
    getByText("O que isso significa?").click();
    for (const b of getAllByRole("button")) expect(b.getAttribute("aria-label")).toMatch(/^O que é /);
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
});

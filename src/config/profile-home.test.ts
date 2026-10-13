import { describe, expect, it } from "vitest";
import { HOME_ACTIONS, HOME_MAX_PRIMARY, homeActionsFor } from "./profile-home";

describe("Início simples", () => {
  it("no máximo 6 botões principais", () => {
    expect(homeActionsFor(() => true).primary.length).toBe(HOME_MAX_PRIMARY);
  });
  it("sem acesso não aparece nenhum botão", () => {
    const r = homeActionsFor(() => false);
    expect(r.primary).toEqual([]);
    expect(r.more).toEqual([]);
  });
  it("só mostra o que a autoridade libera", () => {
    const r = homeActionsFor((p) => p === "/mapa-estatistico" || p === "/alunos");
    expect(r.primary.map((a) => a.to)).toEqual(["/mapa-estatistico", "/alunos"]);
  });
  it("rótulos sem termos técnicos", () => {
    for (const a of HOME_ACTIONS) expect(a.label).not.toMatch(/homolog|proveni|vers[aã]o/i);
  });
});

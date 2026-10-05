import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { render } from "@testing-library/react";
import axe from "axe-core";
import { FLOWS, GLOSSARY, RELEASES, TOPICS, TOURS } from "./help-content";
import { flowsFor, isUpdated, searchHelp, topicsForRoute, toursFor } from "./help-model";

const anon = { capabilities: [], administrative: false };
const admin = { capabilities: ["manter-politica-de-capacidades", "manter-cadastro-de-turmas", "registrar-frequencia"], administrative: true };
const routeFiles = readdirSync("src/routes").map((f) => f.replace(/\.tsx?$/, ""));
const routeExists = (to: string) => {
  const p = to.split("#")[0]!; if (p === "/") return true;
  const f = p.replace(/^\//, "").replace(/\//g, ".");
  return routeFiles.includes(f) || routeFiles.includes(`${f}.index`);
};

describe("central de ajuda", () => {
  it("rota sem conteúdo devolve nada; rota aninhada herda o prefixo", () => {
    expect(topicsForRoute("/rota-inexistente", admin)).toEqual([]);
    expect(topicsForRoute("/matrizes-curriculares/correspondencia", admin).map((t) => t.id)).toContain("matriz-posicao-correspondencia");
    expect(topicsForRoute("/turmasx", admin)).toEqual([]); // prefixo não é substring
  });
  it("perfil diferente vê conteúdo diferente; técnico só para administração", () => {
    expect(topicsForRoute("/central-de-acessos", anon).map((t) => t.id)).not.toContain("capacidade-nao-e-cargo");
    expect(topicsForRoute("/central-de-acessos", admin).map((t) => t.id)).toContain("capacidade-nao-e-cargo");
    expect(searchHelp("knownAt", anon)).toEqual([]);
    expect(searchHelp("knownAt", admin).length).toBe(1);
    expect(flowsFor(anon).map((f) => f.id)).not.toContain("preparar-escola");
    expect(toursFor(anon).map((f) => f.id)).toEqual(["geral"]);
  });
  it("busca ignora acentos e exige todas as palavras", () => {
    expect(searchHelp("alocacao", anon).some((h) => h.id === "alocacao")).toBe(true);
    expect(searchHelp("matricula zebra", anon)).toEqual([]);
    expect(searchHelp("   ", anon)).toEqual([]);
  });
  it("versões: ids únicos, versão positiva e marcação de atualizado", () => {
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(TOPICS.length);
    for (const t of TOPICS) expect(t.version).toBeGreaterThan(0);
    expect(isUpdated(TOPICS[0]!, {})).toBe(true);
    expect(isUpdated(TOPICS[0]!, { [TOPICS[0]!.id]: TOPICS[0]!.version })).toBe(false);
    expect(RELEASES.length).toBeGreaterThan(0);
  });
  it("nenhum link quebrado", () => {
    const links = [...TOPICS.flatMap((t) => [...t.routes, ...(t.links ?? []).map((l) => l.to)]), ...FLOWS.flatMap((f) => f.steps.flatMap((s) => (s.to ? [s.to] : []))), ...TOURS.flatMap((t) => t.steps.map((s) => s.route))];
    for (const l of links) expect(routeExists(l), l).toBe(true);
    for (const g of GLOSSARY) for (const s of g.see ?? []) expect(GLOSSARY.some((x) => x.id === s)).toBe(true);
  });
  it("conteúdo não vive nos componentes", () => {
    for (const f of ["help-page.tsx", "help-components.tsx"]) expect(readFileSync(`src/features/help/${f}`, "utf8")).not.toMatch(/"pt-BR":/);
    expect(existsSync("src/features/help/help-content.ts")).toBe(true);
  });
  it("página da ajuda sem violações de acessibilidade", async () => {
    const { HelpPage } = await import("./help-page");
    const { container } = render(<HelpPage />);
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
});

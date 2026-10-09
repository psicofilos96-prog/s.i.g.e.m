import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { pathAllowed } from "./nav-capabilities";
import { provisionalNavigation } from "@/config/navigation";

const cap = (capabilityId: string, schoolId: string | null = null, engagementId = "e1") =>
  ({ capabilityId, engagementId, policyId: "p", policyVersion: 1, classId: null, periodId: null, schoolId, componentId: null });
const filler = (n: number) => Array.from({ length: n }, (_, i) => cap(`cap-${i}`, "esc-a"));
const allNav = provisionalNavigation.flatMap((g) => g.items.map((i) => i.to));

describe("NACL.UI.1 — menu, atalhos, busca e deep link alinhados às capacidades", () => {
  it("capacidade depois da linha 1000 libera a área", () => {
    const caps = [...filler(1500), cap("publicar-conteudo-publico")];
    expect(caps.findIndex((c) => c.capabilityId === "publicar-conteudo-publico")).toBe(1500);
    expect(pathAllowed({ status: "signed-in", capabilities: caps }, "/publicacoes")).toBe(true);
    expect(pathAllowed({ status: "signed-in", capabilities: filler(1500) }, "/publicacoes")).toBe(false);
  });
  it("autoridade incompleta não oferece nada (sem flash do menu inteiro)", () => {
    for (const p of allNav) {
      expect(pathAllowed({ status: "loading" }, p)).toBe(false);
      expect(pathAllowed({ status: "signed-out" }, p)).toBe(false);
    }
  });
  it("principal setorial vê só a própria estação; deep link de outra estação é recusado", () => {
    const a = { status: "signed-in" as const, principal: { id: "x", station: "alimentacao" as const, scope: "network" as const, schoolId: null }, capabilities: [] };
    expect(pathAllowed(a, "/alimentacao-escolar")).toBe(true);
    expect(pathAllowed(a, "/central-de-acessos")).toBe(false);
    expect(pathAllowed(a, "/alunos/$studentId")).toBe(false);
  });
  it("multi-atuação = união; capacidade escolar não abre área de alcance de rede", () => {
    const caps = [cap("publicar-conteudo-publico", null, "e1"), cap("administrar-integracoes", "esc-a", "e2")];
    const a = { status: "signed-in" as const, capabilities: caps };
    expect(pathAllowed(a, "/publicacoes")).toBe(true);
    expect(pathAllowed(a, "/integracoes")).toBe(false);
    expect(pathAllowed({ status: "signed-in", capabilities: [...caps, cap("administrar-integracoes", null, "e3")] }, "/integracoes/x")).toBe(true);
  });
  it("Admin com todas as capacidades explícitas vê todo o menu", () => {
    const admin = { status: "signed-in" as const, capabilities: [cap("publicar-conteudo-publico"), cap("administrar-integracoes")] };
    for (const p of allNav) expect(pathAllowed(admin, p), p).toBe(true);
  });
  it("menu, paleta, busca, cards e deep link usam a mesma regra", () => {
    const shell = readFileSync("src/components/app-shell/app-shell.tsx", "utf8");
    expect(shell.match(/pathAllowed\(/g)!.length).toBeGreaterThanOrEqual(4);
    expect(shell).toContain('data-sigem-access-denied="capability"');
    expect(shell).not.toContain("provisionalNavigation.map((group) => (");
    expect(readFileSync("src/features/school-supervision/supervision-page.tsx", "utf8")).toContain("pathAllowed(authority, t.to)");
  });
});

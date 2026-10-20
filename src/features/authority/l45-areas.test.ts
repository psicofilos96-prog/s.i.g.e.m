import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { AREA_WORKSPACES } from "./area-workspaces";
import { PROPOSED_AREA_KINDS } from "./institutional-profiles";
import { DRAFT_POLICY, DRAFT_RULES, analyzeDraftConflicts, isDraftRuleActive } from "./draft-capability-policy";
import { pathAllowed } from "./nav-capabilities";

const routeFile = (to: string) => {
  const b = to.slice(1).split("/");
  const cands = [b.join("."), b.join("_."), `${b[0]}_.${b.slice(1).join(".")}`, b.join("_.") ];
  return cands.flatMap((c) => [`src/routes/${c}.tsx`, `src/routes/${c}.index.tsx`]).find(existsSync);
};

describe("L45 — áreas de trabalho e política em rascunho", () => {
  it("as 10 áreas propostas têm espaço de trabalho com telas reais", () => {
    for (const area of Object.keys(PROPOSED_AREA_KINDS)) {
      expect(AREA_WORKSPACES[area]?.length, area).toBeGreaterThan(0);
      for (const a of AREA_WORKSPACES[area]!) expect(routeFile(a.to), a.to).toBeTruthy();
    }
  });
  it("rascunho não tem homologação e nunca está ativo", () => {
    expect(DRAFT_POLICY.status).toBe("rascunho");
    expect(DRAFT_POLICY.homologatedBy).toBeNull();
    for (const r of DRAFT_RULES) { expect(r.kind.startsWith("proposta:")).toBe(true); expect(isDraftRuleActive(r)).toBe(false); }
  });
  it("rascunho atual não tem conflito de segregação", () => {
    expect(analyzeDraftConflicts()).toEqual([]);
  });
  it("detecta quem cria e aprova o mesmo objeto, padrão proibido e administrar", () => {
    const k = PROPOSED_AREA_KINDS["organizacao-da-rede"]!;
    const c = analyzeDraftConflicts([
      { kind: k, capability: "registrar-oferta-de-vagas", verb: "criar", scope: "rede" },
      { kind: k, capability: "aprovar-oferta-de-vagas", verb: "aprovar", scope: "rede" },
      { kind: PROPOSED_AREA_KINDS["tecnologia"]!, capability: "consultar-registro-funcional", verb: "visualizar", scope: "rede" },
      { kind: k, capability: "administrar-vagas", verb: "administrar", scope: "rede" },
    ]);
    expect(c.map((x) => x.reason)).toEqual(expect.arrayContaining([expect.stringMatching(/cria\/edita e aprova/), "padrão proibido: rh", "administrar em perfil operacional"]));
  });
  it("sem sessão nenhuma atividade é oferecida (default deny)", () => {
    for (const acts of Object.values(AREA_WORKSPACES)) for (const a of acts) {
      expect(pathAllowed({ status: "signed-out" }, a.to)).toBe(false);
      expect(pathAllowed({ status: "loading" }, a.to)).toBe(false);
    }
  });
  it("conta setorial de outra estação não recebe a atividade", () => {
    const auth = { status: "signed-in" as const, principal: { id: "p", station: "alimentacao" as const, scope: "network" as const, schoolId: null }, capabilities: [{ capabilityId: "consultar-alimentacao-escolar", engagementId: "e", policyId: "p", policyVersion: 1, classId: null, periodId: null, schoolId: null, componentId: null }] };
    expect(pathAllowed(auth, "/inclusao")).toBe(false);
    expect(pathAllowed(auth, "/alimentacao-escolar")).toBe(true);
  });
  it("a tela não lê banco: só navegação", () => {
    expect(readFileSync("src/features/authority/area-workspace-page.tsx", "utf8")).not.toMatch(/supabase\.(from|rpc)/);
  });
});

import { activityStatus } from "./area-workspace-page";
describe("L46 — estado da atividade", () => {
  it("perfil rascunho nunca aparece como Disponível", () => {
    expect(activityStatus(true, true)).toBe("Aguarda homologação");
    expect(activityStatus(false, true)).toBe("Sem acesso");
    expect(activityStatus(true, false)).toBe("Disponível");
  });
});

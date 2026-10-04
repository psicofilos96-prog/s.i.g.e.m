import { describe, expect, it } from "vitest";
import type { EffectiveCapability } from "@/features/authority/session-authority";
import { generalAdminModules, GENERAL_ADMIN_MODULES } from "./general-admin";

const cap = (capabilityId: string, engagementId: string, policyId: string | null = "v3"): EffectiveCapability => ({
  capabilityId, engagementId, policyId, policyVersion: policyId ? 3 : null, classId: null, periodId: null, schoolId: null, componentId: null,
});

describe("B1.2 Administrador Geral", () => {
  const master = [{ engagementId: "em", positionLabel: null, capabilityCount: 78 }];

  it("mostra módulos só pelas capacidades da atuação de Administrador Geral", () => {
    const caps = [cap("manter-cadastro-unidade-escolar", "em"), cap("registrar-aula", "em"), cap("manter-matricula-e-enturmacao", "outra")];
    expect(generalAdminModules(caps, master).map((m) => m.id)).toEqual(["unidades", "diario"]);
  });

  it("sem atuação de Administrador Geral não há módulo, mesmo com capacidades de setor", () => {
    const caps = GENERAL_ADMIN_MODULES.map((m) => cap(m.capabilityId, "setor"));
    expect(generalAdminModules(caps, [])).toEqual([]);
  });

  it("designação explícita (sem política) não abre a Administração Geral", () => {
    expect(generalAdminModules([cap("construir-calendario-da-rede", "em", null)], master)).toEqual([]);
  });

  it("cobertura total lista todos os módulos", () => {
    const caps = GENERAL_ADMIN_MODULES.map((m) => cap(m.capabilityId, "em"));
    expect(generalAdminModules(caps, master)).toHaveLength(GENERAL_ADMIN_MODULES.length);
  });
});

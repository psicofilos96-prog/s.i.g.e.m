/**
 * Garantias da camada de tradução (Rodada 6B.1).
 *
 * Cada teste aqui protege um refinamento obrigatório: a tradução não inventa
 * competência, não revela existência de dado protegido, não dramatiza espera
 * legítima, não altera autorização e nunca expõe código cru ao usuário.
 */
import { describe, expect, it } from "vitest";
import {
  HEADLINE_FALLBACK,
  RESPONSIBILITY_UNDETERMINED,
  createStatusTemplateRegistry,
  resolveActionDisclosure,
  resolveHumanStatus,
  type StatusTemplate,
} from "./human-status";

const capacityMissing: StatusTemplate = {
  nature: "configuracao-ausente",
  headline: (p) => `A turma ${String(p['className'])} ainda não tem lotação máxima registrada.`,
  because: () => "Sem esse registro não é possível comparar a ocupação com o limite.",
  requires: ["className"],
};

const registry = createStatusTemplateRegistry([
  ["SL-ALLOC-CAPACITY-RECORD-MISSING", capacityMissing],
]);

describe("resolveHumanStatus", () => {
  it("não inventa responsável quando a fonte não informa competência", () => {
    const status = resolveHumanStatus({
      diagnosticCode: "SL-ALLOC-CAPACITY-RECORD-MISSING",
      parameters: { className: "5º ano A" },
      registry,
    });
    expect(status?.responsibilityKnown).toBe(false);
    expect(status?.responsibility).toBe(RESPONSIBILITY_UNDETERMINED);
    expect(status?.headline).not.toMatch(/Direção|Supervisão|Secretaria/);
  });

  it("permite que duas políticas atribuam o mesmo diagnóstico a responsáveis diferentes", () => {
    const base = {
      diagnosticCode: "SL-ALLOC-CAPACITY-RECORD-MISSING",
      parameters: { className: "5º ano A" },
      registry,
    } as const;
    const first = resolveHumanStatus({
      ...base,
      competence: { executorLabel: "Direção da unidade", policyDefinitionId: "POL-A" },
    });
    const second = resolveHumanStatus({
      ...base,
      competence: { executorLabel: "Supervisão Escolar", policyDefinitionId: "POL-B" },
    });
    expect(first?.responsibility).toContain("Direção da unidade");
    expect(second?.responsibility).toContain("Supervisão Escolar");
    expect(first?.provenance.policyDefinitionId).toBe("POL-A");
    expect(second?.provenance.policyDefinitionId).toBe("POL-B");
  });

  it("não revela a existência do dado protegido quando a política impede", () => {
    expect(
      resolveHumanStatus({ nature: "dado-protegido", disclosure: { existenceRevealable: false } }),
    ).toBeNull();
    expect(resolveHumanStatus({ nature: "dado-protegido" })).toBeNull();
  });

  it("projeta apenas nota genérica quando a política autoriza revelar a omissão", () => {
    const status = resolveHumanStatus({
      nature: "dado-protegido",
      disclosure: { existenceRevealable: true, genericNoteAllowed: true },
    });
    expect(status).not.toBeNull();
    expect(status?.tone).toBe("neutro");
  });

  it("aceita diagnóstico novo sem alterar o domínio", () => {
    const extended = createStatusTemplateRegistry([
      ["SL-ALLOC-CAPACITY-RECORD-MISSING", capacityMissing],
      [
        "SL-NOVO-DIAGNOSTICO",
        { nature: "requisito-pendente", headline: () => "Falta um documento da família." },
      ],
    ]);
    const status = resolveHumanStatus({ diagnosticCode: "SL-NOVO-DIAGNOSTICO", registry: extended });
    expect(status?.usedFallback).toBe(false);
    expect(status?.headline).toBe("Falta um documento da família.");
  });

  it("cai em fallback humano seguro quando não há tradução ou parâmetro", () => {
    const unknown = resolveHumanStatus({ diagnosticCode: "SL-SEM-TRADUCAO", registry });
    expect(unknown?.usedFallback).toBe(true);
    expect(unknown?.headline).toBe(HEADLINE_FALLBACK);
    expect(unknown?.headline).not.toContain("SL-SEM-TRADUCAO");
    expect(unknown?.provenance.diagnosticCode).toBe("SL-SEM-TRADUCAO");

    const missingParam = resolveHumanStatus({
      diagnosticCode: "SL-ALLOC-CAPACITY-RECORD-MISSING",
      registry,
    });
    expect(missingParam?.headline).toBe(HEADLINE_FALLBACK);
  });

  it("não dá semântica de alerta a pendência dentro do prazo", () => {
    const serene = resolveHumanStatus({
      nature: "aguardando-terceiro",
      waiting: { waitingForLabel: "documento da família", dueDateLabel: "15/03/2027" },
    });
    expect(serene?.tone).toBe("acompanhamento");
    expect(serene?.waitingLine).toBe("Aguardando documento da família — prazo até 15/03/2027");

    const attention = resolveHumanStatus({
      nature: "aguardando-terceiro",
      waiting: { waitingForLabel: "documento da família", attentionRequired: true },
    });
    expect(attention?.tone).toBe("atencao");
  });
});

describe("resolveActionDisclosure", () => {
  it("mantém ausente a ação irrelevante para o contexto", () => {
    expect(resolveActionDisclosure("irrelevante").present).toBe(false);
  });

  it("mantém explicável a ação legítima bloqueada, sem torná-la executável", () => {
    const noCapacity = resolveActionDisclosure("sem-capacidade", {
      capacityExplanation: "Esta ação exige capacidade de deliberação não atribuída a você.",
    });
    expect(noCapacity.present).toBe(true);
    expect(noCapacity.enabled).toBe(false);
    expect(noCapacity.explanation).toContain("capacidade");

    const pending = resolveActionDisclosure("requisito-pendente", {
      pendingRequirements: ["selecionar a turma", "informar a data de início"],
    });
    expect(pending.enabled).toBe(false);
    expect(pending.explanation).toBe("Falta selecionar a turma; informar a data de início.");
  });

  it("não amplia autorização: somente disponível é executável", () => {
    expect(resolveActionDisclosure("disponivel").enabled).toBe(true);
    for (const relevance of ["sem-capacidade", "requisito-pendente", "irrelevante"] as const) {
      expect(resolveActionDisclosure(relevance).enabled).toBe(false);
    }
  });
});

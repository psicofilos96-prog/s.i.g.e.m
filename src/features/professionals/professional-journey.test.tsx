import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderOperationalRoutes } from "@/test/router-harness";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import {
  demonstrationPedagogicalAssignments,
  pedagogicalAssignmentsForClass,
  pedagogicalAssignmentsForProfessional,
} from "@/features/pedagogical/pedagogical-data";
import {
  demonstrationProfessionals,
  getDemonstrationProfessional,
  type DemonstrationProfessional,
} from "./professionals-data";
import {
  JOURNEY_AUTHORIZATION_NOTE,
  JOURNEY_SCENARIOS,
  JOURNEY_SEQUENCE,
  journeyConsistencyIssues,
  personsWithoutProfessionalRole,
  professionalJourney,
  temporalState,
} from "./professional-journey";

function professional(id: string): DemonstrationProfessional {
  const found = getDemonstrationProfessional(id);
  if (!found) throw new Error(`fixture ${id} ausente`);
  return found;
}

describe("Jornada canônica — sequência e conceitos separados", () => {
  it("apresenta a sequência de navegação sem exigir cadeia obrigatória de criação", () => {
    expect([...JOURNEY_SEQUENCE]).toEqual([
      "Pessoa",
      "Profissional",
      "Vínculo Funcional",
      "Lotação",
      "Atribuição de Função",
      "Atuação Pedagógica",
    ]);
  });

  it("cobre os cenários integrados A–T", () => {
    expect(JOURNEY_SCENARIOS).toHaveLength(20);
    expect(JOURNEY_SCENARIOS.map((item) => item.id)).toContain("T");
  });
});

describe("Registro único — consistência de IDs e fixtures", () => {
  it("não apresenta atuação apontando para profissional, vínculo ou lotação inexistentes", () => {
    expect(journeyConsistencyIssues()).toEqual([]);
  });

  it("usa a mesma atuação no módulo de profissionais e no contexto da turma", () => {
    const record = demonstrationPedagogicalAssignments.find((item) => item.id === "atp-001")!;
    const byProfessional = pedagogicalAssignmentsForProfessional(record.professionalId);
    const byClass = pedagogicalAssignmentsForClass(record.classId);
    expect(byProfessional).toContain(record);
    expect(byClass).toContain(record);
    const fromClass = byClass.find((item) => item.id === record.id)!;
    expect(fromClass.linkId).toBe(record.linkId);
    expect(fromClass.role).toBe(record.role);
    expect(fromClass.start).toBe(record.start);
    expect(fromClass.end).toBe(record.end);
  });

  it("não duplica identificadores de profissional nem de pessoa", () => {
    const ids = demonstrationProfessionals.map((item) => item.id);
    const sigem = demonstrationProfessionals.map((item) => item.professionalId);
    const persons = demonstrationProfessionals.map((item) => item.personId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(sigem).size).toBe(sigem.length);
    expect(new Set(persons).size).toBe(persons.length);
  });
});

describe("Temporalidade — atual, futuro, encerrado e desconhecido", () => {
  it("deriva o estado das datas e não de badges estáticos", () => {
    expect(temporalState({ start: "2024" }, "2026-09-23")).toBe("Atual");
    expect(temporalState({ start: "2027-02-01" }, "2026-09-23")).toBe("Futuro");
    expect(temporalState({ start: "2025-02-03", end: "2025-12-19" }, "2026-09-23")).toBe(
      "Encerrado",
    );
    expect(temporalState({}, "2026-09-23")).toBe("Situação desconhecida");
  });

  it("respeita a data de referência controlável nos testes", () => {
    const journey = professionalJourney(professional("pro-006"), "2025-06-01");
    expect(journey.currentAssignments.map((item) => item.id)).toContain("atp-003");
    const later = professionalJourney(professional("pro-006"), "2026-09-23");
    expect(later.historicalAssignments.map((item) => item.id)).toContain("atp-003");
  });
});

describe("Próximas ações contextuais", () => {
  it("cenário B: profissional sem vínculo recebe apenas a criação de vínculo", () => {
    const journey = professionalJourney(professional("pro-011"));
    expect(journey.nextActions.map((action) => action.kind)).toEqual(["link"]);
    expect(journey.pendencies[0]?.text).toContain("sem vínculo funcional registrado");
  });

  it("cenário E: vínculo sem lotação orienta registrar lotação, sem exigi-la", () => {
    const journey = professionalJourney(professional("pro-008"));
    const action = journey.nextActions.find(
      (item) => item.kind === "posting-new" && item.label.includes("Registrar lotação"),
    );
    expect(action).toBeTruthy();
    expect(journey.pendencies.some((item) => item.text.includes("sem lotação vigente"))).toBe(true);
  });

  it("cenário F: vínculo com lotação distingue adicionar de movimentar", () => {
    const journey = professionalJourney(professional("pro-003"));
    const labels = journey.nextActions.map((action) => action.label);
    expect(labels.some((label) => label.startsWith("Adicionar lotação"))).toBe(true);
    expect(labels.some((label) => label.startsWith("Movimentar lotação"))).toBe(true);
  });

  it("oferece função e atuação pedagógica por vínculo vigente, nunca sem vínculo", () => {
    const journey = professionalJourney(professional("pro-008"));
    for (const action of journey.nextActions) {
      if (action.kind === "function-new" || action.kind === "pedagogical-new")
        expect(journey.activeLinks.some((entry) => entry.link.id === action.linkId)).toBe(true);
    }
  });

  it("cenário P: profissional histórico não recebe ações impossíveis", () => {
    const journey = professionalJourney(professional("pro-007"));
    expect(journey.nextActions.map((action) => action.kind)).not.toContain("pedagogical-new");
    expect(journey.nextActions.map((action) => action.kind)).toContain("review");
  });

  it("cenário A: pessoa existente sem papel profissional", () => {
    const persons = personsWithoutProfessionalRole();
    expect(persons.some((person) => person.id === "pes-prof-001")).toBe(true);
  });
});

describe("Múltiplas relações preservadas", () => {
  it("cenário D: dois vínculos simultâneos não são fundidos", () => {
    const journey = professionalJourney(professional("pro-008"));
    expect(journey.links).toHaveLength(2);
    expect(new Set(journey.links.map((item) => item.link.functionalIdentifier)).size).toBe(2);
  });

  it("cenário T: função administrativa e atuação pedagógica coexistem", () => {
    const journey = professionalJourney(professional("pro-004"));
    expect(journey.links[0]?.currentFunctions.length).toBeGreaterThan(0);
    expect(journey.currentAssignments.length).toBeGreaterThan(0);
  });

  it("cenário J e K: múltiplas turmas e múltiplos profissionais na mesma turma", () => {
    const journey = professionalJourney(professional("pro-006"));
    expect(new Set(journey.currentAssignments.map((item) => item.classId)).size).toBeGreaterThan(1);
    const sameClass = pedagogicalAssignmentsForClass("tur-001");
    expect(new Set(sameClass.map((item) => item.professionalId)).size).toBeGreaterThan(1);
  });

  it("cenário L: substituição é distinguível e preserva a atuação original", () => {
    const substitution = demonstrationPedagogicalAssignments.find((item) => item.id === "atp-010")!;
    expect(substitution.substitutionOf).toBe("atp-001");
    const original = demonstrationPedagogicalAssignments.find((item) => item.id === "atp-001")!;
    expect(original.status).toBe("Atual");
    expect(original.end).toBeUndefined();
  });

  it("cenário G: movimentação parcial preserva a lotação de origem como histórico", () => {
    const journey = professionalJourney(professional("pro-010"));
    expect(journey.links[0]?.historicalPostings.length).toBeGreaterThan(0);
    expect(journey.links[0]?.currentPostings.length).toBeGreaterThan(0);
    expect(journey.links[0]?.state).toBe("Atual");
  });

  it("cenário S: divergência entre lotação e atuação aparece como pendência de validação", () => {
    const journey = professionalJourney(professional("pro-003"));
    expect(
      journey.pendencies.some((item) =>
        item.text.includes("Compatibilidade entre atuação e lotação requer validação"),
      ),
    ).toBe(true);
  });

  it("cenário R: dado incompleto é informativo, não erro", () => {
    const journey = professionalJourney(professional("pro-008"));
    const incomplete = journey.pendencies.find((item) =>
      item.text.includes("sem carga horária informada"),
    );
    expect(incomplete?.level).toBe("informativo");
  });
});

describe("Hub do profissional — navegação e integração", () => {
  it("mostra jornada, pendências e próximas ações no hub", async () => {
    renderOperationalRoutes("/profissionais/pro-008");
    expect(
      await screen.findByRole("heading", { name: /Jornada profissional consolidada/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Pendências demonstrativas")).toBeInTheDocument();
    const actions = screen.getByLabelText("Próximas ações contextuais");
    expect(within(actions).getAllByRole("link").length).toBeGreaterThan(1);
  });

  it("preserva o profissional e permite seleção explícita do vínculo ao criar atuação", async () => {
    renderOperationalRoutes("/profissionais/pro-008");
    const actions = await screen.findByLabelText("Próximas ações contextuais");
    const link = within(actions)
      .getAllByRole("link")
      .find((item) => item.textContent?.includes("Registrar atuação pedagógica"));
    expect(link?.getAttribute("href")).toContain("/profissionais/pro-008/atuacoes/nova");
    expect(link?.getAttribute("href")).toContain("vinculo=");
  });

  it("não sugere permissões pedagógicas automáticas e explica a autorização futura", async () => {
    renderOperationalRoutes("/profissionais/pro-008");
    expect(await screen.findByText(JOURNEY_AUTHORIZATION_NOTE)).toBeInTheDocument();
  });

  it("hub de profissional sem vínculo não exibe erro, e sim ausência de dados", async () => {
    renderOperationalRoutes("/profissionais/pro-011");
    expect(await screen.findByText(/sem vínculo funcional registrado/i)).toBeInTheDocument();
    expect(screen.queryByText(/erro/i)).not.toBeInTheDocument();
  });

  it("identificador inexistente resulta em não encontrado, não em lista vazia", async () => {
    renderOperationalRoutes("/profissionais/pro-inexistente");
    expect(
      await screen.findByRole("heading", { name: /Profissional não encontrado/i }),
    ).toBeInTheDocument();
  });

  it("preserva turma e unidade ao atribuir profissional a partir da turma", async () => {
    renderOperationalRoutes("/turmas/tur-001");
    const link = (await screen.findAllByRole("link")).find((item) =>
      item.textContent?.includes("Atribuir profissional a esta turma"),
    );
    const klass = getDemonstrationClass("tur-001")!;
    expect(link?.getAttribute("href")).toContain("turma=tur-001");
    expect(link?.getAttribute("href")).toContain(`unidade=${klass.unitId}`);
  });

  it("não expõe dados pessoais sensíveis no hub", async () => {
    renderOperationalRoutes("/profissionais/pro-001");
    await screen.findByRole("heading", { name: /Jornada profissional consolidada/i });
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
    expect(text).not.toMatch(/filiação|conta bancária|prontuário/i);
  });
});

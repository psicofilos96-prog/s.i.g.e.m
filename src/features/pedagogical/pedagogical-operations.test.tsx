import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import {
  PEDAGOGICAL_CLOSE_EFFECTS,
  PEDAGOGICAL_DUPLICATE_WARNING,
  PEDAGOGICAL_OPERATION_SCENARIOS,
  PEDAGOGICAL_SUBSTITUTION_SCOPE_NOTE,
  assessPedagogicalConflicts,
  assessSubstitutionConflicts,
  blankCloseDraft,
  blankPedagogicalDraft,
  blankSubstitutionDraft,
  draftFromRecord,
  fieldOptionsForClass,
  isPedagogicalDirty,
  linksForProfessional,
  pedagogicalDraftChanges,
  relatedRecordsForDraft,
  requiresNewAssignment,
  substitutionInheritedField,
  validateCloseDraft,
  validatePedagogicalDraft,
  validateSubstitutionDraft,
  type PedagogicalDraft,
} from "./pedagogical-assignment-draft";
import {
  demonstrationPedagogicalAssignments,
  getPedagogicalAssignment,
} from "./pedagogical-data";

const record = () => {
  const found = getPedagogicalAssignment("atp-001");
  if (!found) throw new Error("fixture atp-001 ausente");
  return found;
};

function filledDraft(preset: Partial<PedagogicalDraft> = {}): PedagogicalDraft {
  const base = draftFromRecord(record());
  return { ...base, ...preset };
}

describe("Nova atuação — pré-condições e seleção explícita", () => {
  it("exige profissional, vínculo, unidade, período, turma, componente, papel e início", () => {
    const errors = validatePedagogicalDraft(blankPedagogicalDraft());
    expect(errors).toContain("Profissional existente não selecionado.");
    expect(errors).toContain("Vínculo funcional não selecionado explicitamente.");
    expect(errors).toContain("Unidade não selecionada.");
    expect(errors).toContain("Período letivo não selecionado.");
    expect(errors).toContain("Turma ou contexto pedagógico não selecionado.");
    expect(errors).toContain("Papel pedagógico não informado.");
    expect(errors).toContain("Data de início não informada.");
  });

  it("não seleciona silenciosamente um vínculo quando há múltiplos", () => {
    const links = linksForProfessional("pro-008");
    expect(links.length).toBeGreaterThan(1);
    const draft = blankPedagogicalDraft({ professionalId: "pro-008" });
    expect(draft.linkId).toBe("");
    expect(validatePedagogicalDraft(draft)).toContain(
      "Vínculo funcional não selecionado explicitamente.",
    );
  });

  it("aceita um rascunho completo sem erros", () => {
    expect(validatePedagogicalDraft(filledDraft())).toHaveLength(0);
  });
});

describe("Contexto acadêmico e componente ou campo", () => {
  it("impede turma incompatível com a unidade e com o período letivo", () => {
    const conflicts = assessPedagogicalConflicts(
      filledDraft({ unitId: "unidade-inexistente", periodLabel: "Período inexistente" }),
    );
    expect(conflicts.some((item) => item.level === "forte")).toBe(true);
  });

  it("não força disciplina convencional na Educação Infantil", () => {
    const klass = getDemonstrationClass("tur-009");
    const options = fieldOptionsForClass(klass);
    expect(options.length).toBeGreaterThan(1);
    expect(options.some((option) => option.kind === "Componente curricular")).toBe(false);
  });

  it("permite contexto pedagógico sem componente definido", () => {
    const options = fieldOptionsForClass(getDemonstrationClass("tur-007"));
    expect(options.some((option) => option.kind === "Contexto sem componente definido")).toBe(true);
    const draft = filledDraft({ fieldKind: "Contexto sem componente definido", field: "" });
    expect(validatePedagogicalDraft(draft)).toHaveLength(0);
  });

  it("não exige série única em turma multietapa ou EJA", () => {
    for (const classId of ["tur-003", "tur-004"]) {
      const klass = getDemonstrationClass(classId);
      expect(klass).toBeDefined();
      expect(fieldOptionsForClass(klass).length).toBeGreaterThan(0);
    }
  });
});

describe("Vigência, duplicidade e compatibilidades", () => {
  it("recusa término anterior ao início", () => {
    expect(validatePedagogicalDraft(filledDraft({ start: "2026-05-01", end: "2026-04-01" }))).toContain(
      "Data de término anterior à data de início.",
    );
  });

  it("sinaliza possível duplicidade sem bloquear", () => {
    const conflicts = assessPedagogicalConflicts(filledDraft());
    const duplicate = conflicts.find((item) => item.title === PEDAGOGICAL_DUPLICATE_WARNING);
    expect(duplicate?.level).toBe("aviso");
  });

  it("não trata corresponsabilidade de outro profissional como duplicidade", () => {
    const conflicts = assessPedagogicalConflicts(
      filledDraft({ professionalId: "pro-001", linkId: "vf-001", role: "Corresponsável" }),
      { excludeRecordId: "atp-004" },
    );
    expect(conflicts.find((item) => item.title === PEDAGOGICAL_DUPLICATE_WARNING)).toBeUndefined();
    expect(conflicts.some((item) => item.title.includes("Corresponsabilidade"))).toBe(true);
  });

  it("avisa divergência entre unidade da atuação e lotações conhecidas", () => {
    const draft = draftFromRecord(
      getPedagogicalAssignment("atp-006") ?? demonstrationPedagogicalAssignments[0]!,
    );
    const conflicts = assessPedagogicalConflicts(draft, { excludeRecordId: "atp-006" });
    expect(
      conflicts.some(
        (item) =>
          item.level === "aviso" &&
          item.title === "Compatibilidade entre atuação e lotação requer validação.",
      ),
    ).toBe(true);
  });

  it("apresenta função do vínculo apenas como contexto informativo", () => {
    const conflicts = assessPedagogicalConflicts(
      filledDraft({ professionalId: "pro-001", linkId: "vf-001" }),
      { excludeRecordId: "atp-004" },
    );
    const functionNote = conflicts.find((item) => item.title.startsWith("Função atribuída"));
    if (functionNote) expect(functionNote.level).toBe("informativo");
  });

  it("lista atuações relacionadas ao contexto a partir do registro canônico", () => {
    expect(relatedRecordsForDraft(filledDraft()).length).toBeGreaterThan(0);
  });
});

describe("Edição, encerramento e histórico", () => {
  it("classifica troca de turma como nova atribuição e ajuste de vigência como correção", () => {
    const initial = draftFromRecord(record());
    expect(requiresNewAssignment({ ...initial, classId: "tur-005" }, initial)).toBe(true);
    const changes = pedagogicalDraftChanges({ ...initial, end: "2026-11-30" }, initial);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.nature).toBe("Correção administrativa");
    expect(requiresNewAssignment({ ...initial, end: "2026-11-30" }, initial)).toBe(false);
  });

  it("exige término válido no encerramento e preserva os demais conceitos", () => {
    expect(validateCloseDraft(blankCloseDraft(), record())).toContain(
      "Data de término proposta não informada.",
    );
    expect(validateCloseDraft({ endDate: "2020-01-01", note: "" }, record())).toContain(
      "Data de término anterior ao início da atuação.",
    );
    expect(validateCloseDraft({ endDate: "2026-12-18", note: "" }, record())).toHaveLength(0);
    expect(PEDAGOGICAL_CLOSE_EFFECTS.join(" ")).toMatch(/Vínculo Funcional não é encerrado/);
  });
});

describe("Substituição temporária", () => {
  it("exige substituto, vínculo explícito, papel e intervalo", () => {
    const errors = validateSubstitutionDraft(blankSubstitutionDraft(), record());
    expect(errors).toContain("Profissional substituto não selecionado.");
    expect(errors).toContain("Vínculo funcional do substituto não selecionado explicitamente.");
    expect(errors).toContain("Início da substituição não informado.");
    expect(errors).toContain(
      "Término da substituição não informado — a substituição é temporal.",
    );
  });

  it("não permite que o titular seja o próprio substituto", () => {
    const errors = validateSubstitutionDraft(
      {
        ...blankSubstitutionDraft(),
        substituteProfessionalId: record().professionalId,
        substituteLinkId: record().linkId,
        start: "2026-05-04",
        end: "2026-06-30",
      },
      record(),
    );
    expect(errors).toContain("O substituto não pode ser o próprio titular da atuação original.");
  });

  it("herda o contexto acadêmico da atuação original", () => {
    const inherited = substitutionInheritedField(blankSubstitutionDraft(), record());
    expect(inherited.fieldKind).toBe(record().fieldKind);
    expect(inherited.field).toBe(record().field ?? "");
  });

  it("preserva a atuação original e avisa sobre permissões não herdadas", () => {
    const conflicts = assessSubstitutionConflicts(
      {
        ...blankSubstitutionDraft(),
        substituteProfessionalId: "pro-009",
        substituteLinkId: "vf-009",
        start: "2026-05-04",
        end: "2026-06-30",
      },
      record(),
    );
    expect(conflicts.length).toBeGreaterThan(0);
    expect(getPedagogicalAssignment("atp-001")?.status).toBe("Atual");
    expect(PEDAGOGICAL_SUBSTITUTION_SCOPE_NOTE).toMatch(/permanece preservada/);
  });

  it("cobre os cenários fictícios A–T", () => {
    expect(PEDAGOGICAL_OPERATION_SCENARIOS).toHaveLength(20);
    expect(PEDAGOGICAL_OPERATION_SCENARIOS.map((item) => item.id)).toContain("T");
  });
});

describe("Workspaces demonstrativos — rotas e acessibilidade", () => {
  it("abre a nova atuação pedagógica com seções navegáveis", async () => {
    renderOperationalRoutes("/atuacoes-pedagogicas/nova");
    expect(
      await screen.findByRole("heading", { name: /Nova atuação pedagógica/i, level: 1 }),
    ).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: /Seções/i });
    expect(within(nav).getByText("Profissional e vínculo")).toBeInTheDocument();
    expect(within(nav).getByText("Revisão")).toBeInTheDocument();
  });

  it("exige seleção explícita do vínculo ao escolher profissional com dois vínculos", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderOperationalRoutes("/atuacoes-pedagogicas/nova");
    const picker = await screen.findByRole("combobox", { name: /Profissional existente/i });
    const professional = getDemonstrationProfessional("pro-008");
    await user.selectOptions(picker, "pro-008");
    expect(professional?.links.length).toBeGreaterThan(1);
    expect(
      await screen.findByText(/nenhum deles é escolhido automaticamente/i),
    ).toBeInTheDocument();
  });

  it("aplica minimização de dados no workspace de criação", async () => {
    renderOperationalRoutes("/atuacoes-pedagogicas/nova");
    expect(await screen.findByText(/CPF completo/i)).toBeInTheDocument();
  });

  it("abre o encerramento mostrando as consequências preservadas", async () => {
    renderOperationalRoutes("/profissionais/pro-006/atuacoes/atp-001/encerrar");
    expect(
      await screen.findByRole("heading", { name: /Encerrar atuação pedagógica/i, level: 1 }),
    ).toBeInTheDocument();
    const list = screen.getByRole("list", { name: /Consequências do encerramento/i });
    expect(within(list).getByText(/O Vínculo Funcional não é encerrado/i)).toBeInTheDocument();
  });

  it("abre a substituição com comparação entre titular e substituto", async () => {
    renderOperationalRoutes("/profissionais/pro-006/atuacoes/atp-001/substituir");
    expect(
      await screen.findByRole("heading", { name: /Substituição temporária/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Atuação original")).toBeInTheDocument();
    expect(screen.getByText("Substituição")).toBeInTheDocument();
    expect(screen.getByText(PEDAGOGICAL_SUBSTITUTION_SCOPE_NOTE)).toBeInTheDocument();
  });

  it("abre a edição com o contexto atual carregado", async () => {
    renderOperationalRoutes("/profissionais/pro-006/atuacoes/atp-001/editar");
    expect(
      await screen.findByRole("heading", { name: /atuação pedagógica/i, level: 1 }),
    ).toBeInTheDocument();
    expect(isPedagogicalDirty(draftFromRecord(record()), draftFromRecord(record()))).toBe(false);
  });

  it("mostra o estado de alterações não salvas após editar a vigência", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderOperationalRoutes("/profissionais/pro-006/atuacoes/atp-001/encerrar");
    expect(await screen.findByText("Sem alterações")).toBeInTheDocument();
    const end = screen.getByLabelText(/Data de término proposta/i);
    await user.type(end, "2026-12-18");
    expect(await screen.findByText("Alterações não salvas")).toBeInTheDocument();
  });
});

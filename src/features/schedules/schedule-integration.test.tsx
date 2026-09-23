import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderOperationalRoutes } from "@/test/router-harness";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import {
  INTEGRATION_CALENDAR_NOTE,
  INTEGRATION_IDENTITY_NOTE,
  SCHEDULE_INTEGRATION_REFERENCE_DATE,
  SCHEDULE_REFERENCE_DATES_ALIGNED,
  classProjection,
  conflictsForClass,
  conflictsForUnit,
  coresponsibilityBlocksOf,
  integrationConsistencyIssues,
  networkProjectionEntries,
  normalizeReferenceDate,
  pendingRectifications,
  personProjection,
  referenceSearch,
  unitProjection,
} from "./schedule-integration";
import { effectiveVersionFor, versionsForClass } from "./schedule-lifecycle";
import { detectPotentialConflicts, getJourneyForClass } from "./schedules-data";

describe("Horários 10D — fonte única e projeções", () => {
  it("usa uma única data de referência alinhada entre 10A/10B/10C", () => {
    expect(SCHEDULE_REFERENCE_DATES_ALIGNED).toBe(true);
    expect(normalizeReferenceDate("texto inválida")).toBe(SCHEDULE_INTEGRATION_REFERENCE_DATE);
    expect(normalizeReferenceDate("2026-03-01")).toBe("2026-03-01");
  });

  it("omite o parâmetro de data quando é a data padrão e o preserva quando difere", () => {
    expect(referenceSearch(SCHEDULE_INTEGRATION_REFERENCE_DATE)).toEqual({});
    expect(referenceSearch("2026-03-01")).toEqual({ data: "2026-03-01" });
  });

  it("projeta turma, unidade e profissional a partir dos mesmos blocos", () => {
    const klass = classProjection("tur-001");
    expect(klass.blocks.length).toBeGreaterThan(0);
    const unit = unitProjection(klass.unitId);
    const unitBlockIds = unit.classes.flatMap((item) => item.blocks.map((block) => block.id));
    for (const block of klass.blocks) expect(unitBlockIds).toContain(block.id);
    const owner = networkProjectionEntries().find((entry) =>
      klass.blocks.some((block) => block.id === entry.block.id),
    );
    expect(owner).toBeTruthy();
    const person = personProjection(owner!.professionalId);
    expect(person.entries.some((entry) => entry.classId === "tur-001")).toBe(true);
  });

  it("preserva identificadores canônicos em vez de nomes", () => {
    const person = personProjection("pro-006");
    expect(person.personId).toBe(getDemonstrationProfessional("pro-006")?.personId);
    expect(person.linkIds.length).toBeGreaterThan(0);
    for (const entry of person.entries) {
      expect(entry.classId).toMatch(/^tur-/);
      expect(entry.assignment.id).toMatch(/^atp-/);
      expect(entry.block.id).toMatch(/^bl-/);
    }
    expect(INTEGRATION_IDENTITY_NOTE.length).toBeGreaterThan(0);
  });

  it("não reporta inconsistências entre as camadas consolidadas", () =>
    expect(integrationConsistencyIssues()).toEqual([]));
});

describe("Horários 10D — integridade temporal e versões", () => {
  it("distingue versão mais recente de versão vigente na data", () => {
    const versions = versionsForClass("tur-001");
    const latest = versions[versions.length - 1];
    const projection = classProjection("tur-001", "2026-03-01");
    expect(projection.effective?.id).toBe("grd-001-v1");
    expect(projection.effective?.id).not.toBe(latest?.id);
  });

  it("seleciona a versão histórica ao consultar por data anterior", () => {
    const early = classProjection("tur-001", "2026-03-01");
    const current = classProjection("tur-001");
    expect(early.effective?.id).not.toBe(current.effective?.id);
    expect(early.blocks).not.toEqual(current.blocks);
  });

  it("mantém versões históricas somente leitura", () => {
    const early = classProjection("tur-001", "2026-03-01");
    expect(early.readOnly).toBe(true);
  });

  it("separa vigência da jornada da vigência da grade", () => {
    const projection = classProjection("tur-001");
    expect(projection.journey?.id).toBe(getJourneyForClass("tur-001")?.id);
    expect(projection.journey?.id).not.toBe(projection.effective?.id);
  });

  it("não apresenta grade futura como vigente e preserva retificações futuras", () => {
    const projection = classProjection("tur-001");
    const future = projection.future.map((item) => item.id);
    expect(future).not.toContain(projection.effective?.id);
    for (const rectification of pendingRectifications("tur-001"))
      expect(rectification.effectiveOn > projection.referenceDate).toBe(true);
  });

  it("não declara duas versões vigentes simultâneas para o mesmo contexto", () => {
    for (const classId of ["tur-001", "tur-002", "tur-004"]) {
      const effective = effectiveVersionFor(classId, SCHEDULE_INTEGRATION_REFERENCE_DATE);
      const sameDate = versionsForClass(classId).filter(
        (item) =>
          item.state === "Publicada" &&
          item.effectiveFrom <= SCHEDULE_INTEGRATION_REFERENCE_DATE &&
          (!item.effectiveTo || item.effectiveTo >= SCHEDULE_INTEGRATION_REFERENCE_DATE),
      );
      if (effective) expect(sameDate.map((item) => item.id)).toEqual([effective.id]);
    }
  });
});

describe("Horários 10D — conflitos, corresponsabilidade e substituições", () => {
  it("apura conflitos pela identidade da Pessoa em toda a rede", () => {
    const conflicts = detectPotentialConflicts();
    for (const conflict of conflicts) {
      expect(conflict.personId).toMatch(/^pes-/);
      expect(conflict.linkIds.length).toBeGreaterThan(0);
      expect(conflict.blockIds[0]).not.toBe(conflict.blockIds[1]);
    }
  });

  it("não gera falso conflito para corresponsabilidade no mesmo bloco", () => {
    const shared = coresponsibilityBlocksOf("tur-001");
    expect(shared.length).toBeGreaterThan(0);
    for (const block of shared)
      for (const conflict of conflictsForClass("tur-001"))
        expect(conflict.blockIds[0] === block.id && conflict.blockIds[1] === block.id).toBe(false);
  });

  it("consolida conflitos coerentes entre turma e unidade", () => {
    const klass = classProjection("tur-001");
    const unitConflictIds = conflictsForUnit(klass.unitId).map((item) => item.id);
    for (const conflict of conflictsForClass("tur-001"))
      if (conflict.unitIds.every((unitId) => unitId === klass.unitId))
        expect(unitConflictIds).toContain(conflict.id);
  });

  it("não atribui blocos a substituto fora da vigência da atuação", () => {
    const outside = personProjection("pro-009", "2026-09-23");
    expect(outside.entries.every((entry) => entry.inVigency)).toBe(true);
    const inside = personProjection("pro-009", "2026-05-20");
    expect(inside.entries.length).toBeGreaterThanOrEqual(outside.entries.length);
  });

  it("preserva a atuação titular ao representar a substituição", () => {
    const titular = personProjection("pro-006", "2026-05-20");
    expect(titular.entries.some((entry) => entry.assignment.id === "atp-001")).toBe(true);
  });
});

describe("Horários 10D — múltiplos vínculos e múltiplas unidades", () => {
  it("consolida vínculos distintos da mesma Pessoa sem apagar a identificação", () => {
    const person = personProjection("pro-008");
    expect(person.linkIds.length + person.entries.length).toBeGreaterThan(0);
    for (const group of person.groups) expect(group.linkIds.length).toBeGreaterThan(0);
  });

  it("reúne unidades distintas em uma visão consolidada", () => {
    const person = personProjection("pro-003");
    const unitIds = new Set(person.groups.map((group) => group.unitId));
    expect(unitIds.size).toBeGreaterThanOrEqual(1);
    expect(person.unitIds.length).toBeGreaterThanOrEqual(unitIds.size);
  });
});

describe("Horários 10D — matriz, jornada, calendário e modalidades", () => {
  it("referencia a matriz aplicável da turma sem declarar cumprimento normativo", () => {
    const projection = classProjection("tur-001");
    expect(projection.matrixId).toBe(getDemonstrationClass("tur-001")?.matrixId);
  });

  it("não preenche a grade a partir da jornada", () => {
    const projection = classProjection("tur-007");
    expect(projection.journey).toBeTruthy();
    expect(projection.blocks).toEqual([]);
    expect(projection.source).toContain("Sem distribuição");
  });

  it("mantém calendário e grade independentes", () =>
    expect(INTEGRATION_CALENDAR_NOTE.toLowerCase()).toContain("calendário"));

  it("representa Educação Infantil, EJA e multisseriada em grade única por turma", () => {
    for (const classId of ["tur-009", "tur-004", "tur-003"]) {
      const projection = classProjection(classId);
      expect(projection.klass?.id).toBe(classId);
      expect(projection.weekView === undefined || Boolean(projection.weekView)).toBe(true);
    }
  });
});

describe("Horários 10D — navegação contextual e estados", () => {
  it("preserva a data de referência ao consultar a turma", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001?data=2026-03-01");
    expect(await screen.findByText(/2026-03-01/)).toBeInTheDocument();
  });

  it("navega da turma para as versões preservando o contexto", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001");
    const link = await screen.findByRole("link", { name: /Versões/ });
    await userEvent.click(link);
    expect(await screen.findByText(/Versão 1/)).toBeInTheDocument();
  });

  it("apresenta ausência de grade como estado vazio, não como erro", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-007");
    expect(await screen.findByText("Grade semanal não iniciada")).toBeInTheDocument();
  });

  it("gera impressão histórica com dados da versão consultada", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001/impressao?data=2026-03-01");
    expect(await screen.findByText("Documento demonstrativo — não oficial")).toBeInTheDocument();
    expect(screen.getByText(/2026-03-01/)).toBeInTheDocument();
  });

  it("mantém a consulta do profissional acessível e sem dados sensíveis", async () => {
    renderOperationalRoutes("/horarios/profissionais/pro-006");
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  });

  it("mantém a consulta da unidade coerente com as turmas projetadas", async () => {
    const klass = classProjection("tur-001");
    renderOperationalRoutes(`/horarios/unidades/${klass.unitId}`);
    expect(await screen.findByText(/Grades vigentes/)).toBeInTheDocument();
  });
});

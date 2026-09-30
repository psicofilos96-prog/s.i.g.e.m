import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  academicYearOn,
  academicYears,
  classAcademicYear,
  classStage,
  getAcademicYear,
  validateAcademicYear,
} from "@/features/academic/academic-structure";
import { demonstrationClasses } from "@/features/classes/classes-data";
import { diaryStageForClass, studentsForClassOn } from "@/features/diary/diary-data";
import { demonstrationStudents } from "@/features/students/students-data";
import {
  formatAcademicDate,
  formatAcademicDateNumeric,
  isIsoDate,
  parseAcademicDate,
} from "@/lib/academic-date";
import { assessmentConfigurations, periodStructures } from "./assessment-fixtures";
import {
  addPeriod,
  assessmentPermissions,
  classConfigurationState,
  configurationState,
  isHomologated,
  removePeriod,
  renamePeriod,
  strategyCapabilities,
  validateStructureOwnership,
} from "./assessment-configuration";
import { resolveConfiguration, validatePeriodStructure } from "./assessment-rules";
import { documentAvailability, getDocumentDependency } from "./document-dependencies";
import { AssessmentStructureView } from "./assessment-structure-page";
import type { AssessmentConfiguration, AssessmentPeriodStructure } from "./assessment-types";

const y2026 = getAcademicYear("ano-2026")!;
const cfg = (id: string) => assessmentConfigurations.find((c) => c.id === id)!;
const base: AssessmentPeriodStructure = {
  id: "est-t",
  academicYearId: "ano-2026",
  label: "Teste",
  normativeStatus: "demonstrativo",
  periods: [],
};
const period = (id: string, start: string, end: string, label = id) => ({ id, label, start, end });

describe("ano letivo com identidade própria", () => {
  it("toda turma referencia o ano letivo por ID existente", () => {
    for (const k of demonstrationClasses) expect(getAcademicYear(k.academicYearId)).toBeDefined();
    expect(classAcademicYear("tur-006")!.id).toBe("ano-2025");
  });
  it("renomear o rótulo não quebra referências", () => {
    const renamed = academicYears.map((y) => ({ ...y, label: "Nome alterado" }));
    expect(classAcademicYear("tur-001", renamed)!.id).toBe("ano-2026");
    expect(classAcademicYear("tur-001", renamed)!.label).toBe("Nome alterado");
  });
  it("distingue ano civil de vigência", () => {
    expect(academicYearOn("2026-01-15")).toBeUndefined();
    expect(academicYearOn("2026-03-01")!.id).toBe("ano-2026");
    expect(
      validateAcademicYear({ ...y2026, validity: { start: "2026-12-01", end: "2026-01-01" } }),
    ).not.toEqual([]);
  });
});

describe("data canônica", () => {
  it("parsing independe da formatação", () => {
    expect(parseAcademicDate("09/02/2026")).toBe("2026-02-09");
    expect(parseAcademicDate("09/02/2026")).toBe("2026-02-09");
    expect(parseAcademicDate("2026-02-09")).toBe("2026-02-09");
    expect(parseAcademicDate("31/02/2026")).toBeNull();
    expect(formatAcademicDate("2026-02-09")).toBe("09/02/2026");
    expect(formatAcademicDateNumeric("2026-02-09")).toBe("09/02/2026");
  });
  it("trajetórias guardam datas ISO", () => {
    const all = demonstrationStudents.flatMap((s) =>
      s.enrollments.flatMap((e) =>
        e.academicLinks.flatMap((l) => l.participations.flatMap((p) => p.allocations)),
      ),
    );
    expect(all.length).toBeGreaterThan(0);
    for (const a of all) {
      expect(isIsoDate(a.from)).toBe(true);
      if (a.until) expect(isIsoDate(a.until)).toBe(true);
    }
    expect(studentsForClassOn("tur-001", "2026-09-23").length).toBeGreaterThan(0);
  });
});

describe("etapa/modalidade estruturada", () => {
  it("toda turma possui referência estruturada demonstrativa", () => {
    for (const k of demonstrationClasses) {
      expect(classStage(k.id)?.normativeStatus).toBe("demonstrativo");
    }
  });
  it("não depende do texto da organização acadêmica", () => {
    const k = demonstrationClasses.find((c) => c.id === "tur-002")!;
    const original = k.academicOrganization;
    k.academicOrganization = "Texto livre sem palavras-chave";
    try {
      expect(diaryStageForClass("tur-002")).toBe("Educação Infantil");
      expect(resolveConfiguration("tur-002", "ano-2026", assessmentConfigurations).status).toBe(
        "resolvida",
      );
    } finally {
      k.academicOrganization = original;
    }
  });
});

describe("estrutura de períodos", () => {
  it("período único, três e quantidade arbitrária", () => {
    const one = addPeriod(base, period("p1", "2026-02-05", "2026-12-18"));
    expect(validatePeriodStructure(one, y2026.validity)).toEqual([]);
    expect(periodStructures.find((s) => s.id === "est-2026-a")!.periods).toHaveLength(3);
    let many = base;
    const starts = ["02-05", "03-02", "04-01", "05-04", "06-01", "08-03", "10-01"];
    const ends = ["02-27", "03-31", "04-30", "05-29", "07-10", "09-30", "12-18"];
    starts.forEach(
      (s, i) => (many = addPeriod(many, period(`p${i}`, `2026-${s}`, `2026-${ends[i]}`))),
    );
    expect(many.periods).toHaveLength(7);
    expect(validatePeriodStructure(many, y2026.validity)).toEqual([]);
    expect(validateStructureOwnership(many)).toEqual([]);
  });
  it("sobreposição e fora do ano letivo", () => {
    const s = addPeriod(
      addPeriod(base, period("a", "2026-02-05", "2026-06-30")),
      period("b", "2026-06-01", "2027-01-10"),
    );
    const msgs = validatePeriodStructure(s, y2026.validity).map((i) => i.message);
    expect(msgs).toContain("Sobreposição com o período anterior.");
    expect(msgs).toContain("Fora do ano letivo.");
  });
  it("renomear e remover preservam identidade e resequenciam", () => {
    const s = addPeriod(
      addPeriod(base, period("a", "2026-02-05", "2026-06-30")),
      period("b", "2026-07-01", "2026-12-18"),
    );
    expect(renamePeriod(s, "b", "Etapa final").periods[1]!.id).toBe("b");
    expect(removePeriod(s, "a").periods[0]).toMatchObject({ id: "b", sequence: 1 });
  });
});

describe("configuração e escalas", () => {
  it("escala quantitativa não limitada a 0–10", () => {
    const scale = cfg("cfg-2026-quantitativa-demo").scales[0]!;
    expect(scale.kind === "numerica" && scale.max).toBe(100);
  });
  it("escala conceitual declara ordenação", () => {
    const scale = cfg("cfg-2026-conceitual-demo").scales.find((s) => s.kind === "conceitual")!;
    expect(scale.kind === "conceitual" && typeof scale.ordered).toBe("boolean");
  });
  it("acompanhamento sem escala, sem nota e sem média", () => {
    const caps = strategyCapabilities(cfg("cfg-2026-ei-acompanhamento"));
    expect(caps).toMatchObject({
      grades: false,
      promotionDecision: false,
      average: false,
      pedagogicalRecords: true,
    });
    expect(caps.scales).toEqual([]);
  });
  it("demonstrativa nunca é homologada", () => {
    for (const c of assessmentConfigurations) {
      const structure = periodStructures.find((s) => s.id === c.periodStructureId);
      expect(isHomologated(c, structure)).toBe(false);
      expect(isHomologated({ ...c, normativeStatus: "configurado" }, structure)).toBe(false);
    }
    expect(classConfigurationState("tur-001").kind).toBe("demonstrativa");
  });
  it("configuração incompleta e inexistente", () => {
    const broken: AssessmentConfiguration = {
      ...cfg("cfg-2026-quantitativa-demo"),
      allowedInstrumentTypeIds: [],
      scales: [],
    };
    const state = configurationState({ configuration: broken });
    expect(state.kind).toBe("incompleta");
    expect(classConfigurationState("tur-006").kind).toBe("inexistente");
  });
  it("professor consulta mas não configura nem homologa", () => {
    const p = assessmentPermissions("professor");
    expect(p.consult).toBe(true);
    expect(p.configure.granted).toBe(false);
    expect(p.homologate.granted).toBe(false);
  });
});

describe("dependências documentais", () => {
  it("Ficha Individual não aparece como disponível", () => {
    expect(documentAvailability(getDocumentDependency("Ficha Individual")!).state).not.toBe(
      "disponivel",
    );
    expect(documentAvailability(getDocumentDependency("Boletim")!).state).toBe("indisponivel");
    expect(documentAvailability(getDocumentDependency("Diário de Classe")!).state).toBe(
      "parcialmente-disponivel",
    );
  });
});

describe("interface da estrutura avaliativa", () => {
  it("na sessão institucional não busca etapa, calendário ou regra demonstrativos", () => {
    const seed = classConfigurationState("tur-001");
    if (!("configuration" in seed)) throw new Error("seed sem estrutura");
    render(<AssessmentStructureView classId="tur-institucional" viewer="professor"
      state={{ ...seed, kind: "homologada", homologated: true, year: { ...seed.year, id: "ano-institucional", label: "Ano institucional", calendarId: "calendario-demonstrativo" },
        structure: { ...seed.structure, label: "Organização institucional" } }}
      institutional={{ stageId: "etapa-institucional", rules: [] }} />);
    expect(screen.getByRole("heading", { name: "Organização institucional" })).toBeInTheDocument();
    expect(screen.getByText("Regra avaliativa institucional indisponível")).toBeInTheDocument();
    expect(screen.queryByText("Calendário escolar")).toBeNull();
    expect(screen.queryByText("Etapa não referenciada")).toBeNull();
    expect(screen.queryByText("Calendário não localizado")).toBeNull();
  });
  it("sem fonte institucional exibe indisponibilidade sem consultar etapa demonstrativa", () => {
    render(<AssessmentStructureView classId="tur-001" viewer="professor"
      state={{ kind: "inexistente", reason: "Vínculo institucional ausente." }}
      institutional={{ stageId: undefined, rules: [] }} />);
    expect(screen.getByText(/Vínculo institucional ausente/)).toBeInTheDocument();
    expect(screen.queryByText("Etapa não referenciada")).toBeNull();
  });
  it("Educação Infantil não mostra nota, escala ou aprovação", () => {
    render(
      <AssessmentStructureView
        classId="tur-009"
        state={classConfigurationState("tur-009")}
        viewer="professor"
      />,
    );
    expect(screen.getByText("Acompanhamento do desenvolvimento")).toBeInTheDocument();
    expect(screen.queryByText(/Registro por nota/)).toBeNull();
    expect(screen.queryByText(/Situação acadêmica/)).toBeNull();
    expect(screen.queryByRole("heading", { name: /Escala/ })).toBeNull();
    expect(screen.getByText("Evidências do desenvolvimento")).toBeInTheDocument();
  });
  it("quantitativa mostra períodos pelos nomes dos dados e marca não oficial", () => {
    render(
      <AssessmentStructureView
        classId="tur-001"
        state={classConfigurationState("tur-001")}
        viewer="professor"
      />,
    );
    expect(screen.getByText("Período demonstrativo 2")).toBeInTheDocument();
    expect(screen.getByText("Não oficial")).toBeInTheDocument();
    expect(screen.getByText(/de 0 a 100/)).toBeInTheDocument();
  });
});

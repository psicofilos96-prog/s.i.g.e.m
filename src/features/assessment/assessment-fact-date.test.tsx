import { useState, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assessmentConfigurations } from "./assessment-fixtures";
import type { ConfigurationState } from "./assessment-configuration";
import type { AssessmentInstrument } from "./assessment-types";
import type { DemonstrationStudent } from "@/features/students/students-data";
import { FIELD_LAB_INSTRUMENT_ID } from "./assessment-entry-field-fixture";
import { fieldVersionStore } from "./assessment-entry-field-config";
import { NewInstrumentPage, InstrumentPage } from "./assessment-instrument-pages";
import { AssessmentEntryFieldPage } from "./assessment-entry-field-page";

const mocks = vi.hoisted(() => ({
  configuration: vi.fn(),
  normative: vi.fn(),
  build: vi.fn(),
  instrument: null as AssessmentInstrument | null,
  labInstrument: null as AssessmentInstrument | null,
  signedIn: true,
  rosterStatus: "pronta" as "pronta" | "laboratorio" | "indisponivel",
  diaryMode: "cloud" as "cloud" | "laboratorio",
  officialStudents: [] as DemonstrationStudent[],
  states: new Map<string, ConfigurationState>(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
  useBlocker: () => undefined,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/features/authority/session-authority", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/authority/session-authority")>()),
  useSessionAuthority: () => ({
    status: mocks.signedIn ? "signed-in" : "signed-out",
    user: { id: "user" },
    person: null,
    capabilities: [],
  }),
}));
vi.mock("@/features/students/institutional-roster", () => ({
  useInstitutionalRoster: () => ({ status: mocks.rosterStatus, students: mocks.officialStudents }),
  rosterStudents: () => [],
}));
vi.mock("@/features/diary/institutional-teaching", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/diary/institutional-teaching")>()),
  useInstitutionalTeaching: () => undefined,
  teachingClass: () => ({
    id: "class-1",
    name: "Turma oficial",
    unitId: "school-1",
    academicYearId: "year-1",
  }),
}));
vi.mock("@/features/diary/diary-cloud", () => ({ useDiaryCloudSync: () => undefined }));
vi.mock("@/features/diary/diary-persistence-mode", () => ({
  useDiaryPersistenceMode: () => mocks.diaryMode,
  isDiaryCloud: () => mocks.signedIn,
  subscribeDiaryPersistenceMode: () => () => undefined,
}));
vi.mock("@/features/diary/diary-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/diary/diary-data")>()),
  diaryContext: (_professional: string, date: string) => ({
    professionalId: "teacher-1",
    referenceDate: date,
    historical: false,
    assignments: [
      {
        classId: "class-1",
        unitId: "school-1",
        field: "Componente",
        record: { id: "assignment-1", field: "Componente" },
      },
    ],
  }),
}));
vi.mock("@/features/diary/diary-context", () => ({
  DiaryHeader: ({ title, children }: { title: string; children: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {children}
    </header>
  ),
}));
vi.mock("./assessment-normative-sources", async (orig) => ({
  // Contrato real de sessão (Patch 4b); só as leituras são substituídas.
  normativeSessionArgs: (await orig<typeof import("./assessment-normative-sources")>()).normativeSessionArgs,
  useClassConfigurationState: (classId: string, date?: string) => {
    mocks.configuration(classId, date);
    return (
      mocks.states.get(date ?? "") ?? {
        kind: "inexistente",
        reason: "Organização indisponível nesta data.",
      }
    );
  },
  useAssessmentNormativeSource: ({
    classId,
    academicDate,
  }: {
    classId: string;
    academicDate?: string;
  }) => {
    mocks.normative(classId, academicDate);
    return {
      state: mocks.states.get(academicDate ?? "") ?? {
        kind: "inexistente",
        reason: "Organização indisponível nesta data.",
      },
    };
  },
}));
vi.mock("./assessment-results-cloud", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./assessment-results-cloud")>()),
  useCloudPautaFacts: () => ({
    ready: true,
    instrument: mocks.instrument,
    versions: [],
    acts: [],
    closings: [],
    policies: [],
    lastStatusEventId: null,
    refresh: async () => undefined,
  }),
}));
vi.mock("./assessment-instrument-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./assessment-instrument-store")>()),
  useInstrumentStore: () => ({
    get: () => mocks.labInstrument,
    typeLabel: () => "Tipo demonstrativo",
    periodLabel: () => "Período demonstrativo",
  }),
}));
vi.mock("./assessment-instruments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./assessment-instruments")>()),
  buildInstrument: (args: unknown) => mocks.build(args),
  instrumentRoster: () => ({ eligible: [], informative: [] }),
}));
vi.mock("@/components/sigem/assessment-entry-registration", () => ({
  AssessmentEntryRegistration: ({
    source,
    allowMissingEntry,
  }: {
    source: {
      readRoster: () => {
        configuration: { periodStructureId: string; scales: { kind: string; max?: number; options?: { id: string }[] }[] };
        period?: { label: string };
        missingEntryPolicy?: { admissibleReasons: { id: string }[] };
        students: { studentId: string }[];
      };
    };
    allowMissingEntry: boolean;
  }) => {
    const [localDraft, setLocalDraft] = useState("");
    return (
    <div data-testid="pauta-oficial">
      {source.readRoster().configuration.periodStructureId}
      <span data-testid="pauta-periodo">{source.readRoster().period?.label}</span>
      <span data-testid="pauta-escala">{source.readRoster().configuration.scales.map((scale) => `${scale.kind}:${scale.max ?? scale.options?.map((o) => o.id).join(",") ?? ""}`).join("|")}</span>
      <span data-testid="pauta-politica">{source.readRoster().missingEntryPolicy?.admissibleReasons.map((reason) => reason.id).join(",") ?? "sem-politica"}</span>
      <span data-testid="pauta-acao-ausencia">{allowMissingEntry ? "disponivel" : "indisponivel"}</span>
      <button type="button" data-testid="pauta-rascunho" onClick={() => setLocalDraft("rascunho-do-laboratorio")}>Preparar rascunho</button>
      <span data-testid="pauta-rascunho-valor">{localDraft}</span>
      {source.readRoster().students.map((student) => (
        <span key={student.studentId}>{student.studentId}</span>
      ))}
    </div>
    );
  },
}));

const A = "2026-03-01";
const B = "2026-07-01";
const search = { data: A };
const config = assessmentConfigurations[0]!;
function stateFor(date: string): ConfigurationState {
  const organization = date === A ? "A" : "B";
  return {
    kind: "homologada",
    configuration: {
      ...config,
      id: `config-${organization}`,
      periodStructureId: `org-${organization}`,
      scales: [
        {
          kind: "numerica",
          min: 0,
          max: organization === "A" ? 100 : 50,
          step: 1,
          normativeStatus: "homologado",
        },
      ],
    },
    structure: {
      id: `org-${organization}`,
      academicYearId: "year-1",
      label: `Organização ${organization}`,
      normativeStatus: "homologado",
      periods: [
        {
          id: `period-${organization}`,
          structureId: `org-${organization}`,
          academicYearId: "year-1",
          sequence: 1,
          label: `Período ${organization}`,
          start: "2026-01-01",
          end: "2026-12-31",
        },
      ],
    },
    year: {
      id: "year-1",
      label: "Ano",
      validity: { start: "2026-01-01", end: "2026-12-31" },
      calendarId: "",
      normativeStatus: "homologado",
    },
    issues: [],
    missing: [],
    pendingRules: [],
    homologated: true,
  };
}
function instrument(appliedOn: string): AssessmentInstrument {
  return {
    id: "instrument-1",
    classId: "class-1",
    appliedOn,
    configurationId: "config-B",
    periodId: "period-B",
    pedagogicalAssignmentId: "assignment-1",
    instrumentTypeId: "it-prova",
    title: "Prova oficial",
    snapshot: { classLabel: "Turma oficial", fieldLabel: "Componente" },
    status: "aplicado",
  };
}

beforeEach(() => {
  fieldVersionStore.setMode("numerica");
  mocks.configuration.mockClear();
  mocks.normative.mockClear();
  mocks.build.mockReset();
  mocks.instrument = null;
  mocks.labInstrument = null;
  mocks.signedIn = true;
  mocks.rosterStatus = "pronta";
  mocks.diaryMode = "cloud";
  mocks.officialStudents = [];
  mocks.states.clear();
  mocks.states.set(A, stateFor(A));
  mocks.states.set(B, stateFor(B));
  mocks.build.mockReturnValue({ ok: false, reasons: ["Teste sem escrita"] });
});

describe("B2.5.3 — data efetiva do fato avaliativo", () => {
  it("novo instrumento usa a data de aplicação B, embora a navegação esteja em A", () => {
    render(<NewInstrumentPage classId="class-1" search={search} />);
    expect(mocks.configuration).not.toHaveBeenCalledWith("class-1", A);
    fireEvent.change(screen.getByLabelText("Data de aplicação"), {
      target: { value: "01/07/2026" },
    });
    expect(mocks.configuration).toHaveBeenLastCalledWith("class-1", B);
    expect(screen.getByText("Período B")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Prova" } });
    fireEvent.change(screen.getByLabelText(/Tipo/), { target: { value: "it-prova" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar instrumento" }));
    expect(mocks.build).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ appliedOn: B }),
        configuration: expect.objectContaining({ periodStructureId: "org-B" }),
        structure: expect.objectContaining({ id: "org-B" }),
      }),
    );
  });

  it("trocar A → B oculta A enquanto B carrega e uma resposta tardia de A não reaparece", () => {
    const page = render(<NewInstrumentPage classId="class-1" search={search} />);
    const date = screen.getByLabelText("Data de aplicação");
    fireEvent.change(date, { target: { value: "01/03/2026" } });
    expect(screen.getByText("Período A")).toBeInTheDocument();
    mocks.states.delete(B);
    fireEvent.change(date, { target: { value: "01/07/2026" } });
    expect(mocks.configuration).toHaveBeenLastCalledWith("class-1", B);
    expect(screen.queryByText("Período A")).toBeNull();
    expect(screen.getByRole("button", { name: "Salvar instrumento" })).toBeDisabled();
    mocks.states.set(A, stateFor(A)); // resposta A chega depois da mudança
    page.rerender(<NewInstrumentPage classId="class-1" search={search} />);
    expect(screen.queryByText("Período A")).toBeNull();
    mocks.states.set(B, stateFor(B));
    page.rerender(<NewInstrumentPage classId="class-1" search={search} />);
    expect(screen.getByText("Período B")).toBeInTheDocument();
  });

  it("sem vínculo em B permanece indisponível, sem voltar a A", () => {
    mocks.states.delete(B);
    render(<NewInstrumentPage classId="class-1" search={search} />);
    fireEvent.change(screen.getByLabelText("Data de aplicação"), {
      target: { value: "01/07/2026" },
    });
    expect(screen.getByText("Organização indisponível nesta data.")).toBeInTheDocument();
    expect(screen.queryByText("Período A")).toBeNull();
    expect(screen.getByRole("button", { name: "Salvar instrumento" })).toBeDisabled();
  });

  it("Pauta aguarda o instrumento e usa sua appliedOn B, não search.data A", () => {
    const page = render(
      <AssessmentEntryFieldPage classId="class-1" instrumentId="instrument-1" search={search} />,
    );
    expect(mocks.normative).toHaveBeenLastCalledWith("class-1", undefined);
    expect(mocks.normative).not.toHaveBeenCalledWith("class-1", A);
    expect(screen.getByText("Pauta indisponível")).toBeInTheDocument();
    mocks.instrument = instrument(B);
    page.rerender(
      <AssessmentEntryFieldPage classId="class-1" instrumentId="instrument-1" search={search} />,
    );
    expect(mocks.normative).toHaveBeenLastCalledWith("class-1", B);
    expect(screen.getByTestId("pauta-oficial")).toHaveTextContent("org-B");
  });

  it("Pauta falha fechada quando B não possui vínculo, mesmo se A estiver disponível", () => {
    mocks.instrument = instrument(B);
    mocks.states.delete(B);
    render(
      <AssessmentEntryFieldPage classId="class-1" instrumentId="instrument-1" search={search} />,
    );
    expect(mocks.normative).toHaveBeenLastCalledWith("class-1", B);
    expect(screen.getByText("Pauta indisponível")).toBeInTheDocument();
    expect(screen.queryByTestId("pauta-oficial")).toBeNull();
  });

  it("troca de instrumento A → B sem vínculo em B remove os períodos de A da Pauta", () => {
    mocks.instrument = { ...instrument(A), id: "instrument-A", periodId: "period-A", configurationId: "config-A" };
    const page = render(
      <AssessmentEntryFieldPage classId="class-1" instrumentId="instrument-A" search={search} />,
    );
    expect(screen.getByTestId("pauta-periodo")).toHaveTextContent("Período A");
    mocks.instrument = { ...instrument(B), id: "instrument-B" };
    mocks.states.delete(B);
    page.rerender(
      <AssessmentEntryFieldPage classId="class-1" instrumentId="instrument-B" search={search} />,
    );
    expect(mocks.normative).toHaveBeenLastCalledWith("class-1", B);
    expect(screen.getByText("Pauta indisponível")).toBeInTheDocument();
    expect(screen.queryByTestId("pauta-oficial")).toBeNull();
    expect(screen.queryByText("Período A")).toBeNull();
  });

  it("a página do instrumento existente também consulta pela appliedOn B", () => {
    mocks.instrument = instrument(B);
    render(<InstrumentPage classId="class-1" instrumentId="instrument-1" search={search} />);
    expect(mocks.configuration).toHaveBeenLastCalledWith("class-1", B);
    expect(screen.getByText("Prova oficial")).toBeInTheDocument();
    expect(screen.getByText("Numérica 0–50")).toBeInTheDocument();
  });

  it("ID institucional igual à fixture não injeta alunos demonstrativos na Pauta", () => {
    fieldVersionStore.setMode("conceitual");
    mocks.officialStudents = [{
      id: "student-official-1",
      personName: "Estudante institucional",
      enrollments: [{
        id: "enrollment-official-1",
        academicLinks: [{
          id: "link-official-1", unitId: "school-1",
          participations: [{
            id: "participation-official-1", nature: "principal",
            allocations: [{ id: "allocation-official-1", classId: "class-1", from: "2026-02-01", until: null }],
          }],
        }],
      }],
    } as unknown as DemonstrationStudent];
    mocks.instrument = { ...instrument(B), id: FIELD_LAB_INSTRUMENT_ID };
    mocks.labInstrument = { ...instrument(A), id: FIELD_LAB_INSTRUMENT_ID, title: "Laboratório" };
    render(
      <AssessmentEntryFieldPage
        classId="class-1"
        instrumentId={FIELD_LAB_INSTRUMENT_ID}
        search={search}
      />,
    );
    expect(mocks.normative).toHaveBeenLastCalledWith("class-1", B);
    expect(screen.getByTestId("pauta-oficial")).toHaveTextContent("org-B");
    expect(screen.getByTestId("pauta-oficial")).not.toHaveTextContent("alu-lab-");
    expect(screen.getByTestId("pauta-oficial")).toHaveTextContent("student-official-1");
    expect(screen.getByTestId("pauta-periodo")).toHaveTextContent("Período B");
    expect(screen.getByTestId("pauta-escala")).toHaveTextContent("numerica:50");
    expect(screen.getByTestId("pauta-politica")).toHaveTextContent("sem-politica");
    expect(screen.getByTestId("pauta-acao-ausencia")).toHaveTextContent("indisponivel");
    expect(screen.queryByText(/Período demonstrativo|Tipo demonstrativo|mot-demo-/)).toBeNull();
  });

  it("sem elenco institucional, colisão de ID falha fechada", () => {
    mocks.instrument = { ...instrument(B), id: FIELD_LAB_INSTRUMENT_ID };
    mocks.rosterStatus = "indisponivel";
    render(
      <AssessmentEntryFieldPage
        classId="class-1"
        instrumentId={FIELD_LAB_INSTRUMENT_ID}
        search={search}
      />,
    );
    expect(
      screen.getByText("Não foi possível consultar os estudantes institucionais da turma."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("pauta-oficial")).toBeNull();
  });

  it("sessão institucional não usa o contexto demonstrativo antes de o Diário ativar o modo Cloud", () => {
    mocks.diaryMode = "laboratorio";
    mocks.instrument = { ...instrument(B), id: FIELD_LAB_INSTRUMENT_ID };
    mocks.labInstrument = { ...instrument(A), id: FIELD_LAB_INSTRUMENT_ID, title: "Laboratório" };
    render(
      <AssessmentEntryFieldPage classId="class-1" instrumentId={FIELD_LAB_INSTRUMENT_ID} search={search} />,
    );
    expect(screen.getByText("Pauta indisponível")).toBeInTheDocument();
    expect(screen.queryByTestId("pauta-oficial")).toBeNull();
    expect(screen.queryByText("Laboratório")).toBeNull();
  });

  it("colisão no login não transporta rascunho de laboratório para a Pauta institucional", () => {
    mocks.signedIn = false;
    mocks.diaryMode = "laboratorio";
    mocks.labInstrument = { ...instrument(A), id: FIELD_LAB_INSTRUMENT_ID, periodId: "period-A", title: "Laboratório" };
    const page = render(
      <AssessmentEntryFieldPage classId="class-1" instrumentId={FIELD_LAB_INSTRUMENT_ID} search={search} />,
    );
    fireEvent.click(screen.getByTestId("pauta-rascunho"));
    expect(screen.getByTestId("pauta-rascunho-valor")).toHaveTextContent("rascunho-do-laboratorio");
    mocks.signedIn = true;
    mocks.diaryMode = "cloud";
    mocks.instrument = { ...instrument(B), id: FIELD_LAB_INSTRUMENT_ID };
    page.rerender(
      <AssessmentEntryFieldPage classId="class-1" instrumentId={FIELD_LAB_INSTRUMENT_ID} search={search} />,
    );
    expect(screen.getByTestId("pauta-periodo")).toHaveTextContent("Período B");
    expect(screen.getByTestId("pauta-rascunho-valor")).toBeEmptyDOMElement();
  });

  it("sem sessão, o instrumento de laboratório mantém seus alunos demonstrativos", () => {
    fieldVersionStore.setMode("conceitual");
    mocks.signedIn = false;
    mocks.diaryMode = "laboratorio";
    mocks.rosterStatus = "laboratorio";
    mocks.labInstrument = { ...instrument(A), id: FIELD_LAB_INSTRUMENT_ID, title: "Laboratório" };
    render(
      <AssessmentEntryFieldPage
        classId="class-1"
        instrumentId={FIELD_LAB_INSTRUMENT_ID}
        search={search}
      />,
    );
    expect(screen.getByTestId("pauta-oficial")).toHaveTextContent("alu-lab-01");
    expect(screen.getByTestId("pauta-politica")).toHaveTextContent("mot-demo-nao-realizou");
    expect(screen.getByTestId("pauta-acao-ausencia")).toHaveTextContent("disponivel");
    expect(screen.getByTestId("pauta-escala")).toHaveTextContent("cdemo-a");
  });
});

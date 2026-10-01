import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assessmentConfigurations } from "./assessment-fixtures";
import type { ConfigurationState } from "./assessment-configuration";
import type { AssessmentInstrument } from "./assessment-types";
import { NewInstrumentPage, InstrumentPage } from "./assessment-instrument-pages";
import { AssessmentEntryFieldPage } from "./assessment-entry-field-page";

const mocks = vi.hoisted(() => ({
  configuration: vi.fn(),
  normative: vi.fn(),
  build: vi.fn(),
  instrument: null as AssessmentInstrument | null,
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
    status: "signed-in",
    user: { id: "user" },
    person: null,
    capabilities: [],
  }),
}));
vi.mock("@/features/diary/institutional-teaching", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/diary/institutional-teaching")>()),
  teachingClass: () => ({
    id: "class-1",
    name: "Turma oficial",
    unitId: "school-1",
    academicYearId: "year-1",
  }),
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
vi.mock("./assessment-normative-sources", () => ({
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
    get: () => undefined,
    typeLabel: () => "Tipo",
    periodLabel: () => "Período",
  }),
}));
vi.mock("./assessment-instruments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./assessment-instruments")>()),
  buildInstrument: (args: unknown) => mocks.build(args),
  instrumentRoster: () => ({ eligible: [], informative: [] }),
}));
vi.mock("./assessment-period-sources", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./assessment-period-sources")>()),
  classEntryRoster: () => [],
}));
vi.mock("@/components/sigem/assessment-entry-registration", () => ({
  AssessmentEntryRegistration: ({
    source,
  }: {
    source: { readRoster: () => { configuration: { periodStructureId: string } } };
  }) => (
    <div data-testid="pauta-oficial">{source.readRoster().configuration.periodStructureId}</div>
  ),
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
  mocks.configuration.mockClear();
  mocks.normative.mockClear();
  mocks.build.mockReset();
  mocks.instrument = null;
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

  it("a página do instrumento existente também consulta pela appliedOn B", () => {
    mocks.instrument = instrument(B);
    render(<InstrumentPage classId="class-1" instrumentId="instrument-1" search={search} />);
    expect(mocks.configuration).toHaveBeenLastCalledWith("class-1", B);
    expect(screen.getByText("Prova oficial")).toBeInTheDocument();
    expect(screen.getByText("Numérica 0–50")).toBeInTheDocument();
  });
});

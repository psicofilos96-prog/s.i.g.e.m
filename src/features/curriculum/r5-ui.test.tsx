import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { EffectiveCapability } from "@/features/authority/session-authority";

let caps: EffectiveCapability[] = [];
vi.mock("@/features/authority/session-authority", () => ({
  useSessionAuthority: () => ({ status: "signed-in", user: { id: "u" }, sessionRevision: 1, person: null, capabilities: caps }),
}));
vi.mock("@/features/classes/institutional-class-source", () => ({ listInstitutionalClasses: vi.fn().mockResolvedValue([]) }));
vi.mock("@/features/curriculum/curricular-matrix-source", () => ({
  leafColumns: () => [], loadInstitutionalMatrices: vi.fn().mockResolvedValue([]), loadInstitutionalMatrixLayout: vi.fn().mockResolvedValue(null),
}));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));
vi.mock("@/features/curriculum/r5-source", async (orig) => {
  const real = await orig<typeof import("@/features/curriculum/r5-source")>();
  return {
    ...real,
    loadLedger: vi.fn().mockResolvedValue([]),
    loadProfiles: vi.fn().mockResolvedValue(new Map()),
    loadCorrespondences: vi.fn().mockResolvedValue(new Map()),
    loadAssociations: vi.fn().mockResolvedValue(new Map()),
  };
});

import { HomologationPanel } from "@/features/curriculum/r5-homologation-panel";
import { AssociationsTab, CorrespondencesTab, E4_EXCEPTION_NOTE, ProfilesTab } from "@/features/curriculum/curricular-correspondence";

const cap = (capabilityId: string): EffectiveCapability => ({
  capabilityId, engagementId: "e", policyId: "p", policyVersion: 3, classId: null, periodId: null, schoolId: null, componentId: null,
});
const wrap = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => { caps = []; });

describe("R5 UI — política em rascunho / sem capability", () => {
  it("homologação E1 sem capability mostra estado e explicação, sem botão", async () => {
    caps = [cap("manter-matrizes-curriculares")];
    wrap(<HomologationPanel kind="matrix" versionId="v1" title="Homologação" />);
    expect(await screen.findByText("Sem homologação")).toBeInTheDocument();
    expect(screen.getByTestId("r5-matrix-v1-blocked")).toHaveTextContent(/homologar-matrizes-curriculares.*aguarda a homologação da política.*não homologa a política/);
    expect(screen.queryByRole("button", { name: /Homologar/ })).toBeNull();
  });
  it("com capability de rede efetiva, ação Homologar aparece", async () => {
    caps = [cap("homologar-matrizes-curriculares")];
    wrap(<HomologationPanel kind="matrix" versionId="v1" title="Homologação" />);
    expect(await screen.findByRole("button", { name: "Homologar versão" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Revogar/ })).toBeNull();
  });
  it("E2/E3/E4 sem capability: nenhum botão de criação", async () => {
    const opts = new Map([["s", [{ scheme: "s", value: "a", version: 1, label: "A" }]]]);
    wrap(<><ProfilesTab knownAt="k" validOn="2027-01-01" options={opts} canWrite={false} />
      <CorrespondencesTab knownAt="k" validOn="2027-01-01" options={opts} matrices={[{ matrixId: "m", officialName: "M" }]} canWrite={false} />
      <AssociationsTab knownAt="k" validOn="2027-01-01" matrices={[]} canWrite={false} /></>);
    expect(await screen.findByTestId("r5-profile-maintain-blocked")).toHaveTextContent("manter-perfis-correspondencia-curricular");
    expect(screen.getByTestId("r5-correspondence-maintain-blocked")).toHaveTextContent("manter-correspondencias-posicao-matriz");
    expect(screen.getByTestId("r5-association-maintain-blocked")).toHaveTextContent("manter-associacoes-especificas-matriz");
    expect(screen.queryByRole("button", { name: /Constituir|Registrar associação/ })).toBeNull();
  });
});

describe("R5 UI — ausência de dados canônicos", () => {
  it("sem catálogos homologados o perfil não pode ser constituído", async () => {
    wrap(<ProfilesTab knownAt="k" validOn="2027-01-01" options={new Map()} canWrite />);
    expect(await screen.findByText(/Não há valores de catálogo homologados/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Constituir novo perfil/ })).toBeNull();
  });
  it("sem perfis/matrizes a correspondência fica bloqueada", async () => {
    wrap(<CorrespondencesTab knownAt="k" validOn="2027-01-01" options={new Map()} matrices={[]} canWrite />);
    expect(await screen.findByText(/Não há perfil de correspondência registrado/)).toBeInTheDocument();
  });
  it("sem turmas a associação específica fica bloqueada e é apresentada como exceção, não fallback", async () => {
    wrap(<AssociationsTab knownAt="k" validOn="2027-01-01" matrices={[{ matrixId: "m", officialName: "M" }]} canWrite />);
    expect(await screen.findByText(/Não há turma institucional registrada/)).toBeInTheDocument();
    expect(screen.getByTestId("r5-e4-exception-note")).toHaveTextContent(E4_EXCEPTION_NOTE);
    expect(E4_EXCEPTION_NOTE).toMatch(/exceção explícita/);
    expect(E4_EXCEPTION_NOTE).toMatch(/nunca substitui automaticamente/);
  });
});

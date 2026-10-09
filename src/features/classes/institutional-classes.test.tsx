import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const rpc = vi.fn();
const tables: Record<string, Record<string, unknown>[]> = {};
function builder(table: string) {
  let rows = tables[table] ?? [];
  const b: Record<string, unknown> = {
    select: () => b,
    in: (c: string, v: string[]) => { rows = rows.filter((r) => v.includes(String(r[c]))); return b; },
    eq: (c: string, v: string) => { rows = rows.filter((r) => r[c] === v); return b; },
    order: () => b,
    maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    then: (res: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(res),
  };
  return b;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (t: string) => builder(t) },
}));
const session = { user: null as null | { id: string }, caps: [] as { capabilityId: string; schoolId: string | null }[] };
vi.mock("@/features/authority/session-authority", () => ({
  useSessionUser: () => ({ loading: false, user: session.user }),
  useSessionAuthority: () => (session.user ? { status: "signed-in", user: session.user, person: null, capabilities: session.caps } : { status: "signed-out" }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/components/sigem/operational", () => ({
  OperationalPageHeader: ({ title, actions }: { title: string; actions?: ReactNode }) => <div><h1>{title}</h1>{actions}</div>,
}));

import { canMaintainPeriodLink, canMaintainRegistry, projectSingle, registerClass, recordPeriodLink } from "./institutional-class-source";
import { InstitutionalClassDetailPage, InstitutionalClassesListPage, InstitutionalClassCreatePage } from "./institutional-classes-pages";
import { ClassRouteGate } from "./class-route-gate";

const rec = { id: "v1", class_id: "c1", version: 1, supersedes_id: null, code: "A", name: "1º ano A", administrative_status: "ativa", valid_from: "2026-02-01", valid_until: null, change_reason: null, originating_act_ref: "Port. 1", recorded_by: "u", recorded_by_person_id: "p", recorded_via_engagement_id: "e", created_at: "2026-01-10T00:00:00Z" };
const wrap = (n: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{n}</QueryClientProvider>);

const ranges: Array<[number, number]> = [];
/** Resposta encadeável (order/range/ilike/abortSignal) como o cliente real. */
function chain(v: { data: unknown; error: null; count?: number }) {
  const p = Promise.resolve(v) as Promise<unknown> & Record<string, unknown>;
  for (const k of ["order", "ilike", "abortSignal"]) p[k] = () => p;
  p["range"] = (a: number, b: number) => { ranges.push([a, b]); return p; };
  return p;
}
beforeEach(() => {
  rpc.mockReset(); ranges.length = 0;
  rpc.mockImplementation((fn: string) => chain({ data: fn === "class_at" ? [rec]
    : fn === "class_period_organization_at" ? []
    : fn === "classes_with_period_link_at" ? [{ class_id: "c1", school_id: "s1", academic_year_id: "y1", record: [rec], link: [] }]
    : "new-id", error: null, count: 1 }));
  Object.assign(tables, {
    institutional_classes: [{ id: "c1", school_id: "s1", academic_year_id: "y1" }],
    institutional_school_record_versions: [{ school_id: "s1", official_name: "EM Centro", version_number: 1 }],
    institutional_academic_year_versions: [{ academic_year_id: "y1", official_name: "2026", version: 1 }],
    institutional_class_record_versions: [rec],
    institutional_class_period_organization_versions: [],
    institutional_period_organizations: [],
    institutional_academic_years: [{ id: "y1" }],
  });
  session.user = { id: "u" };
  session.caps = [];
});

describe("B2.5.4 — fonte institucional", () => {
  it("projeção nunca escolhe versão localmente", () => {
    expect(projectSingle([])).toEqual({ kind: "none" });
    expect(projectSingle([1, 2]).kind).toBe("ambiguous");
  });
  it("capacidades são independentes e escopadas por escola", () => {
    const caps = [{ capabilityId: "manter-cadastro-de-turmas", schoolId: "s1" }] as never;
    expect(canMaintainRegistry(caps, "s1")).toBe(true);
    expect(canMaintainPeriodLink(caps, "s1")).toBe(false);
    expect(canMaintainRegistry(caps, "s2")).toBe(false);
  });
  it("criação e vínculo usam só os escritores institucionais", async () => {
    await registerClass({ schoolId: "s1", academicYearId: "y1", code: "", name: "T", validFrom: "2026-02-01", validUntil: null, actRef: "A" });
    expect(rpc).toHaveBeenCalledWith("register_institutional_class", expect.objectContaining({ _school_id: "s1", _administrative_status: "ativa" }));
    await recordPeriodLink({ classId: "c1", baseVersionId: null, operation: "register", organizationId: "o1", validFrom: "2026-02-01", validUntil: null, reason: "r", actRef: "a" });
    expect(rpc).toHaveBeenCalledWith("record_class_period_organization_version", expect.objectContaining({ _operation: "register", _base_version_id: null }));
  });
});

describe("B2.5.4 — telas", () => {
  it("lista pela projeção class_at e destaca organização não registrada", async () => {
    wrap(<InstitutionalClassesListPage />);
    expect(await screen.findByText("1º ano A")).toBeInTheDocument();
    expect(screen.getByText("EM Centro")).toBeInTheDocument();
    expect(screen.getByText("Ainda não registrada")).toBeInTheDocument();
    // BO.3: listagem em uma única leitura em lote; nunca uma chamada por turma.
    expect(rpc).toHaveBeenCalledWith("classes_with_period_link_at", expect.objectContaining({ _valid_on: expect.any(String) }), { count: "exact" });
    expect(rpc).not.toHaveBeenCalledWith("class_at", expect.anything());
    // PERF.LOADING.2: a lista pede uma página ao servidor, não as 698 turmas.
    expect(ranges).toContainEqual([0, 49]);
  });
  it("detalhe sem capacidade de vínculo não oferece associação; com cadastro oferece inativar", async () => {
    session.caps = [{ capabilityId: "manter-cadastro-de-turmas", schoolId: "s1" }];
    wrap(<InstitutionalClassDetailPage id="c1" />);
    expect(await screen.findByText(/Nenhuma organização de períodos registrada/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inativar turma" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar associação" })).not.toBeInTheDocument();
  });
  it("capacidade de vínculo sozinha não concede cadastro", async () => {
    session.caps = [{ capabilityId: "manter-organizacao-de-periodos-da-turma", schoolId: "s1" }];
    wrap(<InstitutionalClassDetailPage id="c1" />);
    expect(await screen.findByRole("button", { name: "Registrar associação" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inativar turma" })).not.toBeInTheDocument();
  });
  it("turma fora do escopo é indisponível, sem fallback demonstrativo", async () => {
    wrap(<InstitutionalClassDetailPage id="turma-demo-inexistente" />);
    expect(await screen.findByText("Turma indisponível")).toBeInTheDocument();
  });
  it("criação só oferece escolas do escopo", async () => {
    session.caps = [{ capabilityId: "manter-cadastro-de-turmas", schoolId: "s1" }];
    wrap(<InstitutionalClassCreatePage />);
    const select = await screen.findByLabelText(/Escola/);
    await waitFor(() => expect(select.querySelectorAll("option")).toHaveLength(1));
    await userEvent.type(screen.getByLabelText("Nome"), "x");
  });
  it("gate: com sessão nunca renderiza laboratório; sem sessão preserva", () => {
    const { unmount } = render(<ClassRouteGate institutional={() => <p>inst</p>} laboratory={() => <p>lab</p>} />);
    expect(screen.getByText("inst")).toBeInTheDocument();
    expect(screen.queryByText("lab")).not.toBeInTheDocument();
    unmount();
    session.user = null;
    render(<ClassRouteGate institutional={() => <p>inst</p>} laboratory={() => <p>lab</p>} />);
    expect(screen.getByText("lab")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const session = vi.hoisted(() => ({ value: { loading: true, user: null as null | { id: string } } }));
const authCaps = { value: [] as string[] };
vi.mock("@/features/authority/session-authority", () => ({
  useSessionUser: () => session.value,
  useSessionAuthority: () => ({ status: "signed-in", user: { id: "u" }, sessionRevision: 1, person: null,
    capabilities: authCaps.value.map((c) => ({ capabilityId: c, engagementId: "e", policyId: "p", policyVersion: 2, classId: null, periodId: null, schoolId: null, componentId: null })) }),
}));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children, params, to }: { children: ReactNode; to?: string; params?: { calendarioId: string } }) => <a href={params ? `/calendario-escolar/${params.calendarioId}` : to}>{children}</a> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
vi.mock("./calendar-access-panel", () => ({ CalendarAccessPanel: () => null }));
const lab = vi.hoisted(() => ({ list: vi.fn(), work: vi.fn(), print: vi.fn() }));
vi.mock("./calendar-pages", () => ({
  CalendarListPage: (p: unknown) => { lab.list(p); return <div>LAB-LISTA</div>; },
  CalendarWorkspacePage: (p: unknown) => { lab.work(p); return <div>LAB-WORKSPACE</div>; },
  CalendarPrintPage: (p: unknown) => { lab.print(p); return <div>LAB-PRINT</div>; },
}));

import { supabase } from "@/integrations/supabase/client";
import {
  instantMicros, InstitutionalCalendarShapeError, isIsoDate, isKnownAt, mapCalendarRows, readCalendarAt, readCalendarDayAt,
} from "./institutional-calendar-source";
import { CalendarDetailRoute, CalendarDocumentRoute, CalendarListRoute } from "./institutional-calendar-routes";

const K = "2026-10-03T20:00:00.000Z";
const S = { validOn: "2026-03-05", knownAt: K };
const row = (o: Record<string, unknown> = {}) => ({ result_kind: "access-denied", valid_on: S.validOn, known_at: K, ...o });

describe("source: mapCalendarRows fail-closed", () => {
  it("aceita a única linha access-denied com snapshot igual (instante equivalente)", () => {
    expect(mapCalendarRows([row()], S)).toEqual({ kind: "access-denied", ...S });
    expect(mapCalendarRows([row({ known_at: "2026-10-03 17:00:00-03" })], S).kind).toBe("access-denied");
  });
  it.each([
    ["null", null], ["vazio", []], ["duas linhas", [row(), row()]], ["linha nula", [null]],
    ["estado desconhecido", [row({ result_kind: "ausente" })]], ["estado ausente na lista fechada", [row({ result_kind: "letivo" })]], ["campo de conteúdo", [row({ day_state: "declarado" })]],
    ["campo faltante", [{ result_kind: "access-denied", valid_on: S.validOn }]],
    ["data divergente", [row({ valid_on: "2026-03-06" })]], ["knownAt divergente", [row({ known_at: "2026-10-03T20:00:01Z" })]],
    ["data inválida", [row({ valid_on: "2026-02-30" })]],
  ])("rejeita %s", (_n, rows) => {
    expect(() => mapCalendarRows(rows, S)).toThrow(InstitutionalCalendarShapeError);
  });
  it("valida ISO date e knownAt", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isKnownAt("2026-10-03T20:00:00")).toBe(false);
    expect(isKnownAt(K)).toBe(true);
  });
});

describe("source: instantes (B4.6.2a.1)", () => {
  it.each(["2026-02-30T12:00:00Z", "2026-02-29T12:00:00Z", "2026-13-01T00:00:00Z", "2026-10-03T24:00:01Z",
    "2026-10-03T24:00:00.000001Z", "2026-10-03T12:60:00Z", "2026-10-03T12:00:00+16:00", "2026-10-03T12:00:00.1234567Z"])(
    "rejeita %s", (v) => { expect(isKnownAt(v)).toBe(false); });
  it.each(["2028-02-29T12:00:00Z", "2026-10-03 12:00:00+00", "2026-10-03 12:00:00+0000", "2026-10-03T12:00:00+00:00",
    "2026-10-03T12:00:00.123456Z", "2026-10-03T24:00:00Z"])("aceita %s", (v) => { expect(isKnownAt(v)).toBe(true); });
  it("compara em microssegundos e aceita offsets equivalentes", () => {
    expect(instantMicros("2026-10-03T12:00:00.123456Z")).not.toBe(instantMicros("2026-10-03T12:00:00.123999Z"));
    expect(instantMicros("2026-10-03T12:00:00.000001Z")! - instantMicros("2026-10-03T12:00:00Z")!).toBe(1n);
    expect(instantMicros("2026-10-03 09:00:00.5-03")).toBe(instantMicros("2026-10-03T12:00:00.500000Z"));
    expect(instantMicros("2026-10-03T24:00:00Z")).toBe(instantMicros("2026-10-04T00:00:00Z"));
    const S2 = { validOn: S.validOn, knownAt: "2026-10-03T12:00:00.123Z" };
    expect(() => mapCalendarRows([row({ known_at: "2026-10-03T12:00:00.123001Z" })], S2)).toThrow(InstitutionalCalendarShapeError);
    expect(() => mapCalendarRows([row({ known_at: "2026-10-03T12:00:00.123999+00" })], S2)).toThrow(InstitutionalCalendarShapeError);
    expect(mapCalendarRows([row({ known_at: "2026-10-03 09:00:00.123000-03" })], S2).kind).toBe("access-denied");
  });
  it("knownAt impossível não chega à RPC", async () => {
    const rpc = vi.fn();
    await expect(readCalendarAt({ calendarId: null, validOn: S.validOn, knownAt: "2026-02-30T12:00:00Z" }, rpc)).rejects.toThrow(InstitutionalCalendarShapeError);
    await expect(readCalendarDayAt({ calendarId: "c", date: S.validOn, knownAt: "2026-02-29T00:00:00Z" }, rpc)).rejects.toThrow(InstitutionalCalendarShapeError);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("source: RPC caller", () => {
  it("envia IDs, data e knownAt; listagem usa _calendar_id null", async () => {
    const rpc = vi.fn(async (_f: string, a: Record<string, unknown>) => ({ data: [row({ valid_on: a["_on"] ?? a["_date"] })], error: null }));
    await readCalendarAt({ calendarId: null, ...S }, rpc);
    expect(rpc).toHaveBeenLastCalledWith("calendar_at", { _calendar_id: null, _on: S.validOn, _known_at: K });
    await readCalendarAt({ calendarId: "cal-x", ...S }, rpc);
    expect(rpc).toHaveBeenLastCalledWith("calendar_at", { _calendar_id: "cal-x", _on: S.validOn, _known_at: K });
    await readCalendarDayAt({ calendarId: "cal-x", date: S.validOn, knownAt: K }, rpc);
    expect(rpc).toHaveBeenLastCalledWith("calendar_day_at", { _calendar_id: "cal-x", _date: S.validOn, _known_at: K });
  });
  it("parâmetros inválidos não chamam RPC; erro do banco é propagado", async () => {
    const rpc = vi.fn();
    await expect(readCalendarAt({ calendarId: null, validOn: "05/03/2026", knownAt: K }, rpc)).rejects.toThrow(InstitutionalCalendarShapeError);
    await expect(readCalendarAt({ calendarId: null, validOn: S.validOn, knownAt: "ontem" }, rpc)).rejects.toThrow(InstitutionalCalendarShapeError);
    await expect(readCalendarAt({ calendarId: " ", ...S }, rpc)).rejects.toThrow(InstitutionalCalendarShapeError);
    expect(rpc).not.toHaveBeenCalled();
    const boom = new Error("db");
    await expect(readCalendarAt({ calendarId: null, ...S }, async () => ({ data: null, error: boom }))).rejects.toBe(boom);
  });
});

type Args = Record<string, unknown>;
const lst = (a: Args, versions: unknown[] = []) => ({ contract: "b4.6.6/1", state: "lido", audience: "homologados", knownAt: a["_known_at"], versions });
const ver = (o: Record<string, unknown> = {}) => ({ calendarId: "cal-1", versionId: "v-1", version: 1, changeKind: "constituicao", academicYearId: "ano-1",
  periodOrganizationId: "org-1", validFrom: "2026-01-01", validTo: "2026-12-31", actId: "ato-1", recordedAt: "2026-01-01T00:00:00Z",
  lastHomologation: { recordId: "h-1", sequence: 1, decision: "homologada", effectiveFrom: "2026-01-01", recordedAt: "2026-01-01T00:00:00Z" }, ...o });
const decl = (eff: boolean | null, label = "Tipo") => ({ day_state: "declarado", version_id: "v-1", reference_issue: null, homologation_state: "homologada",
  declaration_kind: "faixa", declaration_id: "d-" + label, starts_on: "2026-03-01", ends_on: "2026-03-31", event_label: null, day_type_id: "t", day_type_version_id: "tv",
  day_type_version: 1, day_type_label: label, school_day_effect: eff });
const daysOf = (a: Args, eff: (d: string) => unknown[]) => {
  const out: unknown[] = []; let d = a["_from"] as string;
  while (d <= (a["_to"] as string)) { out.push({ on: d, state: "homologada", rows: eff(d) }); const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); d = x.toISOString().slice(0, 10); }
  return { contract: "b4.6.6/1", state: "lido", audience: "homologados", snapshot: { from: a["_from"], to: a["_to"], knownAt: a["_known_at"] }, calendarId: a["_calendar_id"], days: out };
};
const tables: Record<string, unknown[]> = {
  institutional_academic_year_versions: [{ academic_year_id: "ano-1", version: 1, official_name: "2026", created_at: "2026-01-01T00:00:00Z" }],
  institutional_academic_periods: [{ id: "per-1", period_organization_id: "org-1" }],
  institutional_academic_period_versions: [{ period_id: "per-1", version: 1, official_name: "1º bimestre", starts_on: "2026-03-01", ends_on: "2026-03-10", is_active: true, valid_from: "2026-01-01", created_at: "2026-01-01T00:00:00Z" }],
};
function mockDb(o: { kind?: string; versions?: unknown[]; eff?: (d: string) => unknown[] } = {}) {
  vi.mocked(supabase.from).mockImplementation(((t: string) => {
    const r = Promise.resolve({ data: tables[t] ?? [], error: null });
    const q: Record<string, unknown> = { select: () => q, lte: () => q, order: () => q, eq: () => q, then: r.then.bind(r) };
    return q;
  }) as never);
  vi.mocked(supabase.rpc).mockImplementation((async (f: string, a: Args) => {
    if (f === "calendar_at") return { data: [{ result_kind: o.kind ?? "homologada", valid_on: a["_on"], known_at: a["_known_at"] }], error: null };
    if (f === "calendar_list_at") return { data: lst(a, o.versions ?? [ver()]), error: null };
    if (f === "calendar_day_types_at") return { data: { contract: "b4.6.6/1", state: "lido", knownAt: a["_known_at"], versions: [] }, error: null };
    if (f === "homologated_attribute_values") return { data: [], error: null };
    if (f === "calendar_composition_norm_at") return { data: { contract: "b4.6.6/1", state: "lido", audience: "norma", snapshot: { on: a["_on"], knownAt: a["_known_at"] }, finalState: null, versions: [] }, error: null };
    if (f === "calendar_days_at") return { data: daysOf(a, o.eff ?? ((d) => [decl(d.endsWith("-07") ? false : true, d.endsWith("-07") ? "Feriado" : "Letivo")])), error: null };
    return { data: null, error: new Error("rpc inesperada " + f) };
  }) as never);
}
const routes = (id = "cal-1"): [string, ReactNode, keyof typeof lab][] => [
  ["lista", <CalendarListRoute perfil="supervisao" />, "list"],
  ["detalhe", <CalendarDetailRoute calendarId={id} perfil="supervisao" />, "work"],
  ["documento", <CalendarDocumentRoute calendarId={id} perfil="supervisao" />, "print"],
];
const wrap = (ui: ReactNode, c = new QueryClient()) => <QueryClientProvider client={c}>{ui}</QueryClientProvider>;
const signed = (id = "u-a", revision = 1) => { session.value = { loading: false, user: { id }, revision } as never; };

describe("fronteira das três rotas (B4.6.7: consulta positiva)", () => {
  let getItem: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { vi.clearAllMocks(); getItem = vi.spyOn(Storage.prototype, "getItem"); });
  afterEach(() => { cleanup(); getItem.mockRestore(); });

  it.each(routes())("%s: sessão incerta não monta laboratório nem consulta", (_m, ui) => {
    session.value = { loading: true, user: null };
    render(wrap(ui));
    expect(screen.getByRole("status").textContent).toMatch(/Verificando sessão/);
    expect(lab.list).not.toHaveBeenCalled(); expect(lab.work).not.toHaveBeenCalled(); expect(lab.print).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled(); expect(getItem).not.toHaveBeenCalled();
  });

  it.each(routes())("%s: sem sessão preserva o laboratório com o perfil da URL", (_m, ui, k) => {
    session.value = { loading: false, user: null };
    render(wrap(ui));
    expect(lab[k]).toHaveBeenCalledWith(expect.objectContaining({ profile: "supervisao" }));
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("lista: calendário homologado com rótulo humano; IDs só na auditoria; sem demo/armazenamento/botões", async () => {
    signed(); mockDb();
    render(wrap(<CalendarListRoute perfil="supervisao" />));
    expect(await screen.findByRole("link", { name: /ano letivo 2026 — versão 1/ })).toBeTruthy();
    expect(screen.getByText(/homologada a partir de 2026-01-01/)).toBeTruthy();
    expect(lab.list).not.toHaveBeenCalled(); expect(getItem).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).toBeNull();
    const audit = document.querySelector("details")!;
    expect(audit.textContent).toMatch(/cal-1/);
    expect(document.body.textContent!.replace(audit.textContent!, "")).not.toMatch(/cal-1|v-1|ano-1/);
  });

  it("B4.6.7b: com capacidade exata de construção, gestão aparece; pré-requisitos ausentes orientam a Administração; navegador só é lido ao clicar", async () => {
    signed(); mockDb(); authCaps.value = ["construir-calendario-da-rede"];
    window.location.hash = "#publicar";
    try {
      render(wrap(<CalendarListRoute />));
      expect(await screen.findByRole("heading", { name: "Gestão do calendário da rede" })).toBeTruthy();
      expect((await screen.findAllByText(/Sem unidades escolares cadastradas/)).length).toBeGreaterThan(0);
      expect(screen.queryByRole("heading", { name: /Norma de composição/ })).toBeNull();
      expect(getItem).not.toHaveBeenCalled();
      (await screen.findByRole("button", { name: "Ler calendários deste navegador" })).click();
      expect(await screen.findByText(/REFERÊNCIA 2027 do sistema/)).toBeTruthy();
    } finally { authCaps.value = []; window.location.hash = ""; }
  });

  it("lista vazia é declarada como ausência de homologados, nunca zero inventado", async () => {
    signed(); mockDb({ versions: [] });
    render(wrap(<CalendarListRoute />));
    expect(await screen.findByRole("note")).toHaveTextContent("Nenhum calendário homologado até agora.");
  });

  it("detalhe: grade com feriado não letivo e totais positivos por período", async () => {
    signed(); mockDb();
    render(wrap(<CalendarDetailRoute calendarId="cal-1" />));
    expect(await screen.findByText("Homologado na data consultada.")).toBeTruthy();
    expect(await screen.findByText(/1º bimestre \(2026-03-01 a 2026-03-10\): 9 dias letivos, 1 não letivos/)).toBeTruthy();
    expect(screen.getAllByText("Não letivo").length).toBeGreaterThan(0);
  });

  it("detalhe: NULL declarado junto de true ⇒ total não calculável, nunca contado como letivo", async () => {
    signed(); mockDb({ eff: (d) => (d === "2026-03-04" ? [decl(true, "A"), decl(null, "B")] : [decl(true)]) });
    render(wrap(<CalendarDetailRoute calendarId="cal-1" />));
    expect(await screen.findByText(/não calculável — 2026-03-04:efeito-nao-declarado/)).toBeTruthy();
  });

  it("detalhe: access-denied mostra negação sem grade nem totais", async () => {
    signed(); mockDb({ kind: "access-denied" });
    render(wrap(<CalendarDetailRoute calendarId="cal-x" />));
    expect(await screen.findByRole("note")).toHaveTextContent(/Nenhum calendário homologado disponível/);
    expect(screen.queryByRole("table")).toBeNull();
    expect(vi.mocked(supabase.rpc).mock.calls.map((c) => c[0])).toEqual(["calendar_at"]);
  });

  it("chave desconhecida na lista é erro visível (nada exibido)", async () => {
    signed(); mockDb({ versions: [{ ...ver(), autorizado: true }] });
    render(wrap(<CalendarListRoute />));
    expect(await screen.findByRole("alert")).toHaveTextContent(/formato inesperado/);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("homologados não podem receber versão em construção (vazamento recusado)", async () => {
    signed(); mockDb({ versions: [ver({ lastHomologation: null })] });
    render(wrap(<CalendarListRoute />));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("erro do banco é visível", async () => {
    signed();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: new Error("x") } as never);
    render(wrap(<CalendarListRoute />));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("nova revisão de sessão (mesma conta) usa nova chave de cache e não mostra o anterior durante a carga", async () => {
    const client = new QueryClient();
    signed("u-a", 1); mockDb();
    const { rerender } = render(wrap(<CalendarListRoute />, client));
    await screen.findByRole("link");
    let release!: () => void;
    const prev = vi.mocked(supabase.rpc).getMockImplementation()!;
    vi.mocked(supabase.rpc).mockImplementation((async (f: string, a: Args) => { await new Promise<void>((r) => { release = r; }); return prev(f as never, a as never); }) as never);
    signed("u-a", 2);
    rerender(wrap(<CalendarListRoute />, client));
    expect(screen.queryByRole("link")).toBeNull();
    const keys = client.getQueryCache().getAll().map((q) => q.queryKey[1]);
    expect(new Set(keys)).toEqual(new Set(["u-a#1", "u-a#2"]));
    release();
    await screen.findByRole("link");
  });
});

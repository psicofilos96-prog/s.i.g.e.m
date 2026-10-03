import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const session = vi.hoisted(() => ({ value: { loading: true, user: null as null | { id: string } } }));
vi.mock("@/features/authority/session-authority", () => ({ useSessionUser: () => session.value }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
const lab = vi.hoisted(() => ({ list: vi.fn(), work: vi.fn(), print: vi.fn() }));
vi.mock("./calendar-pages", () => ({
  CalendarListPage: (p: unknown) => { lab.list(p); return <div>LAB-LISTA</div>; },
  CalendarWorkspacePage: (p: unknown) => { lab.work(p); return <div>LAB-WORKSPACE</div>; },
  CalendarPrintPage: (p: unknown) => { lab.print(p); return <div>LAB-PRINT</div>; },
}));

import { supabase } from "@/integrations/supabase/client";
import {
  instantMicros, CALENDAR_ACCESS_DENIED_TEXT, InstitutionalCalendarShapeError, isIsoDate, isKnownAt, mapCalendarRows, readCalendarAt, readCalendarDayAt,
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
    ["estado desconhecido", [row({ result_kind: "ausente" })]], ["campo de conteúdo", [row({ day_state: "declarado" })]],
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

const ok = () => vi.mocked(supabase.rpc).mockImplementation((async (_f: string, a: { _on: string; _known_at: string }) =>
  ({ data: [{ result_kind: "access-denied", valid_on: a._on, known_at: a._known_at }], error: null })) as never);
const routes = (id = "cal-1"): [string, ReactNode, keyof typeof lab][] => [
  ["lista", <CalendarListRoute perfil="supervisao" />, "list"],
  ["detalhe", <CalendarDetailRoute calendarId={id} perfil="supervisao" />, "work"],
  ["documento", <CalendarDocumentRoute calendarId={id} perfil="supervisao" />, "print"],
];
const wrap = (ui: ReactNode, c = new QueryClient()) => <QueryClientProvider client={c}>{ui}</QueryClientProvider>;

describe("fronteira das três rotas", () => {
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

  it.each(routes())("%s: com sessão (+?perfil) só consulta institucional; nenhum demo/armazenamento/impressão", async (m, ui) => {
    session.value = { loading: false, user: { id: "u-a" } };
    ok();
    render(wrap(ui));
    expect(await screen.findByRole("note")).toHaveTextContent(CALENDAR_ACCESS_DENIED_TEXT);
    expect(lab.list).not.toHaveBeenCalled(); expect(lab.work).not.toHaveBeenCalled(); expect(lab.print).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    const args = vi.mocked(supabase.rpc).mock.calls[0]!;
    expect(args[0]).toBe("calendar_at");
    expect((args[1] as { _calendar_id: unknown })._calendar_id).toBe(m === "lista" ? null : "cal-1");
    expect(document.body.textContent).not.toMatch(/não existe|não homologado|Imprimir|Editar|Criar|Homologar/i);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("erro do banco é visível e não mostra mensagem de negação", async () => {
    session.value = { loading: false, user: { id: "u-a" } };
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: new Error("x") } as never);
    render(wrap(<CalendarListRoute />));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("resposta vazia é erro visível, não negação silenciosa", async () => {
    session.value = { loading: false, user: { id: "u-a" } };
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);
    render(wrap(<CalendarDetailRoute calendarId="cal-1" />));
    expect(await screen.findByRole("alert")).toHaveTextContent(/formato inesperado/);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("troca de conta no MESMO QueryClient não reaproveita cache de A em B", async () => {
    const client = new QueryClient();
    ok();
    session.value = { loading: false, user: { id: "u-a" } };
    const { rerender } = render(wrap(<CalendarListRoute />, client));
    await screen.findByRole("note");
    let release!: () => void;
    vi.mocked(supabase.rpc).mockImplementation((async (_f: string, a: { _on: string; _known_at: string }) => {
      await new Promise<void>((r) => { release = r; });
      return { data: [{ result_kind: "access-denied", valid_on: a._on, known_at: a._known_at }], error: null };
    }) as never);
    session.value = { loading: false, user: { id: "u-b" } };
    rerender(wrap(<CalendarListRoute />, client));
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/Consultando/);
    const keys = client.getQueryCache().getAll().map((q) => q.queryKey[1]);
    expect(new Set(keys)).toEqual(new Set(["u-a", "u-b"]));
    release();
    await screen.findByRole("note");
  });

  it("mudança de data/ID invalida dados e não mostra o anterior durante carga ou erro", async () => {
    const client = new QueryClient();
    session.value = { loading: false, user: { id: "u-a" } };
    ok();
    const { rerender } = render(wrap(<CalendarDetailRoute calendarId="cal-1" />, client));
    await screen.findByRole("note");
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: new Error("x") } as never);
    fireEvent.change(screen.getByLabelText("Data de referência"), { target: { value: "2026-04-01" } });
    expect(screen.queryByRole("note")).toBeNull();
    expect(await screen.findByRole("alert")).toBeTruthy();
    ok();
    rerender(wrap(<CalendarDetailRoute calendarId="cal-2" />, client));
    await waitFor(() => expect(vi.mocked(supabase.rpc).mock.calls.at(-1)?.[1]).toMatchObject({ _calendar_id: "cal-2" }));
    await screen.findByRole("note");
  });
});

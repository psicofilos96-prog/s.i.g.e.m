/**
 * B4.10.0a — espelhos globais de fechamento de período, situação acadêmica e Conselho.
 * Hooks REAIS + stores REAIS; banco simulado por respostas adiadas (fixtures, nenhuma escrita real).
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

type Res = { data: unknown; error: { message: string } | null };
type Call = { name: string; filters: Record<string, unknown>; args?: unknown; resolve: (r: Res) => void; done: boolean };
const db = vi.hoisted(() => ({ calls: [] as Call[] }));
vi.mock("@/integrations/supabase/client", () => {
  const pending = (name: string, filters: Record<string, unknown>, args?: unknown) =>
    new Promise<Res>((resolve) => {
      const call: Call = { name, filters, args, done: false, resolve: (r) => { call.done = true; resolve(r); } };
      db.calls.push(call);
    });
  return {
    supabase: {
      from(table: string) {
        const filters: Record<string, unknown> = {};
        const p = pending(table, filters);
        const q: Record<string, unknown> = {
          select: () => q,
          eq: (k: string, v: unknown) => { filters[k] = v; return q; },
          then: (ok: (r: Res) => unknown, ko?: (e: unknown) => unknown) => p.then(ok, ko),
        };
        return q;
      },
      rpc: (name: string, args?: unknown) => pending(name, {}, args),
    },
  };
});

import { periodClosingStore } from "./period-closing-store";
import { recordClosingActInCloud, useCloudClosingSync } from "./period-closing-cloud";
import { createAcademicStandingStore } from "./academic-standing-store";
import { useCloudStanding } from "./academic-standing-cloud";
import { createCollegialStore } from "@/features/collegial/collegial-store";
import { useCloudCollegial } from "@/features/collegial/collegial-cloud";
import type { ClosingScope } from "./period-closing-types";

const open = (name: string, filter?: (f: Record<string, unknown>) => boolean) =>
  db.calls.filter((c) => !c.done && c.name === name && (!filter || filter(c.filters)));
const answer = async (call: Call | undefined, r: Res) => {
  if (!call) throw new Error("pedido inexistente");
  await act(async () => { call.resolve(r); await new Promise((res) => setTimeout(res, 0)); });
};
const ok = (data: unknown): Res => ({ data, error: null });

const version = (id: string) => ({ id, preceding_closing_id: null, version_number: 1, record: { id, scopeKey: `k-${id}`, results: [], scope: { classId: "t", academicYearId: "a", periodId: `p-${id}`, curriculumRef: { kind: "componente", componentId: "c" } } } });
const event = (id: string) => ({ id, scope_key: `k-${id}`, sequence: 1, action: "abertura", scope: {}, detail: id, justification: null, closing_version_id: null, author_person_id: "p", acted_at: "2026-05-01T00:00:00Z" });
const cap = (id: string) => ({ capability_id: id, class_id: null, period_id: null });
const closingIds = () => periodClosingStore.allRecords().map((r) => r.id);

/** Responde a leitura (eventos+versões+capacidades) mais antiga ainda aberta. */
const answerClosing = async (i: number, tag: string) => {
  const ev = open("period_closing_events")[i]; const vs = open("period_closing_versions")[i]; const caps = open("effective_capabilities")[i];
  await answer(ev, ok([event(`ev-${tag}`)]));
  await answer(vs, ok([version(`fech-${tag}`)]));
  await answer(caps, ok([cap(`cap-${tag}`)]));
};

beforeEach(() => { db.calls.length = 0; periodClosingStore.hydrate({ workflows: {}, records: [] }); });

describe("fechamento de período — useCloudClosingSync", () => {
  it("sem identidade ou desabilitado: nenhuma consulta, nunca pronto", () => {
    const a = renderHook(() => useCloudClosingSync(true, { userId: null }));
    const b = renderHook(() => useCloudClosingSync(false, { userId: "A" }));
    expect(db.calls).toEqual([]);
    expect(a.result.current.ready).toBe(false);
    expect(b.result.current.cloud).toBe(false);
  });

  it("A→B: capacidades de A somem já; B aceito e A atrasado NÃO sobrescreve o store global", async () => {
    const { result, rerender } = renderHook(({ u }) => useCloudClosingSync(true, { userId: u }), { initialProps: { u: "A" } });
    rerender({ u: "B" });
    expect(result.current.ready).toBe(false);
    expect(result.current.capabilitiesFor("t", "p")).toEqual([]);
    await answerClosing(1, "B"); // B (pedido mais novo) responde primeiro
    expect(closingIds()).toEqual(["fech-B"]);
    expect(result.current.ready).toBe(true);
    expect(result.current.capabilitiesFor("t", "p")).toEqual(["cap-B"]);
    await answerClosing(0, "A"); // A tardio
    expect(closingIds()).toEqual(["fech-B"]);
    expect(result.current.capabilitiesFor("t", "p")).toEqual(["cap-B"]);
  });

  it("unmount antes da resposta: store intacto", async () => {
    periodClosingStore.hydrate({ workflows: {}, records: [version("pre").record as never] });
    const { unmount } = renderHook(() => useCloudClosingSync(true, { userId: "A" }));
    unmount();
    await answerClosing(0, "A");
    expect(closingIds()).toEqual(["pre"]);
  });

  it("erro de leitura: nada hidratado, erro visível, sem capacidades", async () => {
    periodClosingStore.hydrate({ workflows: {}, records: [version("pre").record as never] });
    const { result } = renderHook(() => useCloudClosingSync(true, { userId: "A" }));
    await answer(open("period_closing_events")[0], { data: null, error: { message: "negado" } });
    await answer(open("period_closing_versions")[0], ok([version("parcial")]));
    await answer(open("effective_capabilities")[0], ok([cap("x")]));
    expect(closingIds()).toEqual(["pre"]);
    expect(result.current).toMatchObject({ ready: true, error: "negado" });
    expect(result.current.capabilitiesFor("t", "p")).toEqual([]);
  });

  it("duas leituras no mesmo contexto: a mais antiga, chegando depois, não substitui a nova", async () => {
    const { result } = renderHook(() => useCloudClosingSync(true, { userId: "A" }));
    await act(async () => { void result.current.refresh(); });
    await answerClosing(1, "nova");
    await answerClosing(0, "velha");
    expect(closingIds()).toEqual(["fech-nova"]);
    expect(result.current.capabilitiesFor("t", "p")).toEqual(["cap-nova"]);
  });

  it("operação com contexto de A após troca para B: nenhum RPC; RPC aceito em A não rehidrata B", async () => {
    const scope = { classId: "t", academicYearId: "a", periodId: "p", curriculumRef: { kind: "componente", componentId: "c" } } as unknown as ClosingScope;
    const { result, rerender } = renderHook(({ u }) => useCloudClosingSync(true, { userId: u }), { initialProps: { u: "A" } });
    await answerClosing(0, "A");
    const ctxA = result.current.context;
    // Operação iniciada em A; troca para B enquanto o RPC está pendente.
    let saved: Promise<unknown> | undefined;
    await act(async () => { saved = recordClosingActInCloud({ scope, action: "abertura" as never, event: { detail: "d" } as never, context: ctxA }); });
    expect(open("record_period_closing_act").length).toBe(1);
    rerender({ u: "B" });
    await answerClosing(0, "B");
    expect(closingIds()).toEqual(["fech-B"]);
    await answer(open("record_period_closing_act")[0], ok(null));
    await act(async () => { await saved; });
    expect(open("period_closing_events").length).toBe(0); // nenhuma rehidratação a partir de A
    expect(closingIds()).toEqual(["fech-B"]);
    // Chamar de novo com o contexto velho: recusa sem RPC.
    const again = await recordClosingActInCloud({ scope, action: "abertura" as never, event: { detail: "d" } as never, context: ctxA });
    expect(again.ok).toBe(false);
    expect(db.calls.filter((c) => c.name === "record_period_closing_act").length).toBe(1);
  });
});

const standingRow = (id: string, classId: string) => ({ id, logical_standing_id: `l-${id}`, version_number: 1, supersedes_version_id: null, record: { studentId: id, classId } });

describe("situação acadêmica — useCloudStanding", () => {
  it("turma1→turma2: tardio da turma1 não sobrescreve; estado anterior não é pronto no novo contexto", async () => {
    const store = createAcademicStandingStore();
    const { result, rerender } = renderHook(({ c }) => useCloudStanding(store, c, true, { userId: "A" }), { initialProps: { c: "t1" } });
    rerender({ c: "t2" });
    expect(result.current.ready).toBe(false);
    await answer(open("academic_standing_versions", (f) => f["class_id"] === "t2")[0], ok([standingRow("s-t2", "t2")]));
    await answer(open("academic_standing_versions", (f) => f["class_id"] === "t1")[0], ok([standingRow("s-t1", "t1")]));
    expect(store.records().map((r) => r.id)).toEqual(["s-t2"]);
    expect(result.current.ready).toBe(true);
  });

  it("A→B com B aceito e A atrasado; erro não hidrata; unmount não hidrata", async () => {
    const store = createAcademicStandingStore();
    const { result, rerender, unmount } = renderHook(({ u }) => useCloudStanding(store, "t", true, { userId: u }), { initialProps: { u: "A" } });
    rerender({ u: "B" });
    const [a, b] = open("academic_standing_versions");
    await answer(b, ok([standingRow("s-B", "t")]));
    await answer(a, ok([standingRow("s-A", "t")]));
    expect(store.records().map((r) => r.id)).toEqual(["s-B"]);
    await act(async () => { void result.current.refresh(); });
    await answer(open("academic_standing_versions")[0], { data: null, error: { message: "negado" } });
    expect(store.records().map((r) => r.id)).toEqual(["s-B"]);
    expect(result.current).toMatchObject({ ready: true, error: "negado" });
    await act(async () => { void result.current.refresh(); });
    unmount();
    await answer(open("academic_standing_versions")[0], ok([]));
    expect(store.records().map((r) => r.id)).toEqual(["s-B"]);
  });

  it("registro com espelho de outro contexto: nenhum RPC", async () => {
    const store = createAcademicStandingStore();
    const { result, rerender } = renderHook(({ u }) => useCloudStanding(store, "t", true, { userId: u }), { initialProps: { u: "A" } });
    await answer(open("academic_standing_versions")[0], ok([standingRow("s-A", "t")]));
    const registerA = result.current.register;
    rerender({ u: "B" });
    const r = await registerA({ actor: {} as never, cycleId: "c", conferred: [], rebuild: () => undefined });
    expect(r.ok).toBe(false);
    expect(db.calls.some((c) => c.name === "register_academic_standings")).toBe(false);
  });
});

const sessionEvent = (id: string) => ({ id: `ev-${id}`, session_id: id, sequence: 1, document: { id, state: "aberta", participants: [], agenda: [] } });
const answerCollegial = async (i: number, sid: string, classId?: string) => {
  const f = classId ? (x: Record<string, unknown>) => x["class_id"] === classId : undefined;
  await answer(open("collegial_body_configurations")[i], ok([]));
  await answer(open("collegial_session_events", f)[classId ? 0 : i], ok([sessionEvent(sid)]));
  await answer(open("collegial_deliberations", f)[classId ? 0 : i], ok([]));
  await answer(open("collegial_minute_versions", f)[classId ? 0 : i], ok([]));
};

describe("Conselho — useCloudCollegial", () => {
  it("A→B: B aceito, A tardio ignorado; meta de A não serve a B (commit sem RPC até ler B)", async () => {
    const store = createCollegialStore();
    const { result, rerender } = renderHook(({ u }) => useCloudCollegial(store, "t", true, { userId: u }), { initialProps: { u: "A" } });
    rerender({ u: "B" });
    expect(result.current.ready).toBe(false);
    const blocked = await result.current.commit(() => ({ ok: true, value: null }));
    expect(blocked.ok).toBe(false);
    await answerCollegial(1, "ses-B");
    await answerCollegial(0, "ses-A");
    expect(store.snapshot().sessions.map((s) => s.id)).toEqual(["ses-B"]);
    expect(result.current.ready).toBe(true);
    expect(db.calls.some((c) => c.name.startsWith("record_collegial") || c.name === "close_collegial_minute")).toBe(false);
  });

  it("turma1→turma2 e erro parcial: nada hidratado, erro visível", async () => {
    const store = createCollegialStore();
    const { result, rerender } = renderHook(({ c }) => useCloudCollegial(store, c, true, { userId: "A" }), { initialProps: { c: "t1" } });
    rerender({ c: "t2" });
    await answerCollegial(1, "ses-t2", "t2");
    await answerCollegial(0, "ses-t1", "t1");
    expect(store.snapshot().sessions.map((s) => s.id)).toEqual(["ses-t2"]);
    await act(async () => { void result.current.refresh(); });
    await answer(open("collegial_body_configurations")[0], ok([]));
    await answer(open("collegial_session_events")[0], { data: null, error: { message: "negado" } });
    await answer(open("collegial_deliberations")[0], ok([]));
    await answer(open("collegial_minute_versions")[0], ok([]));
    expect(store.snapshot().sessions.map((s) => s.id)).toEqual(["ses-t2"]);
    expect(result.current).toMatchObject({ ready: true, error: "negado" });
  });
});

describe("UI pendente não lê o espelho de outro contexto", () => {
  it("ClosingWorkspace com sessão: antes da leitura deste contexto só 'Carregando', sem tocar store", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { ClosingWorkspace } = await import("./period-closing-pages");
    const spy = vi.spyOn(periodClosingStore, "stage");
    render(<ClosingWorkspace {...({ ctx: {}, actor: {}, store: periodClosingStore, archive: {}, policies: [], heading: "h", classId: "t", classSearch: {}, userId: "B" } as unknown as Parameters<typeof ClosingWorkspace>[0])} />);
    expect(screen.getByText("Carregando")).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

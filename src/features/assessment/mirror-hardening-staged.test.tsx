/**
 * B4.10.0a.1 — leitura staged do fechamento (capacidades fazem parte da revisão aceita) e base/meta
 * pertencente à revisão ACEITA do store (duas montagens, mesmo store/contexto, respostas invertidas).
 * Hooks REAIS + stores REAIS; banco simulado por respostas adiadas.
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Res = { data: unknown; error: { message: string } | null };
type Call = { name: string; filters: Record<string, unknown>; args?: unknown; resolve: (r: Res) => void; reject: (e: unknown) => void; done: boolean };
const db = vi.hoisted(() => ({ calls: [] as Call[] }));
vi.mock("@/integrations/supabase/client", () => {
  const pending = (name: string, filters: Record<string, unknown>, args?: unknown) =>
    new Promise<Res>((resolve, reject) => {
      const call: Call = {
        name, filters, args, done: false,
        resolve: (r) => { call.done = true; resolve(r); },
        reject: (e) => { call.done = true; reject(e); },
      };
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
import { closingMirrorOwner, recordClosingActInCloud, useCloudClosingSync } from "./period-closing-cloud";
import { createAcademicStandingStore } from "./academic-standing-store";
import { useCloudStanding } from "./academic-standing-cloud";
import { createCollegialStore } from "@/features/collegial/collegial-store";
import { useCloudCollegial } from "@/features/collegial/collegial-cloud";
import type { ClosingScope } from "./period-closing-types";
import { closingScopeKey } from "./period-closing";

const open = (name: string) => db.calls.filter((c) => !c.done && c.name === name);
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const answer = async (call: Call | undefined, r: Res) => {
  if (!call) throw new Error("pedido inexistente");
  await act(async () => { call.resolve(r); await new Promise((res) => setTimeout(res, 0)); });
};
const fail = async (call: Call | undefined, e: unknown) => {
  if (!call) throw new Error("pedido inexistente");
  await act(async () => { call.reject(e); await new Promise((res) => setTimeout(res, 0)); });
};
const ok = (data: unknown): Res => ({ data, error: null });

const scope = (p: string) => ({ classId: "t", academicYearId: "a", periodId: p, curriculumRef: { kind: "componente", componentId: "c" } });
const version = (id: string) => ({ id, preceding_closing_id: null, version_number: 1, record: { id, scopeKey: `k-${id}`, results: [], scope: scope(`p-${id}`) } });
const event = (id: string, scopeKey: string) => ({ id, scope_key: scopeKey, sequence: 1, action: "abertura", scope: scope("p"), detail: id, justification: null, closing_version_id: null, author_person_id: "p", acted_at: "2026-05-01T00:00:00Z" });
const cap = (id: string) => ({ capability_id: id, class_id: null, period_id: null });
const closingIds = () => periodClosingStore.allRecords().map((r) => r.id);
const closingScope = scope("p") as unknown as ClosingScope;
const KX = closingScopeKey(closingScope);

/** Estabelece um espelho preexistente NÃO vazio de A (fech-pre, ev-pre, cap-pre). */
async function seedClosing() {
  const h = renderHook(() => useCloudClosingSync(true, { userId: "A" }));
  await answer(open("period_closing_events")[0], ok([event("ev-pre", KX)]));
  await answer(open("period_closing_versions")[0], ok([version("fech-pre")]));
  await answer(open("effective_capabilities")[0], ok([cap("cap-pre")]));
  expect(closingIds()).toEqual(["fech-pre"]);
  expect(h.result.current.capabilitiesFor("t", "p")).toEqual(["cap-pre"]);
  return h;
}
/** Base esperada efetivamente enviada no próximo ato de fechamento do escopo `k-x`. */
async function expectedBaseSent(ctx: ReturnType<typeof useCloudClosingSync>["context"]) {
  const before = db.calls.length;
  const s = { ...closingScope };
  void recordClosingActInCloud({ scope: s, action: "abertura" as never, event: { detail: "d" } as never, context: ctx });
  await flush();
  const call = db.calls.slice(before).find((c) => c.name === "record_period_closing_act");
  return call ? (call.args as Record<string, unknown>)["_expected_last_event_id"] : "sem-rpc";
}

beforeEach(() => { db.calls.length = 0; periodClosingStore.hydrate({ workflows: {}, records: [] }); });

describe("fechamento — leitura staged (capacidades fazem parte da revisão)", () => {
  it("eventos/versões completos ANTES, capacidades com error DEPOIS: store, base e dono não mudam", async () => {
    const h = await seedClosing();
    const ownerBefore = closingMirrorOwner();
    await act(async () => { void h.result.current.refresh(); });
    await answer(open("period_closing_events")[0], ok([event("ev-novo", KX)]));
    await answer(open("period_closing_versions")[0], ok([version("fech-novo")]));
    expect(closingIds()).toEqual(["fech-pre"]); // nada aplicado antes das capacidades
    await answer(open("effective_capabilities")[0], { data: null, error: { message: "caps negadas" } });
    expect(closingIds()).toEqual(["fech-pre"]);
    expect(closingMirrorOwner()).toBe(ownerBefore);
    expect(h.result.current).toMatchObject({ ready: true, error: "caps negadas" });
    expect(h.result.current.capabilitiesFor("t", "p")).toEqual([]);
    // Base esperada continua a da revisão aceita (ev-pre), nunca a da leitura falha. Erro bloqueia UI;
    // aqui verificamos só a base que um envio usaria.
    expect(await expectedBaseSent(h.result.current.context)).toBe("ev-pre");
  });

  it("capacidades com error ANTES dos eventos/versões: nada aplicado", async () => {
    const h = await seedClosing();
    await act(async () => { void h.result.current.refresh(); });
    await answer(open("effective_capabilities")[0], { data: null, error: { message: "caps negadas" } });
    await answer(open("period_closing_events")[0], ok([event("ev-novo", KX)]));
    await answer(open("period_closing_versions")[0], ok([version("fech-novo")]));
    expect(closingIds()).toEqual(["fech-pre"]);
    expect(h.result.current).toMatchObject({ ready: true, error: "caps negadas" });
    expect(h.result.current.capabilitiesFor("t", "p")).toEqual([]);
  });

  it("Promise rejeitada (capacidades e eventos): sem rejeição não capturada, sem loading eterno, nada aplicado", async () => {
    const h = await seedClosing();
    await act(async () => { void h.result.current.refresh(); });
    await answer(open("period_closing_events")[0], ok([event("ev-novo", KX)]));
    await answer(open("period_closing_versions")[0], ok([version("fech-novo")]));
    await fail(open("effective_capabilities")[0], new Error("rede caiu"));
    expect(closingIds()).toEqual(["fech-pre"]);
    expect(h.result.current).toMatchObject({ ready: true, error: "rede caiu" });
    await act(async () => { void h.result.current.refresh(); });
    await fail(open("period_closing_events")[0], new Error("rede caiu 2"));
    await answer(open("period_closing_versions")[0], ok([version("fech-x")]));
    await answer(open("effective_capabilities")[0], ok([cap("cap-x")]));
    expect(closingIds()).toEqual(["fech-pre"]);
    expect(h.result.current).toMatchObject({ ready: true, error: "rede caiu 2" });
    expect(h.result.current.capabilitiesFor("t", "p")).toEqual([]);
  });

  it("primeira leitura com caps error: store anterior intacto, nunca pronto sem erro", async () => {
    periodClosingStore.hydrate({ workflows: {}, records: [version("antes").record as never] });
    const { result } = renderHook(() => useCloudClosingSync(true, { userId: "Z" }));
    await answer(open("period_closing_events")[0], ok([event("ev-z", KX)]));
    await answer(open("period_closing_versions")[0], ok([version("fech-z")]));
    await answer(open("effective_capabilities")[0], { data: null, error: { message: "x" } });
    expect(closingIds()).toEqual(["antes"]);
    expect(closingMirrorOwner()).not.toBe("Z:true");
    expect(result.current.capabilitiesFor("t", "p")).toEqual([]);
  });

  it("duas montagens mesmo contexto, respostas invertidas: ambas usam base/caps da revisão aceita mais nova", async () => {
    const one = renderHook(() => useCloudClosingSync(true, { userId: "A" }));
    const two = renderHook(() => useCloudClosingSync(true, { userId: "A" }));
    // two (pedido mais novo) responde primeiro
    await answer(open("period_closing_events")[1], ok([event("ev-novo", KX)]));
    await answer(open("period_closing_versions")[1], ok([version("fech-novo")]));
    await answer(open("effective_capabilities")[1], ok([cap("cap-novo")]));
    await answer(open("period_closing_events")[0], ok([event("ev-velho", KX)]));
    await answer(open("period_closing_versions")[0], ok([version("fech-velho")]));
    await answer(open("effective_capabilities")[0], ok([cap("cap-velho")]));
    expect(closingIds()).toEqual(["fech-novo"]);
    expect(one.result.current.capabilitiesFor("t", "p")).toEqual(["cap-novo"]);
    expect(two.result.current.capabilitiesFor("t", "p")).toEqual(["cap-novo"]);
    expect(await expectedBaseSent(one.result.current.context)).toBe("ev-novo");
  });

  it("store muda de dono para B: capacidades de A somem enquanto A não relê", async () => {
    const a = await seedClosing();
    const b = renderHook(() => useCloudClosingSync(true, { userId: "B" }));
    await answer(open("period_closing_events")[0], ok([event("ev-b", KX)]));
    await answer(open("period_closing_versions")[0], ok([version("fech-b")]));
    await answer(open("effective_capabilities")[0], ok([cap("cap-b")]));
    expect(b.result.current.capabilitiesFor("t", "p")).toEqual(["cap-b"]);
    expect(a.result.current.ready).toBe(false);
    expect(a.result.current.capabilitiesFor("t", "p")).toEqual([]);
    expect(await expectedBaseSent(a.result.current.context)).toBe("sem-rpc");
  });

  it("refresh pós-RPC lê só fechamentos e preserva caps do MESMO dono", async () => {
    const h = await seedClosing();
    let saved: Promise<unknown> | undefined;
    await act(async () => { saved = recordClosingActInCloud({ scope: closingScope, action: "abertura" as never, event: { detail: "d" } as never, context: h.result.current.context }); });
    await answer(open("record_period_closing_act")[0], ok(null));
    expect(open("effective_capabilities").length).toBe(0);
    await answer(open("period_closing_events")[0], ok([event("ev-pos", KX)]));
    await answer(open("period_closing_versions")[0], ok([version("fech-pos")]));
    await act(async () => { await saved; });
    expect(closingIds()).toEqual(["fech-pos"]);
    expect(h.result.current.capabilitiesFor("t", "p")).toEqual(["cap-pre"]);
    expect(await expectedBaseSent(h.result.current.context)).toBe("ev-pos");
  });
});

const sessionEvent = (sid: string, evId: string) => ({ id: evId, session_id: sid, sequence: 1, document: { id: sid, state: "aberta", participants: [], agenda: [] } });
const answerCollegial = async (i: number, sid: string, evId: string) => {
  await answer(open("collegial_body_configurations")[i], ok([]));
  await answer(open("collegial_session_events")[i], ok([sessionEvent(sid, evId)]));
  await answer(open("collegial_deliberations")[i], ok([]));
  await answer(open("collegial_minute_versions")[i], ok([]));
};

describe("Conselho — meta pertence à revisão aceita do store", () => {
  it("duas montagens mesmo user/turma/store, respostas invertidas: commit da montagem rejeitada usa a base NOVA", async () => {
    const store = createCollegialStore();
    const one = renderHook(() => useCloudCollegial(store, "t", true, { userId: "A" }));
    const two = renderHook(() => useCloudCollegial(store, "t", true, { userId: "A" }));
    await answerCollegial(1, "ses", "ev-novo"); // seq2 aceito
    await answerCollegial(0, "ses", "ev-velho"); // seq1 rejeitado
    expect(store.snapshot().sessions.map((s) => s.id)).toEqual(["ses"]);
    expect(one.result.current.ready).toBe(true);
    let pending: Promise<unknown> | undefined;
    await act(async () => {
      pending = one.result.current.commit((clone) => {
        const snap = clone.snapshot();
        clone.hydrate({ ...snap, sessions: snap.sessions.map((s) => ({ ...s, agenda: [{ id: "x" } as never] })) });
        return { ok: true, value: null };
      });
      await new Promise((r) => setTimeout(r, 0));
    });
    const rpc = open("record_collegial_session_event");
    expect(rpc.length).toBe(1);
    expect((rpc[0]!.args as Record<string, unknown>)["_expected_last_event_id"]).toBe("ev-novo");
    expect((rpc[0]!.args as Record<string, unknown>)["_plan_id"]).toBe("sessao:ses:ev-novo:pauta");
    await answer(rpc[0], ok("ev-3"));
    await answerCollegial(0, "ses", "ev-3");
    await answer(open("collegial_body_configurations")[0], ok([])).catch(() => undefined);
    await act(async () => { await pending; });
    void two;
  });

  it("montagem com erro próprio, mesmo dono: commit recusado sem RPC", async () => {
    const store = createCollegialStore();
    const one = renderHook(() => useCloudCollegial(store, "t", true, { userId: "A" }));
    const two = renderHook(() => useCloudCollegial(store, "t", true, { userId: "A" }));
    await answerCollegial(1, "ses", "ev-novo");
    await answer(open("collegial_body_configurations")[0], ok([]));
    await fail(open("collegial_session_events")[0], new Error("rede caiu"));
    await answer(open("collegial_deliberations")[0], ok([]));
    await answer(open("collegial_minute_versions")[0], ok([]));
    expect(one.result.current).toMatchObject({ ready: true, error: "rede caiu" });
    const r = await one.result.current.commit(() => ({ ok: true, value: null }));
    expect(r.ok).toBe(false);
    expect(db.calls.some((c) => c.name === "record_collegial_session_event")).toBe(false);
    expect(two.result.current.error).toBe("");
  });
});

describe("situação — leitura rejeitada (Promise) não deixa loading eterno nem hidrata", () => {
  it("rejeição vira erro visível; store intacto; registro recusado sem RPC", async () => {
    const store = createAcademicStandingStore();
    const { result } = renderHook(() => useCloudStanding(store, "t", true, { userId: "A" }));
    await answer(open("academic_standing_versions")[0], ok([{ id: "s1", logical_standing_id: "l1", version_number: 1, supersedes_version_id: null, record: { studentId: "s1", classId: "t" } }]));
    await act(async () => { void result.current.refresh(); });
    await fail(open("academic_standing_versions")[0], new Error("rede caiu"));
    expect(store.records().map((r) => r.id)).toEqual(["s1"]);
    expect(result.current).toMatchObject({ ready: true, error: "rede caiu" });
    const r = await result.current.register({ actor: {} as never, cycleId: "c", conferred: [], rebuild: () => undefined });
    expect(r.ok).toBe(false);
    expect(db.calls.some((c) => c.name === "register_academic_standings")).toBe(false);
  });
});

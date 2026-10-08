import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { mapScheduleRows, readClassSchedule, ScheduleShapeError, scheduleIsUsable, type RawScheduleRow } from "./class-schedule-source";
import { ScheduleView } from "@/features/schedules/institutional-schedules-page";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => {
  const chain = () => ({ select: () => ({ in: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: null, error: null }) }) });
  return { supabase: { rpc: (...a: unknown[]) => rpc(...a), from: vi.fn(chain), auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: async () => ({ data: { session: null } }) } } };
});

const t = { validOn: "2026-03-02", knownAt: "2026-03-02T12:00:00.000Z" };
const base: RawScheduleRow = {
  result_kind: "block", class_id: "k1", valid_on: t.validOn, known_at: t.knownAt, schedule_state: "utilizavel", schedule_id: "csch-1",
  version_id: "v1", version: 1, change_kind: "constituicao", valid_from: "2026-02-01", effective_until: null, originating_act_ref: "ato-g1",
  change_reason: null, recorded_at: "2026-01-01T00:00:00Z", block_id: "blk-uuid-1", block_key: "b1", weekday: 1, starts_at: "07:00:00",
  ends_at: "08:00:00", block_minutes: 60, component_id: "cmp-tecnico-a", component_version: 1, component_name: "Componente A",
  nature_scheme_id: null, nature_value_id: null, nature_value_version: null, nature_label: null, engagement_ids: ["eng-1", "eng-2"],
  block_state: "utilizavel", block_issues: [], overlapping_block_keys: [], coverage_state: "nao-comprovada", coverage_matrix_ids: [],
  day_minutes: 60, week_minutes: 60,
};
const row = (p: Partial<RawScheduleRow>): RawScheduleRow => ({ ...base, ...p });
const wrap = (ui: ReactNode) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;

describe("B4.4 — grade canônica da turma", () => {
  beforeEach(() => rpc.mockReset());

  it("ausente mostra 'Grade não registrada' e negado não vaza horários", () => {
    const a = mapScheduleRows([row({ result_kind: "absent", block_id: null })], "k1", t);
    const { unmount } = render(wrap(<ScheduleView schedule={a} />));
    expect(screen.getByText("Grade não registrada.")).toBeTruthy();
    unmount();
    const n = mapScheduleRows([row({ result_kind: "access-denied" })], "k1", t);
    const { container } = render(wrap(<ScheduleView schedule={n} />));
    expect(container.textContent).not.toMatch(/07:00|Componente/);
  });

  it("estados de bloqueio são distintos e só grade utilizável alimenta aula prevista", () => {
    const states = ["bloqueada:jornada-ausente", "bloqueada:blocos-com-pendencia", "inconsistente:sobreposicao-de-blocos"];
    const texts = states.map((s) => {
      const g = mapScheduleRows([row({ schedule_state: s })], "k1", t);
      expect(scheduleIsUsable(g)).toBe(false);
      const { container, unmount } = render(wrap(<ScheduleView schedule={g} names={new Map()} />));
      const txt = container.querySelector("[role=status]")!.textContent; unmount(); return txt;
    });
    expect(new Set(texts).size).toBe(3);
    expect(scheduleIsUsable(mapScheduleRows([row({})], "k1", t))).toBe(true);
  });

  it("estado desconhecido falha visivelmente, nunca vira ausência/sucesso", () => {
    expect(() => mapScheduleRows([row({ schedule_state: "novo-estado" })], "k1", t)).toThrow(ScheduleShapeError);
    expect(() => mapScheduleRows([row({ block_state: "x" })], "k1", t)).toThrow(ScheduleShapeError);
    expect(() => mapScheduleRows([row({ result_kind: "outra-coisa" })], "k1", t)).toThrow(ScheduleShapeError);
    expect(() => mapScheduleRows([row({}), row({ version_id: "v2", block_id: "b2" })], "k1", t)).toThrow(ScheduleShapeError);
  });

  it("blocos canônicos aparecem com rótulo legível; IDs só na auditoria; dois responsáveis não são conflito", () => {
    const g = mapScheduleRows([row({}), row({ block_id: "blk-uuid-2", block_key: "b2", starts_at: "08:00:00", ends_at: "09:00:00", component_id: null, component_name: null,
      nature_scheme_id: "esq", nature_value_id: "val-tecnico", nature_value_version: 1, nature_label: "Natureza legível", engagement_ids: [] })], "k1", t);
    const { container } = render(wrap(<ScheduleView schedule={g} names={new Map([["eng-1", "Pessoa Um"]])} />));
    const rows = [...container.querySelectorAll("[data-testid=schedule-block]")];
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("Componente A");
    expect(rows[0]!.textContent).toContain("Pessoa Um; Responsável sem nome legível");
    expect(rows[0]!.textContent).toContain("Utilizável");
    expect(rows[0]!.textContent).not.toMatch(/conflito/i);
    expect(rows[1]!.textContent).toContain("Natureza legível");
    for (const r of rows) expect(r.textContent).not.toMatch(/cmp-tecnico-a|val-tecnico|blk-uuid|eng-1/);
    expect(container.querySelector("details")!.textContent).toContain("cmp-tecnico-a");
  });

  it("reader exige validOn/knownAt e propaga erro fail-closed", async () => {
    await expect(readClassSchedule("k1", { validOn: "", knownAt: "x" })).rejects.toThrow("valid-on-required");
    rpc.mockResolvedValueOnce({ data: null, error: { message: "schedule:ambiguous-temporal-state" } });
    await expect(readClassSchedule("k1", t)).rejects.toThrow("ambiguous");
    rpc.mockResolvedValueOnce({ data: [row({})], error: null });
    await readClassSchedule("k1", t);
    expect(rpc).toHaveBeenLastCalledWith("class_schedule_at", { _class_id: "k1", _on: t.validOn, _known_at: t.knownAt });
  });
});

describe("B4.4 — Diário e tabela antiga", () => {
  it("/horarios com sessão usa só a página institucional, sem fixtures de horários", () => {
    const page = readFileSync("src/features/schedules/institutional-schedules-page.tsx", "utf8");
    expect(page).not.toMatch(/schedules-data|schedule-integration|classes-data|units-data|professionals-data/);
    const layout = readFileSync("src/features/schedules/horarios-layout.tsx", "utf8");
    expect(layout).toMatch(/<MySchedulePage key={ctx} contextKey={ctx}/); expect(layout).toMatch(/<InstitutionalSchedulesPage key={ctx} contextKey={ctx}/); // B4.5 + B4.10.0e
  });

  it("nenhum código de app consulta institutional_class_schedule_slots", () => {
    const hits: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(f) && !p.includes("integrations/supabase/types.ts") && !p.endsWith(".test.tsx") && /from\(\s*"institutional_class_schedule_slots"/.test(readFileSync(p, "utf8"))) hits.push(p); } };
    walk("src");
    expect(hits).toEqual([]);
  });

  it("Diário institucional: grade bloqueada/erro não gera aula prevista e não usa laboratório", async () => {
    const mode = await import("@/features/diary/diary-persistence-mode");
    const teaching = await import("@/features/diary/institutional-teaching");
    mode.setDiaryPersistenceMode("cloud");
    // B4.10.0d — a grade só é lida com o knownAt do lote aplicado (nunca recapturado).
    teaching.applyInstitutionalTeaching({ personId: null, personName: null, classes: [], schools: new Map(), assignments: [] }, "2026-03-02T12:00:00.000Z");
    rpc.mockResolvedValue({ data: [row({ schedule_state: "inconsistente:sobreposicao-de-blocos" })], error: null });
    expect(teaching.teachingClassBlocks("k1", "2026-03-02")).toEqual([]);
    await new Promise((r) => setTimeout(r, 0));
    expect(teaching.teachingScheduleState("k1", "2026-03-02").status).toBe("lida");
    expect(teaching.teachingClassBlocks("k1", "2026-03-02")).toEqual([]);
    rpc.mockResolvedValue({ data: null, error: { message: "schedule:invalid-chain" } });
    expect(teaching.teachingClassBlocks("k9", "2026-03-02")).toEqual([]);
    await new Promise((r) => setTimeout(r, 0));
    expect(teaching.teachingScheduleState("k9", "2026-03-02").status).toBe("erro");
    expect(teaching.teachingClassBlocks("k9", "2026-03-02")).toEqual([]);
    rpc.mockResolvedValue({ data: [row({})], error: null });
    teaching.teachingClassBlocks("k2", "2026-03-02");
    await new Promise((r) => setTimeout(r, 0));
    const blocks = teaching.teachingClassBlocks("k2", "2026-03-02");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind).not.toBe("Aula");
    expect(blocks[0]!.label).toBe("Componente A");
    expect(rpc.mock.calls.every((c) => c[0] === "class_schedule_at")).toBe(true);
    mode.setDiaryPersistenceMode("laboratorio");
    expect(Array.isArray(teaching.teachingClassBlocks("turma-demo-inexistente", "2026-03-02"))).toBe(true);
  });
});

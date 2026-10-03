import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { mapPersonScheduleRows, PersonScheduleShapeError, readMySchedule, type RawPersonRow } from "./person-schedule-source";
import { MyScheduleView } from "./my-schedule-page";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));

const t = { validOn: "2026-03-02", knownAt: "2026-03-02T12:00:00.000Z" };
const nul: RawPersonRow = {
  result_kind: "summary", valid_on: t.validOn, known_at: t.knownAt, class_id: null, school_id: null, source_state: null, source_issue: null,
  schedule_id: null, version_id: null, version: null, block_id: null, block_key: null, weekday: null, starts_at: null, ends_at: null,
  block_minutes: null, component_id: null, component_name: null, nature_label: null, own_engagement_ids: null, block_state: null,
  operational: null, other_block_id: null, other_class_id: null, overlap_starts_at: null, overlap_ends_at: null,
  operational_block_count: null, unavailable_block_count: null, week_minutes: null, conflict_count: null,
};
const blk = (p: Partial<RawPersonRow>): RawPersonRow => ({
  ...nul, result_kind: "block", class_id: "k1", school_id: "esc-a", source_state: "utilizavel", schedule_id: "csch-1", version_id: "v1",
  version: 1, block_id: "blk-1", block_key: "b1", weekday: 1, starts_at: "07:00:00", ends_at: "08:00:00", block_minutes: 60,
  component_id: "cmp-a", component_name: "Componente A", own_engagement_ids: ["eng-1", "eng-2"], block_state: "utilizavel", operational: true, ...p,
});
const sum = (p: Partial<RawPersonRow>): RawPersonRow => ({ ...nul, operational_block_count: 2, unavailable_block_count: 0, week_minutes: 120, conflict_count: 0, ...p });
const names = { classes: new Map([["k1", "Turma Um"], ["k3", "Turma Três"]]), schools: new Map([["esc-a", "Escola Alfa"]]) };
const wrap = (ui: ReactNode) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;

describe("B4.5 — Meu horário (projeção)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("consulta somente a própria pessoa via current_person_id e exige validOn/knownAt", async () => {
    const rpc = vi.fn(async (f: string) => (f === "current_person_id" ? { data: "p-me", error: null } : { data: [{ ...nul, result_kind: "absent" }], error: null }));
    const s = await readMySchedule(t, { rpc });
    expect(s.kind).toBe("ausente");
    expect(rpc).toHaveBeenCalledWith("person_schedule_at", { _person_id: "p-me", _on: t.validOn, _known_at: t.knownAt });
    await expect(readMySchedule({ validOn: "", knownAt: t.knownAt }, { rpc })).rejects.toThrow();
    const none = await readMySchedule(t, { rpc: vi.fn(async () => ({ data: null, error: null })) });
    expect(none.kind).toBe("negado");
  });

  it("ausente mostra a mensagem própria; negado não vaza nada", () => {
    const { unmount } = render(wrap(<MyScheduleView schedule={mapPersonScheduleRows([{ ...nul, result_kind: "absent" }], t)} names={names} />));
    expect(screen.getByText("Nenhum bloco previsto registrado para você nesta data.")).toBeTruthy();
    unmount();
    const { container } = render(wrap(<MyScheduleView schedule={mapPersonScheduleRows([{ ...nul, result_kind: "access-denied" }], t)} names={names} />));
    expect(container.textContent).not.toMatch(/07:00|Componente|Turma/);
  });

  it("blocos legíveis, conflito potencial sem juízo normativo e IDs só na auditoria", () => {
    const rows = [
      sum({ operational_block_count: 2, week_minutes: 120, conflict_count: 1 }),
      blk({}),
      blk({ block_id: "blk-9", block_key: "c1", class_id: "k3", starts_at: "07:30:00", ends_at: "08:30:00", own_engagement_ids: ["eng-3"] }),
      { ...nul, result_kind: "conflict", source_state: "conflito-temporal-potencial", block_id: "blk-1", other_block_id: "blk-9",
        class_id: "k1", other_class_id: "k3", weekday: 1, overlap_starts_at: "07:30:00", overlap_ends_at: "08:00:00" },
    ];
    const { container } = render(wrap(<MyScheduleView schedule={mapPersonScheduleRows(rows, t)} names={names} />));
    expect(screen.getAllByTestId("my-block")).toHaveLength(2);
    const conflict = screen.getByTestId("my-conflict").textContent!;
    expect(conflict).toContain("Sobreposição temporal potencial; requer validação.");
    expect(conflict).not.toMatch(/infra|irregular|ilegal/i);
    const main = [...container.querySelectorAll("[data-testid=my-block],[data-testid=my-conflict]")].map((e) => e.textContent).join(" ");
    expect(main).toContain("Turma Um"); expect(main).toContain("Escola Alfa");
    expect(main).not.toMatch(/blk-1|eng-1|csch-1|cmp-a/);
    expect(container.querySelector("details")!.textContent).toContain("blk-1");
    expect(screen.queryByRole("combobox")).toBeNull(); // sem seletor de outros profissionais
    expect(screen.queryByRole("button")).toBeNull();   // sem editar/publicar/corrigir
  });

  it("mesmo bloco não duplica; bloqueado não vira utilizável; estado desconhecido falha", () => {
    expect(() => mapPersonScheduleRows([sum({}), blk({}), blk({})], t)).toThrow(PersonScheduleShapeError);
    expect(() => mapPersonScheduleRows([sum({}), blk({ source_state: "bloqueada:jornada-ausente", operational: true })], t)).toThrow(PersonScheduleShapeError);
    expect(() => mapPersonScheduleRows([sum({}), blk({ source_state: "novo" })], t)).toThrow(PersonScheduleShapeError);
    expect(() => mapPersonScheduleRows([{ ...nul, result_kind: "outra" }], t)).toThrow(PersonScheduleShapeError);
    const s = mapPersonScheduleRows([sum({ operational_block_count: 0, unavailable_block_count: 1, week_minutes: 0 }),
      blk({ source_state: "bloqueada:jornada-ausente", block_state: "bloqueada:jornada-ausente", operational: false })], t);
    render(wrap(<MyScheduleView schedule={s} names={names} />));
    expect(screen.getByTestId("my-block").textContent).toContain("bloco não confirmado");
  });

  it("fonte indisponível é explicada sem fabricar bloco", () => {
    const s = mapPersonScheduleRows([sum({ operational_block_count: 0, week_minutes: 0 }),
      { ...nul, result_kind: "source-unavailable", class_id: "k3", source_state: "erro-de-leitura", source_issue: "schedule:invalid-chain" }], t);
    render(wrap(<MyScheduleView schedule={s} names={names} />));
    expect(screen.getByRole("alert").textContent).toContain("nenhum bloco foi presumido");
    expect(screen.queryAllByTestId("my-block")).toHaveLength(0);
  });

  it("fontes não usam fixtures nem a tabela antiga; layout separa sessão do laboratório", () => {
    for (const f of ["src/features/schedules/person-schedule-source.ts", "src/features/schedules/my-schedule-page.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/schedules-data|institutional_class_schedule_slots|lab-|fixture/);
    }
    const layout = readFileSync("src/routes/horarios.tsx", "utf8");
    expect(layout).toMatch(/MySchedulePage/); expect(layout).toMatch(/<Outlet \/>/);
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { mapJourneyRows, readClassJourney, formatMinutes, JourneyShapeError, type RawJourneyRow } from "./class-journey-source";
import { JourneyView } from "./class-journey-panel";

const t = { validOn: "2026-03-02", knownAt: "2026-03-02T12:00:00.000Z" };
const empty: RawJourneyRow = {
  result_kind: "interval", class_id: "k1", valid_on: t.validOn, known_at: t.knownAt, journey_id: "cj-1", version_id: "v1", version: 1,
  change_kind: "constituicao", valid_from: "2026-02-01", effective_until: "2026-06-30", originating_act_ref: "ato-j1", change_reason: null,
  recorded_at: "2026-01-01T00:00:00Z", weekday: 1, starts_at: "07:00:00", ends_at: "09:00:00", day_first_start: "07:00:00",
  day_last_end: "15:00:00", day_minutes: 390, week_minutes: 630,
};
const row = (p: Partial<RawJourneyRow>): RawJourneyRow => ({ ...empty, ...p });
const rows = [
  row({ starts_at: "13:00:00", ends_at: "15:00:00" }), row({}), row({ starts_at: "09:00:00", ends_at: "11:30:00" }),
  row({ weekday: 2, starts_at: "07:00:00", ends_at: "11:00:00", day_first_start: "07:00:00", day_last_end: "11:00:00", day_minutes: 240 }),
];

describe("B4.3 — jornada canônica da turma", () => {
  it("agrupa por dia em ordem determinística, com derivados descritivos", () => {
    const j = mapJourneyRows(rows, "k1", t);
    if (j.kind !== "vigente") throw new Error("x");
    expect(j.days.map((d) => d.weekday)).toEqual([1, 2]);
    expect(j.days[0]!.intervals).toEqual([{ startsAt: "07:00", endsAt: "09:00" }, { startsAt: "09:00", endsAt: "11:30" }, { startsAt: "13:00", endsAt: "15:00" }]);
    expect(j.days[0]!.minutes).toBe(390);
    expect(j.weekMinutes).toBe(630);
    expect(formatMinutes(390)).toBe("6 h 30 min");
  });

  it("ausência é 'Jornada não registrada' e negação não vaza horários", () => {
    const a = mapJourneyRows([row({ result_kind: "absent", version_id: null, weekday: null })], "k1", t);
    expect(a.kind).toBe("ausente");
    const { unmount } = render(<JourneyView journey={a} />);
    expect(screen.getByText("Jornada não registrada.")).toBeTruthy();
    unmount();
    const n = mapJourneyRows([row({ result_kind: "access-denied" })], "k1", t);
    expect(n).toEqual({ kind: "negado", classId: "k1", validOn: t.validOn, knownAt: t.knownAt });
    const { container } = render(<JourneyView journey={n} />);
    expect(container.textContent).not.toMatch(/07:00|Total/);
  });

  it("result_kind desconhecido ou várias versões falham fechado", () => {
    expect(() => mapJourneyRows([row({ result_kind: "novo" })], "k1", t)).toThrow(JourneyShapeError);
    expect(() => mapJourneyRows([row({}), row({ version_id: "v2" })], "k1", t)).toThrow(JourneyShapeError);
  });

  it("IDs só no detalhe de auditoria", () => {
    const { container } = render(<JourneyView journey={mapJourneyRows(rows, "k1", t)} />);
    expect(screen.getByText("Segunda-feira")).toBeTruthy();
    const table = container.querySelector("table")!;
    expect(table.textContent).not.toMatch(/cj-1|v1|ato-j1/);
    expect(container.querySelector("details")!.textContent).toMatch(/cj-1/);
  });

  it("validOn/knownAt obrigatórios e repassados; erro do banco propaga; sem fixtures", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row({ result_kind: "absent" })], error: null });
    await readClassJourney("k1", t, { rpc } as never);
    expect(rpc).toHaveBeenCalledWith("class_journey_at", { _class_id: "k1", _on: t.validOn, _known_at: t.knownAt });
    await expect(readClassJourney("k1", { validOn: "", knownAt: t.knownAt }, { rpc } as never)).rejects.toThrow("valid-on-required");
    await expect(readClassJourney("k1", { validOn: t.validOn, knownAt: "" }, { rpc } as never)).rejects.toThrow("known-at-required");
    const bad = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "journey:ambiguous-temporal-state" } }) } as never;
    await expect(readClassJourney("k1", t, bad)).rejects.toThrow("ambiguous");
    for (const f of ["class-journey-source.ts", "class-journey-panel.tsx"]) {
      expect(readFileSync(`src/features/student-life/${f}`, "utf8")).not.toMatch(/fixtures|schedules-data|demonstration/i);
    }
  });
});

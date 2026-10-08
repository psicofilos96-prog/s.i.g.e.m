import { describe, expect, it } from "vitest";
import { createCalendarFixtures, demoActors } from "./calendar-fixtures";
import { mutateCalendar } from "./calendar-governance";
import { resolveCalendar, holidaysForDisplay } from "./calendar-engine";
import { mirrorTargets, translateMutation } from "./calendar-mirror";
import type { NetworkCalendar } from "./calendar-types";

const sup = (Object.values(demoActors) as { role: string }[]).find((a) => a.role === "supervisao") as never;
const draft = (c: NetworkCalendar): NetworkCalendar => ({ ...c, status: "rascunho" as never });

describe("edições livres do calendário", () => {
  const [regular] = createCalendarFixtures().map(draft);
  it("qualquer dia de dezembro pode virar dia letivo, mesmo dentro de férias/recesso", () => {
    const days = [...resolveCalendar(regular!).byDate].filter(([d, t]) => d.startsWith("2027-12") && t !== "VAZIO" && t !== "FDS");
    expect(days.length).toBeGreaterThan(0);
    for (const [d] of days) {
      const r = mutateCalendar(regular!, sup, { kind: "restaurar-dia-letivo", date: d });
      expect(r.ok).toBe(true);
      if (r.ok) expect(resolveCalendar(r.calendar).byDate.get(d)).toBe("VAZIO");
    }
  });
  it("trocar o tipo de um feriado muda o dia e tira da lista de feriados", () => {
    const ev = regular!.events.find((e) => e.type === "FERIADO")!;
    const r = mutateCalendar(regular!, sup, { kind: "editar-evento", id: ev.id, type: "PF" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(resolveCalendar(r.calendar).byDate.get(ev.date)).toBe("PF");
  });
  it("feriado herdado sobrescrito por dia letivo sai da lista de feriados", () => {
    const r = mutateCalendar(regular!, sup, { kind: "restaurar-dia-letivo", date: "2027-04-21" });
    expect(r.ok && holidaysForDisplay(r.calendar).some((h) => h.date === "2027-04-21")).toBe(false);
  });
  it("Regular espelha no EJA Fase I do mesmo ano", () => {
    const all = createCalendarFixtures().map(draft);
    const reg = all.find((c) => c.modality === "regular" && c.year === 2027)!;
    const targets = mirrorTargets(reg, all);
    expect(targets.map((t) => t.modality)).toEqual(["eja-fase-1"]);
    const ev = reg.events.find((e) => e.type === "FERIADO")!;
    const tm = translateMutation({ kind: "remover-evento", id: ev.id }, reg, targets[0]!);
    expect(tm && "id" in tm && targets[0]!.events.find((e) => e.id === tm.id)?.date).toBe(ev.date);
  });
});

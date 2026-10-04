import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { displayTime, mapPersonScheduleRows, PersonScheduleShapeError, readMySchedule, readPlaceNames, sqlRoundedMinutes, type RawPersonRow } from "./person-schedule-source";
import { MyScheduleView } from "./my-schedule-page";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
vi.mock("@/components/sigem/operational", () => ({ OperationalPageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));

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
const names = { classes: new Map([["k1", "Turma Um"], ["k3", "Turma Três"]]), schools: new Map([["esc-a", "Escola Alfa"]]), errors: [] as string[] };
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
      expect(src).not.toMatch(/from ["'][^"']*(schedules-data|laboratory|fixtures)|institutional_class_schedule_slots/);
    }
    const layout = readFileSync("src/routes/horarios.tsx", "utf8");
    expect(layout).toMatch(/MySchedulePage/); expect(layout).toMatch(/<Outlet \/>/);
  });
});

describe("B4.5 — contrato fail-closed do mapeador", () => {
  const ok = [sum({ operational_block_count: 1, week_minutes: 60 }), blk({})];
  const bad = (rows: unknown) => expect(() => mapPersonScheduleRows(rows, t)).toThrow(PersonScheduleShapeError);

  it("aceita forma válida e zero explícito", () => {
    expect(mapPersonScheduleRows(ok, t).kind).toBe("projetado");
    const z = mapPersonScheduleRows([sum({ operational_block_count: 0, unavailable_block_count: 1, week_minutes: 0 }),
      blk({ source_state: "bloqueada:jornada-ausente", operational: false })], t);
    expect(z.kind === "projetado" && z.weekMinutes).toBe(0);
  });

  it("payload nulo/vazio/não-array falha (não vira negado)", () => {
    bad(null); bad([]); bad({});
  });

  it("summary nulo, malformado, duplicado ou discrepante falha", () => {
    bad([sum({ week_minutes: null }), blk({})]);
    bad([sum({ operational_block_count: -1 }), blk({})]);
    bad([sum({ operational_block_count: 1.5 }), blk({})]);
    bad([blk({})]);
    bad([...ok, sum({ operational_block_count: 1, week_minutes: 60 })]);
    bad([sum({ operational_block_count: 2, week_minutes: 60 }), blk({})]);
    bad([sum({ operational_block_count: 1, week_minutes: 90 }), blk({})]);
    bad([sum({ operational_block_count: 1, week_minutes: 60, conflict_count: 1 }), blk({})]);
    bad([sum({ operational_block_count: 1, week_minutes: 60, unavailable_block_count: 1 }), blk({})]);
    bad([sum({ operational_block_count: 0, week_minutes: 0 })]);
  });

  it("campos de bloco ausentes/inválidos falham", () => {
    const m = (p: Partial<RawPersonRow>) => bad([sum({ operational_block_count: 1, week_minutes: 60 }), blk(p)]);
    m({ block_minutes: null }); m({ block_minutes: 30 }); m({ starts_at: null }); m({ ends_at: "25:00:00" });
    m({ starts_at: "08:00:00", ends_at: "07:00:00" }); m({ starts_at: "08:00:00", ends_at: "08:00:00" });
    m({ weekday: 0 }); m({ weekday: 8 }); m({ weekday: null }); m({ weekday: 1.5 });
    m({ class_id: null }); m({ schedule_id: null }); m({ version_id: null }); m({ version: null }); m({ block_key: "" });
    m({ own_engagement_ids: [] }); m({ own_engagement_ids: null }); m({ own_engagement_ids: ["e", "e"] });
    m({ operational: null }); m({ block_state: "novo" });
    bad([sum({ operational_block_count: 0, unavailable_block_count: 1, week_minutes: 0 }), blk({ operational: false })]);
  });

  it("access-denied/absent só como linha única sem dados", () => {
    bad([{ ...nul, result_kind: "access-denied" }, blk({})]);
    bad([{ ...nul, result_kind: "absent" }, ...ok]);
    bad([{ ...nul, result_kind: "access-denied", class_id: "k1" }]);
    bad([{ ...nul, result_kind: "absent", week_minutes: 0 }]);
    bad([{ ...nul, result_kind: "summary" as const, result_kind2: 1 }].map((r) => ({ ...r, result_kind: "desconhecido" })));
  });

  it("identidade temporal: instante equivalente aceito, divergente falha", () => {
    const eq = ok.map((r) => ({ ...r, known_at: "2026-03-02T09:00:00-03:00" }));
    expect(mapPersonScheduleRows(eq, t).kind).toBe("projetado");
    bad(ok.map((r) => ({ ...r, known_at: "2026-03-02T12:00:01Z" })));
    bad(ok.map((r) => ({ ...r, valid_on: "2026-03-03" })));
    bad([{ ...nul, result_kind: "absent", known_at: null as unknown as string }]);
  });

  it("conflitos: pares canônicos, únicos, operacionais e com interseção real", () => {
    const b2 = blk({ block_id: "blk-9", block_key: "c1", class_id: "k3", starts_at: "07:30:00", ends_at: "08:30:00" });
    const c = { ...nul, result_kind: "conflict", source_state: "conflito-temporal-potencial", block_id: "blk-1", other_block_id: "blk-9",
      class_id: "k1", other_class_id: "k3", weekday: 1, overlap_starts_at: "07:30:00", overlap_ends_at: "08:00:00" };
    const s2 = (n: number) => sum({ operational_block_count: 2, week_minutes: 120, conflict_count: n });
    expect(mapPersonScheduleRows([s2(1), blk({}), b2, c], t).kind).toBe("projetado");
    bad([s2(2), blk({}), b2, c, c]);
    bad([s2(1), blk({}), b2, { ...c, block_id: "blk-9", other_block_id: "blk-1", class_id: "k3", other_class_id: "k1" }]);
    bad([s2(1), blk({}), b2, { ...c, other_block_id: "blk-x" }]);
    bad([s2(1), blk({}), b2, { ...c, overlap_ends_at: "08:30:00" }]);
    bad([s2(1), blk({}), b2, { ...c, weekday: 2 }]);
    bad([s2(1), blk({}), b2, { ...c, source_state: "infracao" }]);
    const far = blk({ block_id: "blk-9", block_key: "c1", class_id: "k3", starts_at: "09:00:00", ends_at: "10:00:00" });
    bad([s2(1), blk({}), far, { ...c, overlap_starts_at: "09:00:00", overlap_ends_at: "08:00:00" }]);
    const blocked = blk({ block_id: "blk-9", block_key: "c1", class_id: "k3", starts_at: "07:30:00", ends_at: "08:30:00",
      source_state: "bloqueada:jornada-ausente", block_state: "bloqueada:jornada-ausente", operational: false });
    bad([sum({ operational_block_count: 1, unavailable_block_count: 1, week_minutes: 60, conflict_count: 1 }), blk({}), blocked, c]);
  });
});

describe("B4.5 — nomes no mesmo snapshot", () => {
  const chain = (data: unknown, error: unknown = null) => {
    const calls: [string, unknown[]][] = [];
    const q: Record<string, unknown> = {};
    for (const k of ["select", "in", "lte", "order"]) q[k] = (...a: unknown[]) => { calls.push([k, a]); return k === "order" ? Promise.resolve({ data, error }) : q; };
    return { from: vi.fn(() => q), calls };
  };

  it("class_at e escola recebem o mesmo knownAt; versão futura/registrada depois não é lida", async () => {
    const { from, calls } = chain([{ school_id: "esc-a", official_name: "Escola Alfa", version_number: 1 }]);
    const rpc = vi.fn(async () => ({ data: [{ name: "Turma Um" }], error: null }));
    const n = await readPlaceNames(["k1"], ["esc-a"], t, { rpc, from });
    expect(rpc).toHaveBeenCalledWith("class_at", { _class_id: "k1", _valid_on: t.validOn, _known_at: t.knownAt });
    expect(calls).toContainEqual(["lte", ["valid_from", t.validOn]]);
    expect(calls).toContainEqual(["lte", ["registered_at", t.knownAt]]);
    expect(n.classes.get("k1")).toBe("Turma Um"); expect(n.schools.get("esc-a")).toBe("Escola Alfa"); expect(n.errors).toEqual([]);
  });

  it("falha de nomes é devolvida e exibida sem esconder blocos nem usar ID como rótulo", async () => {
    const { from } = chain(null, { message: "denied" });
    const rpc = vi.fn(async () => ({ data: null, error: { message: "boom" } }));
    const n = await readPlaceNames(["k1"], ["esc-a"], t, { rpc, from });
    expect(n.errors.length).toBe(2);
    render(wrap(<MyScheduleView schedule={mapPersonScheduleRows([sum({ operational_block_count: 1, week_minutes: 60 }), blk({})], t)} names={n} />));
    expect(screen.getByTestId("names-warning")).toBeTruthy();
    const b = screen.getByTestId("my-block").textContent!;
    expect(b).toContain("Turma sem nome legível"); expect(b).toContain("Escola sem nome legível"); expect(b).not.toMatch(/k1|esc-a/);
  });
});

describe("B4.5 — isolamento por conta", () => {
  it("trocar de conta não reaproveita cache nem mostra o horário anterior durante a carga", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { MySchedulePage } = await import("./my-schedule-page");
    let who = "A"; let releaseB: () => void = () => {};
    const gateB = new Promise<void>((r) => { releaseB = r; });
    vi.mocked(supabase.rpc).mockImplementation((async (f: string, a?: { _known_at: string; _on: string }) => {
      if (f === "current_person_id") return { data: `p-${who}`, error: null };
      if (f === "class_at") return { data: [], error: null };
      const me = who;
      if (me === "B") await gateB;
      const row = { ...blk(me === "A" ? { starts_at: "07:00:00", ends_at: "08:00:00" } : { block_id: "blk-b", starts_at: "13:00:00", ends_at: "14:00:00" }), valid_on: a!._on, known_at: a!._known_at };
      return { data: [{ ...sum({ operational_block_count: 1, week_minutes: 60 }), valid_on: a!._on, known_at: a!._known_at }, row], error: null };
    }) as never);
    const q: Record<string, unknown> = {};
    for (const k of ["select", "in", "lte"]) q[k] = () => q;
    q["order"] = () => Promise.resolve({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(q as never);
    const client = new QueryClient();
    const ui = (id: string) => <QueryClientProvider client={client}><MySchedulePage key={id} contextKey={`${id}#1`} /></QueryClientProvider>;
    const { rerender } = render(ui("user-A"));
    expect(await screen.findByText(/07:00–08:00/)).toBeTruthy();
    who = "B";
    rerender(ui("user-B"));
    expect(screen.queryByText(/07:00–08:00/)).toBeNull();
    expect(screen.getByText("Consultando seu horário…")).toBeTruthy();
    releaseB();
    expect(await screen.findByText(/13:00–14:00/)).toBeTruthy();
    expect(screen.queryByText(/07:00–08:00/)).toBeNull();
    const keys = client.getQueryCache().findAll({ queryKey: ["b45-my"] }).map((x) => x.queryKey[1]);
    expect(new Set(keys)).toEqual(new Set(["user-A#1", "user-B#1"]));
  });
});

describe("B4.5.2 — precisão TIME do PostgreSQL", () => {
  const one = (p: Partial<RawPersonRow>, minutes: number) =>
    mapPersonScheduleRows([sum({ operational_block_count: 1, week_minutes: minutes }), blk({ block_minutes: minutes, ...p })], t);
  const bad = (p: Partial<RawPersonRow>, minutes = 60) => expect(() => one(p, minutes)).toThrow(PersonScheduleShapeError);

  it("aceita segundos, microssegundos e 24:00:00 como limite", () => {
    const s = one({ starts_at: "07:00:30", ends_at: "08:00:00" }, 60);
    expect(s.kind === "projetado" && s.blocks[0]!.startsAt).toBe("07:00:30");
    const u = one({ starts_at: "07:00:00.000001", ends_at: "08:00:00" }, 60);
    expect(u.kind === "projetado" && u.blocks[0]!.startsAt).toBe("07:00:00.000001");
    const z = one({ starts_at: "23:00:00", ends_at: "24:00:00" }, 60);
    expect(z.kind === "projetado" && z.blocks[0]!.endsAt).toBe("24:00");
  });

  it("arredondamento igual ao SQL numeric::integer", () => {
    expect(sqlRoundedMinutes(29_999_999)).toBe(0);
    expect(sqlRoundedMinutes(30_000_000)).toBe(1);
    expect(sqlRoundedMinutes(59.5 * 60_000_000)).toBe(60);
    expect(() => one({ starts_at: "07:00:00", ends_at: "07:00:29" }, 0)).not.toThrow();
    expect(() => one({ starts_at: "07:00:00", ends_at: "07:00:30" }, 1)).not.toThrow();
    expect(() => one({ starts_at: "07:00:00", ends_at: "07:59:30" }, 60)).not.toThrow();
    bad({ starts_at: "07:00:00", ends_at: "07:59:30" }, 59);
  });

  it("formatos inválidos, ordem inválida e minutos incoerentes falham", () => {
    for (const e of ["25:00", "24:01", "24:00:01", "24:00:00.000001", "07:60", "07:00:60", "07:00:00.1234567", "7:00"]) bad({ ends_at: e });
    bad({ starts_at: "08:00:00.5", ends_at: "08:00:00.4" }, 0);
    bad({ starts_at: "07:00:30", ends_at: "08:00:00" }, 59);
  });

  it("sobreposição só em segundos é detectada com precisão", () => {
    const a = blk({ starts_at: "07:00:00", ends_at: "08:00:00" });
    const b = blk({ block_id: "blk-9", block_key: "c1", class_id: "k3", starts_at: "07:59:30", ends_at: "09:00:00", block_minutes: 61 });
    const c = { ...nul, result_kind: "conflict", source_state: "conflito-temporal-potencial", block_id: "blk-1", other_block_id: "blk-9",
      class_id: "k1", other_class_id: "k3", weekday: 1, overlap_starts_at: "07:59:30", overlap_ends_at: "08:00:00" };
    const s = mapPersonScheduleRows([sum({ operational_block_count: 2, week_minutes: 121, conflict_count: 1 }), a, b, c], t);
    expect(s.kind === "projetado" && s.conflicts[0]!.overlapStartsAt).toBe("07:59:30");
    expect(() => mapPersonScheduleRows([sum({ operational_block_count: 2, week_minutes: 121, conflict_count: 1 }), a, b,
      { ...c, overlap_starts_at: "07:59:00" }], t)).toThrow(PersonScheduleShapeError);
  });

  it("exibição preserva precisão relevante e valid_on exige data exata", () => {
    expect(displayTime("07:00:00")).toBe("07:00"); expect(displayTime("07:00:00.000000")).toBe("07:00");
    expect(displayTime("07:00:30")).toBe("07:00:30"); expect(displayTime("07:00:00.250000")).toBe("07:00:00.25");
    render(wrap(<MyScheduleView schedule={one({ starts_at: "07:00:30", ends_at: "08:00:00" }, 60)} names={names} />));
    expect(screen.getByTestId("my-block").textContent).toContain("07:00:30–08:00");
    expect(() => mapPersonScheduleRows([{ ...nul, result_kind: "absent", valid_on: "2026-03-02T00:00:00" }], t)).toThrow(PersonScheduleShapeError);
    expect(() => mapPersonScheduleRows([{ ...nul, result_kind: "absent", valid_on: "2026-03-02x" }], t)).toThrow(PersonScheduleShapeError);
  });

  it("aviso de nomes não afirma confirmação global", () => {
    render(wrap(<MyScheduleView schedule={one({}, 60)} names={{ ...names, errors: ["x"] }} />));
    const w = screen.getByTestId("names-warning").textContent!;
    expect(w).not.toMatch(/confirmad/); expect(w).toContain("estado de cada bloco");
  });
});

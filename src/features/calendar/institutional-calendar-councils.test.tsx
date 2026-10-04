import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  aggregateCouncilAgenda, councilProposals, parseCouncilAgenda, parseCouncilConfiguration, recordCouncilConfiguration,
} from "./institutional-calendar-councils";
import { proposeAcademicStructure, writeAcademicStructure } from "./calendar-activation-assistant";
import { referenceCalendars2027 } from "./calendar-browser-import";

const E = { allocation: "a1", from: "2027-04-01", to: "2027-04-30" };
const lido = (days: unknown[]) => ({ contract: "b4.6.7f/1", state: "lido", authorizes: false, allocation: "a1", days });

describe("agenda de conselhos (servidor por alocação)", () => {
  it("lê itens declarados preservando efeito true/false/null", () => {
    const r = parseCouncilAgenda(lido([
      { on: "2027-04-23", state: "configurada", versionId: "v1", calendarId: "c1", dayResult: "letivo",
        items: [{ dayTypeId: "t", role: "Conselho de Classe", label: "CC 1º bim", schoolDayEffect: true }] },
      { on: "2027-04-24", state: "configurada", versionId: "v1", dayResult: "efeito-nao-declarado",
        items: [{ dayTypeId: "t2", role: "Conselho Final", label: null, schoolDayEffect: null }] },
    ]), E);
    expect(r.kind).toBe("lido");
    if (r.kind !== "lido") return;
    const a = aggregateCouncilAgenda([r]);
    expect(a.complete).toBe(true);
    expect(a.items.map((i) => i.schoolDayEffect)).toEqual([true, null]);
  });
  it("recusa formato inesperado, data fora do intervalo e efeito não booleano", () => {
    expect(parseCouncilAgenda({ ...lido([]), authorizes: true }, E).kind).toBe("malformada");
    expect(parseCouncilAgenda(lido([{ on: "2027-05-01", state: "pendente" }]), E).kind).toBe("malformada");
    expect(parseCouncilAgenda(lido([{ on: "2027-04-02", state: "configurada", versionId: "v", items: [{ dayTypeId: "t", role: "C", schoolDayEffect: 0 }] }]), E).kind).toBe("malformada");
    expect(parseCouncilAgenda({ contract: "b4.6.7f/1", state: "access-denied" }, E).kind).toBe("acesso-negado");
  });
  it("sem alocação, pendente ou não configurada nunca vira 'nenhum conselho'", () => {
    expect(aggregateCouncilAgenda([]).complete).toBe(false);
    const p = parseCouncilAgenda(lido([{ on: "2027-04-02", state: "nao-configurada", versionId: "v" }, { on: "2027-04-03", state: "pendente", dayResult: "sem-calendario-aplicavel" }]), E);
    const a = aggregateCouncilAgenda([p]);
    expect(a.complete).toBe(false);
    expect(a.gaps.length).toBe(2);
  });
  it("turma multietapa: itens de calendários diferentes ficam por quantidade de alocações, sem dominante", () => {
    const a = aggregateCouncilAgenda([
      parseCouncilAgenda(lido([{ on: "2027-04-23", state: "configurada", versionId: "v1", items: [{ dayTypeId: "t", role: "CC", label: null, schoolDayEffect: true }] }]), E),
      parseCouncilAgenda({ ...lido([{ on: "2027-04-23", state: "configurada", versionId: "v2", items: [] }]), allocation: "a2" }, { ...E, allocation: "a2" }),
    ]);
    expect(a.items).toEqual([{ on: "2027-04-23", role: "CC", label: null, schoolDayEffect: true, allocations: 1 }]);
  });
  it("configuração: declarar 'nenhum' é distinto de não configurado; incoerência recusada", () => {
    expect(parseCouncilConfiguration({ contract: "b4.6.7f/1", state: "nao-configurada" }).kind).toBe("nao-configurada");
    expect(parseCouncilConfiguration({ contract: "b4.6.7f/1", state: "configurada", declaresNone: true, roles: [] }).kind).toBe("configurada");
    expect(parseCouncilConfiguration({ contract: "b4.6.7f/1", state: "configurada", declaresNone: true, roles: [{ dayTypeId: "t", role: "C" }] }).kind).toBe("malformada");
  });
  it("proposta da fonte só via typeMap explícito; writer exige ato e papel", async () => {
    const m = councilProposals({ typeMap: { tv1: "CC", tv2: "L" }, dayTypeCatalog: { CC: { councilRole: "conselho-classe" }, L: { councilRole: null } } });
    expect([...m]).toEqual([["tv1", "conselho-classe"]]);
    const rpc = vi.fn(async () => ({ data: { recorded: true }, error: null }));
    await expect(recordCouncilConfiguration({ versionId: "v", roles: [], actRef: " " }, rpc)).rejects.toThrow();
    await expect(recordCouncilConfiguration({ versionId: "v", roles: [{ dayTypeId: "t", role: "", sourceProposal: null }], actRef: "a" }, rpc)).rejects.toThrow();
    await recordCouncilConfiguration({ versionId: "v", roles: [{ dayTypeId: "t", role: " CC ", sourceProposal: "x" }], actRef: "a" }, rpc);
    expect(rpc).toHaveBeenCalledWith("record_calendar_council_configuration", { _version_id: "v", _act_ref: "a", _roles: [{ dayTypeId: "t", role: "CC", sourceProposal: "x" }] });
  });
});

describe("assistente de ativação 2027 (B2.4 pelos writers donos)", () => {
  const regular = referenceCalendars2027()[0]!;
  it("propõe ano e períodos da fonte real, sem problemas", () => {
    const p = proposeAcademicStructure(regular);
    expect(p.problems).toEqual([]);
    expect(p.periods.length).toBe(regular.periods.length);
    expect(p.year.startsOn).toBe([...regular.periods].map((x) => x.start).sort()[0]);
    expect(p.year.name).toContain("2027");
  });
  it("grava em ordem ano → organização → períodos e retoma de onde parou", async () => {
    const p = proposeAcademicStructure(regular);
    const calls: string[] = []; let fail = true;
    const rpc = vi.fn(async (fn: string) => {
      calls.push(fn);
      if (fn === "register_academic_period_version" && fail && calls.filter((c) => c === fn).length === 2) { fail = false; return { data: null, error: { message: "period:overlap" } }; }
      return { data: `${fn}-${calls.length}`, error: null };
    });
    const first = await writeAcademicStructure({ proposal: p, existingYearId: null, validFrom: "2027-01-01", actRef: "ato", reason: "", progress: { yearId: null, orgId: null, periodIds: {} } }, rpc);
    expect(first.error).toBe("period:overlap");
    expect(Object.keys(first.progress.periodIds).length).toBe(1);
    const second = await writeAcademicStructure({ proposal: p, existingYearId: null, validFrom: "2027-01-01", actRef: "ato", reason: "", progress: first.progress }, rpc);
    expect(second.error).toBeNull();
    expect(calls.filter((c) => c === "register_academic_year_version").length).toBe(1);
    expect(calls.filter((c) => c === "register_period_organization_version").length).toBe(1);
    expect(Object.keys(second.progress.periodIds).length).toBe(p.periods.length);
  });
  it("sem ato nada é gravado; ano existente não é recriado", async () => {
    const p = proposeAcademicStructure(regular);
    const rpc = vi.fn(async (fn: string) => ({ data: fn, error: null }));
    expect((await writeAcademicStructure({ proposal: p, existingYearId: null, validFrom: "2027-01-01", actRef: "", reason: "", progress: { yearId: null, orgId: null, periodIds: {} } }, rpc)).error).toBe("form:act-required");
    expect(rpc).not.toHaveBeenCalled();
    await writeAcademicStructure({ proposal: p, existingYearId: "ano-x", validFrom: "2027-01-01", actRef: "a", reason: "", progress: { yearId: null, orgId: null, periodIds: {} } }, rpc);
    expect(rpc.mock.calls.some(([fn]) => fn === "register_academic_year_version")).toBe(false);
  });
});

// ---------- painel (sessão positiva/negativa) ----------
const agendaMock = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("@/features/diary/diary-calendar", async (orig) => ({
  ...(await orig<typeof import("@/features/diary/diary-calendar")>()),
  diaryCalendarScope: (classId: string | undefined) => (classId === "turma-1" ? { contextKey: "u#1", allocations: [{ id: "a1", from: null, until: null }] } : null),
}));
vi.mock("./institutional-calendar-councils", async (orig) => ({
  ...(await orig<typeof import("./institutional-calendar-councils")>()),
  readCouncilAgenda: (...a: unknown[]) => agendaMock.fn(...a),
}));
const { CouncilCalendarAgendaPanel } = await import("./institutional-calendar-notices");
const { setDiarySessionState } = await import("@/features/diary/diary-session-state");

afterEach(() => { cleanup(); setDiarySessionState({ phase: "sem-fronteira", key: null, userId: null }); agendaMock.fn.mockReset(); });
const ready = () => setDiarySessionState({ phase: "pronto", key: "u#1", userId: "u",
  reference: { validOn: "2027-04-10", knownAt: "2026-10-04T12:00:00Z", source: "informada", operationalToday: "2026-10-04" } });

describe("painel da agenda de conselhos", () => {
  it("positivo: mostra o conselho declarado com o efeito e preserva a ata existente", async () => {
    agendaMock.fn.mockResolvedValue(parseCouncilAgenda({ contract: "b4.6.7f/1", state: "lido", authorizes: false, allocation: "a1",
      days: [{ on: "2027-04-23", state: "configurada", versionId: "v", items: [{ dayTypeId: "t", role: "Conselho de Classe", label: "CC 1º bimestre", schoolDayEffect: true }] }] },
      { allocation: "a1", from: "2027-01-01", to: "2027-12-31" }));
    ready();
    render(<><article data-testid="ata">Ata encerrada em 09/04/2027</article><CouncilCalendarAgendaPanel classId="turma-1" /></>);
    await waitFor(() => expect(screen.getByTestId("council-calendar-agenda").textContent).toContain("2027-04-23 · Conselho de Classe — CC 1º bimestre · conta como dia letivo"));
    expect(agendaMock.fn).toHaveBeenCalledWith({ allocation: "a1", from: "2027-01-01", to: "2027-12-31", knownAt: "2026-10-04T12:00:00Z" });
    expect(screen.getByTestId("ata").textContent).toBe("Ata encerrada em 09/04/2027");
  });
  it("negativo: acesso negado e turma sem lista confirmada nunca mostram 'nenhum conselho'", async () => {
    agendaMock.fn.mockResolvedValue({ kind: "acesso-negado" });
    ready();
    render(<CouncilCalendarAgendaPanel classId="turma-1" />);
    await waitFor(() => expect(screen.getByTestId("council-calendar-agenda").textContent).toContain("a leitura foi negada"));
    expect(screen.getByTestId("council-calendar-agenda").textContent).not.toContain("Nenhum dia declarado");
    cleanup();
    render(<CouncilCalendarAgendaPanel classId="outra" />);
    expect(screen.getByTestId("council-calendar-agenda").textContent).toContain("ainda não foi confirmada");
    act(() => setDiarySessionState({ phase: "laboratorio", key: "laboratorio", userId: null }));
    expect(screen.queryByTestId("council-calendar-agenda")).toBeNull();
  });
});

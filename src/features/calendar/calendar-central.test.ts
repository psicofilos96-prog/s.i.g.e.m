import { describe, expect, it } from "vitest";
import { centralErrorText, homologateCentralCalendar, readCentralCalendars, saveCentralCalendar, type Rpc } from "./calendar-central";
import { referenceCalendars2027 } from "./calendar-browser-import";

const KNOWN = "2026-10-05T12:00:00.000000Z";
const v = (n: number, h: boolean) => ({
  versionId: `v${n}`, calendarId: "cal-1", version: n, validFrom: "2027-01-01", recordedAt: KNOWN, actId: `a${n}`,
  lastHomologation: h ? { recordId: `h${n}`, sequence: 1, decision: "homologada", effectiveFrom: "2027-01-01" } : null,
});
const editorCal = (id: string) => ({ id, title: `Cal ${id}`, year: 2027, status: "rascunho", periods: [] });

function mockRpc(audience: "construcao" | "homologados", versions: unknown[]): { rpc: Rpc; calls: [string, Record<string, unknown>][] } {
  const calls: [string, Record<string, unknown>][] = [];
  const rpc: Rpc = async (fn, args) => {
    calls.push([fn, args]);
    if (fn === "calendar_network_sources_at") return { data: { contract: "b4.6.10/1", state: "lido", knownAt: KNOWN, audience, sources: [{ sourceKey: "regular-2027", calendarId: "cal-1" }] }, error: null };
    if (fn === "calendar_list_at") return { data: { state: "lido", versions }, error: null };
    if (fn === "calendar_presentation_at") return { data: { state: "lido", snapshot: { presentation: { editorCalendar: editorCal(String(args["_version_id"])) } } }, error: null };
    return { data: null, error: { message: "unexpected" } };
  };
  return { rpc, calls };
}

describe("calendário central (cliente)", () => {
  it("construção abre a última versão salva e conserva o histórico completo", async () => {
    const { rpc } = mockRpc("construcao", [v(1, true), v(2, false)]);
    const r = await readCentralCalendars(rpc);
    if (r.kind !== "lido") throw new Error("esperado lido");
    const e = r.entries[0]!;
    expect(e.latest.versionId).toBe("v2");
    expect(e.homologated?.versionId).toBe("v1");
    expect(e.history.map((x) => x.version)).toEqual([1, 2]);
    expect(e.calendar.id).toBe("v2");
  });

  it("consulta comum abre só a homologada, em modo somente leitura (status homologado)", async () => {
    const { rpc, calls } = mockRpc("homologados", [v(1, true), v(2, false)]);
    const r = await readCentralCalendars(rpc);
    if (r.kind !== "lido") throw new Error("esperado lido");
    expect(r.entries[0]!.calendar.id).toBe("v1");
    expect(r.entries[0]!.calendar.status).toBe("homologado");
    expect(calls.some(([f, a]) => f === "calendar_presentation_at" && a["_version_id"] === "v2")).toBe(false);
  });

  it("sem homologada, a consulta comum não mostra rascunho", async () => {
    const { rpc } = mockRpc("homologados", [v(1, false)]);
    const r = await readCentralCalendars(rpc);
    expect(r.kind === "lido" && r.entries.length).toBe(0);
  });

  it("erro de leitura é erro visível, nunca lista vazia", async () => {
    const rpc: Rpc = async () => ({ data: null, error: { message: "boom" } });
    await expect(readCentralCalendars(rpc)).rejects.toThrow(/Leitura do banco falhou/);
  });

  it("salvar envia a base esperada e recusa base superada com texto claro", async () => {
    const cal = referenceCalendars2027()[0]!;
    let sent: Record<string, unknown> | null = null;
    const rpc: Rpc = async (_fn, args) => { sent = args; return { data: null, error: { message: "calendar:base-superseded" } }; };
    const err = await saveCentralCalendar({ cal, sourceKey: "regular-2027", expectedBaseVersionId: "v1", sourceKind: "edicao-institucional", reason: null }, rpc).catch((e) => e);
    expect(sent!["_expected_base_version_id"]).toBe("v1");
    expect(centralErrorText(err)).toMatch(/Outra versão foi salva/);
  });

  it("salvar sem aplicabilidade preserva a da base (não envia o campo)", async () => {
    const cal = referenceCalendars2027()[0]!;
    let payload: Record<string, unknown> = {};
    const rpc: Rpc = async (_fn, args) => { payload = args["_payload"] as Record<string, unknown>; return { data: { calendarId: "c", versionId: "v3", version: 3 }, error: null }; };
    const r = await saveCentralCalendar({ cal, sourceKey: "k", expectedBaseVersionId: "v2", sourceKind: "edicao-institucional", reason: null }, rpc);
    expect(r.version).toBe(3);
    expect("applicability" in payload).toBe(false);
    expect((payload["presentation"] as Record<string, unknown>)["editorCalendar"]).toBe(cal);
  });

  it("homologar envia a última decisão esperada e trata decisão repetida", async () => {
    let sent: Record<string, unknown> = {};
    const rpc: Rpc = async (_fn, args) => { sent = args; return { data: null, error: { message: "calendar-homologation:repeated-decision" } }; };
    const err = await homologateCentralCalendar({ versionId: "v2", expectedLastHomologationId: "h1" }, rpc).catch((e) => e);
    expect(sent["_expected_last_homologation_id"]).toBe("h1");
    expect(centralErrorText(err)).toMatch(/já está homologada/);
  });
});

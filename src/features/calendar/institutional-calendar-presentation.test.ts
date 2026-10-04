import { describe, expect, it } from "vitest";
import {
  buildPrintModel, composePresentation, parsePresentation, pendingPresentation, titleCollision,
} from "./institutional-calendar-presentation";
import { readBrowserCalendarsOnRequest } from "./calendar-browser-import";
import type { CalendarDayRead, DayDeclarationRow } from "./institutional-calendar-readers";

const row = (o: Partial<DayDeclarationRow>): DayDeclarationRow => ({
  declarationId: "d", dayState: "declarado", startsOn: null, endsOn: null, eventLabel: null, dayTypeId: "t", dayTypeVersionId: "tv-letivo",
  dayTypeVersion: 1, dayTypeLabel: "Letivo", schoolDayEffect: true, ...o,
} as DayDeclarationRow);
const day = (on: string, rows: DayDeclarationRow[] | null, state = "homologada"): CalendarDayRead => ({ on, state, rows });

describe("apresentação institucional", () => {
  it("parser estrito: chaves exatas, versão e digest", () => {
    expect(parsePresentation({ contract: "b4.6.7b/1", state: "sem-snapshot" }, "v").kind).toBe("sem-snapshot");
    expect(parsePresentation({ contract: "b4.6.7b/1", state: "access-denied", extra: 1 }, "v").kind).toBe("invalido");
    const snap = { versionId: "v", sourceKind: "edicao-institucional", sourceKey: null, sourceEntryId: null, sourceDigest: "a".repeat(64),
      presentation: { title: "Regular 2027" }, declaredNote: null, recordedAt: "2026-10-04T12:00:00.000001+00:00" };
    expect(parsePresentation({ contract: "b4.6.7b/1", state: "lido", snapshot: snap }, "v").kind).toBe("lido");
    expect(parsePresentation({ contract: "b4.6.7b/1", state: "lido", snapshot: snap }, "outra").kind).toBe("invalido");
    expect(parsePresentation({ contract: "b4.6.7b/1", state: "lido", snapshot: { ...snap, sourceDigest: "x" } }, "v").kind).toBe("invalido");
  });

  it("nova versão preserva simbologia/assinaturas/original da base e acrescenta vínculo de tipos", () => {
    const base = { title: "Regular 2027", symbology: { FE: { shape: "circulo" } }, signatures: ["Supervisão"], typeMap: { "tv-a": "FE" }, document: { x: 1 } };
    const p = composePresentation({ base, title: "Regular 2027", typeMap: { "tv-b": "RE" }, baseVersionId: "v1" });
    expect(p["symbology"]).toEqual(base.symbology); expect(p["signatures"]).toEqual(["Supervisão"]); expect(p["document"]).toEqual({ x: 1 });
    expect(p["typeMap"]).toEqual({ "tv-a": "FE", "tv-b": "RE" }); expect(p["derivedFromVersionId"]).toBe("v1");
  });

  it("títulos Regular/EJA distintos no mesmo ano; repetição bloqueia, outro ano não", () => {
    const others = [{ calendarId: "c1", academicYearId: "a27", title: "Calendário Regular 2027" }];
    expect(titleCollision("calendario regular 2027", "a27", "c2", others)).toBe(true);
    expect(titleCollision("Calendário EJA 2027", "a27", "c2", others)).toBe(false);
    expect(titleCollision("Calendário Regular 2027", "a28", "c2", others)).toBe(false);
    expect(titleCollision("Calendário Regular 2027", "a27", "c1", others)).toBe(false);
  });

  it("folha: dias e efeitos só das declarações; sem declaração nunca vira letivo; total indeterminado", () => {
    const pres = { title: "Regular 2027", typeMap: { "tv-letivo": "LE", "tv-fer": "FE" }, signatures: ["Supervisão"] };
    const days = [day("2027-04-20", [row({})]), day("2027-04-21", [row({ dayTypeVersionId: "tv-fer", dayTypeLabel: "Feriado", schoolDayEffect: false, eventLabel: "Tiradentes" })]),
      day("2027-04-22", [])];
    const m = buildPrintModel(pres, days, [{ name: "1º", startsOn: "2027-04-20", endsOn: "2027-04-21" }]);
    expect(m.months[0]!.days.map((d) => d.effect)).toEqual(["letivo", "nao-letivo", "sem-declaracao"]);
    expect(m.months[0]!.days[1]!.symbolCode).toBe("FE"); expect(m.months[0]!.days[1]!.label).toBe("Tiradentes");
    expect(m.periods[0]!.schoolDays).toBe(1);
    expect(m.total.schoolDays).toBeNull(); expect(m.signatures).toEqual(["Supervisão"]);
  });

  it("tipo sem vínculo visual é sinalizado, não inventado", () => {
    const m = buildPrintModel({ title: "T" }, [day("2027-05-01", [row({ dayTypeLabel: "Recesso", schoolDayEffect: false, dayTypeVersionId: "tv-x" })])], []);
    expect(m.months[0]!.days[0]!.symbolCode).toBeNull(); expect(m.unmappedTypes).toEqual(["Recesso"]);
  });

  it("anexo pendente guarda o pacote para nova tentativa e é limpo após sucesso", () => {
    pendingPresentation.reset();
    pendingPresentation.put({ versionId: "v", sourceKind: "importacao-navegador", sourceKey: "k", sourceEntryId: "e", digest: "a".repeat(64), raw: { a: 1 }, presentation: {}, note: null, lastError: "rede" });
    expect(pendingPresentation.get("v")?.raw).toEqual({ a: 1 });
    pendingPresentation.clear("v"); expect(pendingPresentation.get("v")).toBeNull();
  });

  it("exceção na leitura do navegador é erro, nunca ausência; JSON corrompido preserva o bruto", () => {
    expect(readBrowserCalendarsOnRequest(() => { throw new Error("SecurityError"); })).toEqual({ state: "erro-leitura", reason: "SecurityError" });
    const r = readBrowserCalendarsOnRequest(() => "{quebrado");
    expect(r.state).toBe("ilegivel"); expect(r.state === "ilegivel" && r.raw).toBe("{quebrado");
  });
});

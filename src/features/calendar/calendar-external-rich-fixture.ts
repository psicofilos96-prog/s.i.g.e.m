/**
 * BU.CAL.2 — Fixture rica (somente teste/evidência): ano 2027 inteiro da referência do código, com o
 * `typeMap` gravado na MESMA forma dos snapshots reais (código → versão do tipo) e conselhos configurados.
 * Não é fonte institucional; não é importada pela aplicação.
 */
import { buildImportPlan, referenceCalendars2027 } from "./calendar-browser-import";
import { buildPrintModel } from "./institutional-calendar-presentation";
import type { CalendarDayRead, DayDeclarationRow } from "./institutional-calendar-readers";
import type { CouncilConfiguration } from "./institutional-calendar-councils";
import type { CalendarPeriod } from "./calendar-types";

export function richFixture(index = 0) {
  const ref = referenceCalendars2027()[index]!;
  const plan = buildImportPlan(ref);
  const catalog = plan.presentation["dayTypeCatalog"] as Record<string, { countsAsSchoolDay: boolean | null; kind: string | null; councilRole?: string }>;
  const tv = (code: string) => `tv-${code}`;
  const days: CalendarDayRead[] = plan.days.map((d) => {
    const kind = catalog[d.code]?.kind;
    const row: DayDeclarationRow = {
      dayState: "declarado", versionId: "ver-rica", referenceIssue: null, homologationState: "homologada",
      declarationKind: d.label || kind === "feriado" ? "evento" : "intervalo", declarationId: `decl-${d.day}`, startsOn: d.day, endsOn: d.day,
      eventLabel: d.label, dayTypeId: `t-${d.code}`, dayTypeVersionId: tv(d.code), dayTypeVersion: 1,
      dayTypeLabel: (plan.presentation["dayTypeCatalog"] as Record<string, { label: string }>)[d.code]?.label ?? d.code,
      schoolDayEffect: catalog[d.code]?.countsAsSchoolDay ?? null,
    };
    return { on: d.day, state: "homologada", rows: [row] };
  });
  // forma real dos snapshots: código → versão (+ entradas de período que não são tipo)
  const typeMap: Record<string, string> = Object.fromEntries(Object.keys(catalog).map((c) => [c, tv(c)]));
  typeMap["period:per-x"] = "per-y";
  const presentation: Record<string, unknown> = {
    ...plan.presentation, title: index === 0 ? "Calendário Regular 2027" : ref.title, typeMap,
    document: { ...(plan.presentation["document"] as object), headerLines: ["PREFEITURA MUNICIPAL DE ITAPERUNA", "SECRETARIA MUNICIPAL DE EDUCAÇÃO"], showHolidays: true },
  };
  const periods = (ref.periods as CalendarPeriod[]).map((p) => ({ name: p.name, startsOn: p.start, endsOn: p.end }));
  const councilCodes = Object.entries(catalog).filter(([, t]) => t.councilRole).map(([c]) => c);
  const council: CouncilConfiguration = { kind: "configurada", declaresNone: false, actRef: "ato", roles: councilCodes.map((c) => ({ dayTypeId: `t-${c}`, role: c, sourceProposal: null })) } as CouncilConfiguration;
  const usedCodes = [...new Set(plan.days.map((d) => d.code))];
  return { plan, days, presentation, periods, council, usedCodes, rawModel: buildPrintModel(presentation, days, periods) };
}

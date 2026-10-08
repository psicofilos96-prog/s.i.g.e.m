import { operationalMonthKey } from "@/lib/academic-date";
import { governError } from "@/lib/observability/governed-errors";
import { Fragment, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MAPA_ESTATISTICO, NETWORK_BRANDING, mapaRows } from "@/features/reports/report-registry";
import { runReport, toCsv as reportCsv, toXlsx } from "@/features/reports/report-engine";
import { getNetworkProjection } from "./network-projection.functions";
import { MapRuleAdmin } from "./map-rule-admin";
import {
  HEADER_LINES, MAP_TITLE, MEASURE_KEYS, MEASURE_LABEL, display, monthLabel, networkTotal,
  type Measure, type MonthWindow, type SchoolProjection,
} from "./network-projection";
import { MONTH_NAMES } from "@/lib/format-ptbr";

type Result = { window: MonthWindow; scope: string; schools: SchoolProjection[]; authorized: boolean; coverage: null | { official: string[]; unreadable: boolean } };

function download(name: string, blob: Blob) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

function Records({ m }: { m: Measure }) {
  if (m.state === "nao-disponivel") return <p className="text-xs text-muted-foreground">Fonte não disponível para sua conta.</p>;
  if (!m.records.length) return <p className="text-xs text-muted-foreground">Nenhum registro.</p>;
  return <ul className="max-h-40 overflow-auto font-mono text-xs">{m.records.map((r) => <li key={r}>{r}</li>)}</ul>;
}

const MONTHS = MONTH_NAMES;

export function NetworkProjectionPage() {
  const fetchProjection = useServerFn(getNetworkProjection);
  const [year, setYear] = useState(() => Number(operationalMonthKey().slice(0, 4)));
  const [month, setMonth] = useState(() => Number(operationalMonthKey().slice(5, 7)));
  const [refDate, setRefDate] = useState("");
  const [knownAt, setKnownAt] = useState("");
  const [district, setDistrict] = useState("");
  const [school, setSchool] = useState("");
  const [situation, setSituation] = useState<"" | "oficial" | "aguardando">("");
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ title: string; m: Measure } | null>(null);

  async function load() {
    setBusy(true); setErr(null); setDetail(null);
    try {
      setRes(await fetchProjection({ data: { year, month, ...(refDate ? { referenceDate: refDate } : {}),
        knownAt: knownAt ? new Date(knownAt).toISOString() : null } }) as Result);
    } catch (e) { { const g = governError(e); setErr(`${g.userMessage} Código: ${g.correlationId}.`); } } finally { setBusy(false); }
  }

  const districts = useMemo(() => [...new Set((res?.schools ?? []).map((s) => s.district).filter((d): d is string => !!d))].sort(), [res]);
  const official = new Set(res?.coverage?.official ?? []);
  const isOfficial = (id: string) => official.has(id);
  const shown = (res?.schools ?? []).filter((s) => (!district || s.district === district) && (!school || s.schoolId === school)
    && (!situation || (situation === "oficial") === isOfficial(s.schoolId)));
  const total = res?.schools.length ?? 0;
  const done = (res?.schools ?? []).filter((s) => isOfficial(s.schoolId)).length;

  function report() {
    const w = res!.window;
    const result = runReport(MAPA_ESTATISTICO, { params: { year: w.year, month: w.month, referenceDate: w.referenceDate, knownAt: w.knownAt } }, mapaRows(shown));
    const meta = [monthLabel(w), `Data de referência: ${w.referenceDate}`, `Conhecido até: ${w.knownAt ?? "momento da consulta"}`];
    return { result, meta };
  }
  async function exportXlsx() {
    if (!res) return;
    const { result, meta } = report();
    download(`mapa-${res.window.year}-${res.window.month}.xlsx`, new Blob([await toXlsx(result, NETWORK_BRANDING, meta)]));
  }
  function exportCsv() {
    if (!res) return;
    const { result, meta } = report();
    download(`mapa-${res.window.year}-${res.window.month}.csv`, new Blob([reportCsv(result, NETWORK_BRANDING, meta)], { type: "text/csv;charset=utf-8" }));
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="CIECE — visão da rede" title="Mapa Estatístico da rede"
        description="Totais calculados na hora a partir dos registros oficiais de matrícula, participação, turma e movimentação. Cada número abre os registros que o compõem." />

      <section aria-label="Filtros" className="grid gap-3 sm:grid-cols-5">
        <label className="text-sm">Ano<Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></label>
        <label className="text-sm">Mês
          <select className="mt-1 block h-9 w-full rounded-md border border-input bg-background px-2" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select></label>
        <label className="text-sm">Data de referência (padrão: último dia)<Input placeholder="aaaa-mm-dd" value={refDate} onChange={(e) => setRefDate(e.target.value)} /></label>
        <label className="text-sm">Conhecido até (opcional)<Input placeholder="aaaa-mm-ddThh:mm" value={knownAt} onChange={(e) => setKnownAt(e.target.value)} /></label>
        <div className="flex items-end"><Button onClick={load} disabled={busy}>{busy ? "Calculando…" : "Consultar"}</Button></div>
      </section>
      {err ? <p role="alert" className="text-sm text-destructive">{err}</p> : null}

      {res && !res.authorized ? <EmptyState title="Sem permissão" description="Sua atuação não tem a permissão de consultar o Mapa Estatístico em nenhuma escola nem na rede." /> : null}
      {res && res.authorized && res.schools.length === 0 ? <EmptyState title="Nenhuma escola no seu alcance" description="Não há escolas cadastradas no alcance da sua permissão. Nenhuma escola é criada para demonstrar." /> : null}

      {res && res.schools.length > 0 ? (
        <>
          {!res.coverage?.unreadable ? (
            <section aria-label="Andamento da rede" className="rounded-2xl border border-border bg-card p-5 shadow-panel print:hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-semibold">Andamento de {monthLabel(res.window)}</h2>
                <p className="text-sm text-muted-foreground"><strong className="text-2xl text-foreground">{done}</strong> de {total} escola(s) com Mapa oficializado</p>
              </div>
              <Progress className="mt-3" value={total ? (done / total) * 100 : 0} aria-label="Escolas com Mapa oficializado" />
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
                {([["", `Todas (${total})`], ["aguardando", `Aguardando Mapa oficial (${total - done})`], ["oficial", `Oficializadas (${done})`]] as const).map(([v, l]) => (
                  <Button key={v} size="sm" variant={situation === v ? "default" : "outline"} aria-pressed={situation === v} onClick={() => setSituation(v)}>{l}</Button>))}
              </div>
            </section>
          ) : null}
          <div className="flex flex-wrap items-end gap-3 print:hidden">
            {districts.length ? (
              <label className="text-sm">Distrito
                <select className="ml-2 rounded-md border border-input bg-background p-2" value={district} onChange={(e) => setDistrict(e.target.value)}>
                  <option value="">Todos</option>{districts.map((d) => <option key={d}>{d}</option>)}
                </select></label>
            ) : <p className="text-xs text-muted-foreground">Filtro de distrito indisponível: nenhuma escola tem distrito registrado.</p>}
            <label className="text-sm">Escola
              <select className="ml-2 rounded-md border border-input bg-background p-2" value={school} onChange={(e) => setSchool(e.target.value)}>
                <option value="">Todas</option>{res.schools.map((s) => <option key={s.schoolId} value={s.schoolId}>{s.schoolName ?? s.schoolId}</option>)}
              </select></label>
            <Button variant="outline" onClick={exportCsv}>CSV</Button>
            <Button variant="outline" onClick={exportXlsx}>XLSX</Button>
            <Button variant="outline" onClick={() => window.print()}>PDF / imprimir</Button>
          </div>

          <header className="text-center text-sm">
            {HEADER_LINES.map((l) => <p key={l}>{l}</p>)}
            <p className="mt-2 text-lg font-semibold">{MAP_TITLE}</p>
            <p className="font-semibold">Projeção dinâmica — não oficial. {res.coverage?.unreadable ? "Cobertura oficial não pôde ser lida." : `${res.coverage?.official.length ?? 0} de ${res.schools.length} escola(s) com Mapa oficializado nesta competência; as demais não têm Mapa oficial.`}</p>
            <p>{monthLabel(res.window)} · referência {res.window.referenceDate}{res.window.knownAt ? ` · conhecido até ${res.window.knownAt}` : ""}</p>
          </header>

          <div className="overflow-x-auto">
            <table className="w-full text-sm"><caption className="sr-only">Projeção da rede por escola</caption>
              <thead><tr className="border-b border-border text-left">
                <th scope="col" className="p-2">Escola</th><th scope="col" className="p-2 print:hidden">Situação</th>{MEASURE_KEYS.map((k) => <th key={k} className="p-2">{MEASURE_LABEL[k]}</th>)}
              </tr></thead>
              <tbody>
                {shown.map((s) => (
                  <Fragment key={s.schoolId}>
                    <tr className="border-b border-border">
                      <td className="p-2">
                        <button className="text-left underline" aria-expanded={open === s.schoolId} onClick={() => setOpen(open === s.schoolId ? null : s.schoolId)}>
                          {s.schoolName ?? "nome não informado"}</button>
                        <p className="text-xs text-muted-foreground">{s.district ?? "distrito não informado"}</p>
                      </td>
                      <td className="p-2 print:hidden">{isOfficial(s.schoolId)
                        ? <Badge>Oficializado</Badge>
                        : <Badge variant="outline">Aguardando</Badge>}</td>
                      {MEASURE_KEYS.map((k) => (
                        <td key={k} className="p-2">
                          <button className={s[k].state === "disponivel" ? "underline" : "italic text-muted-foreground"}
                            onClick={() => setDetail({ title: `${s.schoolName ?? s.schoolId} — ${MEASURE_LABEL[k]}`, m: s[k] })}>{display(s[k].value)}</button>
                        </td>
                      ))}
                    </tr>
                    {open === s.schoolId ? (
                      <tr><td colSpan={MEASURE_KEYS.length + 2} className="bg-muted/40 p-3">
                        {s.classRows == null ? <p className="text-xs">Turmas não disponíveis.</p> : s.classRows.length === 0 ? <p className="text-xs">Nenhuma turma registrada.</p> : (
                          <table className="text-xs"><thead><tr><th scope="col" className="p-1 text-left">Turma</th><th scope="col" className="p-1">Alocados</th><th scope="col" className="p-1">Entradas no mês</th><th scope="col" className="p-1">Saídas no mês</th></tr></thead>
                            <tbody>{s.classRows.map((c) => (
                              <tr key={c.classId}><td className="p-1">{c.className ?? `${c.classId} (sem cadastro vigente)`}</td>
                                {(["allocated", "enteredInMonth", "leftInMonth"] as const).map((k) => (
                                  <td key={k} className="p-1 text-center"><button className="underline" onClick={() => setDetail({ title: `${c.className ?? c.classId} — ${k}`, m: c[k] })}>{display(c[k].value)}</button></td>))}
                              </tr>))}</tbody></table>
                        )}
                        {s.movementsByType?.length ? <p className="mt-2 text-xs">Movimentações por tipo: {s.movementsByType.map((t) => `${t.typeId}: ${t.measure.value}`).join(" · ")}</p> : null}
                      </td></tr>
                    ) : null}
                  </Fragment>
                ))}
                <tr className="font-semibold">
                  <td className="p-2">Rede</td><td className="print:hidden" />
                  {MEASURE_KEYS.map((k) => { const t = networkTotal(shown, k); return (
                    <td key={k} className="p-2">{display(t.value)}{t.missingSchools.length ? <span className="block text-xs font-normal text-muted-foreground">{t.missingSchools.length} escola(s) sem dado</span> : null}</td>); })}
                </tr>
              </tbody>
            </table>
          </div>
          <Sheet open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle>De onde veio este valor</SheetTitle>
                <SheetDescription>{detail?.title}</SheetDescription>
              </SheetHeader>
              {detail ? (
                <div className="mt-4 space-y-3 text-sm">
                  <p className="font-display text-3xl font-semibold">{display(detail.m.value)}</p>
                  <p className="text-muted-foreground">Calculado agora a partir dos registros oficiais de matrícula, turma e movimentação. Nada foi digitado à mão. Registros que formam este número:</p>
                  <Records m={detail.m} />
                </div>
              ) : null}
            </SheetContent>
          </Sheet>
        </>
      ) : null}
      <MapRuleAdmin />
    </div>
  );
}

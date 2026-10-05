import { Fragment, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getNetworkProjection } from "./network-projection.functions";
import {
  HEADER_LINES, MAP_TITLE, MEASURE_KEYS, MEASURE_LABEL, display, exportRows, monthLabel, networkTotal, toCsv,
  type Measure, type MonthWindow, type SchoolProjection,
} from "./network-projection";

type Result = { window: MonthWindow; scope: string; schools: SchoolProjection[]; authorized: boolean };

function download(name: string, blob: Blob) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

function Records({ m }: { m: Measure }) {
  if (m.state === "nao-disponivel") return <p className="text-xs text-muted-foreground">Fonte não disponível para sua conta.</p>;
  if (!m.records.length) return <p className="text-xs text-muted-foreground">Nenhum registro.</p>;
  return <ul className="max-h-40 overflow-auto font-mono text-xs">{m.records.map((r) => <li key={r}>{r}</li>)}</ul>;
}

export function NetworkProjectionPage() {
  const fetchProjection = useServerFn(getNetworkProjection);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [refDate, setRefDate] = useState("");
  const [knownAt, setKnownAt] = useState("");
  const [district, setDistrict] = useState("");
  const [school, setSchool] = useState("");
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
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  const districts = useMemo(() => [...new Set((res?.schools ?? []).map((s) => s.district).filter((d): d is string => !!d))].sort(), [res]);
  const shown = (res?.schools ?? []).filter((s) => (!district || s.district === district) && (!school || s.schoolId === school));

  async function exportXlsx() {
    if (!res) return;
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Mapa");
    [...HEADER_LINES, MAP_TITLE, monthLabel(res.window), `Data de referência: ${res.window.referenceDate}`].forEach((l) => ws.addRow([l]));
    ws.addRow([]); exportRows(shown).forEach((r) => ws.addRow(r));
    download(`mapa-${res.window.year}-${res.window.month}.xlsx`, new Blob([await wb.xlsx.writeBuffer()]));
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="CIECE — visão da rede" title="Mapa Estatístico da rede"
        description="Totais calculados na hora a partir dos registros oficiais de matrícula, participação, turma e movimentação. Cada número abre os registros que o compõem." />

      <section aria-label="Filtros" className="grid gap-3 sm:grid-cols-5">
        <label className="text-sm">Ano<Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></label>
        <label className="text-sm">Mês<Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} /></label>
        <label className="text-sm">Data de referência (padrão: último dia)<Input placeholder="aaaa-mm-dd" value={refDate} onChange={(e) => setRefDate(e.target.value)} /></label>
        <label className="text-sm">Conhecido até (opcional)<Input placeholder="aaaa-mm-ddThh:mm" value={knownAt} onChange={(e) => setKnownAt(e.target.value)} /></label>
        <div className="flex items-end"><Button onClick={load} disabled={busy}>{busy ? "Calculando…" : "Consultar"}</Button></div>
      </section>
      {err ? <p role="alert" className="text-sm text-destructive">{err}</p> : null}

      {res && !res.authorized ? <EmptyState title="Sem permissão" description="Sua atuação não tem a permissão de consultar o Mapa Estatístico em nenhuma escola nem na rede." /> : null}
      {res && res.authorized && res.schools.length === 0 ? <EmptyState title="Nenhuma escola no seu alcance" description="Não há escolas cadastradas no alcance da sua permissão. Nenhuma escola é criada para demonstrar." /> : null}

      {res && res.schools.length > 0 ? (
        <>
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
            <Button variant="outline" onClick={() => download(`mapa-${year}-${month}.csv`, new Blob([toCsv(res.window, exportRows(shown))], { type: "text/csv;charset=utf-8" }))}>CSV</Button>
            <Button variant="outline" onClick={exportXlsx}>XLSX</Button>
            <Button variant="outline" onClick={() => window.print()}>PDF / imprimir</Button>
          </div>

          <header className="text-center text-sm">
            {HEADER_LINES.map((l) => <p key={l}>{l}</p>)}
            <p className="mt-2 text-lg font-semibold">{MAP_TITLE}</p>
            <p>{monthLabel(res.window)} · referência {res.window.referenceDate}{res.window.knownAt ? ` · conhecido até ${res.window.knownAt}` : ""}</p>
          </header>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left">
                <th className="p-2">Escola</th>{MEASURE_KEYS.map((k) => <th key={k} className="p-2">{MEASURE_LABEL[k]}</th>)}
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
                      {MEASURE_KEYS.map((k) => (
                        <td key={k} className="p-2">
                          <button className={s[k].state === "disponivel" ? "underline" : "italic text-muted-foreground"}
                            onClick={() => setDetail({ title: `${s.schoolName ?? s.schoolId} — ${MEASURE_LABEL[k]}`, m: s[k] })}>{display(s[k].value)}</button>
                        </td>
                      ))}
                    </tr>
                    {open === s.schoolId ? (
                      <tr><td colSpan={MEASURE_KEYS.length + 1} className="bg-muted/40 p-3">
                        {s.classRows == null ? <p className="text-xs">Turmas não disponíveis.</p> : s.classRows.length === 0 ? <p className="text-xs">Nenhuma turma registrada.</p> : (
                          <table className="text-xs"><thead><tr><th className="p-1 text-left">Turma</th><th className="p-1">Alocados</th><th className="p-1">Entradas no mês</th><th className="p-1">Saídas no mês</th></tr></thead>
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
                  <td className="p-2">Rede</td>
                  {MEASURE_KEYS.map((k) => { const t = networkTotal(shown, k); return (
                    <td key={k} className="p-2">{display(t.value)}{t.missingSchools.length ? <span className="block text-xs font-normal text-muted-foreground">{t.missingSchools.length} escola(s) sem dado</span> : null}</td>); })}
                </tr>
              </tbody>
            </table>
          </div>
          {detail ? (
            <section aria-label="Registros que compõem o total" className="rounded-md border border-border p-3 print:hidden">
              <div className="flex justify-between"><h2 className="text-sm font-semibold">{detail.title}</h2><Button size="sm" variant="outline" onClick={() => setDetail(null)}>Fechar</Button></div>
              <Records m={detail.m} />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

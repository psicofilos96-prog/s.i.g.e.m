import { useState } from "react";
import { callRpc } from "@/lib/rpc-call";
import { monthBounds } from "@/lib/academic-date";
import { institution } from "@/config/institution";
import { runReport, toPrintableHtml, toXlsx, fingerprint } from "@/features/reports/report-engine";
import { Button } from "@/components/ui/button";
import { REFEICOES_PNAE, servedMealsRows, servedMealsTotals, type ExecRow } from "./served-meals-report";

const field = "mt-1 block w-full rounded border bg-background p-2";

/** Relatório PNAE de apoio por escola e mês (PDF A4 / XLSX). */
export function ServedMealsPanel({ school, schoolName, slots }: { school: string; schoolName: string; slots: { value_id: string; label: string }[] }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (fmt: "pdf" | "xlsx") => {
    setMsg(null);
    if (!/^\d{4}-\d{2}$/.test(month)) { setMsg("Informe o mês como AAAA-MM."); return; }
    const { from, to } = monthBounds(month);
    let data: ExecRow[];
    try { data = await callRpc<ExecRow[]>("meal_executions_at", { _school: school, _from: from, _to: to, _known_at: null }); }
    catch { setMsg("Sem permissão ou falha ao ler o Diário da Cozinha."); return; }
    const rows = servedMealsRows(data ?? [], (v) => slots.find((s) => s.value_id === v)?.label ?? v);
    const t = servedMealsTotals(rows);
    const result = runReport(REFEICOES_PNAE, { params: { from, to } }, rows);
    const miss = (m: number) => (m ? ` (${m} registro(s) sem informação)` : "");
    const meta = [`Escola: ${schoolName}`, `Período: ${from} a ${to}`, `Dias com registro: ${t.days}`,
      `Total bruto: ${t.total.sum}${miss(t.total.missing)}`, `1ª refeição a alunos: ${t.first.sum}${miss(t.first.missing)}`,
      `Repetições: ${t.repeats.sum}${miss(t.repeats.missing)} · Servidores: ${t.staff.sum}${miss(t.staff.missing)}`,
      `Adesão do período: ${t.adhesion == null ? "não informado (faltam contagens)" : `${t.adhesion}%`}`,
      "Demonstrativo de apoio; não é transmissão ao FNDE."];
    const branding = { headerLines: [institution.governmentName, institution.departmentName, "Núcleo de Alimentação Escolar — SIGEM"], title: REFEICOES_PNAE.title, logoUrl: new URL(institution.emblemUrl, window.location.href).href };
    if (fmt === "xlsx") {
      const buf = await toXlsx(result, branding, meta);
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })); a.download = `refeicoes-${school}-${month}.xlsx`; a.click();
      return;
    }
    const w = window.open("", "_blank"); if (!w) { setMsg("O navegador bloqueou a janela de impressão."); return; }
    w.document.write(toPrintableHtml(result, branding, meta, await fingerprint(result))); w.document.close(); w.focus(); w.print();
  };
  return (
    <section className="space-y-2 rounded border p-3 text-sm">
      <h2 className="font-semibold">Refeições servidas e adesão (PNAE)</h2>
      <label className="block max-w-xs">Mês<input className={field} value={month} onChange={(e) => setMonth(e.target.value)} placeholder="AAAA-MM" /></label>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void run("pdf")}>PDF A4</Button><Button variant="outline" onClick={() => void run("xlsx")}>XLSX</Button></div>
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { callRpc } from "@/lib/rpc-call";
import { operationalToday } from "@/lib/academic-date";
import { institution } from "@/config/institution";
import { downloadBlob, runReport, toPdfFile, toXlsx } from "@/features/reports/report-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/sigem/patterns";
import { compareClasses } from "@/features/classes/class-stage-order";
import { filterListing, LISTING_COLUMNS, listingReport, listingRows, type ListingColumn, type ListingRow } from "./student-listing";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Listagens de alunos da própria escola: escolha colunas e filtros e baixe em Excel ou PDF. */
export function StudentListingPage() {
  const [rows, setRows] = useState<ListingRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cols, setCols] = useState<ListingColumn[]>(["numero", "nome", "nascimento", "turma"]);
  const [f, setF] = useState({ classId: "", birthMonth: "", search: "", noCpf: false });
  const [title, setTitle] = useState("Lista de alunos");
  useEffect(() => { callRpc<ListingRow[]>("secretariat_own_student_listing", {}).then((r) => setRows(r ?? []), () => setErr("Não foi possível carregar os alunos.")); }, []);
  const classes = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows ?? []) if (r.class_id) m.set(r.class_id, r.class_label ?? r.class_id);
    return [...m].sort((a, b) => compareClasses({ name: a[1] }, { name: b[1] }));
  }, [rows]);
  const shown = useMemo(() => filterListing(rows ?? [], f), [rows, f]);
  const toggle = (c: ListingColumn) => setCols((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));
  const exportFile = async (kind: "pdf" | "xlsx") => {
    const rep = runReport(listingReport(cols, title), { params: {} }, listingRows(shown, operationalToday()));
    const brand = { headerLines: [institution.governmentName, institution.departmentName], title };
    const meta = [`${shown.length} aluno(s)`, `Emitida em ${operationalToday().split("-").reverse().join("/")}`];
    const name = title.normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase();
    if (kind === "xlsx") return downloadBlob(`${name}.xlsx`, new Blob([await toXlsx(rep, brand, meta)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    downloadBlob(`${name}.pdf`, await toPdfFile(rep, brand, meta));
  };
  const sel = "mt-1 block w-full rounded-md border border-input bg-background p-2";
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <PageHeader eyebrow="Secretaria" title="Listagens de alunos" description="Escolha as colunas e os filtros. Só aparecem alunos com matrícula ativa na escola." />
      <div className="grid gap-3 rounded-md border border-border bg-card p-4 text-sm sm:grid-cols-4">
        <label className="sm:col-span-2">Título da lista<Input className="mt-1" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label>Turma<select className={sel} value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })}>
          <option value="">Todas</option>{classes.map(([id, l]) => <option key={id} value={id}>{l}</option>)}<option value="sem-turma">Sem turma</option></select></label>
        <label>Mês de nascimento<select className={sel} value={f.birthMonth} onChange={(e) => setF({ ...f, birthMonth: e.target.value })}>
          <option value="">Todos</option>{MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}</select></label>
        <label className="sm:col-span-2">Buscar nome<Input className="mt-1" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} /></label>
        <label className="flex items-center gap-2 self-end"><input type="checkbox" checked={f.noCpf} onChange={(e) => setF({ ...f, noCpf: e.target.checked })} />Só sem CPF</label>
        <fieldset className="sm:col-span-4"><legend className="mb-1 font-medium">Colunas</legend>
          <div className="flex flex-wrap gap-3">{LISTING_COLUMNS.map((c) => (
            <label key={c.id} className="flex items-center gap-1"><input type="checkbox" checked={cols.includes(c.id)} onChange={() => toggle(c.id)} />{c.label}</label>))}</div>
        </fieldset>
        <div className="flex gap-2 sm:col-span-4">
          <Button disabled={!rows || cols.length === 0 || shown.length === 0} onClick={() => void exportFile("pdf")}>Baixar PDF</Button>
          <Button variant="outline" disabled={!rows || cols.length === 0 || shown.length === 0} onClick={() => void exportFile("xlsx")}>Baixar Excel</Button>
        </div>
      </div>
      {err && <p role="status" className="text-sm text-destructive">{err}</p>}
      {rows === null && !err ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
        <div className="overflow-x-auto rounded-md border border-border">
          <p className="p-2 text-sm text-muted-foreground">{shown.length} aluno(s)</p>
          <table className="w-full text-sm">
            <thead><tr>{LISTING_COLUMNS.filter((c) => cols.includes(c.id)).map((c) => <th key={c.id} className="border-t border-border p-2 text-left">{c.label}</th>)}</tr></thead>
            <tbody>{listingRows(shown.slice(0, 300), operationalToday()).map((r) => (
              <tr key={r.numero}>{LISTING_COLUMNS.filter((c) => cols.includes(c.id)).map((c) => <td key={c.id} className="border-t border-border p-2">{String(r[c.id] ?? "")}</td>)}</tr>))}</tbody>
          </table>
          {shown.length > 300 && <p className="p-2 text-xs text-muted-foreground">A tela mostra os primeiros 300; o arquivo baixado traz todos.</p>}
        </div>)}
    </div>
  );
}

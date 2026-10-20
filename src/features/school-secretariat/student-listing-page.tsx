import { LoadingState } from "@/components/sigem/states";
import { useEffect, useMemo, useState } from "react";
import { operationalToday } from "@/lib/academic-date";
import { institution } from "@/config/institution";
import { downloadBlob, runReport, toPdfFile, toXlsx } from "@/features/reports/report-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/sigem/patterns";
import { compareClasses } from "@/features/classes/class-stage-order";
import { paginate, readPages } from "@/lib/list-paging";
import { supabase } from "@/integrations/supabase/client";
import { useOwnSchoolId } from "@/features/authority/own-school";
import { filterListing, LISTING_COLUMNS, listingReport, listingRows, type ListingColumn, type ListingRow } from "./student-listing";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Listagens de alunos da própria escola: escolha colunas e filtros e baixe em Excel ou PDF. */
export function StudentListingPage() {
  const own = useOwnSchoolId();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ListingRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cols, setCols] = useState<ListingColumn[]>(["numero", "nome", "nascimento", "turma"]);
  const [f, setF] = useState({ classId: "", birthMonth: "", search: "", noCpf: false });
  const [title, setTitle] = useState("Lista de alunos");
  useEffect(() => {
    if (!own) return;
    let active = true;
    setRows(null); setErr(null);
    void readPages((from, to) => supabase.rpc("secretariat_own_student_listing").order("student_name").order("student_id").range(from, to).abortSignal(AbortSignal.timeout(15000)), 20000)
      .then((r) => { if (!active) return; if (r.error || r.truncated) { setErr("Não foi possível consultar a lista completa. Tente novamente."); return; } setRows((r.data ?? []) as ListingRow[]); });
    return () => { active = false; };
  }, [own]);
  const classes = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows ?? []) if (r.class_id) m.set(r.class_id, r.class_label ?? r.class_id);
    return [...m].sort((a, b) => compareClasses({ name: a[1] }, { name: b[1] }));
  }, [rows]);
  const shown = useMemo(() => filterListing(rows ?? [], f), [rows, f]);
  const paged = paginate(shown, page, 100);
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
      {!err && (rows === null ? <LoadingState label="Carregando…" /> : (
        <div className="overflow-x-auto rounded-md border border-border">
          <p className="p-2 text-sm text-muted-foreground">{shown.length} aluno(s)</p>
          <table className="w-full text-sm">
            <thead><tr>{LISTING_COLUMNS.filter((c) => cols.includes(c.id)).map((c) => <th key={c.id} scope="col" className="border-t border-border p-2 text-left">{c.label}</th>)}</tr></thead>
            <tbody>{listingRows(shown, operationalToday()).slice(paged.from ? paged.from - 1 : 0, paged.to).map((r) => (
              <tr key={r.numero}>{LISTING_COLUMNS.filter((c) => cols.includes(c.id)).map((c) => <td key={c.id} className="border-t border-border p-2">{String(r[c.id] ?? "")}</td>)}</tr>))}</tbody>
          </table>
          {paged.pageCount > 1 && <nav aria-label="Páginas da lista" className="flex items-center justify-between gap-2 p-2"><Button variant="outline" disabled={paged.page === 1} onClick={() => setPage(paged.page - 1)}>Anterior</Button><span className="text-sm">{paged.from}–{paged.to} de {paged.total}</span><Button variant="outline" disabled={paged.page === paged.pageCount} onClick={() => setPage(paged.page + 1)}>Próxima</Button></nav>}
        </div>))}
    </div>
  );
}

import { operationalToday } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { institution } from "@/config/institution";
import { runReport, toCsv, toXlsx } from "@/features/reports/report-engine";
import { secretariatMessage } from "./secretariat";
import { SchoolContextPicker, useSchoolContext } from "./school-context";
import { inepOf, readEnrollmentBook, readVacancies } from "./vacancies-book-source";
import {
  bookPrintHtml, bookReportRows, ENROLLMENT_BOOK_REPORT, filterBook, VACANCY_LABEL, vacancySummary,
  type BookFilter, type BookRow, type VacancyRow,
} from "./vacancies-book";

const today = () => operationalToday();
const errText = (e: unknown) => secretariatMessage(e instanceof Error ? e.message : String(e));
const TONE = { "ha-vaga": "success", lotada: "warning", "capacidade-nao-informada": "neutral" } as const;

export function VacanciesPage() {
  const ctx = useSchoolContext();
  const [on, setOn] = useState(today());
  const [rows, setRows] = useState<VacancyRow[] | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!ctx.school || !ctx.year) return;
    setRows(null); setErr(null);
    readVacancies(ctx.school, ctx.year, on).then(setRows, (e) => setErr(errText(e)));
  }, [ctx.school, ctx.year, on]);
  const sum = rows ? vacancySummary(rows) : null;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Secretaria Escolar" title="Vagas" description="Capacidade e ocupação das turmas da sua escola. Sem capacidade informada, não há número de vagas." />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2"><SchoolContextPicker ctx={ctx} /></div>
        <label className="text-sm">Data de referência<DateInput value={on} onChange={(e) => setOn(e.target.value)} /></label>
      </div>
      {!ctx.school || !ctx.year ? <EmptyState title="Escolha a escola e o ano" description="As vagas são sempre de uma escola e de um ano." />
        : err ? <StatePanel tone="danger" title="Não foi possível ler as vagas" description={err} />
        : rows === null ? <SkeletonState label="Carregando" />
        : rows.length === 0 ? <EmptyState title="Nenhuma turma ativa para este ano" description="Turmas são cadastradas em Turmas → Nova turma." />
        : (
          <>
            <section aria-label="Resumo" className="grid gap-3 sm:grid-cols-4">
              <Box label="Turmas ativas" value={String(sum!.classes)} />
              <Box label="Lotadas" value={String(sum!.full)} />
              <Box label="Sem capacidade informada" value={String(sum!.unknownCapacity)} />
              <Box label="Vagas (turmas com capacidade)" value={sum!.availableKnown == null ? "Não informada" : String(sum!.availableKnown)} />
            </section>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <li key={r.class_id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{r.name}</p>
                    <StatusBadge tone={TONE[r.vacancy_state]}>{VACANCY_LABEL[r.vacancy_state]}</StatusBadge>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.shift_label ?? "Turno não informado"}</p>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <div><dt className="text-xs text-muted-foreground">Capacidade</dt><dd className="tabular-nums">{r.capacity ?? "Não informada"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Enturmados</dt><dd className="tabular-nums">{r.occupancy}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Vagas</dt><dd className="tabular-nums">{r.available ?? "—"}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Lista de espera e solicitações de vaga ainda não existem: a rede não definiu critério de prioridade.</p>
          </>
        )}
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-display text-2xl font-semibold tabular-nums">{value}</p></div>;
}

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function EnrollmentBookPage() {
  const ctx = useSchoolContext();
  const [rows, setRows] = useState<BookRow[] | null>(null); const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<BookFilter>({ text: "", classLabel: "", situation: "" });
  const [knownAt] = useState(() => new Date().toISOString());
  useEffect(() => {
    if (!ctx.school || !ctx.year) return;
    setRows(null); setErr(null);
    readEnrollmentBook(ctx.school, ctx.year, knownAt).then(setRows, (e) => setErr(errText(e)));
  }, [ctx.school, ctx.year, knownAt]);
  const shown = useMemo(() => (rows ? filterBook(rows, f) : []), [rows, f]);
  const classes = useMemo(() => [...new Set((rows ?? []).map((r) => r.class_label).filter((x): x is string => !!x))].sort(), [rows]);
  const fileBase = `livro-matricula-${ctx.yearLabel || "ano"}`.replace(/\s+/g, "-");
  const header = [institution.governmentName, institution.departmentName];
  const report = () => runReport(ENROLLMENT_BOOK_REPORT, { params: {} }, bookReportRows(shown));
  const meta = [`${ctx.schoolName} — ano letivo ${ctx.yearLabel}`, "Ordem cronológica de registro; não é numeração oficial."];
  const print = () => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(bookPrintHtml({ school: ctx.schoolName, inep: inepOf(ctx.school), year: ctx.yearLabel, knownAt: new Date(knownAt).toLocaleString("pt-BR"), header }, shown));
    w.document.close(); w.focus(); w.print();
  };
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Secretaria Escolar" title="Livro de Matrícula" description="Registro das matrículas da escola no ano letivo, lido diretamente das matrículas oficiais." />
      <SchoolContextPicker ctx={ctx} />
      {!ctx.school || !ctx.year ? <EmptyState title="Escolha a escola e o ano" description="O Livro é sempre de uma escola e de um ano letivo." />
        : err ? <StatePanel tone="danger" title="Não foi possível ler o Livro" description={err} />
        : rows === null ? <SkeletonState label="Carregando" />
        : (
          <>
            <section aria-label="Pesquisar" className="grid gap-3 sm:grid-cols-4">
              <label className="text-sm sm:col-span-2">Estudante ou código<Input className="mt-1" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Nome ou código SIGEM" /></label>
              <label className="text-sm">Turma
                <select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={f.classLabel} onChange={(e) => setF({ ...f, classLabel: e.target.value })}>
                  <option value="">Todas</option>{classes.map((c) => <option key={c}>{c}</option>)}
                </select></label>
              <label className="text-sm">Situação
                <select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={f.situation} onChange={(e) => setF({ ...f, situation: e.target.value as "" | "ativa" | "encerrada" })}>
                  <option value="">Todas</option><option value="ativa">Ativa</option><option value="encerrada">Encerrada</option>
                </select></label>
            </section>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={print} disabled={!shown.length}>Imprimir Livro (PDF)</Button>
              <Button variant="outline" disabled={!shown.length} onClick={() => download(`${fileBase}.csv`, toCsv(report(), { headerLines: header, title: "Livro de Matrícula" }, meta), "text/csv;charset=utf-8")}>Baixar planilha (CSV)</Button>
              <Button variant="outline" disabled={!shown.length} onClick={async () => download(`${fileBase}.xlsx`, await toXlsx(report(), { headerLines: header, title: "Livro de Matrícula" }, meta), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}>Baixar Excel</Button>
              <span className="text-sm text-muted-foreground">{shown.length} de {rows.length} matrícula(s)</span>
            </div>
            {shown.length === 0 ? <EmptyState title="Nenhuma matrícula encontrada" description="Mude a pesquisa ou o ano letivo." /> : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left"><tr>
                    <th className="p-2">Ordem</th><th className="p-2">Estudante</th><th className="p-2">Código SIGEM</th><th className="p-2">Data</th>
                    <th className="p-2">Turma</th><th className="p-2">Situação</th><th className="p-2">Encerramento</th></tr></thead>
                  <tbody>{bookReportRows(shown).map((r, i) => (
                    <tr key={shown[i]!.enrollment_id} className="border-t border-border">
                      <td className="p-2 tabular-nums">{r.ordem}</td><td className="p-2">{r.estudante ?? "Não disponível"}</td>
                      <td className="p-2">{r.codigo ?? "Não disponível"}</td><td className="p-2">{r.data ?? "Não disponível"}</td>
                      <td className="p-2">{r.turma}</td><td className="p-2">{r.situacao}</td><td className="p-2">{r.encerramento ?? ""}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground">A ordem é cronológica de registro no SIGEM e não é a numeração oficial do Livro: a rede ainda não definiu essa regra.</p>
          </>
        )}
    </div>
  );
}

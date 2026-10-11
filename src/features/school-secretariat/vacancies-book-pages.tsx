import { operationalToday, formatDateTime } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { institution } from "@/config/institution";
import { downloadBlob, runReport, toCsv, toPdfFile, toXlsx } from "@/features/reports/report-engine";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { secretariatMessage } from "./secretariat";
import { SchoolContextPicker, useSchoolContext } from "./school-context";
import { inepOf, readEnrollmentBook, readVacancies } from "./vacancies-book-source";
import {
  bookReportRows, ENROLLMENT_BOOK_REPORT, filterBook, VACANCY_LABEL, vacancySummary,
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
  const [editing, setEditing] = useState<string | null>(null);
  const reload = () => { setRows(null); readEnrollmentBook(ctx.school, ctx.year, new Date().toISOString()).then(setRows, (e) => setErr(errText(e))); };
  // Arquivo PDF A4 com cabeçalho, todas as linhas e assinaturas; não é página web impressa.
  const print = async () => downloadBlob(`${fileBase}.pdf`, await toPdfFile(report(), { headerLines: header, title: `Livro de Matrícula — ${ctx.schoolName}` },
    [...meta, `INEP ${inepOf(ctx.school) ?? "não informado"} · Situação em ${formatDateTime(knownAt)}`], { signatures: BOOK_SIGNATURES }));
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
              <Button onClick={() => void print()} disabled={!shown.length}>Imprimir Livro (PDF)</Button>
              <Button variant="outline" disabled={!shown.length} onClick={() => download(`${fileBase}.csv`, toCsv(report(), { headerLines: header, title: "Livro de Matrícula" }, meta), "text/csv;charset=utf-8")}>Baixar planilha (CSV)</Button>
              <Button variant="outline" disabled={!shown.length} onClick={async () => download(`${fileBase}.xlsx`, await toXlsx(report(), { headerLines: header, title: "Livro de Matrícula" }, meta), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}>Baixar Excel</Button>
              <span className="text-sm text-muted-foreground">{shown.length} de {rows.length} matrícula(s)</span>
            </div>
            {shown.length === 0 ? <EmptyState title="Nenhuma matrícula encontrada" description="Mude a pesquisa ou o ano letivo." /> : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left"><tr>
                    <th scope="col" className="p-2">Ordem</th><th scope="col" className="p-2">Estudante</th><th scope="col" className="p-2">Código SIGEM</th><th scope="col" className="p-2">Data</th>
                    <th scope="col" className="p-2">Turma</th><th scope="col" className="p-2">Situação</th><th scope="col" className="p-2">Encerramento</th><th scope="col" className="p-2"><span className="sr-only">Ações</span></th></tr></thead>
                  <tbody>{bookReportRows(shown).map((r, i) => (
                    <tr key={shown[i]!.enrollment_id} className="border-t border-border">
                      <td className="p-2 tabular-nums">{r.ordem}</td><td className="p-2">{r.estudante ?? "Não disponível"}</td>
                      <td className="p-2">{r.codigo ?? "Não disponível"}</td><td className="p-2">{r.data ?? "Não disponível"}</td>
                      <td className="p-2">{r.turma}</td><td className="p-2">{r.situacao}</td><td className="p-2">{r.encerramento ?? ""}</td>
                      <td className="p-2"><Button size="sm" variant="outline" aria-expanded={editing === shown[i]!.enrollment_id}
                        onClick={() => setEditing(editing === shown[i]!.enrollment_id ? null : shown[i]!.enrollment_id)}>{editing === shown[i]!.enrollment_id ? "Fechar" : "Editar"}</Button></td>
                    </tr>))}</tbody>
                </table>
              </div>
            )}
            {editing && (() => { const row = shown.find((x) => x.enrollment_id === editing); return row
              ? <BookRowEditor key={editing} school={ctx.school} row={row} onDone={() => { setEditing(null); reload(); }} /> : null; })()}
            <p className="text-xs text-muted-foreground">A ordem é cronológica de registro no SIGEM e não é a numeração oficial do Livro: a rede ainda não definiu essa regra.</p>
          </>
        )}
    </div>
  );
}

export const BOOK_SIGNATURES = ["Secretário(a) Escolar", "Diretor(a)"] as const;

/** Editar no Livro = corrigir o fato que o Livro lê, pelo writer próprio (declaração de início, append-only, motivo, base esperada).
 * Turma e encerramento mudam pela Estação da Secretaria; o Livro nunca grava linha própria. */
function BookRowEditor({ school, row, onDone }: { school: string; row: BookRow; onDone: () => void }) {
  const [start, setStart] = useState(row.opened_on ?? ""); const [reason, setReason] = useState(""); const [src, setSrc] = useState("");
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const rpc = supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  async function save() {
    setMsg(null);
    if (!start) { setMsg("Informe a data de início."); return; }
    if (reason.trim().length < 5) { setMsg("Informe o motivo (ao menos 5 caracteres)."); return; }
    setBusy(true);
    try {
      const q = row.institutional_number ?? row.student_name ?? "";
      const look = await rpc("secretariat_enrollment_lookup", { _school: school, _query: q, _on: new Date().toISOString().slice(0, 10) });
      if (look.error) throw new Error(look.error.message);
      const hit = ((look.data ?? []) as { enrollment_id: string; declaration_head: string | null }[]).find((h) => h.enrollment_id === row.enrollment_id);
      if (!hit) throw new Error("secretariat:not-found");
      const r = await rpc("secretariat_declare_enrollment_start", { _enrollment: row.enrollment_id, _start_on: start, _expected_head: hit.declaration_head, _reason: reason.trim(), _source_ref: src.trim() || null });
      if (r.error) throw new Error(r.error.message);
      onDone();
    } catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
  }
  return (
    <section aria-label="Editar matrícula do Livro" className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="font-semibold">Editar — {row.student_name ?? "estudante"}</h2>
      <p className="text-sm text-muted-foreground">A correção vira nova versão com motivo e autoria; a anterior fica no histórico. Troca de turma, transferência e encerramento são feitos na Estação da Secretaria.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Data de início da matrícula<Input type="date" className="mt-1" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="text-sm">Motivo<Input className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <label className="text-sm">Documento de origem (opcional)<Input className="mt-1" value={src} onChange={(e) => setSrc(e.target.value)} placeholder="ex.: ficha de matrícula" /></label>
      </div>
      {msg && <p role="alert" className="text-sm text-destructive">{msg}</p>}
      <div className="flex gap-2"><Button disabled={busy} onClick={() => void save()}>Salvar correção</Button>
        <Button variant="outline" asChild><Link to="/secretaria">Abrir Estação da Secretaria</Link></Button></div>
    </section>
  );
}

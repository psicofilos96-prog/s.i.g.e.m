import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { confirmAction } from "@/components/sigem/confirm-action";
import { formatAcademicDateNumeric } from "@/lib/academic-date";
import { listInstitutionalClasses } from "@/features/classes/institutional-class-source";
import { locateStudent, locateStudentByName, readCandidates, readYears, recordDecision, type YearOption } from "@/features/year-transition/year-transition-source";
import { normalizeStudentLookup } from "@/features/year-transition/year-transition";
import { eligibleClassOptions, secretariatMessage, type ClassOption } from "./secretariat";
import { emitTransferDeclaration, readDeath, readTransferHistory, receiveTransfer, recordDeath, recordRenewalTerm, type DeathRow, type HistoryRow } from "./movement-source";
import { downloadBlob, renewalTermPdf, transferDeclarationPdf } from "./movement-pdf";
import { groupRenewal, renewalFingerprint, type RenewalCandidate } from "./movement-docs";
import { loadSchoolHeader } from "./enrollment-form/source";

const errText = (e: unknown) => secretariatMessage(e instanceof Error ? e.message : String(e));
const d = (s: string | null) => (s ? formatAcademicDateNumeric(s as never) : "—");

/** Gera (ou reimprime) a Declaração Provisória de Transferência de uma matrícula encerrada por transferência. */
export function TransferDeclarationButton({ enrollment }: { enrollment: string }) {
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
        setBusy(true); setMsg(null);
        try { const f = await emitTransferDeclaration(enrollment); downloadBlob(transferDeclarationPdf(f), `declaracao-transferencia-${f.number}-${f.issue_year}.pdf`); setMsg(`Declaração emitida, válida até ${d(f.valid_until)}.`); }
        catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
      }}>Baixar Declaração de Transferência</Button>
      {msg ? <span role="status" className="text-xs">{msg}</span> : null}
    </span>
  );
}

/** Receber transferência: busca exata, ficha histórica e troca de escola numa única operação. */
export function ReceiveTransferPanel({ school, year, on }: { school: string; year: string; on: string }) {
  const [cpf, setCpf] = useState(""); const [name, setName] = useState(""); const [birth, setBirth] = useState("");
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const [hist, setHist] = useState<HistoryRow[] | null>(null); const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState(""); const [date, setDate] = useState(on); const [msg, setMsg] = useState<string | null>(null);
  const [idem, setIdem] = useState(() => crypto.randomUUID()); const [busy, setBusy] = useState(false);
  useEffect(() => { listInstitutionalClasses({ validOn: on }).then((l) => setClasses(eligibleClassOptions(l, school, year)), () => setClasses([])); }, [school, year, on]);

  async function search() {
    setMsg(null); setStudent(null); setHist(null);
    try {
      if (cpf.trim()) {
        const v = normalizeStudentLookup("cpf", cpf); if (!v) { setMsg("CPF inválido."); return; }
        const r = await locateStudent(school, "cpf", v, year);
        if (r.outcome !== "encontrado" || !r.student_id) { setMsg("Nenhum aluno com este CPF."); return; }
        setStudent({ id: r.student_id, name: r.display_name ?? "Estudante" });
        setHist(await readTransferHistory(school, r.student_id));
      } else {
        if (name.trim().split(/\s+/).length < 2 || !birth) { setMsg("Informe nome completo E data de nascimento."); return; }
        const r = (await locateStudentByName(school, name.trim(), birth)).filter((m) => m.birth_date === birth);
        if (r.length !== 1) { setMsg(r.length ? "Mais de um aluno com esse nome e nascimento. Use o CPF." : "Nenhum aluno com esse nome e nascimento."); return; }
        setStudent({ id: r[0]!.student_id, name: r[0]!.display_name });
        setHist(await readTransferHistory(school, r[0]!.student_id));
      }
    } catch (e) { setMsg(errText(e)); }
  }
  async function confirm() {
    if (!student || !classId) return;
    const cls = classes.find((c) => c.id === classId)?.name ?? "";
    if (!(await confirmAction({ title: "Receber transferência", consequence: `${student.name} sai da escola de origem na véspera de ${d(date)} e entra na turma ${cls} desta escola.`, actionLabel: "Receber" }))) return;
    setBusy(true); setMsg(null);
    try {
      const r = await receiveTransfer({ student: student.id, school, year, classId, on: date, idem });
      setMsg(`Transferência recebida${r.origin_school_name ? ` de ${r.origin_school_name}` : ""}. Matrícula aberta nesta escola.`);
      setIdem(crypto.randomUUID()); setHist(await readTransferHistory(school, student.id));
    } catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
  }
  return (
    <section aria-labelledby="receber" className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 id="receber" className="font-semibold">Receber transferência</h2>
      <p className="text-sm text-muted-foreground">Busque pelo CPF, ou pelo nome completo junto com a data de nascimento.</p>
      <div className="flex flex-wrap gap-2">
        <Input aria-label="CPF" placeholder="CPF" inputMode="numeric" className="max-w-[12rem]" value={cpf} onChange={(e) => setCpf(e.target.value)} />
        <span className="self-center text-sm text-muted-foreground">ou</span>
        <Input aria-label="Nome completo" placeholder="Nome completo" className="max-w-xs" value={name} onChange={(e) => setName(e.target.value)} />
        <DateInput aria-label="Data de nascimento" value={birth} onChange={(e) => setBirth(e.target.value)} />
        <Button onClick={() => void search()}>Buscar</Button>
      </div>
      {student && hist ? (
        <div className="space-y-3 text-sm">
          <p className="font-medium">{student.name}</p>
          {hist.length ? (
            <table className="w-full text-left text-xs"><thead><tr className="text-muted-foreground"><th>Escola</th><th>Ano</th><th>Turma</th><th>Início</th><th>Fim</th><th>Situação</th></tr></thead>
              <tbody>{hist.map((h) => <tr key={h.enrollment_id} className="border-t border-border"><td>{h.school_name ?? h.school_id}</td><td>{h.year_label}</td><td>{h.classes}</td><td>{d(h.opened_on)}</td><td>{d(h.ended_on)}</td><td>{h.ending ?? "Ativa"}</td></tr>)}</tbody></table>
          ) : <p className="text-muted-foreground">Sem matrícula anterior na rede.</p>}
          <div className="flex flex-wrap items-end gap-2">
            <label>Turma de destino
              <select className="mt-1 block rounded-md border border-input bg-background p-2" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Escolha</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label>Data de entrada<DateInput value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <Button disabled={!classId || busy} onClick={() => void confirm()}>Confirmar transferência</Button>
          </div>
        </div>) : null}
      {msg ? <p role="status" className="text-sm">{msg}</p> : null}
    </section>
  );
}

/** Registro de óbito: certidão + data; encerra a matrícula e bloqueia o aluno para sempre. */
export function DeathRecordPanel({ enrollment, student, onDone }: { enrollment: string | null; student: string; onDone: () => void }) {
  const [rec, setRec] = useState<DeathRow | null | undefined>(undefined);
  const [cert, setCert] = useState(""); const [date, setDate] = useState(""); const [note, setNote] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { readDeath(student).then(setRec, () => setRec(null)); }, [student]);
  if (rec === undefined) return null;
  if (rec) return <p className="rounded-md border border-destructive/40 p-3 text-sm">Óbito registrado em {d(rec.died_on)} — certidão {rec.certificate_number}. Matrícula bloqueada definitivamente.</p>;
  if (!enrollment) return null;
  async function save() {
    if (!(await confirmAction({ title: "Registrar óbito", consequence: "A matrícula será encerrada e o aluno ficará bloqueado para sempre. Isso não pode ser desfeito.", actionLabel: "Continuar", destructive: true }))) return;
    if (!(await confirmAction({ title: "Tem certeza?", consequence: `Confirme a certidão ${cert.trim()} e a data ${d(date)}.`, actionLabel: "Registrar óbito", destructive: true }))) return;
    try { await recordDeath({ enrollment: enrollment!, certificate: cert.trim(), diedOn: date, note }); setRec(await readDeath(student)); onDone(); }
    catch (e) { setMsg(errText(e)); }
  }
  return (
    <details className="rounded-md border border-border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Registrar óbito</summary>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label>Nº da certidão de óbito<Input value={cert} onChange={(e) => setCert(e.target.value)} /></label>
        <label>Data do falecimento<DateInput value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="grow">Observação<Input value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <Button variant="destructive" disabled={!cert.trim() || !date} onClick={() => void save()}>Registrar óbito</Button>
      </div>
      {msg ? <p role="status" className="mt-2">{msg}</p> : null}
    </details>
  );
}

/** Rematrícula em lote: prévia, seleção, confirmação única e Termo de Renovação. */
export function RenewalBatchPanel({ school }: { school: string }) {
  const [years, setYears] = useState<YearOption[]>([]); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [rows, setRows] = useState<RenewalCandidate[] | null>(null); const [fp, setFp] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set()); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { readYears().then(setYears, () => setYears([])); }, []);
  async function load() {
    setMsg(null);
    try { const r = (await readCandidates(school, from, to)) as unknown as RenewalCandidate[]; setRows(r); setFp(renewalFingerprint(r)); setSel(new Set(groupRenewal(r).prontos.map((x) => x.student_id))); }
    catch (e) { setMsg(errText(e)); }
  }
  async function confirm() {
    if (!rows) return;
    if (!(await confirmAction({ title: "Confirmar rematrícula", consequence: `${sel.size} aluno(s) serão renovados para o novo ano, sem turma.`, actionLabel: "Renovar" }))) return;
    setBusy(true);
    const fresh = (await readCandidates(school, from, to)) as unknown as RenewalCandidate[];
    if (renewalFingerprint(fresh) !== fp) { setBusy(false); setRows(fresh); setFp(renewalFingerprint(fresh)); setMsg("A lista mudou desde a prévia. Confira de novo e confirme."); return; }
    const ok: string[] = []; const bad: string[] = [];
    for (const r of rows.filter((x) => sel.has(x.student_id))) {
      try { await recordDecision({ school, student: r.student_id, fromYear: from, toYear: to, decision: "renovou", expected: r.decision_sequence ?? 0, declaredOn: null, reason: "Rematrícula em lote" }); ok.push(r.display_name); }
      catch (e) { bad.push(`${r.display_name}: ${errText(e)}`); }
    }
    setBusy(false); setMsg(`Renovados: ${ok.length}. Recusados: ${bad.length}.${bad.length ? " " + bad.join("; ") : ""}`); await load();
  }
  async function terms() {
    if (!rows) return;
    const done = groupRenewal(rows).renovados; const yl = years.find((y) => y.id === to)?.label ?? null;
    const h = await loadSchoolHeader(school).catch(() => null);
    for (const r of done) if (r.resulting_enrollment_id) await recordRenewalTerm({ enrollment: r.resulting_enrollment_id, grade: null, image: null, address: null }).catch(() => null);
    downloadBlob(renewalTermPdf(h?.school ?? null, done.map((r) => ({ studentName: r.display_name, yearLabel: yl, grade: null, image: null, address: null }))), `termos-renovacao-${yl ?? to}.pdf`);
  }
  const g = rows ? groupRenewal(rows) : null;
  const yearSel = (v: string, set: (s: string) => void, label: string) => (
    <label>{label}<select className="mt-1 block rounded-md border border-input bg-background p-2" value={v} onChange={(e) => set(e.target.value)}>
      <option value="">Escolha</option>{years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}</select></label>);
  return (
    <section aria-labelledby="rematricula" className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
      <h2 id="rematricula" className="font-semibold">Rematrícula em lote</h2>
      <div className="flex flex-wrap items-end gap-2">
        {yearSel(from, setFrom, "Do ano")}{yearSel(to, setTo, "Para o ano")}
        <Button disabled={!from || !to || from === to} onClick={() => void load()}>Ver lista</Button>
      </div>
      {g ? (<>
        <p>Prontos: {g.prontos.length} · Já renovados: {g.renovados.length} · Exceções: {g.excecoes.length}</p>
        <ul className="max-h-72 divide-y divide-border overflow-auto rounded-md border border-border">
          {g.prontos.map((r) => (
            <li key={r.student_id} className="p-2"><label className="flex items-center gap-2">
              <input type="checkbox" checked={sel.has(r.student_id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(r.student_id); else n.delete(r.student_id); setSel(n); }} />{r.display_name}</label></li>))}
          {g.excecoes.map((r) => <li key={r.student_id} className="p-2 text-muted-foreground">{r.display_name} — exceção ({r.decision})</li>)}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!sel.size || busy} onClick={() => void confirm()}>Confirmar rematrícula ({sel.size})</Button>
          <Button variant="outline" disabled={!g.renovados.length} onClick={() => void terms()}>Baixar Termos de Renovação ({g.renovados.length})</Button>
        </div>
      </>) : null}
      {msg ? <p role="status">{msg}</p> : null}
    </section>
  );
}

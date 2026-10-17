import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { formatAcademicDateNumeric } from "@/lib/academic-date";
import { downloadBlob } from "@/features/reports/report-engine";
import { CONSENT_MESSAGES, CONSENT_TERMS, currentConsents, DECISION_LABEL, type ConsentDecision, type ConsentRow, type ConsentTerm } from "./consent-terms";
import { consentTermPdf } from "./consent-term-pdf";

const msgOf = (e: unknown): string => {
  const m = e instanceof Error ? e.message : String(e);
  const k = Object.keys(CONSENT_MESSAGES).find((x) => m.includes(x));
  return (k && CONSENT_MESSAGES[k]) || "Não foi possível registrar. Tente de novo.";
};
const d = (s: string) => formatAcademicDateNumeric(s as never);

/** Termos do cadastro na ficha do aluno: imprimir para assinar e registrar a resposta real do responsável. */
export function ConsentPanel({ school, student, studentName, schoolName }: { school: string; student: string; studentName: string; schoolName: string }) {
  const [rows, setRows] = useState<ConsentRow[] | null>(null);
  async function load() {
    const { data, error } = await supabase.from("student_consent_events").select("term_key,term_version,sequence,decision,guardian_name,declared_on")
      .eq("school_id", school).eq("student_id", student);
    setRows(error ? [] : ((data ?? []) as ConsentRow[]));
  }
  useEffect(() => { void load(); }, [school, student]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows) return null;
  const cur = currentConsents(rows);
  return (
    <details className="rounded-md border border-border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Termos e autorizações</summary>
      <ul className="mt-2 space-y-3">
        {CONSENT_TERMS.map((t) => <TermRow key={t.key} t={t} state={cur.get(t.key)!} school={school} student={student} studentName={studentName} schoolName={schoolName} onDone={load} />)}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Sem resposta registrada, o termo fica "não respondido" — nunca vale como autorizado.</p>
    </details>
  );
}

function TermRow({ t, state, school, student, studentName, schoolName, onDone }: {
  t: ConsentTerm; state: { row: ConsentRow | null; outdated: boolean }; school: string; student: string; studentName: string; schoolName: string; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<ConsentDecision | "">("");
  const [guardian, setGuardian] = useState(""); const [date, setDate] = useState(""); const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const r = state.row;
  const save = async () => {
    setMsg(null);
    try {
      await callRpc("secretariat_record_consent", { _school: school, _student: student, _term: t.key, _version: t.version, _decision: decision, _guardian: guardian, _declared_on: date, _note: note || null, _expected_sequence: r?.sequence ?? 0 });
      setOpen(false); setDecision(""); setNote(""); onDone();
    } catch (e) { setMsg(msgOf(e)); }
  };
  return (
    <li className="rounded-md border border-border p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{t.title}</p>
          <p className="text-muted-foreground">{r ? `${DECISION_LABEL[r.decision]} — ${r.guardian_name}, ${d(r.declared_on)}` : "Não respondido"}{state.outdated ? " · texto do termo mudou: peça nova assinatura" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={async () => downloadBlob(`termo-${t.key}.pdf`, await consentTermPdf(t, { school: schoolName, student: studentName }))}>Imprimir termo</Button>
          <Button size="sm" onClick={() => setOpen((v) => !v)}>{open ? "Fechar" : "Registrar resposta"}</Button>
        </div>
      </div>
      {open && (
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <label>Resposta
            <select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={decision} onChange={(e) => setDecision(e.target.value as ConsentDecision)}>
              <option value="">Escolha</option>
              {t.decisions.filter((x) => x !== "revogado" || r).map((x) => <option key={x} value={x}>{DECISION_LABEL[x]}</option>)}
            </select></label>
          <label>Responsável que assinou<Input className="mt-1" value={guardian} onChange={(e) => setGuardian(e.target.value)} /></label>
          <label>Data da assinatura<DateInput value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Observação<Input className="mt-1" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="sm:col-span-4"><Button size="sm" disabled={!decision || guardian.trim().length < 5 || !date} onClick={() => void save()}>Salvar resposta</Button></div>
          {msg && <p role="status" className="sm:col-span-4 text-destructive">{msg}</p>}
        </div>
      )}
    </li>
  );
}

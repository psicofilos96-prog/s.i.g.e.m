import { operationalToday, formatDateTime } from "@/lib/academic-date";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { Button } from "@/components/ui/button";
import { fmtDate } from "./family-portal";
import { CARD_KIND_LABEL, CARD_STATE_LABEL, cardMessage, projectCardChain, validateCardDraft, verifyUrlFor, type CardChainView, type CardDraft } from "./card-issuance";
import { readCardChain, recordCard } from "./card-issuance-source";
import { locateStudentForGuardian, type StudentLookup } from "./guardian-admin-source";
import { StudentCardView } from "./student-card-view";

const db = supabase as unknown as { from: (t: string) => any };
const today = () => operationalToday();

/** Secretaria: emite, reemite e cancela carteirinhas. Permissão e regras são do banco; a tela só coleta. */
export function CardAdminPage() {
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [school, setSchool] = useState("");
  const [chain, setChain] = useState<CardChainView[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [open, setOpen] = useState<string | null>(null);
  const [sKind, setSKind] = useState<"cpf" | "inep">("cpf");
  const [sValue, setSValue] = useState("");
  const [student, setStudent] = useState<StudentLookup | null>(null);
  const [draft, setDraft] = useState<CardDraft>({ kind: "emissao", validUntil: "", reason: "", year: today().slice(0, 4) });
  const [classLabel, setClassLabel] = useState("");

  useEffect(() => {
    void db.from("institutional_school_record_versions").select("school_id, official_name, version_number").then((r: { data: { school_id: string; official_name: string; version_number: number }[] | null }) => {
      const last = new Map<string, { n: number; name: string }>();
      for (const x of r.data ?? []) { const c = last.get(x.school_id); if (!c || c.n < x.version_number) last.set(x.school_id, { n: x.version_number, name: x.official_name }); }
      setSchools([...last].map(([id, v]) => ({ id, name: v.name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    });
  }, []);

  async function reload(s = school) {
    if (!s) return;
    try { setChain(projectCardChain(await readCardChain(s), today())); setErr(null); }
    catch (e) { setChain(null); setErr(cardMessage((e as Error).message)); }
  }
  useEffect(() => { setChain(null); setStudent(null); void reload(school); }, [school]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(fn: () => Promise<unknown>, ok: string) {
    if (inFlight.current) return; // clique duplo não grava duas vezes
    inFlight.current = true; setBusy(true); setNotice(null); setErr(null);
    try { await fn(); setNotice(ok); await reload(); } catch (e) { setErr(cardMessage((e as Error).message)); }
    inFlight.current = false; setBusy(false);
  }
  const schoolName = schools.find((s) => s.id === school)?.name ?? null;

  async function find() {
    setBusy(true); setErr(null);
    try { setStudent(await locateStudentForGuardian(school, sKind, sValue)); } catch (e) { setStudent(null); setErr(cardMessage((e as Error).message)); }
    setBusy(false);
  }
  function emit() {
    const v = validateCardDraft({ ...draft, kind: "emissao" }); if (v) { setErr(v); return; }
    if (!student?.student_id || !student.display_name) return;
    void act(() => recordCard({ publicId: null, expected: null, kind: "emissao", student: student.student_id, school, year: draft.year, validUntil: draft.validUntil,
      studentName: student.display_name, schoolName, classLabel: classLabel.trim() || null, reason: null }), "Carteirinha emitida.");
  }
  function change(c: CardChainView, kind: "reemissao" | "cancelamento", reason: string, validUntil: string) {
    const v = validateCardDraft({ kind, reason, validUntil, year: c.head.academic_year }); if (v) { setErr(v); return; }
    void act(() => recordCard({ publicId: c.publicId, expected: c.head.version, kind, student: null, school, year: null, validUntil: kind === "reemissao" ? validUntil : null,
      studentName: null, schoolName: null, classLabel: null, reason }), kind === "reemissao" ? "Carteirinha reemitida; a versão anterior passa a constar como substituída." : "Carteirinha cancelada.");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Carteirinhas" description="Emissão, reemissão e cancelamento da carteirinha do estudante. Cada ato fica no histórico e nada é apagado." />
      <label className="block max-w-md text-sm">Escola
        <select className="mt-1 block w-full rounded border bg-background p-2" value={school} onChange={(e) => setSchool(e.target.value)}>
          <option value="">Escolha…</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      {err && <StatePanel tone="danger" title="Não foi possível concluir" description={err} />}
      {notice && <StatePanel tone="success" title="Registrado" description={notice} />}
      {school && chain && (
        <>
          <section className="space-y-3 rounded-lg border bg-card p-4" aria-labelledby="nova">
            <h2 id="nova" className="font-semibold">Emitir carteirinha</h2>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm">Buscar por<select className="mt-1 block rounded border bg-background p-2" value={sKind} onChange={(e) => setSKind(e.target.value as "cpf" | "inep")}><option value="cpf">CPF</option><option value="inep">INEP</option></select></label>
              <label className="text-sm">Valor exato<input className="mt-1 block rounded border bg-background p-2" value={sValue} onChange={(e) => setSValue(e.target.value)} /></label>
              <Button type="button" variant="outline" disabled={busy || !sValue.trim()} onClick={() => void find()}>Localizar</Button>
            </div>
            {student && student.outcome !== "encontrado" && <p className="text-sm text-muted-foreground">Nenhum estudante encontrado com esse dado nesta escola.</p>}
            {student?.outcome === "encontrado" && (
              <div className="space-y-2">
                <p className="text-sm">Estudante: <strong>{student.display_name}</strong></p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-sm">Ano letivo<input inputMode="numeric" className="mt-1 block w-24 rounded border bg-background p-2" value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} /></label>
                  <label className="text-sm">Válida até<DateInput value={draft.validUntil} onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })} /></label>
                  <label className="text-sm">Turma (como impressa, opcional)<input className="mt-1 block rounded border bg-background p-2" value={classLabel} onChange={(e) => setClassLabel(e.target.value)} /></label>
                  <Button type="button" disabled={busy} onClick={emit}>Emitir</Button>
                </div>
              </div>)}
          </section>
          {chain.length === 0 ? <EmptyState title="Nenhuma carteirinha emitida nesta escola" description="As carteirinhas emitidas aparecerão aqui com todo o histórico." /> : (
            <ul className="space-y-3">{chain.map((c) => (
              <li key={c.publicId} className="space-y-2 rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{c.head.student_name}</strong><span className="text-sm text-muted-foreground">{c.head.academic_year} · código {c.publicId}.{c.head.version}</span>
                  <span className="rounded border px-2 py-0.5 text-xs">{CARD_STATE_LABEL[c.state]}</span>
                  <Button type="button" variant="ghost" size="sm" className="ml-auto" aria-expanded={open === c.publicId} onClick={() => setOpen(open === c.publicId ? null : c.publicId)}>{open === c.publicId ? "Fechar" : "Abrir"}</Button>
                </div>
                {open === c.publicId && <CardDetail c={c} schoolName={schoolName} busy={busy} onChange={change} />}
              </li>))}</ul>)}
        </>)}
    </div>
  );
}

function CardDetail({ c, schoolName, busy, onChange }: { c: CardChainView; schoolName: string | null; busy: boolean; onChange: (c: CardChainView, k: "reemissao" | "cancelamento", reason: string, until: string) => void }) {
  const [reason, setReason] = useState(""); const [until, setUntil] = useState(c.head.valid_until);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const card = { name: c.head.student_name, school: schoolName, className: c.head.class_label, shift: null, code: `${c.publicId}.${c.head.version}`, year: c.head.academic_year, photoUrl: null,
    verifyUrl: c.state === "cancelada" ? null : verifyUrlFor(origin, c.publicId, c.head.version), status: "vigente" as const };
  return (
    <div className="space-y-3">
      {c.state !== "cancelada" && <div className="card-print-area"><StudentCardView card={card} /></div>}
      {c.state !== "cancelada" && <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>Imprimir ou salvar em PDF</Button>}
      <table className="w-full text-sm"><caption className="text-left font-medium">Histórico</caption>
        <thead><tr className="text-left text-muted-foreground"><th>Versão</th><th>Ato</th><th>Válida até</th><th>Motivo</th><th>Registrado em</th></tr></thead>
        <tbody>{c.history.map((h) => <tr key={h.version}><td>{h.version}</td><td>{CARD_KIND_LABEL[h.kind]}</td><td>{fmtDate(h.valid_until)}</td><td>{h.reason ?? "—"}</td>
          <td>{formatDateTime(h.recorded_at)}</td></tr>)}</tbody></table>
      {c.state !== "cancelada" && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">Motivo<input className="mt-1 block rounded border bg-background p-2" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <label className="text-sm">Nova validade (reemissão)<DateInput value={until} onChange={(e) => setUntil(e.target.value)} /></label>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onChange(c, "reemissao", reason, until)}>Reemitir</Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => onChange(c, "cancelamento", reason, until)}>Cancelar carteirinha</Button>
        </div>)}
    </div>
  );
}

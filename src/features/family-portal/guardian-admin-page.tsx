import { operationalToday, formatDateTime } from "@/lib/academic-date";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { Button } from "@/components/ui/button";
import { FAMILY_SECTIONS, SECTION_LABEL, fmtDate, type FamilySection } from "./family-portal";
import { adminMessage, projectAuthorizations, validateDraft, type AuthorizationView, type GrantDraft } from "./guardian-admin";
import { locateGuardian, locateStudentForGuardian, readChain, recordAuthorization, type GuardianLookup, type StudentLookup } from "./guardian-admin-source";

const today = () => operationalToday();
const STATE_TEXT: Record<AuthorizationView["state"], string> = { vigente: "Vigente", futura: "Vigência futura", expirada: "Expirada", revogada: "Revogada" };
const KIND_TEXT = { constituicao: "Concessão", substituicao: "Substituição", revogacao: "Revogação" } as const;
const emptyDraft = (): GrantDraft => ({ sections: ["matricula"], validFrom: today(), validUntil: "", reason: "" });
const db = supabase as unknown as { from: (t: string) => any };

/** Equipe da escola: concede, substitui e revoga autorização de responsável. Toda decisão é do banco. */
export function GuardianAdminPage() {
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [school, setSchool] = useState("");
  const [sKind, setSKind] = useState<"cpf" | "inep">("cpf");
  const [sValue, setSValue] = useState("");
  const [student, setStudent] = useState<StudentLookup | null>(null);
  const [chain, setChain] = useState<AuthorizationView[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void db.from("institutional_school_record_versions").select("school_id, official_name, version_number").then((r: { data: { school_id: string; official_name: string; version_number: number }[] | null }) => {
      const last = new Map<string, { n: number; name: string }>();
      for (const x of r.data ?? []) { const c = last.get(x.school_id); if (!c || c.n < x.version_number) last.set(x.school_id, { n: x.version_number, name: x.official_name }); }
      setSchools([...last].map(([id, v]) => ({ id, name: v.name })).sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, []);

  async function reload(st: string) {
    try { setChain(projectAuthorizations(await readChain(school, st), today())); setErr(null); }
    catch (e) { setChain(null); setErr(adminMessage((e as Error).message)); }
  }
  async function findStudent() {
    setBusy(true); setNotice(null); setChain(null); setErr(null);
    try { const r = await locateStudentForGuardian(school, sKind, sValue); setStudent(r); if (r.outcome === "encontrado" && r.student_id) await reload(r.student_id); }
    catch (e) { setStudent(null); setErr(adminMessage((e as Error).message)); }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Autorizações de responsáveis" description="Quem pode acompanhar cada educando no Portal da Família. Cada concessão, alteração ou revogação fica registrada e nada é apagado." />
      <section aria-label="Educando" className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Escola<select className="ml-2 rounded border border-input bg-background p-2" value={school} onChange={(e) => { setSchool(e.target.value); setStudent(null); setChain(null); }}>
          <option value="">Selecione…</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="text-sm">Identificar educando por<select className="ml-2 rounded border border-input bg-background p-2" value={sKind} onChange={(e) => setSKind(e.target.value as "cpf" | "inep")}>
          <option value="cpf">CPF</option><option value="inep">INEP</option></select></label>
        <label className="text-sm">Número<input className="ml-2 rounded border border-input bg-background p-2" value={sValue} onChange={(e) => setSValue(e.target.value)} inputMode="numeric" autoComplete="off" /></label>
        <Button onClick={() => void findStudent()} disabled={!school || !sValue.trim() || busy}>Localizar</Button>
      </section>
      {err ? <StatePanel tone="danger" title="Não disponível" description={err} /> : null}
      {notice ? <StatePanel tone="success" title="Registrado" description={notice} /> : null}
      {student && student.outcome !== "encontrado" ? <EmptyState title={student.outcome === "conflito" ? "Identificador ambíguo" : student.outcome === "entrada-invalida" ? "Número inválido" : "Educando não encontrado"} description="Nenhum educando foi escolhido. Confira o número informado." /> : null}
      {student?.outcome === "encontrado" && student.student_id && chain ? (
        <>
          <h2 className="text-lg font-semibold">{student.display_name ?? "Nome não registrado"}</h2>
          <AuthorizationList items={chain} busy={busy} onAct={async (base, kind, d) => {
            setBusy(true); setNotice(null);
            try { await recordAuthorization({ base, kind, student: null, person: null, school: null, sections: kind === "revogacao" ? null : d.sections, validFrom: kind === "revogacao" ? null : d.validFrom, validUntil: d.validUntil || null, reason: d.reason || null });
              setNotice(kind === "revogacao" ? "Autorização revogada." : "Autorização alterada."); await reload(student.student_id!); }
            catch (e) { setErr(adminMessage((e as Error).message)); }
            setBusy(false);
          }} />
          <NewGrant school={school} busy={busy} onGrant={async (person, d) => {
            setBusy(true); setNotice(null);
            try { await recordAuthorization({ base: null, kind: "constituicao", student: student.student_id, person, school, sections: d.sections, validFrom: d.validFrom, validUntil: d.validUntil || null, reason: d.reason || null });
              setNotice("Autorização concedida."); await reload(student.student_id!); }
            catch (e) { setErr(adminMessage((e as Error).message)); }
            setBusy(false);
          }} />
        </>
      ) : null}
    </div>
  );
}

function SectionPicker({ value, onChange }: { value: FamilySection[]; onChange: (v: FamilySection[]) => void }) {
  return (
    <fieldset className="flex flex-wrap gap-3 text-sm"><legend className="mb-1 font-medium">Seções que o responsável poderá ver</legend>
      {FAMILY_SECTIONS.map((s) => <label key={s} className="flex items-center gap-1"><input type="checkbox" checked={value.includes(s)} onChange={(e) => onChange(e.target.checked ? [...value, s] : value.filter((x) => x !== s))} />{SECTION_LABEL[s]}</label>)}
    </fieldset>
  );
}

function DraftFields({ d, set }: { d: GrantDraft; set: (d: GrantDraft) => void }) {
  return (
    <div className="space-y-2">
      <SectionPicker value={d.sections} onChange={(sections) => set({ ...d, sections })} />
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">Início <DateInput value={d.validFrom} onChange={(e) => set({ ...d, validFrom: e.target.value })} /></label>
        <label className="text-sm">Fim (opcional) <DateInput value={d.validUntil} onChange={(e) => set({ ...d, validUntil: e.target.value })} /></label>
      </div>
      <label className="block text-sm">Motivo (opcional)<input className="mt-1 block w-full rounded border border-input bg-background p-2" value={d.reason} onChange={(e) => set({ ...d, reason: e.target.value })} /></label>
    </div>
  );
}

function AuthorizationList({ items, busy, onAct }: { items: AuthorizationView[]; busy: boolean; onAct: (base: string, kind: "substituicao" | "revogacao", d: GrantDraft) => Promise<void> }) {
  const [edit, setEdit] = useState<{ id: string; kind: "substituicao" | "revogacao"; d: GrantDraft } | null>(null);
  if (items.length === 0) return <EmptyState title="Nenhuma autorização registrada" description="Ninguém tem acesso a este educando pelo Portal da Família." />;
  return (
    <ul className="space-y-3">{items.map((a) => { const errs = edit && edit.id === a.head.id ? validateDraft(edit.d, edit.kind) : []; return (
      <li key={a.logicalId} className="space-y-2 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong>{a.head.guardian_name ?? "Responsável não identificado (autorização antiga)"}</strong>
          <span className="rounded bg-muted px-2 py-0.5 text-xs">{STATE_TEXT[a.state]}</span>
        </div>
        <p className="text-sm">Seções: {a.head.sections.map((s) => SECTION_LABEL[s as FamilySection] ?? s).join(", ") || "nenhuma"} · de {fmtDate(a.head.valid_from)} {a.head.valid_until ? `até ${fmtDate(a.head.valid_until)}` : "sem data de fim"}</p>
        <p className="text-xs text-muted-foreground">Parentesco: {a.head.relation_value_id ?? "não registrado (sem catálogo homologado)"}</p>
        <details className="text-xs"><summary>Histórico ({a.history.length})</summary>
          <ol className="mt-1 space-y-1">{a.history.map((h) => <li key={h.id}>v{h.version} · {KIND_TEXT[h.event_kind]} · {formatDateTime(h.recorded_at)}{h.reason ? ` · ${h.reason}` : ""}</li>)}</ol></details>
        {a.state !== "revogada" && !a.legacy ? (edit?.id === a.head.id ? (
          <div className="space-y-2 border-t border-border pt-2">
            {edit.kind === "substituicao" ? <DraftFields d={edit.d} set={(d) => setEdit({ ...edit, d })} />
              : <label className="block text-sm">Motivo da revogação<input className="mt-1 block w-full rounded border border-input bg-background p-2" value={edit.d.reason} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, reason: e.target.value } })} /></label>}
            {errs.length ? <ul className="text-xs text-destructive">{errs.map((x) => <li key={x}>{x}</li>)}</ul> : null}
            <div className="flex gap-2">
              <Button variant={edit.kind === "revogacao" ? "destructive" : "default"} disabled={busy || errs.length > 0} onClick={() => void onAct(a.head.id, edit.kind, edit.d).then(() => setEdit(null))}>{edit.kind === "revogacao" ? "Confirmar revogação" : "Salvar alteração"}</Button>
              <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEdit({ id: a.head.id, kind: "substituicao", d: { sections: a.head.sections as FamilySection[], validFrom: a.head.valid_from, validUntil: a.head.valid_until ?? "", reason: "" } })}>Alterar</Button>
            <Button variant="outline" size="sm" onClick={() => setEdit({ id: a.head.id, kind: "revogacao", d: { ...emptyDraft(), reason: "" } })}>Revogar</Button>
          </div>
        )) : null}
      </li>); })}</ul>
  );
}

function NewGrant({ school, busy, onGrant }: { school: string; busy: boolean; onGrant: (person: string, d: GrantDraft) => Promise<void> }) {
  const [cpf, setCpf] = useState("");
  const [g, setG] = useState<GuardianLookup | null>(null);
  const [d, setD] = useState<GrantDraft>(emptyDraft());
  const [e, setE] = useState<string | null>(null);
  const errs = validateDraft(d, "constituicao");
  return (
    <section aria-labelledby="nova" className="space-y-3 rounded-lg border border-border p-4">
      <h3 id="nova" className="font-medium">Nova autorização</h3>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">CPF do responsável<input className="ml-2 rounded border border-input bg-background p-2" value={cpf} onChange={(x) => setCpf(x.target.value)} inputMode="numeric" autoComplete="off" /></label>
        <Button variant="outline" disabled={!cpf.trim() || busy} onClick={() => void locateGuardian(school, cpf).then((r) => { setG(r); setE(null); }, (x: Error) => { setG(null); setE(adminMessage(x.message)); })}>Localizar responsável</Button>
      </div>
      {e ? <p className="text-sm text-destructive">{e}</p> : null}
      {g && g.outcome !== "encontrado" ? <p className="text-sm">{g.outcome === "conflito" ? "CPF ligado a mais de uma pessoa; resolva o cadastro antes." : g.outcome === "entrada-invalida" ? "CPF inválido." : "Nenhuma pessoa com este CPF. O responsável precisa ser cadastrado antes."}</p> : null}
      {g?.outcome === "encontrado" && g.person_id ? (g.account_state !== "conta-unica" ? (
        <p className="text-sm">{g.display_name}: {g.account_state === "sem-conta" ? "ainda não tem conta de acesso ligada. A administração de contas precisa criar o vínculo antes da autorização." : "tem mais de uma conta ligada; a administração precisa resolver antes."}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm">Responsável: <strong>{g.display_name}</strong></p>
          <DraftFields d={d} set={setD} />
          {errs.length ? <ul className="text-xs text-destructive">{errs.map((x) => <li key={x}>{x}</li>)}</ul> : null}
          <Button disabled={busy || errs.length > 0} onClick={() => void onGrant(g.person_id!, d).then(() => { setG(null); setCpf(""); setD(emptyDraft()); })}>Conceder autorização</Button>
        </div>
      )) : null}
    </section>
  );
}

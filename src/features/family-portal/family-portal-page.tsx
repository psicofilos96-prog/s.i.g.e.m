import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { FAMILY_SECTIONS, SECTION_LABEL, familyMessage, fmtDate, resolveSelected, sectionState, type FamilySection, type FamilyStudent, type FamilySummary } from "./family-portal";
import { readFamilyStudents, readFamilySummary } from "./family-source";

export function FamilyPortalPage({ requested }: { requested: string | undefined }) {
  const navigate = useNavigate();
  const [list, setList] = useState<FamilyStudent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { readFamilyStudents().then(setList, (e: Error) => setErr(familyMessage(e.message))); }, []);
  if (err) return <StatePanel tone="danger" title="Não foi possível abrir o portal" description={err} />;
  if (!list) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  const sel = resolveSelected(list, requested);
  return (
    <div className="space-y-6">
      <PageHeader title="Portal da Família" description="Consulta dos educandos que você tem autorização para acompanhar." />
      {list.length === 0 ? <EmptyState title="Nenhum educando autorizado" description="Sua conta ainda não tem autorização vigente para acompanhar nenhum educando. Procure a secretaria da escola." /> : (
        <label className="block text-sm max-w-md">Educando
          <select className="mt-1 block w-full rounded border bg-background p-2" value={sel.id ?? ""}
            onChange={(e) => void navigate({ to: "/familia", search: { aluno: e.target.value || undefined } })}>
            <option value="">Escolha…</option>
            {list.map((s) => <option key={s.student_id} value={s.student_id}>{s.display_name ?? "Nome não registrado"}</option>)}
          </select>
        </label>)}
      {sel.rejected && <StatePanel tone="warning" title="Educando não disponível" description="Não há autorização vigente para você consultar o educando indicado no endereço." />}
      {sel.id && <Summary key={sel.id} studentId={sel.id} />}
    </div>
  );
}

function Summary({ studentId }: { studentId: string }) {
  const [s, setS] = useState<FamilySummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { readFamilySummary(studentId).then(setS, (e: Error) => setErr(familyMessage(e.message))); }, [studentId]);
  if (err) return <StatePanel tone="danger" title="Não foi possível carregar" description={err} />;
  if (!s) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  const visible = FAMILY_SECTIONS.filter((k) => sectionState(s, k).kind !== "nao-autorizada");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {visible.map((k) => <Section key={k} s={s} k={k} />)}
    </div>
  );
}

function Section({ s, k }: { s: FamilySummary; k: FamilySection }) {
  const st = sectionState(s, k);
  return (
    <section className="rounded-lg border bg-card p-4 space-y-2" aria-labelledby={`sec-${k}`}>
      <h2 id={`sec-${k}`} className="font-semibold">{SECTION_LABEL[k]}</h2>
      {st.kind === "sem-publicacao" ? <p className="text-sm text-muted-foreground">{st.reason}</p>
        : st.kind === "vazia" ? <p className="text-sm text-muted-foreground">{st.message}</p>
        : k === "matricula" ? (
          <ul className="space-y-2 text-sm">{s.enrollments!.map((e, i) => (
            <li key={i}><strong>{e.school}</strong> — desde {fmtDate(e.opened_on)}{e.ended_on ? `, encerrada em ${fmtDate(e.ended_on)}` : ""}
              {e.classes.length === 0 ? <p className="text-muted-foreground">Sem turma registrada.</p>
                : <ul className="ml-4 list-disc">{e.classes.map((c, j) => <li key={j}>{c.class} — de {fmtDate(c.from)}{c.until ? ` a ${fmtDate(c.until)}` : ""}</li>)}</ul>}
            </li>))}</ul>)
        : k === "documentos" ? (
          <ul className="space-y-1 text-sm">{s.documents!.map((d) => (
            <li key={d.verification_code}>{d.kind}{d.number ? ` nº ${d.number}` : ""} — {new Date(d.emitted_at).toLocaleDateString("pt-BR")} ·{" "}
              <Link to="/verificar/$codigo" params={{ codigo: d.verification_code }} className="underline">verificar situação</Link></li>))}</ul>)
        : k === "calendario" ? <Link to="/calendario-escolar" className="text-sm underline">Abrir o calendário escolar homologado</Link>
        : null}
    </section>
  );
}

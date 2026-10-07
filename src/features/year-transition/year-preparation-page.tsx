import { SkeletonState } from "@/components/sigem/guidance";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { supabase } from "@/integrations/supabase/client";
import {
  DECISION_LABEL, candidateState, expectedSequence, lookupMessage, normalizeProfessionalLookup, normalizeStudentLookup,
  reasonRequired, transitionError, type Candidate, type PreparationSummary, type ProfessionalLookupKind, type StudentLookupKind, type TransitionDecision,
} from "./year-transition";
import {
  enrollStudent, locateProfessional, locateStudent, readCandidates, readSummary, readYears, recordDecision, registerStudent,
  type ProfessionalLookupResult, type StudentLookupResult, type YearOption,
} from "./year-transition-source";

const STATE_LABEL: Record<string, string> = {
  "historico-importado": "Base censitária/histórica",
  "em-preparacao": "Em preparação",
  operacional: "Ano operacional",
  encerrado: "Encerrado",
};

export function YearPreparationPage() {
  const [years, setYears] = useState<YearOption[] | null>(null);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [school, setSchool] = useState("");
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    readYears().then(setYears, (e: Error) => setErr(transitionError(e.message)));
    supabase.from("institutional_school_record_versions").select("school_id,official_name,version_number").order("version_number", { ascending: false })
      .then(({ data }) => {
        const m = new Map<string, string>();
        for (const r of (data ?? []) as { school_id: string; official_name: string }[]) if (!m.has(r.school_id)) m.set(r.school_id, r.official_name);
        setSchools([...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
      });
  }, []);

  if (err) return <StatePanel tone="danger" title="Não foi possível abrir" description={err} />;
  if (!years) return <SkeletonState label="Carregando" />;
  const target = years.find((y) => y.id === toYear);
  const ready = school && fromYear && toYear && fromYear !== toYear;

  return (
    <div className="space-y-6">
      <PageHeader title="Preparação do ano operacional" description="Transição entre o ano de origem e o ano de destino, por escola. Nada é renovado automaticamente." />
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">Escola
          <select className="mt-1 block w-full rounded border bg-background p-2" value={school} onChange={(e) => setSchool(e.target.value)}>
            <option value="">Escolha…</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <YearSelect label="Ano de origem" years={years} value={fromYear} onChange={setFromYear} />
        <YearSelect label="Ano de destino" years={years} value={toYear} onChange={setToYear} />
      </div>
      {!ready ? <EmptyState title="Escolha escola e anos" description="Os anos são sempre explícitos: a tela nunca troca um ano pelo outro." /> : (
        <>
          {target && target.state !== "em-preparacao" && target.state !== "operacional" && (
            <StatePanel tone="info" title={`${target.label} ainda não foi aberto para preparação`} description="Isto é esperado: a abertura é um ato do Administrador Geral, com motivo. Não se trata de erro nem de falta de calendário — o calendário oficial do ano continua cadastrado. Até a abertura, decisões, matrículas e lotações deste ano são recusadas." />
          )}
          <Workspace key={`${school}|${fromYear}|${toYear}`} school={school} fromYear={fromYear} toYear={toYear} />
        </>
      )}
    </div>
  );
}

function YearSelect({ label, years, value, onChange }: { label: string; years: YearOption[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-sm">{label}
      <select className="mt-1 block w-full rounded border bg-background p-2" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Escolha…</option>
        {years.map((y) => <option key={y.id} value={y.id}>{y.label} — {y.state ? STATE_LABEL[y.state] ?? y.state : "situação não registrada"}</option>)}
      </select>
    </label>
  );
}

function Workspace({ school, fromYear, toYear }: { school: string; fromYear: string; toYear: string }) {
  const [summary, setSummary] = useState<PreparationSummary | null>(null);
  const [cands, setCands] = useState<Candidate[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    setErr(null);
    readSummary(school, fromYear, toYear).then(setSummary, (e: Error) => setErr(transitionError(e.message)));
    readCandidates(school, fromYear, toYear).then(setCands, (e: Error) => setErr(transitionError(e.message)));
  }, [school, fromYear, toYear]);
  useEffect(load, [load]);
  if (err) return <StatePanel tone="danger" title="Acesso indisponível" description={err} />;
  return (
    <div className="space-y-6">
      {summary && <SummaryGrid s={summary} />}
      <StudentSearch school={school} toYear={toYear} onDone={load} />
      <ProfessionalSearch school={school} />
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Candidatos do ano de origem</h2>
        {!cands ? <SkeletonState label="Carregando" /> : cands.length === 0
          ? <EmptyState title="Nenhum candidato" description="Não há matrícula observada nesta escola no ano de origem." />
          : <ul className="divide-y rounded border">{cands.map((c) => <CandidateRow key={c.student_id} c={c} school={school} fromYear={fromYear} toYear={toYear} onDone={load} />)}</ul>}
      </section>
    </div>
  );
}

function SummaryGrid({ s }: { s: PreparationSummary }) {
  const items: [string, number][] = [
    ["Candidatos", s.candidatos], ["Renovados", s.renovados], ["Transferidos / saídas", s.transferidos_saidas],
    ["Não renovados", s.nao_renovados], ["Pendentes", s.pendentes], ["Novos alunos", s.novos_alunos],
    ["Turmas do ano de destino", s.turmas_ano_destino], ["Alunos sem turma", s.alunos_sem_turma],
    ["Servidores lotados", s.servidores_lotados_ano_destino], ["Servidores observados no Censo", s.servidores_observados_baseline],
  ];
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
      {items.map(([k, v]) => <div key={k} className="rounded border bg-card p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-semibold">{v}</p></div>)}
    </div>
  );
}

function CandidateRow({ c, school, fromYear, toYear, onDone }: { c: Candidate; school: string; fromYear: string; toYear: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [declared, setDeclared] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const state = candidateState(c);
  const act = (decision: TransitionDecision) => {
    if (reasonRequired(c) && !reason.trim()) { setMsg("Informe o motivo da retificação."); return; }
    recordDecision({ school, student: c.student_id, fromYear, toYear, decision, expected: expectedSequence(c), declaredOn: declared || null, reason })
      .then(() => { setMsg(null); onDone(); }, (e: Error) => setMsg(transitionError(e.message)));
  };
  return (
    <li className="p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{c.display_name ?? "Nome não informado"}</span>
        <span className="text-xs rounded bg-muted px-2 py-1">{DECISION_LABEL[state]}</span>
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs">Data declarada (opcional)<DateInput className="mt-1 block" value={declared} onChange={(e) => setDeclared(e.target.value)} /></label>
        {reasonRequired(c) && <label className="text-xs">Motivo da retificação<input className="mt-1 block rounded border bg-background p-1" value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
        {(["renovou", "transferido-saida", "nao-renovou"] as const).map((d) => (
          <button key={d} type="button" disabled={state === d} onClick={() => act(d)} className="rounded border px-2 py-1 text-sm hover:bg-accent disabled:opacity-50">{DECISION_LABEL[d]}</button>
        ))}
      </div>
      {msg && <p className="text-xs text-destructive">{msg}</p>}
    </li>
  );
}

function StudentSearch({ school, toYear, onDone }: { school: string; toYear: string; onDone: () => void }) {
  const [kind, setKind] = useState<StudentLookupKind>("cpf");
  const [value, setValue] = useState("");
  const [res, setRes] = useState<StudentLookupResult | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [name, setName] = useState("");
  const search = () => {
    const v = normalizeStudentLookup(kind, value);
    if (!v) { setMsg("Informe o identificador completo. Busca por nome não existe."); return; }
    setMsg(null);
    locateStudent(school, kind, v, toYear).then(setRes, (e: Error) => setMsg(transitionError(e.message)));
    setValue("");
  };
  const enroll = (sid: string) => enrollStudent(sid, school, toYear, null).then(() => { setMsg("Matrícula registrada."); setRes(null); onDone(); }, (e: Error) => setMsg(transitionError(e.message)));
  return (
    <section className="space-y-2 rounded border p-3">
      <h2 className="text-lg font-semibold">Busca ativa de aluno</h2>
      <p className="text-xs text-muted-foreground">Somente CPF ou identificação INEP completos. O valor digitado não é guardado.</p>
      <div className="flex flex-wrap gap-2">
        <select className="rounded border bg-background p-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value as StudentLookupKind)}>
          <option value="cpf">CPF</option><option value="inep">Identificação INEP</option>
        </select>
        <input inputMode="numeric" autoComplete="off" className="rounded border bg-background p-2 text-sm" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Identificador" />
        <button type="button" onClick={search} className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground">Buscar</button>
      </div>
      {res && <p className="text-sm">{lookupMessage(res.outcome)}</p>}
      {res?.outcome === "encontrado" && res.student_id && (
        <div className="text-sm space-y-1">
          <p>{res.display_name ?? "Nome não informado"}</p>
          {res.active_here ? <p>Já matriculado nesta escola no ano de destino.</p>
            : res.active_elsewhere ? <p>Matriculado em outra escola neste ano: use a transferência explícita.</p>
            : <button type="button" onClick={() => enroll(res.student_id!)} className="rounded border px-2 py-1">Matricular nesta escola</button>}
        </div>
      )}
      {res?.outcome === "nao-encontrado" && (
        <div className="flex flex-wrap gap-2 items-end text-sm">
          <label className="text-xs">Nome do novo aluno<input className="mt-1 block rounded border bg-background p-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <p className="text-xs text-muted-foreground w-full">Informe novamente o identificador no campo acima antes de cadastrar.</p>
          <button type="button" className="rounded border px-2 py-1" onClick={() => {
            const v = normalizeStudentLookup(kind, value);
            if (!v || !name.trim()) { setMsg("Nome e identificador completos são obrigatórios."); return; }
            registerStudent(school, name, kind === "cpf" ? v : "", kind === "inep" ? v : "")
              .then((sid) => enroll(sid), (e: Error) => setMsg(transitionError(e.message)));
          }}>Cadastrar e matricular</button>
        </div>
      )}
      {msg && <p className="text-xs">{msg}</p>}
    </section>
  );
}

function ProfessionalSearch({ school }: { school: string }) {
  const [kind, setKind] = useState<ProfessionalLookupKind>("matricula");
  const [value, setValue] = useState("");
  const [res, setRes] = useState<ProfessionalLookupResult | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const search = () => {
    const v = normalizeProfessionalLookup(value);
    if (!v) { setMsg("Informe a matrícula funcional ou o QP-MEC exatos. Busca por nome não existe."); return; }
    setMsg(null);
    locateProfessional(school, kind, v).then(setRes, (e: Error) => setMsg(transitionError(e.message)));
    setValue("");
  };
  return (
    <section className="space-y-2 rounded border p-3">
      <h2 className="text-lg font-semibold">Busca ativa de servidor</h2>
      <p className="text-xs text-muted-foreground">Lotação é registrada na tela de lotações e nunca cria regência.</p>
      <div className="flex flex-wrap gap-2">
        <select className="rounded border bg-background p-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value as ProfessionalLookupKind)}>
          <option value="matricula">Matrícula funcional</option><option value="qp-mec">QP-MEC</option>
        </select>
        <input autoComplete="off" className="rounded border bg-background p-2 text-sm" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Identificador do servidor" />
        <button type="button" onClick={search} className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground">Buscar</button>
      </div>
      {res && <p className="text-sm">{lookupMessage(res.outcome)}{res.outcome === "encontrado" ? ` ${res.display_name ?? ""} — vínculos: ${res.functional_link_logical_ids?.length ?? 0}` : ""}</p>}
      {msg && <p className="text-xs">{msg}</p>}
    </section>
  );
}

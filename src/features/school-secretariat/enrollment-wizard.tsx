import { RecoveryRetryButton } from "@/components/sigem/recovery-retry-button";
import { PageHeader } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { createAutosave, type AutosaveStatus } from "@/features/autosave/autosave-controller";
import { readYears, locateStudent, type YearOption } from "@/features/year-transition/year-transition-source";
import { readSchoolLife } from "./secretariat-source";
import { lifeKindLabel } from "./secretariat";
import { WIZARD_STEPS, canComplete, fieldProblems, missingByStep, photoPath, photoProblem, seatLabel, sniffImage, validCpf, wizardMessage, type ClassOption, type WizardPayload } from "./enrollment-wizard-model";
import { abandonDraft, bindPhoto, classOptions, completeDraft, currentStudentPhoto, openDrafts, photoUrl, removePhoto, saveDraft, uploadPhoto, type OpenDraft } from "./enrollment-wizard-source";
import { formatDateTime } from "@/lib/academic-date";

/** N5.2.1 — Cadastrar aluno → Matricular → Enturmar → Revisar → Concluir, numa só tela retomável. */
export function EnrollmentWizard() {
  const auth = useSessionAuthority();
  const schools = useMemo(() => auth.status !== "signed-in" ? [] :
    [...new Set(auth.capabilities.filter((c) => c.capabilityId === "manter-matricula-e-enturmacao" && c.schoolId).map((c) => c.schoolId!))], [auth]);
  const [school, setSchool] = useState("");
  useEffect(() => { if (!school && schools.length) setSchool(schools[0]!); }, [schools, school]);
  if (auth.status === "loading") return <SkeletonState label="Carregando" />;
  if (auth.status !== "signed-in") return <p className="p-6">Entre com a conta da Secretaria para matricular.</p>;
  if (!schools.length) return <p className="p-6" role="alert">Sua conta não tem autorização para matricular alunos.</p>;
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <PageHeader eyebrow="Secretaria Escolar" title="Nova matrícula" description="Tudo é salvo automaticamente como rascunho. Só vira matrícula ao concluir." />
      {schools.length > 1 ? (
        <label className="block text-sm">Escola
          <select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={school} onChange={(e) => setSchool(e.target.value)}>
            {schools.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      ) : null}
      {school ? <DraftPicker key={school} school={school} /> : null}
    </div>
  );
}

function DraftPicker({ school }: { school: string }) {
  const [drafts, setDrafts] = useState<OpenDraft[] | null>(null); const [err, setErr] = useState("");
  const [current, setCurrent] = useState<OpenDraft | null>(null);
  const load = () => openDrafts(school).then(setDrafts, (e) => setErr(wizardMessage(e)));
  useEffect(() => { void load(); }, [school]);
  if (current) return <Wizard school={school} initial={current} onExit={() => { setCurrent(null); void load(); }} />;
  if (err) return <p role="alert" className="text-destructive">{err}</p>;
  if (!drafts) return <SkeletonState label="Carregando rascunhos" />;
  const fresh = (): OpenDraft => ({ draftId: crypto.randomUUID(), sequence: 0, step: 1, payload: {}, hasCpf: false, cpfHint: null, inep: null,
    existingStudentId: null, existingStudentName: null, updatedAt: "", mine: true });
  return (
    <section className="space-y-3">
      <Button onClick={() => setCurrent(fresh())}>Começar nova matrícula</Button>
      {drafts.length ? (
        <div>
          <h2 className="mb-2 font-medium">Continuar de onde parou</h2>
          <ul className="divide-y rounded-md border">
            {drafts.map((d) => (
              <li key={d.draftId} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>
                  <strong>{d.existingStudentName ?? d.payload.aluno?.nome ?? "Aluno sem nome"}</strong>
                  <span className="block text-sm text-muted-foreground">Passo {d.step} de 8 · {WIZARD_STEPS[d.step - 1]?.title} · salvo {formatDateTime(d.updatedAt)}</span>
                </span>
                <Button variant="outline" onClick={() => setCurrent(d)}>Continuar</Button>
              </li>
            ))}
          </ul>
        </div>
      ) : <p className="text-sm text-muted-foreground">Nenhum rascunho em aberto.</p>}
    </section>
  );
}

type FP = ReturnType<typeof fieldProblems>;
/** NFORM.2 — erro específico junto ao campo, ligado por aria-invalid/aria-describedby. */
function Field({ label, value, onChange, type = "text", hint, error }: { label: string; value: string; onChange: (v: string) => void; type?: string; hint?: string; error?: string | undefined }) {
  const id = useId();
  const described = [hint ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div><label className="block text-sm">{label}
      <input type={type} aria-invalid={error ? true : undefined} aria-describedby={described} className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint ? <span id={`${id}-h`} className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
      {error ? <span id={`${id}-e`} className="block text-xs text-destructive">{error}</span> : null}</div>
  );
}

const STATUS: Record<AutosaveStatus, string> = { ocioso: "", pendente: "Alterações não salvas…", salvando: "Salvando…", salvo: "Salvo", erro: "Não foi possível salvar o rascunho", "sem-conexao": "Sem conexão — o rascunho será salvo quando a conexão voltar" };

function Wizard({ school, initial, onExit }: { school: string; initial: OpenDraft; onExit: () => void }) {
  const [step, setStep] = useState(initial.step);
  const [p, setP] = useState<WizardPayload>(initial.payload);
  const [ident, setIdent] = useState({ existingStudentId: initial.existingStudentId, existingName: initial.existingStudentName, hasCpf: initial.hasCpf, cpfHint: initial.cpfHint, inep: initial.inep });
  const seq = useRef(initial.sequence); const stepRef = useRef(step);
  const [status, setStatus] = useState<AutosaveStatus>("ocioso"); const [saveErr, setSaveErr] = useState("");
  const auto = useMemo(() => createAutosave<WizardPayload>({
    save: async (v) => { seq.current = await saveDraft({ draft: initial.draftId, school, expected: seq.current, step: stepRef.current, payload: v }); },
    isOnline: () => typeof navigator === "undefined" || navigator.onLine,
    onStatus: (s, e) => { setStatus(s); setSaveErr(e ? wizardMessage(e) : ""); },
  }), [initial.draftId, school]);
  useEffect(() => { const h = () => auto.online(); window.addEventListener("online", h); return () => window.removeEventListener("online", h); }, [auto]);
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (auto.hasUnsaved) e.preventDefault(); }; window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h); }, [auto]);
  const pRef = useRef(p);
  const edit = (f: (x: WizardPayload) => WizardPayload) => { const n = f(pRef.current); pRef.current = n; setP(n); auto.change(n); };
  const go = async (n: number) => { stepRef.current = n; setStep(n); auto.change(pRef.current); await auto.flush(); };
  const identity = { existingStudentId: ident.existingStudentId, hasCpf: ident.hasCpf, inep: ident.inep };
  const missing = missingByStep(p, identity);
  const fp = fieldProblems(p, identity);
  const [done, setDone] = useState<{ studentId: string; name: string } | null>(null);

  if (done) return <Done school={school} studentId={done.studentId} name={done.name} onAgain={onExit} />;
  return (
    <section className="space-y-4">
      {/* INT.7: matrícula em uma única página (antes: 8 telas e 7 cliques em "Continuar"). */}
      <nav aria-label="Seções da matrícula" className="sticky top-[var(--topbar-height)] z-10 rounded-lg border bg-card/95 p-3 backdrop-blur">
        <p className="mb-2 text-sm">
          {(() => { const n = Object.values(missing).flat().length; return n ? <span>Faltam {n} {n === 1 ? "informação obrigatória" : "informações obrigatórias"}</span> : <strong>Tudo pronto para concluir</strong>; })()}
        </p>
        <ol className="flex flex-wrap gap-1 text-xs">
          {WIZARD_STEPS.filter((s) => s.n < 8).map((s) => (
            <li key={s.n}>
              <a href={`#wz-sec-${s.n}`} className={`inline-block rounded-full border px-2 py-1 ${missing[s.n]!.length ? "border-warning" : "border-border"}`}>
                {s.title}{missing[s.n]!.length ? " •" : ""}
              </a>
            </li>
          ))}
        </ol>
        <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">{STATUS[status]}{saveErr && status === "erro" ? ` — ${saveErr}` : ""}
          {status === "erro" ? <RecoveryRetryButton type="button" variant="outline" size="sm" className="ml-2" error={saveErr ?? undefined} operation="salvar-rascunho-matricula" onRetry={() => auto.retry()} /> : null}</p>
      </nav>
      {WIZARD_STEPS.filter((s) => s.n < 8).map((s) => (
        <div key={s.n} id={`wz-sec-${s.n}`} className="scroll-mt-40 space-y-3 rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          {s.n === 1 ? <StepStudent fp={fp} school={school} draft={initial.draftId} p={p} edit={edit} ident={ident} setIdent={setIdent} seq={seq} stepRef={stepRef} auto={auto} /> : null}
          {s.n === 2 ? <StepGuardians p={p} edit={edit} /> : null}
          {s.n === 3 ? (<div className="grid gap-3 sm:grid-cols-2">
            {(["logradouro", "numero", "bairro", "cidade", "cep"] as const).map((k) => (
              <Field key={k} label={{ logradouro: "Rua/Logradouro", numero: "Número", bairro: "Bairro", cidade: "Cidade", cep: "CEP" }[k]} value={p.endereco?.[k] ?? ""} onChange={(v) => edit((x) => ({ ...x, endereco: { ...x.endereco, [k]: v } }))} />))}
          </div>) : null}
          {s.n === 4 ? (<div className="space-y-3">
            <Field label="Certidão de nascimento (número/matrícula)" value={p.documentos?.certidao ?? ""} onChange={(v) => edit((x) => ({ ...x, documentos: { ...x.documentos, certidao: v } }))} />
            <Field label="Observações sobre documentos entregues" value={p.documentos?.observacao ?? ""} onChange={(v) => edit((x) => ({ ...x, documentos: { ...x.documentos, observacao: v } }))} />
            <p className="text-xs text-muted-foreground">Foto 3×4 e anexos: envio pela ficha do aluno após concluir.</p>
          </div>) : null}
          {s.n === 5 ? (<div className="space-y-3">
            <Field label="Escola anterior" value={p.escolar?.escolaAnterior ?? ""} onChange={(v) => edit((x) => ({ ...x, escolar: { ...x.escolar, escolaAnterior: v } }))} />
            <Field label="Observações escolares" value={p.escolar?.observacao ?? ""} onChange={(v) => edit((x) => ({ ...x, escolar: { ...x.escolar, observacao: v } }))}
              hint="Informações de saúde, laudos e NEE não são registradas aqui: têm registro restrito próprio." />
          </div>) : null}
          {s.n === 6 ? <StepYear fp={fp} p={p} edit={edit} /> : null}
          {s.n === 7 ? <StepClass fp={fp} school={school} p={p} edit={edit} /> : null}
          {missing[s.n]!.length ? <p className="text-sm text-warning-foreground" role="status">Falta: {missing[s.n]!.join(", ")}.</p> : null}
        </div>
      ))}
      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="ghost" onClick={async () => { await auto.flush(); onExit(); }}>Sair e continuar depois</Button>
          <Discard draft={initial.draftId} seq={seq} auto={auto} onDone={onExit} photo={p.foto?.path} />
        </div>
        <Complete draft={initial.draftId} seq={seq} auto={auto} p={p} ready={canComplete(p, identity)} onDone={(sid) => setDone({ studentId: sid, name: ident.existingName ?? p.aluno?.nome ?? "" })} />
      </div>
    </section>
  );
}

type Auto = ReturnType<typeof createAutosave<WizardPayload>>;
type Edit = (f: (x: WizardPayload) => WizardPayload) => void;
type Ident = { existingStudentId: string | null; existingName: string | null; hasCpf: boolean; cpfHint: string | null; inep: string | null };

function StepStudent({ fp, school, draft, p, edit, ident, setIdent, seq, stepRef, auto }: { fp: FP; school: string; draft: string; p: WizardPayload; edit: Edit; ident: Ident; setIdent: (i: Ident) => void; seq: React.MutableRefObject<number>; stepRef: React.MutableRefObject<number>; auto: Auto }) {
  const [cpf, setCpf] = useState(""); const [inep, setInep] = useState(ident.inep ?? ""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ id: string; name: string; activeHere: boolean } | null>(null);
  const year = p.matricula?.ano ?? "";
  async function search() {
    setMsg(""); setFound(null);
    const digits = cpf.replace(/\D/g, "");
    if (digits && !validCpf(digits)) { setMsg("CPF inválido. Confira os números."); return; }
    if (!digits && !inep.trim()) { setMsg("Informe CPF ou INEP para buscar."); return; }
    setBusy(true);
    try {
      const r = await locateStudent(school, digits ? "cpf" : "inep", digits || inep.trim(), year);
      if (r.outcome === "encontrado" && r.student_id) setFound({ id: r.student_id, name: r.display_name ?? "Aluno", activeHere: !!r.active_here });
      else setMsg("Nenhum aluno com este documento. Pode cadastrar como novo.");
    } catch (e) { setMsg(wizardMessage(e)); } finally { setBusy(false); }
  }
  async function bind(existing: string | null) {
    setBusy(true); setMsg("");
    try {
      await auto.flush();
      const digits = cpf.replace(/\D/g, "");
      seq.current = await saveDraft({ draft, school, expected: seq.current, step: stepRef.current, payload: p,
        cpf: existing ? null : digits || null, inep: existing ? null : inep.trim() || null, existingStudent: existing });
      setIdent(existing ? { ...ident, existingStudentId: existing, existingName: found?.name ?? null }
        : { ...ident, hasCpf: ident.hasCpf || !!digits, cpfHint: digits ? digits.slice(-2) : ident.cpfHint, inep: inep.trim() || ident.inep });
      setCpf(""); setMsg(existing ? "Cadastro existente selecionado." : "Documento guardado com segurança.");
    } catch (e) { setMsg(wizardMessage(e)); } finally { setBusy(false); }
  }
  if (ident.existingStudentId) return <p>Aluno já cadastrado: <strong>{ident.existingName ?? "selecionado"}</strong>. Os dados pessoais seguem a ficha existente.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Primeiro confira se o aluno já tem cadastro na rede (busca só por documento, nunca por nome).</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`CPF${ident.hasCpf ? ` (guardado, final ${ident.cpfHint})` : ""}`} value={cpf} onChange={setCpf} error={(cpf.trim() && !validCpf(cpf) ? "CPF inválido: confira os 11 dígitos." : undefined) ?? fp.identificacao} />
        <Field label="Código INEP do aluno" value={inep} onChange={setInep} error={fp.identificacao} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => void search()}>Já tem cadastro? Buscar</Button>
        <Button variant="outline" disabled={busy || (!cpf && !inep)} onClick={() => void bind(null)}>Guardar documento</Button>
      </div>
      {found ? (
        <div className="rounded-md border p-3">
          <p>Encontrado: <strong>{found.name}</strong>{found.activeHere ? " (já matriculado nesta escola neste ano)" : ""}</p>
          <Button className="mt-2" disabled={busy} onClick={() => void bind(found.id)}>Usar este cadastro</Button>
        </div>
      ) : null}
      {msg ? <p role="status" className="text-sm">{msg}</p> : null}
      <PhotoField school={school} draft={draft} p={p} edit={edit} auto={auto} />
      <Field label="Nome completo" error={fp["aluno.nome"]} value={p.aluno?.nome ?? ""} onChange={(v) => edit((x) => ({ ...x, aluno: { ...x.aluno, nome: v } }))} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Data de nascimento" type="date" value={p.aluno?.nascimento ?? ""} onChange={(v) => edit((x) => ({ ...x, aluno: { ...x.aluno, nascimento: v } }))} />
        <Field label="Nome social (se houver)" value={p.aluno?.nomeSocial ?? ""} onChange={(v) => edit((x) => ({ ...x, aluno: { ...x.aluno, nomeSocial: v } }))} />
      </div>
    </div>
  );
}

function StepGuardians({ p, edit }: { p: WizardPayload; edit: Edit }) {
  const list = p.responsaveis?.length ? p.responsaveis : [{}];
  const upd = (i: number, k: "nome" | "parentesco" | "telefone", v: string) => edit((x) => { const l = [...(x.responsaveis?.length ? x.responsaveis : [{}])]; l[i] = { ...l[i], [k]: v }; return { ...x, responsaveis: l }; });
  return (
    <div className="space-y-4">
      {list.map((r, i) => (
        <fieldset key={i} className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
          <legend className="px-1 text-sm">Responsável {i + 1}</legend>
          <Field label="Nome" value={r.nome ?? ""} onChange={(v) => upd(i, "nome", v)} />
          <Field label="Parentesco" value={r.parentesco ?? ""} onChange={(v) => upd(i, "parentesco", v)} />
          <Field label="Telefone" type="tel" value={r.telefone ?? ""} onChange={(v) => upd(i, "telefone", v)} />
        </fieldset>
      ))}
      <Button variant="outline" onClick={() => edit((x) => ({ ...x, responsaveis: [...list, {}] }))}>Adicionar responsável</Button>
    </div>
  );
}

function StepYear({ fp, p, edit }: { fp: FP; p: WizardPayload; edit: Edit }) {
  const [years, setYears] = useState<YearOption[]>([]);
  useEffect(() => { readYears().then(setYears, () => setYears([])); }, []);
  const open = years.filter((y) => y.state === "operacional" || y.state === "em-preparacao");
  // INT.7: padrão 2026 — com um único ano operacional, ele já vem escolhido; data de início = hoje.
  const operational = open.filter((y) => y.state === "operacional");
  useEffect(() => {
    if (operational.length === 1 && !p.matricula?.ano) {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      edit((x) => ({ ...x, matricula: { ...x.matricula, ano: operational[0]!.id, data: x.matricula?.data || today }, turma: {} }));
    }
  }, [operational.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-3">
      {open.length ? (
        <label className="block text-sm">Ano letivo
          <select aria-invalid={fp["matricula.ano"] ? true : undefined} aria-describedby={fp["matricula.ano"] ? "wz-ano-e" : undefined} className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={p.matricula?.ano ?? ""}
            onChange={(e) => edit((x) => ({ ...x, matricula: { ...x.matricula, ano: e.target.value }, turma: {} }))}>
            <option value="">Escolha…</option>
            {open.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
        </label>
      ) : null}
      {open.length > 0 && fp["matricula.ano"] ? <span id="wz-ano-e" className="block text-xs text-destructive">{fp["matricula.ano"]}</span> : null}
      {open.length ? null : <p role="alert" className="rounded-md border border-warning p-3 text-sm">Nenhum ano letivo está aberto para matrícula. A abertura do ano é ato da rede; o rascunho fica salvo até lá.</p>}
      <Field label="Data de início na escola" error={fp["matricula.data"]} type="date" value={p.matricula?.data ?? ""} onChange={(v) => edit((x) => ({ ...x, matricula: { ...x.matricula, data: v }, turma: {} }))} />
    </div>
  );
}

function StepClass({ fp, school, p, edit }: { fp: FP; school: string; p: WizardPayload; edit: Edit }) {
  const [opts, setOpts] = useState<ClassOption[] | null>(null); const [err, setErr] = useState("");
  const year = p.matricula?.ano, on = p.matricula?.data;
  useEffect(() => { if (year && on) classOptions(school, year, on).then(setOpts, (e) => setErr(wizardMessage(e))); }, [school, year, on]);
  if (!year || !on) return <p>Escolha antes o ano letivo e a data de início (passo 6).</p>;
  if (err) return <p role="alert">{err}</p>;
  if (!opts) return <SkeletonState label="Carregando turmas" />;
  if (!opts.length) return <p role="alert">Nenhuma turma ativa desta escola neste ano na data escolhida.</p>;
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2" aria-invalid={fp.turma ? true : undefined} aria-describedby={fp.turma ? "wz-turma-e" : undefined}>
      <legend className="sr-only">Turmas disponíveis</legend>
      {fp.turma ? <p id="wz-turma-e" className="text-xs text-destructive sm:col-span-2">{fp.turma}</p> : null}
      {opts.map((c) => (
        <label key={c.id} className={`cursor-pointer rounded-md border p-3 ${p.turma?.id === c.id ? "border-primary ring-2 ring-primary" : ""}`}>
          <input type="radio" name="turma" className="sr-only" checked={p.turma?.id === c.id} onChange={() => edit((x) => ({ ...x, turma: { id: c.id, nome: c.name } }))} />
          <strong className="block">{c.name}</strong>
          <span className="block text-sm text-muted-foreground">{c.shift ?? "Turno não informado"}</span>
          <span className="block text-sm">{seatLabel(c)}</span>
        </label>
      ))}
    </fieldset>
  );
}

function StepReview({ p, ident, missing, go }: { p: WizardPayload; ident: Ident; missing: Record<number, string[]>; go: (n: number) => Promise<void> }) {
  const rows: [number, string][] = [
    [1, ident.existingStudentId ? `Cadastro existente: ${ident.existingName ?? ""}` : `${p.aluno?.nome ?? "—"}${ident.hasCpf ? ` · CPF final ${ident.cpfHint}` : ""}${ident.inep ? ` · INEP ${ident.inep}` : ""}`],
    [2, (p.responsaveis ?? []).filter((r) => r.nome).map((r) => `${r.nome}${r.telefone ? ` (${r.telefone})` : ""}`).join("; ") || "Não informado"],
    [3, [p.endereco?.logradouro, p.endereco?.numero, p.endereco?.bairro, p.endereco?.cidade].filter(Boolean).join(", ") || "Não informado"],
    [4, p.documentos?.certidao || "Não informado"], [5, p.escolar?.escolaAnterior || "Não informado"],
    [6, p.matricula?.data ? `Início em ${new Date(p.matricula.data + "T12:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "—"], [7, p.turma?.nome ?? "—"],
  ];
  return (
    <dl className="divide-y">
      {rows.map(([n, v]) => (
        <div key={n} className="flex flex-wrap items-start justify-between gap-2 py-2">
          <div><dt className="text-sm text-muted-foreground">{WIZARD_STEPS[n - 1]!.title}</dt><dd>{v}</dd>
            {missing[n]!.length ? <dd className="text-sm text-warning-foreground">Falta: {missing[n]!.join(", ")}</dd> : null}</div>
          <Button variant="link" onClick={() => void go(n)}>Editar</Button>
        </div>
      ))}
    </dl>
  );
}

function Complete({ draft, seq, auto, p, ready, onDone }: { draft: string; seq: React.MutableRefObject<number>; auto: Auto; p: WizardPayload; ready: boolean; onDone: (sid: string) => void }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [confirm, setConfirm] = useState(false);
  return (
    <div className="text-right">
      {confirm ? <p className="mb-2 text-sm">Isto cria a matrícula oficial e coloca o aluno na turma <strong>{p.turma?.nome}</strong>. Confirmar?</p> : null}
      {confirm ? <Button variant="outline" className="mr-2" disabled={busy} onClick={() => setConfirm(false)}>Revisar de novo</Button> : null}
      <Button disabled={!ready || busy} onClick={async () => {
        if (!confirm) { setConfirm(true); return; }
        setBusy(true); setErr("");
        try {
          await auto.flush();
          const r = await completeDraft({ draft, expected: seq.current, year: p.matricula!.ano!, on: p.matricula!.data!, classId: p.turma!.id! });
          if (p.foto?.path) await bindPhoto(draft).catch(() => null);
          onDone(r.student_id);
        } catch (e) { setErr(wizardMessage(e)); setConfirm(false); } finally { setBusy(false); }
      }}>{busy ? "Concluindo…" : confirm ? "Sim, concluir matrícula" : "Concluir matrícula"}</Button>
      {err ? <p role="alert" className="mt-1 text-sm text-destructive">{err}</p> : null}
    </div>
  );
}

function Discard({ draft, seq, auto, onDone, photo }: { draft: string; seq: React.MutableRefObject<number>; auto: Auto; onDone: () => void; photo?: string | undefined }) {
  const [ask, setAsk] = useState(false);
  if (seq.current === 0 && !ask) return null;
  if (!ask) return <Button variant="ghost" onClick={() => setAsk(true)}>Descartar rascunho</Button>;
  return (
    <span className="flex items-center gap-2 text-sm" role="alertdialog" aria-label="Confirmar descarte">
      Descartar? Nada será matriculado.
      <Button variant="destructive" size="sm" onClick={async () => { await auto.flush(); await abandonDraft(draft, seq.current, "Descartado pela Secretaria"); if (photo) await removePhoto(photo).catch(() => null); onDone(); }}>Descartar</Button>
      <Button variant="outline" size="sm" onClick={() => setAsk(false)}>Manter</Button>
    </span>
  );
}

function Done({ school, studentId, name, onAgain }: { school: string; studentId: string; name: string; onAgain: () => void }) {
  const [life, setLife] = useState<{ kind: string; label: string }[] | null>(null);
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => { currentStudentPhoto(school, studentId).then((p) => (p ? photoUrl(p) : null)).then(setImg, () => setImg(null)); }, [school, studentId]);
  useEffect(() => { readSchoolLife(school, studentId).then((r) => setLife(r.map((x) => ({ kind: x.kind, label: lifeKindLabel(x.kind) }))), () => setLife([])); }, [school, studentId]);
  return (
    <section className="space-y-3 rounded-lg border border-success p-4" role="status">
      <div className="flex items-center gap-3">
        {img ? <img src={img} alt={`Foto de ${name}`} className="h-24 w-[4.5rem] rounded object-cover" /> : null}
        <h2 className="text-lg font-semibold">Matrícula concluída — {name}</h2>
      </div>
      <p className="text-sm">Ficha escolar atualizada:</p>
      <ul className="list-disc pl-5 text-sm">{(life ?? []).map((l, i) => <li key={i}>{l.label}</li>)}</ul>
      <div className="flex gap-2"><Button onClick={onAgain}>Nova matrícula</Button><Button variant="outline" asChild><Link to="/secretaria">Ir para a Secretaria</Link></Button></div>
    </section>
  );
}

function PhotoField({ school, draft, p, edit, auto }: { school: string; draft: string; p: WizardPayload; edit: Edit; auto: Auto }) {
  const [url, setUrl] = useState<string | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const path = p.foto?.path;
  useEffect(() => { if (path) photoUrl(path).then(setUrl, () => setUrl(null)); else setUrl(null); }, [path]);
  async function pick(f: File | undefined) {
    if (!f) return; setErr("");
    const kind = sniffImage(new Uint8Array(await f.slice(0, 16).arrayBuffer()));
    const bad = photoProblem(kind, f.size); if (bad) { setErr(bad); return; }
    setBusy(true);
    try {
      const np = photoPath(school, draft, crypto.randomUUID(), kind!);
      await uploadPhoto(np, f, kind!);
      const old = path; edit((x) => ({ ...x, foto: { path: np } })); await auto.flush();
      if (old) await removePhoto(old).catch(() => null);
    } catch { setErr("Não foi possível enviar a foto. Tente de novo."); } finally { setBusy(false); }
  }
  async function clear() {
    if (!path) return; setBusy(true);
    try { edit((x) => { const { foto: _f, ...rest } = x; return rest; }); await auto.flush(); await removePhoto(path).catch(() => null); } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
      <div className="flex h-28 w-[5.25rem] items-center justify-center overflow-hidden rounded bg-muted text-xs text-muted-foreground">
        {url ? <img src={url} alt="Foto 3×4 do aluno" className="h-full w-full object-cover" /> : "Sem foto"}
      </div>
      <div className="space-y-2">
        <p className="text-sm">Foto 3×4 <span className="text-muted-foreground">(opcional)</span></p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm">
            {path ? "Trocar foto" : "Adicionar foto"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
          <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm sm:hidden">
            Tirar foto
            <input type="file" accept="image/*" capture="user" className="sr-only" disabled={busy} onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
          {path ? <Button variant="ghost" size="sm" disabled={busy} onClick={() => void clear()}>Remover</Button> : null}
        </div>
        {busy ? <p className="text-xs text-muted-foreground">Enviando…</p> : null}
        {err ? <p role="alert" className="text-xs text-destructive">{err}</p> : null}
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PublicLayout } from "@/features/public-portal/public-layout";
import { listPublicCampaigns, readableId, TERM_LABEL, campaignWindow } from "@/features/enrollments/ingress-public";
import {
  emptyDraft, firstInvalidStep, STEP_LABEL, STEPS, stepErrors, submitApplication, SUBMIT_MESSAGE, effectiveStudentName,
  type Draft, type Errs,
} from "@/features/enrollments/application-wizard";
import { EmptyState } from "@/components/sigem/patterns";
import { ErrorState, LoadingState } from "@/components/sigem/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { institution } from "@/config/institution";

const TITLE = `Inscrição para matrícula — ${institution.departmentName}`;
const DESC = "Formulário de inscrição em etapas para campanha de matrícula publicada.";

export const Route = createFileRoute("/publico/inscricao/$campanhaId")({
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { name: "robots", content: "noindex" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApplicationPage,
});

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

function ApplicationPage() {
  const { campanhaId } = Route.useParams();
  const q = useQuery({ queryKey: ["enr-public-campaigns"], queryFn: listPublicCampaigns, staleTime: 60_000 });
  const c = q.data?.find((x) => x.campaign_id === campanhaId);
  return (
    <PublicLayout>
      <Link to="/publico/matriculas" className="inline-flex min-h-11 items-center text-sm text-primary hover:underline">← Voltar para matrículas</Link>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState description="Tente novamente em instantes." onRetry={() => q.refetch()} /> :
        !c || campaignWindow(c, today()) !== "aberta"
          ? <EmptyState title="Inscrição indisponível" description="Esta campanha não está recebendo pedidos agora. Confira os prazos na página de matrículas." />
          : <Wizard campaign={c} />}
    </PublicLayout>
  );
}

type C = NonNullable<Awaited<ReturnType<typeof listPublicCampaigns>>[number]>;

function Wizard({ campaign }: { campaign: C }) {
  // Rascunho só em memória: some ao fechar a página (contém dados de criança).
  const [d, setD] = useState<Draft>(emptyDraft);
  const [i, setI] = useState(0);
  const [errors, setErrors] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ code: string; check: string } | null>(null);
  const [fail, setFail] = useState<string | null>(null);
  const keyRef = useRef<string>(crypto.randomUUID());
  const headRef = useRef<HTMLHeadingElement>(null);
  const step = STEPS[i]!;
  const t = today();
  const dirty = JSON.stringify(d) !== JSON.stringify(emptyDraft());

  useEffect(() => {
    if (!dirty || done) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty, done]);
  useEffect(() => { headRef.current?.focus(); }, [i, done]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  function next() {
    const e = stepErrors(step, d, campaign, t); setErrors(e);
    if (!Object.keys(e).length) setI((x) => Math.min(x + 1, STEPS.length - 1));
  }
  async function send() {
    const bad = firstInvalidStep(d, campaign, t);
    if (bad) { setI(STEPS.indexOf(bad)); setErrors(stepErrors(bad, d, campaign, t)); return; }
    setBusy(true); setFail(null);
    const r = await submitApplication(campaign.campaign_id, d, keyRef.current);
    setBusy(false);
    if (r.result === "recebido" && r.code && r.check) { setDone({ code: r.code, check: r.check }); setD(emptyDraft()); }
    else setFail(r.result === "recebido" ? SUBMIT_MESSAGE.indisponivel : SUBMIT_MESSAGE[r.result]);
  }

  if (done) return (
    <section className="mt-4 rounded-md border border-border bg-card p-4" aria-labelledby="h-ok">
      <h1 id="h-ok" ref={headRef} tabIndex={-1} className="text-2xl font-semibold text-foreground outline-none">Pedido recebido</h1>
      <p className="mt-2 text-sm text-foreground">Anote ou fotografe os dois códigos abaixo. Eles aparecem só agora e são necessários para consultar o pedido.</p>
      <dl className="mt-3 grid gap-2 text-sm">
        <div><dt className="text-muted-foreground">Número da inscrição</dt><dd className="font-mono text-lg text-foreground">{done.code}</dd></div>
        <div><dt className="text-muted-foreground">Código de conferência</dt><dd className="font-mono text-lg text-foreground">{done.check}</dd></div>
      </dl>
      <p className="mt-3 text-sm text-muted-foreground">O pedido não garante vaga. Ele será analisado conforme o edital; a matrícula só existe depois de confirmada pela escola.</p>
      <Button className="mt-4 min-h-11" onClick={() => window.print()}>Imprimir comprovante</Button>
    </section>
  );

  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground">{readableId(campaign.kind)} — {TERM_LABEL[campaign.cycle_term] ?? campaign.cycle_term} {campaign.cycle_year}</p>
      <h1 ref={headRef} tabIndex={-1} className="mt-1 text-2xl font-semibold text-foreground outline-none">{STEP_LABEL[step]}</h1>
      <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">Etapa {i + 1} de {STEPS.length}</p>
      <ol className="mt-3 flex gap-1" aria-label="Progresso">
        {STEPS.map((s, k) => <li key={s} className={`h-1.5 flex-1 rounded ${k <= i ? "bg-primary" : "bg-muted"}`} aria-current={k === i ? "step" : undefined}><span className="sr-only">{STEP_LABEL[s]}</span></li>)}
      </ol>
      <p className="mt-3 rounded-md border border-border bg-muted p-3 text-sm text-foreground">Seus dados ficam só nesta página até o envio. Se fechar ou recarregar, será preciso preencher de novo.</p>

      {Object.keys(errors).length > 0 && (
        <div role="alert" className="mt-3 rounded-md border border-destructive bg-card p-3 text-sm text-foreground">
          <p className="font-medium">Revise {Object.keys(errors).length === 1 ? "o campo indicado" : "os campos indicados"}:</p>
          <ul className="mt-1 list-disc pl-5">{Object.values(errors).map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}

      <form className="mt-4 grid gap-4" onSubmit={(e) => { e.preventDefault(); if (step === "conferencia") void send(); else next(); }} noValidate>
        {step === "responsavel" && <>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-foreground">Quem está pedindo?</legend>
            {(["responsavel", "estudante-adulto"] as const).map((k) => (
              <label key={k} className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                <input type="radio" name="kind" checked={d.requesterKind === k} onChange={() => set("requesterKind", k)} className="size-5" />
                {k === "responsavel" ? "Responsável pelo estudante" : "O próprio estudante (maior de idade)"}
              </label>
            ))}
          </fieldset>
          <Field id="requesterName" label="Nome completo" error={errors.requesterName}><Input value={d.requesterName} onChange={(e) => set("requesterName", e.target.value)} autoComplete="name" /></Field>
          <Field id="requesterCpf" label="CPF" error={errors.requesterCpf}><Input value={d.requesterCpf} onChange={(e) => set("requesterCpf", e.target.value)} inputMode="numeric" autoComplete="off" /></Field>
          <Field id="email" label="E-mail" hint="Informe e-mail, telefone ou os dois." error={errors.email}><Input type="email" value={d.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></Field>
          <Field id="phone" label="Telefone com DDD" error={errors.phone}><Input type="tel" value={d.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" inputMode="tel" /></Field>
          {d.requesterKind === "responsavel" && <Field id="kinship" label="Parentesco com o estudante" hint="É uma declaração. O acesso da família é autorizado depois, pela escola." error={errors.kinship}><Input value={d.kinship} onChange={(e) => set("kinship", e.target.value)} /></Field>}
        </>}

        {step === "estudante" && <>
          {d.requesterKind === "responsavel"
            ? <Field id="studentName" label="Nome completo do estudante" error={errors.studentName}><Input value={d.studentName} onChange={(e) => set("studentName", e.target.value)} autoComplete="off" /></Field>
            : <p className="text-sm text-muted-foreground">Estudante: {d.requesterName || "—"}</p>}
          <Field id="studentBirth" label="Data de nascimento" error={errors.studentBirth}><Input type="date" value={d.studentBirth} max={t} onChange={(e) => set("studentBirth", e.target.value)} /></Field>
          <Field id="studentCpf" label="CPF do estudante (se tiver)" error={errors.studentCpf}><Input value={d.studentCpf} onChange={(e) => set("studentCpf", e.target.value)} inputMode="numeric" autoComplete="off" /></Field>
        </>}

        {step === "etapa" && <>
          <Choice name="stage" legend="Etapa" options={campaign.stage_ids} value={d.stage} onChange={(v) => set("stage", v)} error={errors.stage} />
          <Choice name="modality" legend="Modalidade" options={campaign.modality_ids} value={d.modality} onChange={(v) => set("modality", v)} error={errors.modality} />
        </>}

        {step === "preferencias" && (
          <fieldset className="grid gap-2" aria-describedby={errors.schools ? "err-schools" : undefined}>
            <legend className="text-sm font-medium text-foreground">Marque as escolas na ordem de preferência</legend>
            {campaign.schools.map((s) => {
              const pos = d.schools.indexOf(s.school_id);
              return (
                <label key={s.school_id} className="flex min-h-11 items-center gap-2 rounded-md border border-border p-2 text-sm text-foreground">
                  <input type="checkbox" className="size-5" checked={pos >= 0}
                    onChange={() => set("schools", pos >= 0 ? d.schools.filter((x) => x !== s.school_id) : [...d.schools, s.school_id])} />
                  <span className="min-w-0 flex-1">{s.name ?? "Escola sem nome registrado"}</span>
                  {pos >= 0 && <span className="shrink-0 rounded bg-muted px-2 text-xs">{pos + 1}ª opção</span>}
                </label>
              );
            })}
            {errors.schools && <p id="err-schools" aria-live="polite" className="text-sm text-destructive">{errors.schools}</p>}
          </fieldset>
        )}

        {step === "criterios" && (
          <p className="rounded-md border border-border bg-card p-3 text-sm text-foreground">
            Esta campanha não pede declaração de critérios pelo portal. Os critérios de prioridade, quando houver, são os do edital e serão conferidos pela equipe com os documentos.
          </p>
        )}

        {step === "documentos" && <>
          <p className="text-sm text-foreground">A lista de documentos é a do edital da campanha. Leve os originais quando for chamado.</p>
          {campaign.edital_verification_code
            ? <Link to="/verificar/ato/$codigo" params={{ codigo: campaign.edital_verification_code }} target="_blank" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">Abrir o edital</Link>
            : <p className="text-sm text-muted-foreground">Edital não disponível online: procure o atendimento para saber os documentos.</p>}
          <Check id="documentsAck" checked={d.documentsAck} onChange={(v) => set("documentsAck", v)} error={errors.documentsAck}>Li a lista de documentos do edital.</Check>
        </>}

        {step === "conferencia" && <>
          <dl className="grid gap-1 rounded-md border border-border bg-card p-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
            <dt className="text-muted-foreground">Quem pede</dt><dd className="text-foreground">{d.requesterName}{d.kinship && d.requesterKind === "responsavel" ? ` (${d.kinship})` : ""}</dd>
            <dt className="text-muted-foreground">Estudante</dt><dd className="text-foreground">{effectiveStudentName(d)} · {d.studentBirth}</dd>
            <dt className="text-muted-foreground">Etapa</dt><dd className="text-foreground">{readableId(d.stage)} · {readableId(d.modality)}</dd>
            <dt className="text-muted-foreground">Escolas</dt><dd className="text-foreground">{d.schools.map((s, k) => `${k + 1}ª ${campaign.schools.find((x) => x.school_id === s)?.name ?? "Escola"}`).join("; ")}</dd>
            <dt className="text-muted-foreground">Contato</dt><dd className="text-foreground">{[d.email, d.phone].filter(Boolean).join(" · ")}</dd>
          </dl>
          <Check id="truth" checked={d.truth} onChange={(v) => set("truth", v)} error={errors.truth}>Declaro que as informações são verdadeiras.</Check>
          {fail && <p role="alert" className="rounded-md border border-destructive bg-card p-3 text-sm text-foreground">{fail}</p>}
        </>}

        <div className="flex flex-wrap gap-2">
          {i > 0 && <Button type="button" variant="outline" className="min-h-11" onClick={() => { setErrors({}); setI(i - 1); }}>Voltar</Button>}
          <Button type="submit" className="min-h-11" disabled={busy}>{step === "conferencia" ? (busy ? "Enviando…" : "Enviar pedido") : "Continuar"}</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string | undefined; error?: string | undefined; children: ReactNode }) {
  const uid = useId(); const fid = `${id}-${uid}`;
  const child = children as React.ReactElement<Record<string, unknown>>;
  const desc = [hint && `${fid}-h`, error && `${fid}-e`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-1">
      <Label htmlFor={fid}>{label}</Label>
      {{ ...child, props: { ...child.props, id: fid, "aria-invalid": error ? true : undefined, "aria-describedby": desc, className: "min-h-11" } }}
      {hint && <p id={`${fid}-h`} className="text-sm text-muted-foreground">{hint}</p>}
      {error && <p id={`${fid}-e`} aria-live="polite" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
function Choice({ name, legend, options, value, onChange, error }: { name: string; legend: string; options: string[]; value: string; onChange: (v: string) => void; error?: string | undefined }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      {options.map((o) => (
        <label key={o} className="flex min-h-11 items-center gap-2 text-sm text-foreground">
          <input type="radio" name={name} className="size-5" checked={value === o} onChange={() => onChange(o)} />{readableId(o)}
        </label>
      ))}
      {error && <p aria-live="polite" className="text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}
function Check({ id, checked, onChange, error, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; error?: string | undefined; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="flex min-h-11 items-center gap-2 text-sm text-foreground">
        <input id={id} type="checkbox" className="size-5" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={error ? true : undefined} />{children}
      </label>
      {error && <p aria-live="polite" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

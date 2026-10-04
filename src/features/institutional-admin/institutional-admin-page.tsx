import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { safeInstallReturn } from "@/features/calendar/calendar-access-onboarding";
import { PageHeader } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createInstitutionalAccount,
  listInstitutionalAccounts,
  resetInstitutionalCredential,
} from "./accounts.functions";
import { SchoolsAdminSection } from "./schools-admin-section";
import { SchoolSourceImportSection } from "./school-source-import-section";
import { StudentsAdminSection } from "./students-admin-section";
import { ComponentsAdminSection } from "./components-admin-section";
import { AcademicPeriodsAdminSection } from "./academic-periods-admin-section";
import { CatalogsAdminSection } from "./catalogs-admin-section";

/**
 * Administração institucional (B1): só coleta e exibe. Toda autorização é do
 * banco (capacidade vigente pela política homologada); a tela nunca concede nada.
 */
type Person = { id: string; display_name: string; institutional_identifier: string | null };
type Engagement = {
  id: string;
  person_id: string;
  engagement_kind_id: string;
  scope_level: string | null;
  school_id: string | null;
  valid_from: string;
  valid_until: string | null;
  originating_act_ref: string | null;
};
type Policy = { id: string; logical_policy_id: string; version: number; status: string; homologation_act_ref: string | null };

const ERRORS: Record<string, string> = {
  "install:not-designated": "Esta conta não é a conta designada para a instalação.",
  "install:already-installed": "O SIGEM já foi instalado. A instalação não se repete.",
  "install:act-required": "Informe a referência do ato de implantação.",
  "install:engagement-kind-without-rules": "A política escolhida não tem regras para esse tipo de atuação.",
  "install:policy-not-draft": "A política escolhida não está em rascunho.",
  "install:unauthenticated": "Entre com a conta institucional antes de instalar.",
  "install:review-not-confirmed": "Confirme que revisou todas as regras.",
  "install:review-stale": "A política mudou desde a revisão. Revise de novo.",
  "person:identifier-in-use": "Já existe pessoa com esse identificador institucional.",
  "policy:would-remove-administration": "Homologação recusada: com esta versão, nenhuma atuação vigente de rede conseguiria mais administrar pessoas, contas, atuações ou a própria política.",
};
function humanError(msg: string): string {
  const key = Object.keys(ERRORS).find((k) => msg.includes(k));
  if (key) return ERRORS[key]!;
  const cap = msg.match(/capability:([a-z-]+)/);
  if (cap) return `Sua atuação vigente não concede a capacidade necessária (${cap[1]}).`;
  return "Operação recusada; nada foi gravado.";
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <h2 className="mb-3 font-display text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
function Field({ id, label, ...rest }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} {...rest} />
    </div>
  );
}
function Notice({ text, tone = "muted" }: { text: string | null; tone?: "muted" | "error" }) {
  if (!text) return null;
  return <p className={tone === "error" ? "mt-2 text-sm text-destructive" : "mt-2 text-sm text-muted-foreground"}>{text}</p>;
}

export function InstitutionalAdminPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [designated, setDesignated] = useState(false);
  const [mustChange, setMustChange] = useState(false);
  const [caps, setCaps] = useState<string[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof listInstitutionalAccounts>>>([]);
  const listAccounts = useServerFn(listInstitutionalAccounts);
  const navigate = useNavigate();

  const reload = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    setSignedIn(!!u.user);
    const st = await supabase.from("sigem_installation_state").select("state").maybeSingle();
    setState(st.data?.state ?? null);
    if (!u.user) return;
    const [d, m, c, p, e, pol] = await Promise.all([
      supabase.rpc("am_designated_installer"),
      supabase.rpc("password_change_required"),
      supabase.rpc("effective_scope_capabilities"),
      supabase.from("institutional_persons").select("id, display_name, institutional_identifier").order("display_name"),
      supabase.from("institutional_engagements").select("id, person_id, engagement_kind_id, scope_level, school_id, valid_from, valid_until, originating_act_ref"),
      supabase.from("capability_policies").select("id, logical_policy_id, version, status, homologation_act_ref").order("version"),
    ]);
    setDesignated(!!d.data);
    setMustChange(!!m.data);
    setCaps(Array.from(new Set((c.data ?? []).map((x: { capability_id: string }) => x.capability_id))).sort());
    setPersons((p.data ?? []) as Person[]);
    setEngagements((e.data ?? []) as Engagement[]);
    setPolicies((pol.data ?? []) as Policy[]);
    setAccounts(await listAccounts());
  }, [listAccounts]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const has = (cap: string) => caps.includes(cap);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-6">
      <PageHeader
        eyebrow="Administração institucional"
        title="Pessoas, contas, atuações e política"
        description="Conta e pessoa identificam quem entra; o que cada um pode fazer vem só da atuação vigente e da política homologada."
      />
      {signedIn === false && <Notice text="Entre com uma conta institucional para usar esta área. Contas são criadas só pela administração; o login institucional é identificador, não caixa postal." />}
      {signedIn && mustChange && <PasswordChange onDone={reload} />}
      {signedIn && state === "nao-instalado" && designated && <Installation policies={policies} onDone={async () => { await reload(); const back = safeInstallReturn(new URLSearchParams(window.location.search).get("retorno")); if (back) void navigate({ to: back }); }} />}
      {signedIn && state === "nao-instalado" && !designated && (
        <Notice text="O SIGEM ainda não foi instalado. A instalação só pode ser feita pela conta designada no ato de implantação." />
      )}
      {signedIn && (
        <Section title="Minhas capacidades">
          {caps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma capacidade vigente. Ter conta não concede capacidades.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">{caps.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}</div>
          )}
        </Section>
      )}
      {has("manter-pessoas-institucionais") && <PersonsSection persons={persons} onDone={reload} />}
      {has("manter-contas-institucionais") && <AccountsSection persons={persons} accounts={accounts} onDone={reload} />}
      {has("manter-atuacoes-institucionais") && <EngagementsSection persons={persons} engagements={engagements} onDone={reload} />}
      {(has("registrar-politica-de-capacidades") || has("homologar-politica-de-capacidades")) && (
        <PolicySection policies={policies} canHomologate={has("homologar-politica-de-capacidades")} onDone={reload} />
      )}
      {signedIn && <SchoolsAdminSection canMaintain={has("manter-cadastro-unidade-escolar")} />}
      {signedIn && <SchoolSourceImportSection canMaintain={has("manter-cadastro-unidade-escolar")} />}
      {signedIn && <ComponentsAdminSection canMaintain={has("manter-componentes-curriculares")} />}
      {signedIn && <AcademicPeriodsAdminSection canMaintain={has("manter-anos-e-periodos-letivos")} />}
      {signedIn && <CatalogsAdminSection canMaintain={has("manter-catalogos-institucionais")} />}
      {signedIn && has("consultar-identidade-cadastral-do-estudante") && (
        <StudentsAdminSection canRegister={has("cadastrar-estudante-na-rede")} canMaintain={has("manter-identidade-cadastral-do-estudante")} />
      )}
    </div>
  );
}

type ReviewRule = { engagementKindId: string; capabilityId: string; scope: string[] };
type ReviewPolicy = { id: string; logicalPolicyId: string; version: number; status: string; fingerprint: string; rules: ReviewRule[] };
type Review = { state: "lido"; installation: string; emailConfirmed: boolean; policies: ReviewPolicy[] } | { state: "access-denied" } | { state: "erro"; reason: string };

/** Capacidades que a ativação do calendário 2027 exige (por regra declarada, nunca presumida). */
const CALENDAR_CAPS = ["construir-calendario-da-rede", "homologar-calendario-da-rede", "construir-norma-composicao-calendario-da-rede", "homologar-norma-composicao-calendario-da-rede"];

const FP = /^[0-9a-f]{64}$/;

export function parseInstallationReview(v: unknown): Review {
  if (!v || typeof v !== "object") return { state: "erro", reason: "resposta-vazia" };
  const o = v as Record<string, unknown>;
  if (o["contract"] !== "b4.6.7e/1") return { state: "erro", reason: "contrato" };
  if (o["state"] === "access-denied") return { state: "access-denied" };
  if (o["state"] !== "lido" || !Array.isArray(o["policies"])) return { state: "erro", reason: "forma" };
  const policies = o["policies"] as ReviewPolicy[];
  // Sem impressão digital válida não há revisão vinculável: falha fechada.
  if (policies.some((p) => !p || typeof p.fingerprint !== "string" || !FP.test(p.fingerprint) || !Array.isArray(p.rules)))
    return { state: "erro", reason: "impressao-digital" };
  return { state: "lido", installation: String(o["installation"]), emailConfirmed: o["emailConfirmed"] === true, policies };
}

/** Argumentos do ato: a impressão enviada é exatamente a da política revisada na tela. */
export type ActorNature = "pessoa-natural" | "orgao-institucional";
export function buildInstallArgs(policy: ReviewPolicy, f: { act: string; name: string; identifier: string; label: string; nature: ActorNature }, kind: string, confirmed: boolean) {
  return {
    _act_ref: f.act, _actor_nature: f.nature, _person_name: f.name, _person_identifier: f.identifier,
    _engagement_kind_id: kind, _position_label: f.label, _policy_id: policy.id,
    _expected_fingerprint: policy.fingerprint, _confirm_all_rules_reviewed: confirmed,
  };
}

function Installation({ onDone }: { policies: Policy[]; onDone: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [policyId, setPolicyId] = useState<string>("");
  const [kind, setKind] = useState<string>("");
  const [confirmed, setConfirmed] = useState(false);
  const [nature, setNature] = useState<ActorNature>("orgao-institucional");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.rpc("installation_review");
      setReview(error ? { state: "erro", reason: "leitura-falhou" } : parseInstallationReview(data));
    })();
  }, []);
  const policy = review?.state === "lido" ? review.policies.find((p) => p.id === policyId) ?? null : null;
  const byKind = new Map<string, ReviewRule[]>();
  for (const r of policy?.rules ?? []) byKind.set(r.engagementKindId, [...(byKind.get(r.engagementKindId) ?? []), r]);
  const calendarHolders = CALENDAR_CAPS.map((c) => ({ cap: c, kinds: [...byKind.entries()].filter(([, rs]) => rs.some((r) => r.capabilityId === c)).map(([k]) => k) }));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!policy || !confirmed) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.rpc("install_sigem_reviewed", buildInstallArgs(policy,
      { act: String(f.get("act")), name: String(f.get("name")), identifier: String(f.get("identifier")), label: String(f.get("label")), nature },
      kind, confirmed));
    setBusy(false);
    if (error) return setErr(humanError(error.message));
    onDone();
  }
  if (!review) return <Section title="Ato de instalação (uso único)"><p className="text-sm text-muted-foreground">Lendo a política para revisão…</p></Section>;
  if (review.state !== "lido")
    return <Section title="Ato de instalação (uso único)"><Notice tone="error" text={review.state === "access-denied" ? "Esta conta não pode revisar a instalação." : "Não foi possível ler a política para revisão. Nada foi instalado."} /></Section>;
  return (
    <Section title="Ato de instalação (uso único)">
      <p className="mb-3 text-sm text-muted-foreground">
        A instalação registra o primeiro ator institucional (órgão ou pessoa), a sua atuação de rede e homologa a política escolhida pelo ato informado. Ela só acontece quando você
        revisar todas as regras e confirmar. Depois disso, esta porta fecha definitivamente.
      </p>
      <div className="mb-3 grid gap-1">
        <Label htmlFor="policy">Política em rascunho a revisar</Label>
        <select id="policy" value={policyId} onChange={(e) => { setPolicyId(e.target.value); setKind(""); setConfirmed(false); }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Escolha…</option>
          {review.policies.map((p) => <option key={p.id} value={p.id}>{p.logicalPolicyId} v{p.version} — {p.rules.length} regras</option>)}
        </select>
      </div>
      {policy && (
        <>
          <div className="mb-3 max-h-96 overflow-auto rounded-md border p-3 text-sm" aria-label="Regras da política">
            {[...byKind.entries()].map(([k, rs]) => (
              <div key={k} className="mb-2">
                <p className="font-medium">{k} — {rs.length} regras</p>
                <ul className="ml-4 list-disc text-muted-foreground">{rs.map((r) => <li key={r.capabilityId}>{r.capabilityId}{r.scope.length ? ` (${r.scope.join(", ")})` : ""}</li>)}</ul>
              </div>
            ))}
          </div>
          <div className="mb-3 rounded-md border p-3 text-sm">
            <p className="font-medium">Pré-requisitos para ativar o calendário 2027</p>
            <ul className="ml-4 list-disc text-muted-foreground">
              {calendarHolders.map((h) => <li key={h.cap}>{h.cap}: {h.kinds.length ? `atuação ${h.kinds.join(" ou ")}` : "nenhuma regra nesta política — o calendário não poderá ser ativado com ela"}</li>)}
              <li>Depois da instalação: cadastrar ano letivo, escolas (com INEP real), turmas e alocações; a Supervisão recebe atuação com as capacidades acima.</li>
              <li>Importação 2027: em Calendário escolar, a Supervisão pede “Importar do navegador” neste MESMO navegador; o original é preservado e nada é lido sem esse pedido.</li>
              <li>Agenda de conselhos: os tipos de dia que são conselho são declarados explicitamente em cada versão do calendário, por quem constrói.</li>
            </ul>
          </div>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <Field id="act" label="Ato de implantação (referência real)" required />
            <fieldset className="grid gap-1 text-sm sm:col-span-2">
              <legend className="font-medium">Quem esta conta representa</legend>
              <label className="flex items-center gap-2"><input type="radio" name="nature" checked={nature === "orgao-institucional"} onChange={() => setNature("orgao-institucional")} /> Órgão ou setor institucional (sem pessoa específica)</label>
              <label className="flex items-center gap-2"><input type="radio" name="nature" checked={nature === "pessoa-natural"} onChange={() => setNature("pessoa-natural")} /> Pessoa natural</label>
              <span className="text-xs text-muted-foreground">A natureza só identifica a autoria; o que a conta pode fazer vem da atuação e da política homologada, nunca do e-mail.</span>
            </fieldset>
            <Field id="name" label={nature === "orgao-institucional" ? "Nome oficial do órgão (ex.: Supervisão Escolar)" : "Nome da pessoa (real)"} required />
            <Field id="identifier" label="Identificador institucional (matrícula)" />
            <div className="grid gap-1">
              <Label htmlFor="kind">Tipo de atuação de rede</Label>
              <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)} required className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Escolha…</option>
                {[...byKind.keys()].map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <Field id="label" label="Rótulo do cargo (só leitura)" />
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              Revisei as {policy.rules.length} regras desta política e, pelo ato informado, as homologo.
            </label>
            <div className="sm:col-span-2"><Button type="submit" disabled={!confirmed || !kind || busy}>Registrar instalação</Button></div>
          </form>
        </>
      )}
      <Notice text={err} tone="error" />
    </Section>
  );
}

function PasswordChange({ onDone }: { onDone: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const pw = String(f.get("pw"));
    if (pw.length < 10 || pw !== String(f.get("pw2"))) return setErr("A nova senha precisa ter 10+ caracteres e coincidir.");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setErr("Não foi possível trocar a senha.");
    await supabase.rpc("record_own_password_change");
    onDone();
  }
  return (
    <Section title="Troque sua senha provisória">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field id="pw" label="Nova senha" type="password" autoComplete="new-password" required />
        <Field id="pw2" label="Repita a nova senha" type="password" autoComplete="new-password" required />
        <div className="sm:col-span-2"><Button type="submit">Trocar senha</Button></div>
      </form>
      <Notice text={err} tone="error" />
    </Section>
  );
}

function PersonsSection({ persons, onDone }: { persons: Person[]; onDone: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const { error } = await supabase.rpc("register_person", { _display_name: String(f.get("pname")), _identifier: String(f.get("pid")) });
    if (error) return setErr(humanError(error.message));
    setErr(null);
    form.reset();
    onDone();
  }
  const shown = persons.filter((p) => `${p.display_name} ${p.institutional_identifier ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Section title="Pessoas">
      <Input placeholder="Localizar por nome ou matrícula" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" aria-label="Localizar pessoa" />
      <ul className="mb-4 grid gap-1 text-sm">
        {shown.map((p) => <li key={p.id}>{p.display_name}{p.institutional_identifier ? ` — ${p.institutional_identifier}` : ""}</li>)}
        {shown.length === 0 && <li className="text-muted-foreground">Nenhuma pessoa encontrada.</li>}
      </ul>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field id="pname" label="Nome" required />
        <Field id="pid" label="Identificador institucional" />
        <Button type="submit">Cadastrar pessoa</Button>
      </form>
      <Notice text={err} tone="error" />
    </Section>
  );
}

function AccountsSection({ persons, accounts, onDone }: { persons: Person[]; accounts: Awaited<ReturnType<typeof listInstitutionalAccounts>>; onDone: () => void }) {
  const create = useServerFn(createInstitutionalAccount);
  const reset = useServerFn(resetInstitutionalCredential);
  const [err, setErr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const linked = new Set(accounts.map((a) => a.personId));
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSecret(null);
    const r = await create({ data: { personId: String(f.get("aperson")), basis: String(f.get("basis")) as "matricula", value: String(f.get("avalue")) } });
    if (!r.ok) return setErr(r.error);
    setErr(null);
    setSecret(`Conta ${r.login} criada. Senha provisória (exibida só agora): ${r.provisionalPassword}`);
    onDone();
  }
  async function doReset(userId: string) {
    const act = window.prompt("Referência do ato que autoriza a redefinição:");
    if (!act) return;
    const r = await reset({ data: { userId, actRef: act } });
    if (!r.ok) return setErr(r.error);
    setSecret(`Nova senha provisória (exibida só agora): ${r.provisionalPassword}`);
    onDone();
  }
  const name = (id: string) => persons.find((p) => p.id === id)?.display_name ?? "Pessoa";
  return (
    <Section title="Contas institucionais">
      <ul className="mb-4 grid gap-2 text-sm">
        {accounts.map((a) => (
          <li key={a.userId} className="flex flex-wrap items-center justify-between gap-2">
            <span>{name(a.personId)} — {a.login ?? "login não registrado"}{a.lastEvent !== "troca" ? " · troca de senha pendente" : ""}</span>
            <Button size="sm" variant="outline" onClick={() => doReset(a.userId)}>Redefinir credencial</Button>
          </li>
        ))}
        {accounts.length === 0 && <li className="text-muted-foreground">Nenhuma conta vinculada.</li>}
      </ul>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3 sm:items-end">
        <div className="grid gap-1">
          <Label htmlFor="aperson">Pessoa</Label>
          <select id="aperson" name="aperson" required className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {persons.filter((p) => !linked.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="basis">Regra do login</Label>
          <select id="basis" name="basis" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="matricula">Matrícula (profissional)</option>
            <option value="inep">INEP (escola)</option>
            <option value="setor">Nome do setor</option>
          </select>
        </div>
        <Field id="avalue" label="Matrícula, INEP ou setor" required />
        <div className="sm:col-span-3"><Button type="submit">Criar conta</Button></div>
      </form>
      <Notice text={err} tone="error" />
      {secret && <p className="mt-3 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm text-foreground">{secret}</p>}
    </Section>
  );
}

function EngagementsSection({ persons, engagements, onDone }: { persons: Person[]; engagements: Engagement[]; onDone: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const classes = String(f.get("eclasses")).split(",").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.rpc("record_engagement", {
      _person: String(f.get("eperson")),
      _kind: String(f.get("ekind")),
      _scope_level: String(f.get("escope")),
      _school: String(f.get("eschool")),
      _class_ids: classes,
      _component: String(f.get("ecomponent")),
      _period: String(f.get("eperiod")),
      _valid_from: String(f.get("efrom")),
      _valid_until: (String(f.get("euntil")) || null) as string,
      _act_ref: String(f.get("eact")),
      _position_label: String(f.get("elabel")),
    });
    if (error) return setErr(humanError(error.message));
    setErr(null);
    onDone();
  }
  async function end(id: string) {
    const act = window.prompt("Referência do ato de encerramento:");
    const on = act ? window.prompt("Data de encerramento (AAAA-MM-DD):") : null;
    if (!act || !on) return;
    const { error } = await supabase.rpc("end_engagement", { _engagement: id, _ended_on: on, _act_ref: act });
    if (error) return setErr(humanError(error.message));
    onDone();
  }
  const name = (id: string) => persons.find((p) => p.id === id)?.display_name ?? "Pessoa";
  return (
    <Section title="Atuações">
      <ul className="mb-4 grid gap-2 text-sm">
        {engagements.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>{name(g.person_id)} — {g.engagement_kind_id} · alcance {g.scope_level ?? "nenhum"}{g.school_id ? ` (${g.school_id})` : ""} · {g.valid_from} a {g.valid_until ?? "sem fim"} · ato {g.originating_act_ref ?? "—"}</span>
            {!g.valid_until && <Button size="sm" variant="outline" onClick={() => end(g.id)}>Encerrar vigência</Button>}
          </li>
        ))}
        {engagements.length === 0 && <li className="text-muted-foreground">Nenhuma atuação registrada.</li>}
      </ul>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor="eperson">Pessoa</Label>
          <select id="eperson" name="eperson" required className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {persons.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
        </div>
        <Field id="ekind" label="Tipo de atuação" required />
        <div className="grid gap-1">
          <Label htmlFor="escope">Alcance</Label>
          <select id="escope" name="escope" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="rede">Rede</option><option value="escola">Escola</option><option value="turmas">Turmas</option><option value="turma">Turma</option>
          </select>
        </div>
        <Field id="eschool" label="Escola (código)" />
        <Field id="eclasses" label="Turmas (códigos, separados por vírgula)" />
        <Field id="ecomponent" label="Componente" />
        <Field id="eperiod" label="Período" />
        <Field id="efrom" label="Início da vigência" type="date" required />
        <Field id="euntil" label="Fim da vigência" type="date" />
        <Field id="eact" label="Ato originador" required />
        <Field id="elabel" label="Rótulo do cargo (só leitura)" />
        <div className="sm:col-span-2"><Button type="submit">Registrar atuação</Button></div>
      </form>
      <Notice text={err} tone="error" />
    </Section>
  );
}

function PolicySection({ policies, canHomologate, onDone }: { policies: Policy[]; canHomologate: boolean; onDone: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  async function homologate(id: string) {
    const act = window.prompt("Referência do ato de homologação:");
    const from = act ? window.prompt("Início da vigência (AAAA-MM-DD):") : null;
    if (!act || !from) return;
    const { error } = await supabase.rpc("homologate_capability_policy", { _policy: id, _act_ref: act, _valid_from: from });
    if (error) return setErr(humanError(error.message));
    onDone();
  }
  return (
    <Section title="Política de Capacidades">
      <ul className="grid gap-2 text-sm">
        {policies.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>{p.logical_policy_id} v{p.version} — {p.status === "homologated" ? `homologada (ato ${p.homologation_act_ref})` : "rascunho"}</span>
            {canHomologate && p.status === "draft" && <Button size="sm" onClick={() => homologate(p.id)}>Homologar mediante ato</Button>}
          </li>
        ))}
      </ul>
      <Notice text={err} tone="error" />
    </Section>
  );
}

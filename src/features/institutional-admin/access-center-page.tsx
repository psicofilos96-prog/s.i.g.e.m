import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useSessionAuthority, sessionContextKey } from "@/features/authority/session-authority";
import {
  diffPolicies, effectiveVersion, engagementActive, headVersion, humanizePolicyError, validateDraft,
  type PolicyRule, type PolicyVersion,
} from "./policy-governance";

const today = () => new Date().toISOString().slice(0, 10);

/** Central de usuários, atuações, capacidades e políticas. Todas as gravações passam por RPC. */
export function AccessCenterPage() {
  const authority = useSessionAuthority();
  const held = new Set(authority.status === "signed-in" ? authority.capabilities.filter((c) => c.policyId).map((c) => c.capabilityId) : []);
  const key = sessionContextKey(authority);
  const enabled = authority.status === "signed-in";
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["access-center"] });

  const people = useQuery({ queryKey: ["access-center", "people", key], enabled, queryFn: async () => {
    const [p, e, end] = await Promise.all([
      supabase.from("institutional_persons").select("id, display_name, actor_nature, institutional_identifier").order("display_name"),
      supabase.from("institutional_engagements").select("id, person_id, engagement_kind_id, scope_level, school_id, valid_from, valid_until, position_label_snapshot"),
      supabase.from("engagement_endings").select("engagement_id, ended_on"),
    ]);
    if (p.error || e.error || end.error) throw p.error ?? e.error ?? end.error;
    return { persons: p.data, engagements: e.data, endings: end.data };
  } });
  const accounts = useQuery({ queryKey: ["access-center", "accounts", key], enabled: enabled && held.has("manter-contas-institucionais"), queryFn: async () => {
    const { data, error } = await supabase.rpc("admin_account_overview"); if (error) throw error; return data ?? [];
  } });
  const policies = useQuery({ queryKey: ["access-center", "policies", key], enabled, queryFn: async () => {
    const [v, r] = await Promise.all([
      supabase.from("capability_policies").select("id, logical_policy_id, version, status, supersedes_version_id, valid_from, valid_until, homologation_origin, homologated_at, homologated_by, created_at, created_by").order("version"),
      supabase.from("capability_policy_rules").select("policy_id, engagement_kind_id, capability_id, scope_dimensions"),
    ]);
    if (v.error || r.error) throw v.error ?? r.error;
    const rules = new Map<string, PolicyRule[]>();
    for (const x of r.data) rules.set(x.policy_id, [...(rules.get(x.policy_id) ?? []), { engagement_kind_id: x.engagement_kind_id, capability_id: x.capability_id, scope_dimensions: x.scope_dimensions }]);
    return { versions: v.data as PolicyVersion[], rules };
  } });

  if (authority.status === "signed-out") return <Shell><p className="text-muted-foreground">Entre com a sua conta institucional para continuar.</p></Shell>;
  if (authority.status !== "signed-in") return <Shell><p className="text-muted-foreground">Carregando a sua atuação…</p></Shell>;
  if (![...held].some((c) => c.startsWith("manter-") && c.endsWith("-institucionais") || c.endsWith("politica-de-capacidades")))
    return <Shell><p className="text-muted-foreground">Esta central exige capacidade administrativa de rede na política vigente. Cargo ou função não concede acesso.</p></Shell>;

  return (
    <Shell>
      <div role="note" className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
        <p className="font-semibold">Cargo e função não são permissão.</p>
        <p className="mt-1 text-muted-foreground">Uma conta só pode agir pelo que a política efetiva concede ao tipo de atuação vigente, no escopo declarado. Não há curinga, troca de perfil nem acesso automático aos setores.</p>
      </div>
      <Loadable q={people} label="pessoas e atuações">{(d) => <PeopleSection data={d} accounts={accounts.data ?? null} accountsError={accounts.isError} />}</Loadable>
      <Loadable q={policies} label="políticas">{(d) => <PolicySection data={d} canDraft={held.has("registrar-politica-de-capacidades")} canHomologate={held.has("homologar-politica-de-capacidades")} onDone={refresh} />}</Loadable>
    </Shell>
  );
}

function Loadable<T>({ q, label, children }: { q: { isError: boolean; data: T | undefined }; label: string; children: (d: T) => React.ReactNode }) {
  if (q.isError) return <p role="alert" className="mt-6 text-destructive">Não foi possível ler {label}.</p>;
  if (!q.data) return <p className="mt-6 text-muted-foreground">Carregando {label}…</p>;
  return <>{children(q.data)}</>;
}

type PeopleData = { persons: { id: string; display_name: string; actor_nature: string; institutional_identifier: string | null }[];
  engagements: { id: string; person_id: string; engagement_kind_id: string; scope_level: string | null; school_id: string | null; valid_from: string; valid_until: string | null; position_label_snapshot: string | null }[];
  endings: { engagement_id: string; ended_on: string }[] };
type Account = { user_id: string; person_id: string | null; login: string | null; last_sign_in_at: string | null; banned: boolean; password_change_required: boolean };

function PeopleSection({ data, accounts, accountsError }: { data: PeopleData; accounts: Account[] | null; accountsError: boolean }) {
  const ended = new Map(data.endings.map((e) => [e.engagement_id, e.ended_on]));
  const orphan = (accounts ?? []).filter((a) => !a.person_id);
  return (
    <Section title="Pessoas, contas e atuações">
      {accountsError && <p className="text-sm text-muted-foreground">O estado das contas exige “manter-contas-institucionais”.</p>}
      {orphan.length > 0 && <p role="status" className="mb-3 text-sm text-destructive">{orphan.length} conta(s) sem pessoa institucional vinculada: não recebem nenhuma capacidade.</p>}
      {data.persons.length === 0 ? <p className="text-muted-foreground">Nenhuma pessoa institucional registrada.</p> : (
        <ul className="grid gap-3">
          {data.persons.map((p) => {
            const acc = (accounts ?? []).filter((a) => a.person_id === p.id);
            const eng = data.engagements.filter((e) => e.person_id === p.id);
            return (
              <li key={p.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{p.display_name} <span className="text-muted-foreground">({p.actor_nature === "orgao-institucional" ? "órgão" : "pessoa natural"})</span></p>
                <p className="text-muted-foreground">
                  {accounts === null ? "Contas não consultadas." : acc.length === 0 ? "Sem conta vinculada." :
                    acc.map((a) => `${a.login ?? "conta"} — ${a.banned ? "bloqueada" : "ativa"}${a.password_change_required ? ", troca de senha pendente" : ""}${a.last_sign_in_at ? `, último acesso ${a.last_sign_in_at.slice(0, 10)}` : ", nunca acessou"}`).join("; ")}
                </p>
                <ul className="mt-2 grid gap-1">
                  {eng.length === 0 ? <li className="text-muted-foreground">Sem atuação registrada.</li> : eng.map((e) => {
                    const on = engagementActive(e, ended.get(e.id) ?? null, today());
                    return <li key={e.id}><span className={on ? "font-medium" : "text-muted-foreground line-through"}>{e.engagement_kind_id}</span> · {e.scope_level === "rede" ? "rede" : `escola ${e.school_id ?? "—"}`} · {e.valid_from} → {ended.get(e.id) ?? e.valid_until ?? "sem fim"} {on ? "(vigente)" : "(histórica)"}{e.position_label_snapshot ? ` · cargo: ${e.position_label_snapshot} (só rótulo)` : ""}</li>;
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Cadastro de pessoas, contas e atuações continua em Administração, pelos registros próprios.</p>
    </Section>
  );
}

function PolicySection({ data, canDraft, canHomologate, onDone }: { data: { versions: PolicyVersion[]; rules: Map<string, PolicyRule[]> }; canDraft: boolean; canHomologate: boolean; onDone: () => void }) {
  const logicals = [...new Set(data.versions.map((v) => v.logical_policy_id))];
  const [logical, setLogical] = useState(logicals[0] ?? "");
  const versions = data.versions.filter((v) => v.logical_policy_id === logical).sort((a, b) => b.version - a.version);
  const effective = effectiveVersion(versions, today());
  const head = headVersion(data.versions, logical);
  const [selected, setSelected] = useState<string | null>(null);
  const sel = versions.find((v) => v.id === selected) ?? head;
  const catalog = useMemo(() => [...new Set((effective ? data.rules.get(effective.id) ?? [] : []).map((r) => r.capability_id))].sort(), [effective, data.rules]);

  if (logicals.length === 0) return <Section title="Políticas de capacidades"><p className="text-muted-foreground">Nenhuma política registrada.</p></Section>;
  const baseOf = (v: PolicyVersion) => (v.supersedes_version_id ? data.rules.get(v.supersedes_version_id) ?? [] : []);
  const diff = sel ? diffPolicies(baseOf(sel), data.rules.get(sel.id) ?? []) : null;
  return (
    <Section title="Políticas de capacidades">
      {logicals.length > 1 && <select aria-label="Política" className="mb-3 rounded border border-border bg-background p-1" value={logical} onChange={(e) => setLogical(e.target.value)}>{logicals.map((l) => <option key={l}>{l}</option>)}</select>}
      <p className="text-sm">Efetiva hoje: {effective ? `v${effective.version} (desde ${effective.valid_from})` : <strong>nenhuma versão única efetiva</strong>}. Catálogo efetivo: {catalog.length} capacidades.</p>
      <ul className="mt-3 grid gap-1 text-sm" aria-label="Histórico de versões">
        {versions.map((v) => (
          <li key={v.id}>
            <button className={`underline-offset-2 hover:underline ${sel?.id === v.id ? "font-semibold" : ""}`} onClick={() => setSelected(v.id)}>
              v{v.version} — {v.status === "homologated" ? `efetivada em ${v.homologated_at?.slice(0, 10) ?? "—"} (${v.homologation_origin === "decisao-do-proprietario" ? "decisão do proprietário" : v.homologation_origin ?? "origem não registrada"}), vigência ${v.valid_from ?? "—"}` : "rascunho (não autoriza ninguém)"} · registrada em {v.created_at.slice(0, 10)}{v.created_by ? "" : " · autor não registrado"}
            </button>
          </li>
        ))}
      </ul>
      {sel && diff && (
        <div className="mt-4 rounded-md border border-border p-3 text-sm">
          <p className="font-medium">v{sel.version} comparada à antecessora: +{diff.added.length} / −{diff.removed.length} / {diff.unchanged} iguais</p>
          <RuleList title="Incluídas" rules={diff.added} />
          <RuleList title="Removidas" rules={diff.removed} />
          {sel.status === "draft" && sel.id === head?.id && canHomologate && <Homologate policy={sel} onDone={onDone} />}
        </div>
      )}
      {canDraft && effective && head && <DraftEditor logical={logical} head={head} base={data.rules.get(effective.id) ?? []} onDone={onDone} />}
    </Section>
  );
}

function RuleList({ title, rules }: { title: string; rules: PolicyRule[] }) {
  if (rules.length === 0) return null;
  return <details className="mt-2"><summary>{title} ({rules.length})</summary><ul className="mt-1 grid gap-0.5">{rules.map((r, i) => <li key={i}>{r.engagement_kind_id} → {r.capability_id} [{r.scope_dimensions.join(", ") || "sem escopo"}]</li>)}</ul></details>;
}

function Homologate({ policy, onDone }: { policy: PolicyVersion; onDone: () => void }) {
  const [from, setFrom] = useState(today()); const [ref, setRef] = useState("");
  const [preview, setPreview] = useState<{ issue: string | null; missing: string[] } | null>(null);
  const [confirm, setConfirm] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  async function check() {
    setMsg(null); const { data, error } = await supabase.rpc("preview_capability_policy", { _policy: policy.id, _valid_from: from });
    if (error) return setMsg(humanizePolicyError(error.message));
    setPreview({ issue: data?.[0]?.issue ?? null, missing: data?.[0]?.coverage_missing ?? [] });
  }
  async function go() {
    const { error } = await supabase.rpc("homologate_capability_policy_expected", { _policy: policy.id, _valid_from: from, _act_ref: ref.trim() || null as unknown as string });
    if (error) return setMsg(humanizePolicyError(error.message));
    setMsg("Versão efetivada."); onDone();
  }
  return (
    <div className="mt-3 grid gap-2 border-t border-border pt-3">
      <label className="grid gap-1">Início da vigência<input type="date" className="rounded border border-border bg-background p-1" value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); }} /></label>
      <label className="grid gap-1">Referência documental (opcional, só proveniência)<input className="rounded border border-border bg-background p-1" value={ref} onChange={(e) => setRef(e.target.value)} /></label>
      <Button variant="outline" size="sm" onClick={check}>Validar consequências</Button>
      {preview && (preview.issue ? <p role="alert" className="text-destructive">{humanizePolicyError(preview.issue)}{preview.missing.length ? ` Sem cobertura: ${preview.missing.join(", ")}.` : ""}</p> : (
        <>
          <p role="status">Validação sem impedimentos para {from}.</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />Confirmo, pela decisão do proprietário, a efetivação de v{policy.version}. A versão anterior sai de vigor e a efetivada não poderá ser editada.</label>
          <Button size="sm" disabled={!confirm} onClick={go}>Efetivar v{policy.version}</Button>
        </>
      ))}
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}

function DraftEditor({ logical, head, base, onDone }: { logical: string; head: PolicyVersion; base: PolicyRule[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<PolicyRule[]>(base);
  const [kind, setKind] = useState(""); const [cap, setCap] = useState(""); const [scope, setScope] = useState("network");
  const [confirm, setConfirm] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  const issues = validateDraft(rules); const diff = diffPolicies(base, rules);
  if (!open) return <Button className="mt-4" variant="outline" onClick={() => { setRules(base); setOpen(true); }}>Nova versão rascunho a partir da efetiva</Button>;
  async function save() {
    const { error } = await supabase.rpc("register_capability_policy_draft_expected", { _logical: logical, _expected_head: head.id, _rules: rules });
    if (error) return setMsg(humanizePolicyError(error.message));
    setMsg("Rascunho registrado. Ele não autoriza ninguém até ser efetivado."); setOpen(false); onDone();
  }
  return (
    <div className="mt-4 grid gap-2 rounded-md border border-border p-3 text-sm">
      <p className="font-medium">Rascunho sobre v{head.version} · +{diff.added.length} / −{diff.removed.length}</p>
      <div className="flex flex-wrap gap-2">
        <input aria-label="Tipo de atuação" placeholder="tipo de atuação" className="rounded border border-border bg-background p-1" value={kind} onChange={(e) => setKind(e.target.value)} />
        <input aria-label="Capacidade" placeholder="capacidade" className="rounded border border-border bg-background p-1" value={cap} onChange={(e) => setCap(e.target.value)} />
        <input aria-label="Escopos (vírgula)" className="rounded border border-border bg-background p-1" value={scope} onChange={(e) => setScope(e.target.value)} />
        <Button size="sm" onClick={() => { setRules([...rules, { engagement_kind_id: kind.trim(), capability_id: cap.trim(), scope_dimensions: scope.split(",").map((s) => s.trim()).filter(Boolean) }]); setKind(""); setCap(""); }}>Incluir regra</Button>
      </div>
      <details><summary>Regras ({rules.length})</summary>
        <ul className="mt-1 grid gap-0.5">{rules.map((r, i) => <li key={i} className="flex justify-between gap-2"><span>{r.engagement_kind_id} → {r.capability_id} [{r.scope_dimensions.join(", ")}]</span><button className="text-destructive" aria-label={`Remover ${r.capability_id}`} onClick={() => setRules(rules.filter((_, j) => j !== i))}>remover</button></li>)}</ul>
      </details>
      {issues.length > 0 && <ul role="alert" className="text-destructive">{issues.map((i, k) => <li key={k}>{i.detail}</li>)}</ul>}
      <label className="flex items-center gap-2"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />Confirmo o registro deste rascunho.</label>
      <div className="flex gap-2"><Button size="sm" disabled={!confirm || issues.length > 0} onClick={save}>Registrar rascunho</Button><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button></div>
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-6"><h2 className="mb-2 text-lg font-semibold">{title}</h2>{children}</section>;
}
function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-5xl p-6"><h1 className="text-2xl font-semibold">Central de acessos</h1><div className="mt-4">{children}</div></main>;
}

/** ACV.2 — Membros, compartilhamento com herança, política de cota/retenção, limpeza de reservas e provisionamento.
 *  Toda leitura passa por funções que conferem o papel da sessão; toda escrita por acv_* (o banco é a garantia). */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { confirmAction } from "@/components/sigem/confirm-action";
import { formatDateTime } from "@/lib/academic-date";
import { ROLES, reasonText, groupAccess, bytesFromMb, policyDraftProblems, type AccessRow } from "./archive-core";

const db = supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => any; from: (t: string) => any; storage: typeof supabase.storage };
const key = () => crypto.randomUUID();
const msgOf = (e: unknown) => reasonText(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "");
async function rpc<T>(fn: string, a: Record<string, unknown>): Promise<T> { const r = await db.rpc(fn, a); if (r.error) throw r.error; return r.data as T; }

function PersonPicker({ spaceId, onPick }: { spaceId: string; onPick: (p: { person_id: string; display_name: string }) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ person_id: string; display_name: string }[]>([]);
  useEffect(() => {
    if (q.trim().length < 3) { setRes([]); return; }
    let live = true;
    const t = setTimeout(async () => {
      const r = await db.rpc("acv_eligible_people", { _space: spaceId, _query: q });
      if (live) setRes(r.error ? [] : r.data ?? []);
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [q, spaceId]);
  return (
    <div className="space-y-1">
      <label className="block text-xs text-muted-foreground">Pessoa com atuação vigente (mín. 3 letras)
        <input className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-2 text-sm" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </label>
      {res.length > 0 && <ul className="max-h-40 overflow-auto rounded-md border border-border" aria-label="Pessoas encontradas">
        {res.map((p) => <li key={p.person_id}><button type="button" className="min-h-11 w-full px-2 text-left text-sm hover:bg-muted" onClick={() => { onPick(p); setQ(""); setRes([]); }}>{p.display_name}</button></li>)}
      </ul>}
    </div>
  );
}

function RolePick({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <label htmlFor={id} className="block text-xs text-muted-foreground">Papel
      <select id={id} className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
    </label>
  );
}

export function ShareDialog({ node, spaceId, onClose }: { node: { id: string; name: string } | null; spaceId: string; onClose: () => void }) {
  const [rows, setRows] = useState<AccessRow[] | null>(null);
  const [who, setWho] = useState<{ person_id: string; display_name: string } | null>(null);
  const [role, setRole] = useState("visualizar");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    if (!node) return;
    const r = await db.rpc("acv_node_access", { _node: node.id });
    setRows(r.error ? [] : r.data ?? []);
  }, [node]);
  useEffect(() => { setRows(null); setMsg(null); setWho(null); void load(); }, [load]);
  const g = groupAccess(rows ?? []);
  async function share() {
    if (!node || !who) return;
    try { await rpc("acv_share", { _node: node.id, _person: who.person_id, _principal: null, _role: role, _key: key() }); setMsg({ ok: true, text: `Compartilhado com ${who.display_name}.` }); setWho(null); await load(); }
    catch (e) { setMsg({ ok: false, text: msgOf(e) }); }
  }
  async function revoke(r: AccessRow) {
    if (!(await confirmAction({ title: `Retirar o acesso de ${r.display_name ?? "conta de setor"}?`, consequence: "A pessoa deixa de ver este item e o que estiver dentro dele.", actionLabel: "Retirar acesso", destructive: true }))) return;
    try { await rpc("acv_revoke_share", { _acl: r.acl_id, _key: key() }); setMsg({ ok: true, text: "Acesso retirado." }); await load(); }
    catch (e) { setMsg({ ok: false, text: msgOf(e) }); }
  }
  return (
    <Dialog open={!!node} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar “{node?.name}”</DialogTitle>
          <DialogDescription>O acesso vale para este item e para tudo dentro dele. Acessos herdados só podem ser retirados na pasta de origem.</DialogDescription>
        </DialogHeader>
        {rows === null ? <p className="text-sm text-muted-foreground">Lendo acessos…</p> : (
          <div className="space-y-3">
            <section aria-label="Acessos diretos">
              <h3 className="text-sm font-semibold text-foreground">Neste item</h3>
              {g.direct.length ? <ul className="mt-1 space-y-1 text-sm">{g.direct.map((r) => (
                <li key={r.acl_id} className="flex items-center justify-between gap-2"><span>{r.display_name ?? "Conta de setor"} — {r.role}</span>
                  <Button size="sm" variant="outline" onClick={() => void revoke(r)}>Retirar</Button></li>))}</ul>
                : <p className="text-sm text-muted-foreground">Nenhum acesso direto.</p>}
            </section>
            <section aria-label="Acessos herdados">
              <h3 className="text-sm font-semibold text-foreground">Herdados de pastas acima</h3>
              {g.inherited.length ? <ul className="mt-1 space-y-1 text-sm text-muted-foreground">{g.inherited.map((r) => <li key={r.acl_id}>{r.display_name ?? "Conta de setor"} — {r.role}</li>)}</ul>
                : <p className="text-sm text-muted-foreground">Nenhum.</p>}
            </section>
            <div className="space-y-2 rounded-md border border-border p-3">
              {who ? <p className="text-sm text-foreground">Para: <strong>{who.display_name}</strong> <button className="ml-2 text-xs text-primary underline" onClick={() => setWho(null)}>trocar</button></p>
                : <PersonPicker spaceId={spaceId} onPick={setWho} />}
              <RolePick id="share-role" value={role} onChange={setRole} />
              <Button className="min-h-11" disabled={!who} onClick={() => void share()}>Compartilhar</Button>
            </div>
          </div>
        )}
        {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-foreground" : "text-sm text-destructive"}>{msg.text}</p>}
      </DialogContent>
    </Dialog>
  );
}

interface Member { member_id: string; display_name: string | null; role: string; granted_at: string }
interface Policy { id: string; version: number; quota_bytes: number | null; trash_retention_days: number | null; source: string; created_at: string }

export function SpaceAdminPanel({ spaceId }: { spaceId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [who, setWho] = useState<{ person_id: string; display_name: string } | null>(null);
  const [role, setRole] = useState("visualizar");
  const [pol, setPol] = useState({ quotaMb: "", retention: "", source: "", reason: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    const [m, p, a] = await Promise.all([
      db.rpc("acv_space_member_list", { _space: spaceId }),
      db.from("acv_policy_versions").select("id, version, quota_bytes, trash_retention_days, source, created_at").eq("space_id", spaceId).order("version", { ascending: false }),
      db.from("acv_policy_approvals").select("policy_id"),
    ]);
    setMembers(m.error ? [] : m.data ?? []);
    setPolicies(p.error ? [] : p.data ?? []);
    setApproved(new Set((a.error ? [] : a.data ?? []).map((x: { policy_id: string }) => x.policy_id)));
  }, [spaceId]);
  useEffect(() => { void load(); }, [load]);
  const run = async (fn: () => Promise<unknown>, ok: string) => { setMsg(null); try { await fn(); setMsg({ ok: true, text: ok }); await load(); } catch (e) { setMsg({ ok: false, text: msgOf(e) }); } };

  const lastVersion = policies[0]?.version ?? 0;
  const problems = policyDraftProblems(pol);
  async function cleanup() {
    await run(async () => {
      const rows = await rpc<{ storage_path: string }[]>("acv_expire_uploads", { _space: spaceId });
      if (rows.length) {
        const r = await db.storage.from("acervo-documental").remove(rows.map((x) => x.storage_path));
        if (r.error) throw r.error;
      }
      setMsg({ ok: true, text: rows.length ? `${rows.length} arquivo(s) de envios não concluídos removido(s).` : "Nenhum envio abandonado para limpar." });
    }, "");
  }
  return (
    <section aria-labelledby="h-admin" className="space-y-4 rounded-xl border border-border bg-card p-4">
      <h2 id="h-admin" className="text-base font-semibold text-foreground">Administração do espaço</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Membros</h3>
          {members.length ? <ul className="space-y-1 text-sm">{members.map((m) => (
            <li key={m.member_id} className="flex items-center justify-between gap-2"><span>{m.display_name ?? "—"} — {m.role}</span>
              <Button size="sm" variant="outline" onClick={() => void run(() => rpc("acv_revoke_member", { _member: m.member_id, _key: key() }), "Membro retirado.")}>Retirar</Button></li>))}</ul>
            : <p className="text-sm text-muted-foreground">Só a conta do setor administra este espaço.</p>}
          {who ? <p className="text-sm">Incluir: <strong>{who.display_name}</strong> <button className="ml-1 text-xs text-primary underline" onClick={() => setWho(null)}>trocar</button></p> : <PersonPicker spaceId={spaceId} onPick={setWho} />}
          <RolePick id="member-role" value={role} onChange={setRole} />
          <Button size="sm" className="min-h-11" disabled={!who} onClick={() => who && void run(() => rpc("acv_add_member", { _space: spaceId, _person: who.person_id, _principal: null, _role: role, _key: key() }).then(() => setWho(null)), "Membro incluído.")}>Incluir membro</Button>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Cota e retenção</h3>
          <p className="text-xs text-muted-foreground">A proposta só vale depois de aprovada por outra pessoa da rede. Retenção é registro: nada é apagado automaticamente.</p>
          <ul className="space-y-1 text-xs">{policies.map((p) => (
            <li key={p.id}>v{p.version} — cota {p.quota_bytes ? `${Math.round(p.quota_bytes / 1048576)} MB` : "sem limite"}, lixeira {p.trash_retention_days ? `${p.trash_retention_days} dias` : "sem prazo"} — <strong>{approved.has(p.id) ? "aprovada" : "aguardando aprovação"}</strong> ({formatDateTime(p.created_at)})</li>))}</ul>
          {(["quotaMb", "retention", "source", "reason"] as const).map((k) => (
            <label key={k} className="block text-xs text-muted-foreground">{{ quotaMb: "Cota (MB, vazio = sem limite)", retention: "Retenção da lixeira (dias, vazio = sem prazo)", source: "Fonte da decisão", reason: "Justificativa" }[k]}
              <input className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-2 text-sm" inputMode={k === "quotaMb" || k === "retention" ? "numeric" : undefined} value={pol[k]} onChange={(e) => setPol((p) => ({ ...p, [k]: e.target.value }))} />
            </label>))}
          {problems.length > 0 && <p className="text-xs text-muted-foreground">{problems.join(" ")}</p>}
          <Button size="sm" className="min-h-11" disabled={problems.length > 0} onClick={() => void run(() => rpc("acv_record_policy", { _space: spaceId, _expected: lastVersion, _quota: bytesFromMb(pol.quotaMb), _retention: pol.retention ? Number(pol.retention) : null, _source: pol.source, _reason: pol.reason, _key: key() }).then(() => setPol({ quotaMb: "", retention: "", source: "", reason: "" })), "Proposta registrada; aguarda aprovação.")}>Propor política</Button>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Envios abandonados</h3>
          <p className="text-xs text-muted-foreground">Envios não confirmados em 24 horas expiram. A limpeza remove só arquivos que nunca viraram documento do acervo e pode ser repetida sem risco.</p>
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => void cleanup()}>Limpar envios abandonados</Button>
        </div>
      </div>
      {msg && msg.text && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-foreground" : "text-sm text-destructive"}>{msg.text}</p>}
    </section>
  );
}

/** Rede: aprovar política proposta e provisionar espaço de setor (exigem permissões da rede, conferidas no banco). */
export function NetworkArchivePanel() {
  const [pending, setPending] = useState<Policy[]>([]);
  const [principal, setPrincipal] = useState("");
  const [decision, setDecision] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    const [p, a] = await Promise.all([
      db.from("acv_policy_versions").select("id, version, quota_bytes, trash_retention_days, source, created_at").order("created_at", { ascending: false }).limit(50),
      db.from("acv_policy_approvals").select("policy_id"),
    ]);
    const done = new Set((a.data ?? []).map((x: { policy_id: string }) => x.policy_id));
    setPending((p.data ?? []).filter((x: Policy) => !done.has(x.id)));
  }, []);
  useEffect(() => { void load(); }, [load]);
  const run = async (fn: () => Promise<unknown>, ok: string) => { setMsg(null); try { await fn(); setMsg({ ok: true, text: ok }); await load(); } catch (e) { setMsg({ ok: false, text: msgOf(e) }); } };
  return (
    <section aria-labelledby="h-rede" className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 id="h-rede" className="text-base font-semibold text-foreground">Acervo na rede</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Políticas aguardando aprovação</h3>
          {pending.length ? <ul className="space-y-2 text-sm">{pending.map((p) => (
            <li key={p.id} className="space-y-1"><span>v{p.version} — {p.quota_bytes ? `${Math.round(p.quota_bytes / 1048576)} MB` : "sem limite"}; fonte: {p.source}</span>
              <Button size="sm" disabled={decision.trim().length < 5} onClick={() => void run(() => rpc("acv_approve_policy", { _policy: p.id, _decision: decision }), "Política aprovada.")}>Aprovar</Button></li>))}</ul>
            : <p className="text-sm text-muted-foreground">Nenhuma proposta visível para sua conta.</p>}
          <label className="block text-xs text-muted-foreground">Decisão (referência, mín. 5 caracteres)
            <input className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-2 text-sm" value={decision} onChange={(e) => setDecision(e.target.value)} /></label>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Provisionar espaço de setor</h3>
          <label className="block text-xs text-muted-foreground">Conta de setor (identificador)
            <input className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-2 font-mono text-sm" value={principal} onChange={(e) => setPrincipal(e.target.value.trim())} /></label>
          <Button size="sm" className="min-h-11" disabled={!/^[0-9a-f-]{36}$/i.test(principal)} onClick={() => void run(() => rpc("acv_provision_space", { _principal: principal, _key: key() }), "Espaço provisionado (ou já existia).")}>Provisionar</Button>
        </div>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-foreground" : "text-sm text-destructive"}>{msg.text}</p>}
    </section>
  );
}

import { userErrorText } from "@/lib/observability/governed-errors";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState, LoadingState, WarningNote } from "@/components/sigem/states";
import { EVENT_CATALOG, SCOPES } from "./integration-core";
import { processWebhookQueue } from "./integration.functions";

type Overview = {
  clients: { id: string; name: string; scopes: string[]; school_ids: string[] | null; rate: number; active: boolean }[];
  keys: { id: string; client_id: string; prefix: string; created_at: string; revoked_at: string | null }[];
  subscriptions: { id: string; client_id: string; url: string; events: string[]; secret_hint: string; secret_version: number; active: boolean }[];
  deliveries: { id: string; event_type: string; event_id: string; status: string; attempts: number; last_http_status: number | null; last_error: string | null; replay_count: number }[];
  requests: { client_id: string | null; method: string; route: string; status: number; error_code: string | null; request_id: string; created_at: string }[];
};

const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args);

export function IntegrationPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<{ label: string; value: string } | null>(null);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [schools, setSchools] = useState("");
  const process = useServerFn(processWebhookQueue);

  const load = useCallback(async () => {
    const r = await rpc("integration_overview");
    if (r.error) { setError(r.error.message.includes("capability-missing") ? "Sua conta não tem a permissão administrar-integracoes." : "Não foi possível ler as integrações."); return; }
    setError(null); setData(r.data as Overview);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (fn: string, args: Record<string, unknown>, label?: string) => {
    const r = await rpc(fn, args);
    if (r.error) { setError(userErrorText(r.error)); return; }
    if (label) setShown({ label, value: typeof r.data === "string" ? r.data : r.data.secret });
    await load();
  };

  if (error && !data) return <div className="p-6"><ErrorState title="Integrações indisponíveis" description={error} onRetry={load} /></div>;
  if (!data) return <div className="p-6"><LoadingState label="Carregando integrações" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Integrações externas</h1>
        <p className="text-muted-foreground">Sistemas externos usam uma chave própria (nunca a de uma pessoa), com permissões mínimas. Documentação técnica: <a className="underline" href="/api/public/v1/openapi.json">openapi.json</a>.</p>
      </header>
      {error && <WarningNote>{error}</WarningNote>}
      {shown && (
        <section className="rounded-md border border-border bg-muted p-4" aria-live="polite">
          <p className="font-medium">{shown.label} — copie agora; não será mostrado de novo.</p>
          <code className="block break-all py-2">{shown.value}</code>
          <Button variant="outline" onClick={() => setShown(null)}>Já copiei</Button>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Novo cliente</h2>
        <Input aria-label="Nome do cliente" placeholder="Nome do sistema externo" value={name} onChange={(e) => setName(e.target.value)} />
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Permissões (nenhuma vem marcada)</legend>
          {Object.entries(SCOPES).map(([s, d]) => (
            <label key={s} className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={scopes.includes(s)} onChange={(e) => setScopes(e.target.checked ? [...scopes, s] : scopes.filter((x) => x !== s))} />
              <span><code>{s}</code> — {d}</span>
            </label>
          ))}
        </fieldset>
        <Input aria-label="Escolas permitidas" placeholder="IDs de escola separados por vírgula (vazio = todas)" value={schools} onChange={(e) => setSchools(e.target.value)} />
        <Button disabled={name.trim().length < 3} onClick={() => act("integration_create_client", { _name: name, _scopes: scopes, _school_ids: schools.trim() ? schools.split(",").map((s) => s.trim()).filter(Boolean) : null, _rate: 60 }).then(() => { setName(""); setScopes([]); setSchools(""); })}>Criar cliente</Button>
      </section>

      {data.clients.map((c) => (
        <section key={c.id} className="space-y-3 rounded-md border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{c.name} {c.active ? "" : "(desativado)"}</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => act("integration_issue_key", { _client: c.id }, "Chave de acesso")}>Emitir chave</Button>
              <Button variant="outline" onClick={() => act("integration_set_client_active", { _client: c.id, _active: !c.active })}>{c.active ? "Desativar" : "Reativar"}</Button>
            </div>
          </div>
          <p className="text-sm">Permissões: {c.scopes.length ? c.scopes.join(", ") : "nenhuma"} · Escolas: {c.school_ids === null ? "todas" : c.school_ids.length ? c.school_ids.join(", ") : "nenhuma"} · Limite: {c.rate}/min</p>
          <ul className="text-sm">
            {data.keys.filter((k) => k.client_id === c.id).map((k) => (
              <li key={k.id} className="flex items-center gap-2">
                <code>{k.prefix}…</code> {k.revoked_at ? "revogada" : <Button variant="outline" size="sm" onClick={() => act("integration_revoke_key", { _key: k.id })}>Revogar</Button>}
              </li>
            ))}
          </ul>
          <SubscriptionForm onCreate={(url, events) => act("integration_create_subscription", { _client: c.id, _url: url, _events: events }, "Segredo de assinatura do webhook")} />
          <ul className="text-sm">
            {data.subscriptions.filter((s) => s.client_id === c.id).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2">
                {s.url} · {s.events.join(", ")} · segredo {s.secret_hint} (v{s.secret_version})
                <Button variant="outline" size="sm" onClick={() => act("integration_rotate_secret", { _subscription: s.id }, "Novo segredo do webhook")}>Trocar segredo</Button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Entregas de webhook</h2>
          <Button variant="outline" onClick={async () => { try { await process({ data: { ids: null } }); } catch { setError("Não foi possível processar a fila."); } await load(); }}>Processar fila agora</Button>
        </div>
        {data.deliveries.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma entrega.</p> : (
          <table className="w-full text-sm"><thead><tr className="text-left"><th>Evento</th><th>Estado</th><th>Tentativas</th><th>Último HTTP</th><th /></tr></thead>
            <tbody>{data.deliveries.map((d) => (
              <tr key={d.id}><td>{d.event_type}</td><td>{d.status}</td><td>{d.attempts}</td><td>{d.last_http_status ?? "—"}</td>
                <td>{d.status !== "pendente" && <Button variant="outline" size="sm" onClick={() => act("integration_replay_delivery", { _delivery: d.id })}>Reenviar</Button>}</td></tr>
            ))}</tbody></table>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Chamadas recentes</h2>
        {data.requests.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma chamada.</p> : (
          <table className="w-full text-sm"><thead><tr className="text-left"><th>Quando</th><th>Rota</th><th>HTTP</th><th>Código</th></tr></thead>
            <tbody>{data.requests.map((r) => <tr key={r.request_id + r.created_at}><td>{new Date(r.created_at).toLocaleString("pt-BR")}</td><td>{r.method} {r.route}</td><td>{r.status}</td><td>{r.error_code ?? "—"}</td></tr>)}</tbody></table>
        )}
      </section>
    </div>
  );
}

function SubscriptionForm({ onCreate }: { onCreate: (url: string, events: string[]) => void }) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  return (
    <div className="space-y-2">
      <Input aria-label="Endereço do webhook" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
      <div className="flex flex-wrap gap-3 text-sm">
        {Object.keys(EVENT_CATALOG).map((e) => (
          <label key={e} className="flex items-center gap-1"><input type="checkbox" checked={events.includes(e)} onChange={(x) => setEvents(x.target.checked ? [...events, e] : events.filter((y) => y !== e))} /><code>{e}</code></label>
        ))}
      </div>
      <Button variant="outline" disabled={!url.startsWith("https://") || events.length === 0} onClick={() => { onCreate(url, events); setUrl(""); setEvents([]); }}>Assinar webhook</Button>
    </div>
  );
}

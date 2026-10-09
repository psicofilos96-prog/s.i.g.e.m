import { PageHeader } from "@/components/sigem/patterns";
import { userErrorText } from "@/lib/observability/governed-errors";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, LoadingState, WarningNote } from "@/components/sigem/states";
import { dryRunMapping, findAdapter, heads, SLOTS, validateConfig, validateMapping, validateSecretRef, type IntegrationVersion, type MappingRule, type SlotKey } from "./institutional-registry";
import { checkInstitutionalIntegration } from "./institutional.functions";
import { formatDateTime } from "@/lib/academic-date";

type Run = { key: string; kind: string; outcome: string; code: string; attempts: number; ran_at: string };
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args);

export function InstitutionalIntegrationsPage() {
  const [versions, setVersions] = useState<IntegrationVersion[] | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ slot: SlotKey; head: IntegrationVersion | null } | null>(null);
  const check = useServerFn(checkInstitutionalIntegration);

  const load = useCallback(async () => {
    const r = await rpc("institutional_integrations_overview");
    if (r.error) { setError(r.error.message.includes("capability-missing") ? "Sua conta não tem a permissão administrar-integracoes." : "Não foi possível ler as integrações."); return; }
    setError(null); setVersions(r.data.versions); setRuns(r.data.runs);
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (error && !versions) return <div className="p-6"><ErrorState title="Central indisponível" description={error} onRetry={load} /></div>;
  if (!versions) return <div className="p-6"><LoadingState label="Carregando integrações" /></div>;
  const current = heads(versions);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader eyebrow="Administração" title="Central de integrações institucionais" description="Cada serviço externo tem uma vaga. Credenciais nunca ficam aqui: só o nome do segredo guardado nas configurações do projeto. Nenhum provedor está conectado." />
      {error && <WarningNote>{error}</WarningNote>}
      {(Object.keys(SLOTS) as SlotKey[]).map((slot) => {
        const list = current.filter((v) => v.slot === slot);
        return (
          <section key={slot} className="space-y-2 rounded-md border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{SLOTS[slot].label}</h2>
              <Button variant="outline" onClick={() => setEditing({ slot, head: null })}>Configurar nova</Button>
            </div>
            <p className="text-sm text-muted-foreground">Capacidades: {SLOTS[slot].capabilities.join(", ")}</p>
            {list.length === 0 && <p className="text-sm">Nenhuma integração configurada.</p>}
            {list.map((v) => {
              const last = runs.find((r) => r.key === v.key);
              return (
                <div key={v.key} className="space-y-1 border-t border-border pt-2 text-sm">
                  <p><strong>{v.key}</strong> · provedor {v.provider} · {v.state} · versão {v.version}</p>
                  <p>Segredo: {v.secret_ref ? <code>{v.secret_ref}</code> : "nenhum"} · Adaptador: {findAdapter(v.slot, v.provider) ? "disponível" : "não existe (falha fechada)"}</p>
                  <p>Última verificação: {last ? `${last.outcome} em ${formatDateTime(last.ran_at)}` : "nunca"}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={async () => { try { await check({ data: { key: v.key } }); } catch { setError("Verificação recusada."); } await load(); }}>Verificar saúde</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing({ slot, head: v })}>Editar (nova versão)</Button>
                    <Button size="sm" variant="outline" onClick={async () => { const r = await rpc("record_institutional_integration_version", { _key: v.key, _expected_version: v.version, _slot: v.slot, _provider: v.provider, _state: v.state === "ativa" ? "inativa" : "ativa", _config: v.config, _secret_ref: v.secret_ref, _mapping: v.mapping, _reason: v.state === "ativa" ? "Desativação" : "Ativação" }); if (r.error) setError(userErrorText(r.error)); await load(); }}>{v.state === "ativa" ? "Desativar" : "Ativar"}</Button>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
      {editing && <Editor slot={editing.slot} head={editing.head} onDone={async (msg) => { setEditing(null); if (msg) setError(msg); await load(); }} />}
    </div>
  );
}

function Editor({ slot, head, onDone }: { slot: SlotKey; head: IntegrationVersion | null; onDone: (msg?: string) => void }) {
  const [key, setKey] = useState(head?.key ?? "");
  const [provider, setProvider] = useState(head?.provider ?? "");
  const [config, setConfig] = useState(JSON.stringify(head?.config ?? {}, null, 2));
  const [secretRef, setSecretRef] = useState(head?.secret_ref ?? "");
  const [mapping, setMapping] = useState(JSON.stringify(head?.mapping ?? [], null, 2));
  const [sample, setSample] = useState("{}");
  const [reason, setReason] = useState("");
  let parsed: { config: Record<string, unknown>; mapping: MappingRule[] } | null = null;
  let issues: string[] = [];
  try { parsed = { config: JSON.parse(config), mapping: JSON.parse(mapping) }; issues = [...validateConfig(parsed.config), ...validateSecretRef(secretRef || null), ...validateMapping(slot, parsed.mapping)]; }
  catch { issues = ["JSON inválido em configuração ou mapeamento"]; }
  let dry: ReturnType<typeof dryRunMapping> | null = null;
  try { if (parsed && !issues.length) dry = dryRunMapping(parsed.mapping, JSON.parse(sample)); } catch { dry = null; }

  return (
    <section className="space-y-2 rounded-md border border-border p-4" aria-label="Editar integração">
      <h2 className="text-lg font-semibold">{head ? `Nova versão de ${head.key}` : `Nova integração — ${SLOTS[slot].label}`}</h2>
      <Input aria-label="Identificador" placeholder="identificador (ex.: email-secretaria)" value={key} disabled={!!head} onChange={(e) => setKey(e.target.value)} />
      <Input aria-label="Provedor" placeholder="provedor (identificador)" value={provider} onChange={(e) => setProvider(e.target.value)} />
      <Textarea aria-label="Configuração não secreta (JSON)" value={config} onChange={(e) => setConfig(e.target.value)} />
      <Input aria-label="Nome do segredo" placeholder="NOME_DO_SEGREDO (opcional)" value={secretRef} onChange={(e) => setSecretRef(e.target.value)} />
      <Textarea aria-label="Mapeamento (JSON)" value={mapping} onChange={(e) => setMapping(e.target.value)} />
      <p className="text-xs text-muted-foreground">Destinos permitidos: {SLOTS[slot].mappingTargets.join(", ") || "nenhum"}</p>
      <Textarea aria-label="Linha de exemplo para simulação (JSON)" value={sample} onChange={(e) => setSample(e.target.value)} />
      {dry && <pre className="overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(dry, null, 2)}</pre>}
      {issues.map((i) => <WarningNote key={i}>{i}</WarningNote>)}
      <Input aria-label="Motivo" placeholder="Motivo da alteração" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2">
        <Button disabled={!!issues.length || reason.trim().length < 3 || !key || !provider} onClick={async () => {
          const r = await rpc("record_institutional_integration_version", { _key: key, _expected_version: head?.version ?? null, _slot: slot, _provider: provider, _state: head?.state ?? "inativa", _config: parsed!.config, _secret_ref: secretRef || null, _mapping: parsed!.mapping, _reason: reason });
          onDone(r.error ? (r.error.message.includes("stale") ? "Outra pessoa alterou esta integração; recarregue." : userErrorText(r.error)) : undefined);
        }}>Salvar versão</Button>
        <Button variant="outline" onClick={() => onDone()}>Cancelar</Button>
      </div>
    </section>
  );
}

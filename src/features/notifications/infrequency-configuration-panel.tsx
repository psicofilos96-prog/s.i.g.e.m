import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { callRpc } from "@/lib/rpc-call";
import { canConfigureInfrequency, configurationMessage, readInfrequencyConfiguration, type InfrequencyConfiguration } from "./infrequency-configuration";
export function InfrequencyConfigurationPanel() {
  const authority = useSessionAuthority();
  const allowed = authority.status === "signed-in" && canConfigureInfrequency(authority.capabilities, authority.principal?.scope === "school");
  const uid = authority.status === "signed-in" ? authority.user.id : null;
  const query = useQuery({
    queryKey: ["infrequency-configuration", uid], enabled: allowed,
    queryFn: async () => readInfrequencyConfiguration(await callRpc("infrequency_notification_configuration")), retry: false,
  });
  if (!allowed || (query.isError && configurationMessage(query.error).startsWith("Sua conta"))) return null;
  return <section className="space-y-3" aria-labelledby="infrequency-communication-title">
    <h3 id="infrequency-communication-title" className="font-semibold">Avisos de infrequência</h3>
    {query.isPending ? <p role="status">Carregando aviso…</p> : query.isError ? <div role="alert"><p>{configurationMessage(query.error)}</p><Button variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></div>
      : <ConfigurationEditor key={`${query.data.version}-${query.data.rule_id}`} current={query.data} />}
  </section>;
}
function ConfigurationEditor({ current }: { current: InfrequencyConfiguration }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(current.title);
  const [body, setBody] = useState(current.body);
  const [enabled, setEnabled] = useState(current.enabled);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      readInfrequencyConfiguration(await callRpc("record_infrequency_notification_configuration", {
        _template_base: current.template_id, _rule_base: current.rule_id,
        _title: title, _body: body, _enabled: enabled, _reason: reason,
      }));
      await queryClient.invalidateQueries({ queryKey: ["infrequency-configuration"] });
    } catch (error) { setMessage(configurationMessage(error)); }
    finally { setBusy(false); }
  }
  return <div className="max-w-2xl space-y-3">
    <p className="text-sm text-muted-foreground">{current.version === 0 ? "Modelo-base do sistema" : `Versão ${current.version} · ${current.enabled ? "Ativo" : "Desativado"}`}</p>
    <label className="block text-sm">Título<Input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} /></label>
    <label className="block text-sm">Mensagem<textarea className="mt-1 block min-h-28 w-full rounded-md border border-border bg-background p-2" value={body} maxLength={500} onChange={(event) => setBody(event.target.value)} /></label>
    <p className="text-sm">Destinatários: responsáveis com autorização vigente para frequência escolar.</p>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />Ativar avisos no SIGEM</label>
    <label className="block text-sm">Motivo da alteração<Input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    {current.recorded_at && <p className="text-xs text-muted-foreground">Última alteração: {new Date(current.recorded_at).toLocaleString("pt-BR")} · {current.reason}</p>}
    <Button onClick={() => void save()} disabled={busy || reason.trim().length < 3 || !title.trim() || !body.trim()}>{busy ? "Salvando…" : "Salvar aviso"}</Button>
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
  </div>;
}

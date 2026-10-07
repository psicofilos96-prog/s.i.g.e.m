import { PageHeader } from "@/components/sigem/patterns";
/**
 * BT — Configuração mínima das regras institucionais. Lista estado, cria rascunho,
 * pré-visualiza no banco, homologa e mostra histórico. Nenhum valor é sugerido; sem
 * capacidade concedida pela policy homologada a tela mostra "acesso negado".
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { userErrorText } from "@/lib/observability/governed-errors";
import { RULE_DOMAINS, classifyReadError, domainSummary, expectedHead, stateLabel, type RuleDomainInfo } from "./institutional-rules-model";
import { homologateRule, listRuleVersions, previewRuleDraft, recordRuleDraft } from "./institutional-rules.functions";

const today = () => new Date().toISOString().slice(0, 10);

function DomainSection({ info }: { info: RuleDomainInfo }) {
  const list = useServerFn(listRuleVersions);
  const preview = useServerFn(previewRuleDraft);
  const draft = useServerFn(recordRuleDraft);
  const homol = useServerFn(homologateRule);
  const qc = useQueryClient();
  const key = ["institutional-rules", info.id];
  const read = useQuery({ queryKey: key, retry: false, queryFn: () => list({ data: { domain: info.id, on: today() } }) });
  const [logicalId, setLogicalId] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [json, setJson] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const parse = () => { try { return JSON.parse(json) as Record<string, unknown>; } catch { throw new Error("payload-invalid: conteúdo precisa ser JSON válido"); } };
  const onError = (e: Error) => setMsg({ ok: false, text: userErrorText(e) });
  const rows = read.data?.kind === "lido" ? read.data.rows : [];
  const check = useMutation({ mutationFn: () => preview({ data: { domain: info.id, payload: parse(), validFrom: from || null, validUntil: until || null } }),
    onSuccess: (r) => setMsg(r.issue ? { ok: false, text: `Conteúdo recusado pelo contrato: ${r.issue}` } : { ok: true, text: "Conteúdo aceito pelo contrato. Nada foi gravado." }), onError });
  const save = useMutation({ mutationFn: () => draft({ data: { domain: info.id, logicalId, expectedVersion: expectedHead(rows, logicalId), validFrom: from || null,
      validUntil: until || null, payload: parse(), reason, sourceRef: null } }),
    onSuccess: (r) => { setMsg({ ok: true, text: `Rascunho v${r.version} registrado. Ainda não vale: precisa de homologação por outra pessoa.` }); qc.invalidateQueries({ queryKey: key }); }, onError });
  const approve = useMutation({ mutationFn: (r: { logicalId: string; version: number }) => homol({ data: { domain: info.id, ...r, reason: "Homologação registrada pela tela de regras institucionais", sourceRef: null } }),
    onSuccess: () => { setMsg({ ok: true, text: "Versão homologada." }); qc.invalidateQueries({ queryKey: key }); }, onError });
  const headingId = `rules-${info.id}`;

  return (
    <section aria-labelledby={headingId} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 id={headingId} className="text-base font-semibold">{info.label}</h2>
      <p className="text-sm text-muted-foreground">Capacidades: {info.configureCapability} (rascunho) e {info.homologateCapability} (homologação). {info.temporal ? "Vigência obrigatória." : "Sem vigência própria: o motor usa a versão citada."}</p>
      <p className="text-sm" role="status">{read.isError ? domainSummary(classifyReadError(/unauthorized|authorization/i.test(String(read.error?.message)) ? "session:required" : String(read.error?.message))) : !read.data ? "Carregando…" : domainSummary(read.data)}</p>
      {rows.length > 0 && (
        <ul className="space-y-1 text-sm" aria-label={`Histórico — ${info.label}`}>
          {rows.map((r) => (
            <li key={`${r.logicalId}@${r.version}`} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{r.logicalId} v{r.version}</span>
              <span>{stateLabel(r.state)}</span>
              {info.temporal && <span className="text-muted-foreground">Vigência: {r.validFrom ?? "—"} a {r.validUntil ?? "sem fim"}</span>}
              <span className="text-muted-foreground">Motivo: {r.reason}</span>
              {r.state === "rascunho" && <Button size="sm" variant="outline" disabled={approve.isPending} onClick={() => approve.mutate({ logicalId: r.logicalId, version: r.version })}>Homologar v{r.version}</Button>}
            </li>))}
        </ul>)}
      {read.data?.kind === "lido" && (
        <details>
          <summary className="cursor-pointer text-sm">Registrar rascunho (nova regra ou nova versão)</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <label className="text-sm">Identificador<Input value={logicalId} onChange={(e) => setLogicalId(e.target.value)} /></label>
            {info.temporal && <label className="text-sm">Vigência de<DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>}
            {info.temporal && <label className="text-sm">até (opcional)<DateInput value={until} onChange={(e) => setUntil(e.target.value)} /></label>}
          </div>
          <label className="mt-2 block text-sm">Conteúdo (campos aceitos: {info.fields.join(", ")})
            <textarea aria-label={`Conteúdo — ${info.label}`} className="mt-1 min-h-28 w-full rounded-md border border-input bg-background p-2 font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} />
          </label>
          <label className="mt-2 block text-sm">Motivo<Input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" disabled={check.isPending || !json} onClick={() => check.mutate()}>Pré-visualizar</Button>
            <Button disabled={save.isPending || !logicalId || !json || !reason || (info.temporal && !from)} onClick={() => save.mutate()}>Registrar rascunho</Button>
          </div>
        </details>)}
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm" : "text-sm text-destructive"}>{msg.text}</p>}
    </section>
  );
}

export function InstitutionalRulesAdminPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <PageHeader eyebrow="Normas" title="Regras institucionais" description="Regras usadas pelo Diário, Avaliação, Fechamento, Frequência e Colegiados. Rascunho não vale: só a homologação por outra pessoa autorizada torna a versão aplicável. Versão homologada nunca é editada; mudança é nova versão." />
      {RULE_DOMAINS.map((d) => <DomainSection key={d.id} info={d} />)}
    </div>
  );
}

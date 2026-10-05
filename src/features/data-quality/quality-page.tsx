import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader, EmptyState } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { listSchools } from "@/features/onboarding/onboarding-source";
import { QUALITY_RULES, SEVERITY_UNCONFIGURED, detect, evidenceHash, filterInbox, inbox, ruleById, severityOf, type InboxItem, type ReviewState, type Sector } from "./quality-model";
import { canReview, loadQualityInputs, loadReviewEvents, recordReview } from "./quality-source";

const STATE_LABEL: Record<ReviewState, string> = { aberto: "Aberto", revisado: "Revisado", dispensado: "Dispensado", resolvido: "Resolvido" };
const SECTORS: { id: Sector; label: string }[] = [
  { id: "secretaria", label: "Secretaria" }, { id: "pedagogico", label: "Pedagógico" }, { id: "rede", label: "Rede" },
  { id: "documentos", label: "Documentos" }, { id: "importacao", label: "Importação" },
];

export function DataQualityPage() {
  const a = useSessionAuthority();
  const uid = a.status === "signed-in" ? a.user.id : null;
  const qc = useQueryClient();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [sector, setSector] = useState<Sector | null>(null);
  const [states, setStates] = useState<ReviewState[]>(["aberto"]);
  const today = new Date().toISOString().slice(0, 10);
  const schools = useQuery({ queryKey: ["dq-schools", uid], enabled: !!uid, queryFn: listSchools });
  const data = useQuery({ queryKey: ["dq", uid, schoolId, today], enabled: !!schoolId, queryFn: async () => {
    const inputs = await loadQualityInputs(schoolId!, today);
    const d = detect(inputs, new Date().toISOString());
    const hashes = new Map(await Promise.all(d.findings.map(async (f) => [f.fingerprint, await evidenceHash(f.evidence)] as const)));
    const events = await loadReviewEvents();
    return { d, hashes, events, reviewer: await canReview(schoolId!) };
  } });
  const review = useMutation({ mutationFn: recordReview, onSuccess: () => qc.invalidateQueries({ queryKey: ["dq"] }) });

  if (a.status === "signed-out") return <EmptyState title="Entre para ver a qualidade dos dados" description="A verificação usa só o que sua conta pode ler." />;
  if (a.status === "loading") return <p role="status">Carregando…</p>;

  const items = data.data ? inbox(data.data.d.findings, data.data.hashes, data.data.events ?? []).filter((i) => i.schoolId === schoolId) : [];
  const shown = filterInbox(items, { sector, states });

  return (
    <div className="space-y-6">
      <PageHeader title="Qualidade dos dados" description="Inconsistências objetivas detectadas nos registros oficiais. Nada é corrigido aqui: cada item leva à tela onde o fato é corrigido." />
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">Escola{" "}
          <select className="ml-1 min-h-11 rounded-md border bg-background px-2" value={schoolId ?? ""} onChange={(e) => setSchoolId(e.target.value || null)}>
            <option value="">Selecione</option>
            {(schools.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Setor{" "}
          <select className="ml-1 min-h-11 rounded-md border bg-background px-2" value={sector ?? ""} onChange={(e) => setSector((e.target.value || null) as Sector | null)}>
            <option value="">Todos</option>
            {SECTORS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <fieldset className="flex flex-wrap items-center gap-2 text-sm"><legend className="sr-only">Estados</legend>
          {(Object.keys(STATE_LABEL) as ReviewState[]).map((st) => (
            <label key={st} className="flex min-h-11 items-center gap-1">
              <input type="checkbox" checked={states.includes(st)} onChange={(e) => setStates((p) => e.target.checked ? [...p, st] : p.filter((x) => x !== st))} />
              {STATE_LABEL[st]}
            </label>))}
        </fieldset>
      </div>

      {!schoolId ? <EmptyState title="Escolha uma escola" description="A caixa de entrada é sempre por escola." />
        : data.isLoading ? <p role="status">Verificando…</p>
        : data.isError ? <EmptyState title="Não foi possível verificar" description="Tente novamente em instantes." />
        : <>
          {shown.length === 0 ? <EmptyState title="Nenhum item com estes filtros" description="Isso não significa ausência de problema nas regras não verificáveis abaixo." /> : (
            <ul className="space-y-3">{shown.map((i) => <Item key={i.fingerprint} item={i} hash={data.data!.hashes.get(i.fingerprint) ?? null} reviewer={data.data!.reviewer}
              onReview={(state, reason) => review.mutate({ fingerprint: i.fingerprint, evidenceSha256: data.data!.hashes.get(i.fingerprint) ?? i.head!.evidenceSha256,
                ruleId: i.ruleId, ruleVersion: ruleById(i.ruleId)?.version ?? 1, schoolId: i.schoolId, state, reason, expectedHead: i.head?.id ?? null })} />)}</ul>)}
          {review.error && <p role="alert" className="text-sm text-destructive">{(review.error as Error).message}</p>}
          {data.data!.d.unverifiable.length > 0 && (
            <section aria-labelledby="dq-unv" className="rounded-md border p-4">
              <h2 id="dq-unv" className="font-medium">Regras não verificáveis agora</h2>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                {data.data!.d.unverifiable.map((r) => <li key={r}>{ruleById(r)?.label ?? r}: a fonte não pôde ser lida por sua conta.</li>)}
              </ul>
            </section>)}
          <p className="text-xs text-muted-foreground">Regras: {QUALITY_RULES.map((r) => `${r.label} (v${r.version})`).join(" · ")}.</p>
        </>}
    </div>
  );
}

function Item({ item, hash, reviewer, onReview }: { item: InboxItem; hash: string | null; reviewer: boolean; onReview: (s: "revisado" | "dispensado" | "reaberto", reason: string) => void }) {
  const rule = ruleById(item.ruleId); const [reason, setReason] = useState("");
  const sev = severityOf(SEVERITY_UNCONFIGURED, item.ruleId);
  const ev = item.finding?.evidence ?? {};
  return (
    <li className="rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{rule?.label ?? item.ruleId}</h3>
        <span className="rounded border px-2 py-0.5 text-xs">{STATE_LABEL[item.state]} · {sev ?? "severidade não configurada"}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{rule?.explain}</p>
      {item.finding && <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-xs">
        {Object.entries(ev).map(([k, v]) => <><dt key={`k${k}`} className="text-muted-foreground">{k}</dt><dd key={`v${k}`} className="break-all">{v == null ? "Não informado" : String(v)}</dd></>)}
        <dt className="text-muted-foreground">detectado em</dt><dd>{new Date(item.finding.detectedAt).toLocaleString("pt-BR")}</dd>
      </dl>}
      {item.evidenceChanged && <p className="mt-1 text-xs">Reaberto: a evidência mudou desde a última revisão.</p>}
      {item.head && <p className="mt-1 text-xs text-muted-foreground">Última revisão: {item.head.state} — {item.head.reason}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {rule && item.finding && <Button asChild size="sm" variant="outline"><Link to={rule.fix(ev) as never}>Corrigir na fonte</Link></Button>}
        {reviewer && item.state !== "resolvido" && hash && <>
          <label className="sr-only" htmlFor={`r-${item.fingerprint}`}>Motivo</label>
          <input id={`r-${item.fingerprint}`} className="min-h-11 flex-1 rounded-md border bg-background px-2 text-sm" placeholder="Motivo (obrigatório)" value={reason} onChange={(e) => setReason(e.target.value)} />
          {item.state === "aberto" ? <>
            <Button size="sm" disabled={reason.trim().length < 3} onClick={() => onReview("revisado", reason)}>Marcar revisado</Button>
            <Button size="sm" variant="outline" disabled={reason.trim().length < 3} onClick={() => onReview("dispensado", reason)}>Dispensar</Button>
          </> : <Button size="sm" variant="outline" disabled={reason.trim().length < 3} onClick={() => onReview("reaberto", reason)}>Reabrir</Button>}
        </>}
      </div>
    </li>
  );
}

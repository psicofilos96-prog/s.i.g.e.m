/**
 * 14.4 — Superfície do CIECE: visão geral → exploração → detalhamento.
 *
 * Recebe uma `CieceSource` e um `CieceCatalog`. Cada nível (agregado,
 * decomposição, proveniência) é uma NOVA consulta à fonte e pode ser recusado
 * isoladamente. Nada é calculado aqui.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AnalyticResponse, DisclosedGroup, CieceCatalog, CieceCatalogEntry, CieceQueryInput, CieceReference, CieceSource } from "./ciece-surface-types";
import {
  STATE_PRESENTATION, TEMPORAL_LABELS, dimensionLabel, formatUnit, formatValue, groupStateId, viewResponse, type SurfaceStateId,
} from "./ciece-presentation";
import { PageHeader, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/sigem/date-input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function referenceFor(entry: CieceCatalogEntry, ref: CieceReference): CieceReference {
  const pick = (...keys: (keyof CieceReference)[]): CieceReference => {
    const out: CieceReference = {};
    for (const k of keys) { const v = ref[k]; if (v) out[k] = v; }
    return out;
  };
  switch (entry.temporalKind) {
    case "fotografia": return pick("at");
    case "intervalo": return pick("from", "to");
    case "periodo": return pick("periodId");
    case "ciclo": return pick("cycleId");
  }
}

function StateBadge({ id }: { id: SurfaceStateId }) {
  const p = STATE_PRESENTATION[id];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium", `state-${p.tone}`)}>
      <span aria-hidden>{p.marker}</span>
      {p.label}
    </span>
  );
}

function Coverage({ g }: { g: DisclosedGroup }) {
  if (!g.coverage) return null;
  return (
    <p className="text-xs text-muted-foreground">
      População: {g.coverage.eligible} · com registro: {g.coverage.observed}
      {!g.coverage.complete && " · cobertura incompleta"}
    </p>
  );
}

function ValueBlock({ g, unit }: { g: DisclosedGroup; unit: string }) {
  const id = groupStateId(g);
  const p = STATE_PRESENTATION[id];
  const v = p.showsValue ? formatValue(g.value, unit) : null;
  const u = formatUnit(unit);
  return (
    <div className="space-y-1">
      {v !== null ? (
        <p className="font-display text-3xl font-semibold text-foreground" data-testid="ciece-value">
          {v}{u && <span className="ml-1 text-sm font-normal text-muted-foreground">{u}</span>}
        </p>
      ) : (
        <p className="text-sm font-medium text-foreground" data-testid="ciece-no-value">{p.label}</p>
      )}
      <StateBadge id={id} />
      <p className="text-xs text-muted-foreground">{p.sentence}</p>
      <Coverage g={g} />
    </div>
  );
}

function ResponseBody({ r, unit }: { r: AnalyticResponse; unit: string }) {
  const v = viewResponse(r);
  if (v.kind === "estado") {
    const p = STATE_PRESENTATION[v.stateId];
    return (
      <div className="space-y-1" data-testid="ciece-state">
        <StateBadge id={v.stateId} />
        <p className="text-xs text-muted-foreground">{p.sentence}</p>
      </div>
    );
  }
  if (!v.total) return <p className="text-xs text-muted-foreground">Resposta decomposta.</p>;
  return <ValueBlock g={v.total} unit={unit} />;
}

function useSourceQuery(source: CieceSource, input: CieceQueryInput | null, enabled = true) {
  return useQuery({
    queryKey: ["ciece", source.kind, input],
    enabled: enabled && input !== null,
    queryFn: () => source.query(input!),
    staleTime: 0,
    gcTime: 0,
  });
}

function referenceText(entry: CieceCatalogEntry, ref: CieceReference) {
  const r = referenceFor(entry, ref);
  const br = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split("-").reverse().join("/") : v);
  const val = Object.values(r).filter(Boolean).map((v) => br(String(v))).join(" a ");
  return `${TEMPORAL_LABELS[entry.temporalKind]}: ${val || "não informado"}`;
}

function IndicatorCard({ entry, source, classId, reference, onExplain }: {
  entry: CieceCatalogEntry; source: CieceSource; classId: string; reference: CieceReference; onExplain: () => void;
}) {
  const input: CieceQueryInput = { definitionId: entry.definitionId, definitionVersion: entry.definitionVersion, reference: referenceFor(entry, reference), filters: { classId } };
  const q = useSourceQuery(source, input);
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-md border border-border/70 bg-card p-4" aria-label={entry.label}>
      <header>
        <h3 className="text-sm font-semibold text-foreground">{entry.label}</h3>
        <p className="text-xs text-muted-foreground">{referenceText(entry, reference)}</p>
      </header>
      <div className="flex-1">
        {q.isPending ? <p className="text-xs text-muted-foreground">Consultando…</p>
          : q.isError ? <p className="text-xs text-muted-foreground">A consulta não pôde ser concluída. Tente novamente.</p>
          : <ResponseBody r={q.data} unit={entry.unit} />}
      </div>
      <Button variant="outline" size="sm" onClick={onExplain}>Como este número foi formado?</Button>
    </article>
  );
}

function GroupTable({ r, catalog }: { r: Extract<AnalyticResponse, { state: "respondido" }>; catalog: CieceCatalog }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Decomposição por {dimensionLabel(r.groupBy ?? "")}</caption>
        <thead>
          <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
            <th scope="col" className="py-1 pr-2 font-medium">{dimensionLabel(r.groupBy ?? "")}</th>
            <th scope="col" className="py-1 pr-2 font-medium">Valor</th>
            <th scope="col" className="py-1 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {r.groups.map((g, i) => {
            const id = groupStateId(g);
            const v = STATE_PRESENTATION[id].showsValue ? formatValue(g.value, r.unit) : null;
            return (
              <tr key={g.groupKey ?? i} className="border-b border-border/40" data-testid={`group-${g.groupKey}`}>
                <td className="py-1 pr-2">{(g.groupKey && catalog.groupLabels?.[g.groupKey]) ?? g.groupKey ?? "Total"}</td>
                <td className="py-1 pr-2">{v ?? STATE_PRESENTATION[id].label}</td>
                <td className="py-1"><StateBadge id={id} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-muted-foreground">Nenhum total é exibido na decomposição; grupos suprimidos não são reconstruídos.</p>
    </div>
  );
}

function ExplainPanel({ entry, source, catalog, classId, reference }: {
  entry: CieceCatalogEntry; source: CieceSource; catalog: CieceCatalog; classId: string; reference: CieceReference;
}) {
  const base: CieceQueryInput = { definitionId: entry.definitionId, definitionVersion: entry.definitionVersion, reference: referenceFor(entry, reference), filters: { classId } };
  const agg = useSourceQuery(source, base);
  const [dim, setDim] = useState<string | null>(null);
  const [askProv, setAskProv] = useState(false);
  const dec = useSourceQuery(source, dim ? { ...base, groupBy: dim } : null);
  const prov = useSourceQuery(source, askProv ? { ...base, wantProvenance: true } : null);
  const aggResp = agg.data;
  const total = aggResp?.state === "respondido" && aggResp.groupBy === null ? aggResp.groups[0] : null;

  return (
    <div className="space-y-6">
      <section aria-labelledby="n1">
        <h3 id="n1" className="mb-2 text-xs font-semibold uppercase text-primary">1 · Significado</h3>
        <p className="text-sm text-foreground">{entry.label}</p>
        <p className="mb-2 text-xs text-muted-foreground">{referenceText(entry, reference)} · unidade: {entry.unit}</p>
        {aggResp ? <ResponseBody r={aggResp} unit={entry.unit} /> : <p className="text-xs text-muted-foreground">Consultando…</p>}
      </section>

      <section aria-labelledby="n2">
        <h3 id="n2" className="mb-2 text-xs font-semibold uppercase text-primary">2 · Composição</h3>
        {total && (total.numerator !== null || total.denominator !== null) && (
          <dl className="mb-2 grid grid-cols-2 gap-1 text-xs">
            <dt className="text-muted-foreground">Numerador</dt><dd>{total.numerator ?? "não informado"}</dd>
            <dt className="text-muted-foreground">Denominador</dt><dd>{total.denominator ?? "não informado"}</dd>
          </dl>
        )}
        <p className="text-xs text-muted-foreground">
          Critérios da definição: {Object.keys(entry.populationCriteria).length ? Object.entries(entry.populationCriteria).map(([k, v]) => `${k} = ${v}`).join("; ") : "nenhum critério adicional declarado"}.
        </p>
        {catalog.decomposableDimensions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {catalog.decomposableDimensions.map((d) => (
              <Button key={d} size="sm" variant={dim === d ? "default" : "outline"} onClick={() => setDim(d)}>
                Decompor por {dimensionLabel(d).toLowerCase()}
              </Button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Nenhuma decomposição está disponível neste escopo.</p>
        )}
        {dim && (
          <div className="mt-3" data-testid="ciece-decomposition">
            {dec.data ? (dec.data.state === "respondido" ? <GroupTable r={dec.data} catalog={catalog} /> : <ResponseBody r={dec.data} unit={entry.unit} />)
              : <p className="text-xs text-muted-foreground">Consultando decomposição…</p>}
          </div>
        )}
      </section>

      <section aria-labelledby="n3">
        <h3 id="n3" className="mb-2 text-xs font-semibold uppercase text-primary">3 · Auditoria</h3>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Definição</dt><dd className="break-all">{entry.definitionId} v{entry.definitionVersion}</dd>
          {aggResp?.state === "respondido" && (<><dt className="text-muted-foreground">Política de divulgação</dt><dd className="break-all">{aggResp.disclosurePolicy.id} v{aggResp.disclosurePolicy.version}</dd></>)}
          {agg.data && viewResponse(agg.data).kind === "estado" && (<><dt className="text-muted-foreground">Motivo registrado</dt><dd className="break-all">{(viewResponse(agg.data) as { technical: string }).technical}</dd></>)}
        </dl>
        {aggResp?.state === "respondido" && aggResp.limitations.length > 0 && (
          <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">{aggResp.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        )}
        <Button className="mt-3" size="sm" variant="outline" onClick={() => setAskProv(true)} disabled={askProv}>Consultar proveniência</Button>
        {askProv && (
          <div className="mt-2" data-testid="ciece-provenance">
            {!prov.data ? <p className="text-xs text-muted-foreground">Consultando proveniência…</p>
              : prov.data.state !== "respondido" ? <ResponseBody r={prov.data} unit={entry.unit} />
              : !prov.data.provenance ? <p className="text-xs text-muted-foreground">A política não divulga referências de proveniência.</p>
              : prov.data.provenance.level === "referencias-institucionais" ? (
                <ul className="space-y-1 text-xs">{prov.data.provenance.sources.map((s) => <li key={`${s.sourceId}:${s.recordId}:${s.recordVersion}`} className="break-all">{s.sourceId} · {s.recordId}{s.recordVersion !== null && ` v${s.recordVersion}`}</li>)}</ul>
              ) : (
                <ul className="space-y-1 text-xs">{prov.data.provenance.facts.map((f) => <li key={`${f.sourceId}:${f.recordId}:${f.recordVersion}`} className="break-all">{f.sourceId} · {f.recordId}</li>)}</ul>
              )}
          </div>
        )}
      </section>
    </div>
  );
}

export function CieceWorkspace({ source, catalog, initialReference }: { source: CieceSource; catalog: CieceCatalog; initialReference: CieceReference }) {
  const [classId, setClassId] = useState<string | null>(catalog.scopes[0]?.classId ?? null);
  const [reference, setReference] = useState<CieceReference>(initialReference);
  const [selected, setSelected] = useState<string | null>(null);
  const kinds = new Set(catalog.entries.map((e) => e.temporalKind));
  const entry = catalog.entries.find((e) => e.definitionId === selected) ?? null;
  const setRef = (k: keyof CieceReference) => (e: React.ChangeEvent<HTMLInputElement>) => setReference((r) => { const n = { ...r }; if (e.target.value) n[k] = e.target.value; else delete n[k]; return n; });
  const field = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <PageHeader eyebrow="CIECE" title="Informação e Estatística" description="Indicadores respondidos pela fronteira analítica, dentro do escopo da sua atuação vigente." />
      {source.kind === "laboratorio" && (
        <StatePanel tone="warning" title="Laboratório demonstrativo" description="Todos os números desta página são fictícios e simulados. Nada é lido ou gravado no banco institucional." />
      )}

      {catalog.scopes.length === 0 ? (
        <StatePanel tone="neutral" title={STATE_PRESENTATION["nao-autorizado"].label} description="Nenhuma turma está no seu escopo analítico. Uma atuação vigente com a capacidade de consulta agregada, concedida por política homologada, é necessária." />
      ) : (
        <>
          <section aria-label="Exploração" className="grid gap-3 rounded-md border border-border/70 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="min-w-0 text-xs text-muted-foreground">Turma
              <select className={field} value={classId ?? ""} onChange={(e) => setClassId(e.target.value)}>
                {catalog.scopes.map((s) => <option key={s.classId} value={s.classId}>{s.label}</option>)}
              </select>
            </label>
            {kinds.has("fotografia") && <label className="min-w-0 text-xs text-muted-foreground">{TEMPORAL_LABELS.fotografia}<DateInput className={field} value={reference.at ?? ""} onChange={setRef("at")} /></label>}
            {kinds.has("ciclo") && <label className="min-w-0 text-xs text-muted-foreground">{TEMPORAL_LABELS.ciclo}<input className={field} value={reference.cycleId ?? ""} onChange={setRef("cycleId")} /></label>}
            {kinds.has("periodo") && <label className="min-w-0 text-xs text-muted-foreground">{TEMPORAL_LABELS.periodo}<input className={field} value={reference.periodId ?? ""} onChange={setRef("periodId")} /></label>}
          </section>

          {classId && (
            <section aria-label="Visão geral" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.entries.map((e) => (
                <IndicatorCard key={`${e.definitionId}:${classId}`} entry={e} source={source} classId={classId} reference={reference} onExplain={() => setSelected(e.definitionId)} />
              ))}
            </section>
          )}
        </>
      )}

      <Sheet open={!!entry} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {entry && classId && (
            <>
              <SheetHeader>
                <SheetTitle>Como este número foi formado?</SheetTitle>
                <SheetDescription>Cada nível é uma nova consulta e pode ser recusado sem afetar o indicador já exibido.</SheetDescription>
              </SheetHeader>
              <div className="mt-4"><ExplainPanel entry={entry} source={source} catalog={catalog} classId={classId} reference={reference} /></div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

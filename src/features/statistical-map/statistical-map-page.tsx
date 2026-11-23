import { confirmAction } from "@/components/sigem/confirm-action";
import { useActiveYear } from "@/features/academic-year/active-year";
import { useOwnSchoolId } from "@/features/authority/own-school";
import { humanizeForScreen } from "@/config/technical-codes";
import { knownLabel } from "@/config/ui-vocabulary";
import { SkeletonState } from "@/components/sigem/guidance";
import { userErrorText } from "@/lib/observability/governed-errors";
/**
 * 14.10 — Tela operacional do Mapa Estatístico. "O SIGEM preenche; a escola confere."
 * Só apresenta `MapView` do servidor: não calcula, não aceita digitação de totais nem de
 * lacunas; as únicas declarações são observações e o ato de oficialização/correção.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAPA_ESTATISTICO_ESCOLA, NETWORK_BRANDING, mapaEscolaRows } from "@/features/reports/report-registry";
import { runReport, toCsv as reportCsv, toXlsx } from "@/features/reports/report-engine";
import { type CellState, type MapCell } from "./map-domain";
import { snapshotReasonText } from "./map-domain";
import { SchoolCompositionStructure } from "@/features/classes/class-composition-views";
import { STAGE_LABEL, STAGE_NEXT_STEP, cellValueText, groupByStructure, originBadge, projectWorkflow } from "./map-structures";
import {
  conferStatisticalMap, getStatisticalMap, listMapSchools, officializeStatisticalMap, openMapCorrectionFn, openStatisticalMap, returnStatisticalMap, adjustMapCell, saveMapObservations, type MapView,
} from "./statistical-map.functions";
import { institution } from "@/config/institution";
import { formatDateTime, operationalToday } from "@/lib/academic-date";
import { withListTimeout } from "@/lib/server-page";
import { ContextHint } from "@/components/sigem/context-help";
import { Link } from "@tanstack/react-router";
import { Download, Pencil, CheckCircle2, CircleAlert, Send } from "lucide-react";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { pathAllowed } from "@/features/authority/nav-capabilities";
import { modalityOf } from "./map-live";
import { MONTH_NAMES_LOWER } from "@/lib/format-ptbr";

const MONTHS = MONTH_NAMES_LOWER;

const STATE: Record<CellState, { label: string; tone: string }> = {
  disponivel: { label: "Disponível", tone: "state-success" },
  ausente: { label: "Sem registro", tone: "state-warning" },
  indeterminado: { label: "Ainda sem número", tone: "state-warning" },
  "nao-aplicavel": { label: "Não se aplica", tone: "state-neutral" },
  "sem-regra": { label: "Sem regra homologada", tone: "state-neutral" },
  "sem-fonte": { label: "Sem fonte no SIGEM", tone: "state-neutral" },
};
const ORIGIN: Record<MapCell["origin"], string> = {
  automatico: "Automático", calculado: "Calculado", declaracao: "Declaração da escola", herdado: "Herdado do Mapa oficial anterior (travado)", "sem-fonte": "Fonte inexistente",
};
const STATUS_LABEL: Record<string, string> = {
  "nao-aberto": "Não aberto", "em-preparacao": "Em preparação", conferido: "Conferido", oficializado: "Oficializado",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

const MAP_ERROR: Record<string, string> = {
  "map:previous-competence-missing": "O Mapa do mês anterior ainda não foi aberto. Ele precisa estar aprovado antes de abrir este mês.",
  "map:previous-competence-not-official": "O Mapa do mês anterior ainda não foi aprovado pela Estatística. Aguarde a aprovação para abrir este mês.",
  "map:approved-use-rectification": "Este Mapa já foi aprovado. Para mudar algo, abra uma retificação (nova revisão).",
  "map:nothing-sent": "Não há envio da escola aguardando análise.",
  "map:sent-awaiting-review": "O Mapa foi enviado e aguarda a Estatística. Ajustes só depois de devolvido.",
  "map:cell-not-adjustable": "Este item não admite ajuste pela regra vigente.",
};
function mapErrorText(e: Error) {
  const k = Object.keys(MAP_ERROR).find((x) => e.message.includes(x));
  return k ? MAP_ERROR[k]! : userErrorText(e);
}

type AdjustProps = { info: MapView["adjustable"][number]; canAdjust: boolean; busy: boolean; onSubmit: (a: { adjusted: string | number | null; reason: string; annul: boolean; expectedHeadId: string | null }) => void };

function AdjustBox({ c, info, canAdjust, busy, onSubmit }: AdjustProps & { c: MapCell }) {
  const [val, setVal] = useState(""); const [why, setWhy] = useState("");
  return (
    <details className="mt-2 text-xs print:hidden">
      <summary className="cursor-pointer font-medium">Ajuste manual{info.history.length ? ` (${info.history.length} registro${info.history.length > 1 ? "s" : ""})` : ""}</summary>
      {c.adjustment && <p className="mt-1">Calculado pelo SIGEM: <strong>{cellValueText(c.adjustment.calculated)}</strong> · Valor efetivo: <strong>{cellValueText(c.adjustment.adjusted)}</strong> · Motivo: {humanizeForScreen(c.adjustment.reason)}</p>}
      {info.history.length > 0 && <ol className="mt-1 list-decimal pl-4">{info.history.map((h) => <li key={h.at}>{formatDateTime(h.at)} — {h.kind === "anulacao" ? "ajuste anulado" : `ajustado para ${h.adjusted}`} pela {h.side === "escola" ? "escola" : "Estatística"}: {humanizeForScreen(h.reason)}</li>)}</ol>}
      {canAdjust && (
        <div className="mt-2 space-y-1">
          <input aria-label={`Novo valor para ${c.label}`} className="w-full rounded-md border border-input bg-background p-1" value={val} onChange={(e) => setVal(e.target.value)} placeholder="Novo valor" />
          <input aria-label={`Motivo do ajuste de ${c.label}`} className="w-full rounded-md border border-input bg-background p-1" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Motivo (obrigatório)" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy || !val.trim() || !why.trim()} onClick={() => onSubmit({ adjusted: /^-?\d+$/.test(val.trim()) ? Number(val.trim()) : val.trim(), reason: why, annul: false, expectedHeadId: info.headId })}>Registrar ajuste</Button>
            {c.adjustment && <Button size="sm" variant="ghost" disabled={busy || !why.trim()} onClick={() => onSubmit({ adjusted: null, reason: why, annul: true, expectedHeadId: info.headId })}>Voltar ao calculado</Button>}
          </div>
          <p className="text-muted-foreground">O ajuste não altera alunos, matrículas, turmas nem profissionais. Fica registrado com motivo e autor.</p>
        </div>
      )}
    </details>
  );
}

function CellRow({ c, adjust }: { c: MapCell; adjust?: AdjustProps | undefined }) {
  const st = STATE[c.state];
  const ref = c.reference?.at ? `em ${fmtDate(c.reference.at)}` : c.reference?.from ? `de ${fmtDate(c.reference.from)} a ${fmtDate(c.reference.to)}` : null;
  return (
    <li className="break-inside-avoid rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium break-words">{c.label}</p>
          {c.state !== "indeterminado" && <p className="text-xs font-medium">{originBadge(c)}</p>}
          <p hidden data-provenance className="text-xs text-muted-foreground">{ORIGIN[c.origin]}{ref ? ` · ${ref}` : ""}</p>
        </div>
        <span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium", st.tone)}>{st.label}</span>
      </div>
      {c.state === "disponivel" && (
        <p className="mt-2 text-lg font-semibold break-words">{cellValueText(c.value)}{c.unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{c.unit}</span> : null}</p>
      )}
      {c.groups && c.groups.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm">{c.groups.map((g) => <li key={g.key ?? "—"}>{g.key ?? "Sem classificação"}: {cellValueText(g.value)}</li>)}</ul>
      )}
      {c.adjustment && <p className="mt-1 text-xs">Ajustado de <strong>{cellValueText(c.adjustment.calculated)}</strong> para <strong>{cellValueText(c.adjustment.adjusted)}</strong> — motivo: {humanizeForScreen(c.adjustment.reason)}</p>}
      {c.notes.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">{c.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      {c.coverage && !c.coverage.complete && <p className="mt-1 text-xs text-muted-foreground">Cobertura incompleta: {c.coverage.observed} de {c.coverage.eligible} com registro.</p>}
      {(c.source || c.recordRefs.length > 0 || c.ruleRef) && (
        <details hidden data-provenance className="mt-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">Origem da informação</summary>
          <dl className="mt-1 space-y-1 break-all">
            {c.source && <div hidden data-provenance><dt className="inline font-medium">Fonte: </dt><dd className="inline">{c.source}</dd></div>}
            {c.ruleRef && <div><dt className="inline font-medium">Regra: </dt><dd className="inline">{c.ruleRef}</dd></div>}
            {c.recordRefs.length > 0 && <div><dt className="font-medium">Registros ({c.recordRefs.length}):</dt><dd>{c.recordRefs.slice(0, 20).join(", ")}{c.recordRefs.length > 20 ? " …" : ""}</dd></div>}
          </dl>
        </details>
      )}
      {adjust && <AdjustBox c={c} {...adjust} />}
    </li>
  );
}

const YEAR_STATE: Record<string, string> = {
  operacional: "Em andamento", "historico-importado": "Histórico de 2026",
  "sem-estado": "Ano letivo ainda não aberto",
};

/** Exporta a fotografia exibida — oficial congelada quando houver, senão a viva — pelo motor de relatórios. */
function currentCells(v: MapView) {
  const head = v.versions.find((x) => !x.superseded);
  return v.status.id === "oficializado" && head ? head.snapshot.cells : v.snapshot.cells;
}
function download(name: string, blob: Blob) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
async function exportMap(v: MapView, c: { schoolId: string; year: number; month: number }, fmt: "csv" | "xlsx") {
  const key = `${c.year}-${String(c.month).padStart(2, "0")}`;
  const result = runReport(MAPA_ESTATISTICO_ESCOLA, { params: { competence: key, status: knownLabel(STATUS_LABEL, v.status.id) } }, mapaEscolaRows(currentCells(v)));
  const meta = [`Competência: ${key}`, `Situação: ${knownLabel(STATUS_LABEL, v.status.id)}`, `Marca: ${v.fingerprint}`];
  const branding = { ...NETWORK_BRANDING, title: `MAPA ESTATÍSTICO — ${MONTHS[c.month - 1]!.toUpperCase()}/${c.year}` };
  if (fmt === "csv") download(`mapa-${key}.csv`, new Blob([reportCsv(result, branding, meta)], { type: "text/csv;charset=utf-8" }));
  else download(`mapa-${key}.xlsx`, new Blob([await toXlsx(result, branding, meta)]));
}

import { PrintChoice, printOpts } from "./map-print-choice";
import { buildFromSnapshot } from "./map-official-model";
import { downloadOfficialMapPdf } from "./map-pdf";
import { buildLiveDoc } from "./map-live";
import { freezeLiveMap, getLiveMapData } from "./map-live.functions";
import { MapSectionView } from "./map-doc-view";
import { Checkbox } from "@/components/ui/checkbox";
function openMapDocument(v: MapView, c: { year: number; month: number }, versionId?: string) {
  const ver = versionId ? v.versions.find((x) => x.id === versionId) : v.versions.find((x) => !x.superseded);
  const useOfficial = !!ver && (versionId || v.status.id === "oficializado");
  const snapshot = useOfficial ? ver!.snapshot : v.snapshot;
  const nameCell = snapshot.cells.find((x) => /nome/.test(x.cellId) && x.state === "disponivel");
  const wf = projectWorkflow(v.opened, v.workflowEvents, v.versions.length);
  void wf;
  const doc = buildFromSnapshot(snapshot, {
    headerLines: NETWORK_BRANDING.headerLines, schoolName: nameCell ? String(nameCell.value) : "Unidade escolar", official: !!useOfficial, revision: useOfficial ? ver!.version : null,
    signatures: ["Secretaria Escolar", "Direção da Unidade", "Setor de Informação e Estatística"], generatedAt: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
  });
  void downloadOfficialMapPdf(doc, `mapa-estatistico-${c.year}-${String(c.month).padStart(2, "0")}.pdf`, { cover: printOpts.cover, emblemUrl: institution.emblemUrl });
}

function MapBody({ v, competence, onChange }: { v: MapView; competence: { schoolId: string; year: number; month: number }; onChange: (v: MapView) => void }) {
  const open = useServerFn(openStatisticalMap);
  const saveObs = useServerFn(saveMapObservations);
  const confer = useServerFn(conferStatisticalMap);
  const officialize = useServerFn(officializeStatisticalMap);
  const openCorr = useServerFn(openMapCorrectionFn);
  const doReturn = useServerFn(returnStatisticalMap);
  const doAdjust = useServerFn(adjustMapCell);
  const [returnReason, setReturnReason] = useState("");
  const [obs, setObs] = useState(v.snapshot.declarations.observations);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: async (fn: () => Promise<MapView>) => fn(),
    onSuccess: (nv) => { setError(null); onChange(nv); },
    onError: (e: Error) => setError(mapErrorText(e)),
  });
  const s = v.snapshot;
  const correcting = v.status.id === "oficializado" || (v.status.id === "conferido" && v.versions.length > 0);
  const officialized = v.versions.length > 0;
  const workflow = projectWorkflow(v.opened, v.workflowEvents, v.versions.length);
  const statusText = { rascunho: "Rascunho em aberto", enviado: "Enviado para SEMED", reenviado: "Reenviado para SEMED", devolvido: "Devolvido para correção", aprovado: "Aprovado", "em-retificacao": "Retificação em aberto" }[workflow.stage];

  return (
    <div className="space-y-6">
      <section aria-labelledby="sit" className="border-b border-border pb-5">
        <h2 id="sit" className="text-base font-semibold">Situação do Mapa</h2>
        <p className="mt-3 text-sm">
          <strong className={cn("inline-flex rounded-md border px-4 py-2 text-base", workflow.stage === "aprovado" ? "border-success/25 bg-success/10 text-success-foreground" : workflow.stage === "devolvido" ? "border-warning/25 bg-warning/10 text-warning-foreground" : "border-border bg-muted text-foreground")}>{statusText}</strong>
          {v.status.id === "oficializado" && ` — versão ${v.status.version}${v.status.corrected ? " (corrige a anterior)" : ""}`}
          {"correctionInProgress" in v.status && v.status.correctionInProgress ? " · correção em preparação" : ""}
        </p>
        {(() => { const wf = projectWorkflow(v.opened, v.workflowEvents, v.versions.length); return (
          <div role="status" data-map-stage={wf.stage} className="mt-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p>Envio: <strong>{knownLabel(STAGE_LABEL, wf.stage)}</strong>{wf.revision ? ` · revisão ${wf.revision}` : ""}</p>
            {wf.returnReason && <p className="mt-1">Motivo informado: {wf.returnReason}</p>}
            <p className="mt-1 text-muted-foreground">Próximo passo: {STAGE_NEXT_STEP[wf.stage] ?? "—"}</p>
          </div>
        ); })()}
        {v.versions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 print:hidden">
            {[...v.versions].sort((a, b) => b.version - a.version).map((ver) => (
              <Button key={ver.id} size="sm" variant="ghost" onClick={() => openMapDocument(v, competence, ver.id)}>PDF da revisão {ver.version}{ver.superseded ? " (substituída)" : " (vigente)"}</Button>
            ))}
          </div>
        )}
        <details className="mt-4 text-sm"><summary className="cursor-pointer text-muted-foreground">Detalhes da competência</summary><dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          <div><dt className="inline text-muted-foreground">Competência: </dt><dd className="inline">{MONTHS[competence.month - 1]} de {competence.year}</dd></div>
          <div><dt className="inline text-muted-foreground">Período: </dt><dd className="inline">{fmtDate(s.competence.window.from)} a {fmtDate(s.competence.window.to)}</dd></div>
          <div><dt className="inline text-muted-foreground">Data de referência: </dt><dd className="inline">{s.snapshotDate ? `${fmtDate(s.snapshotDate)} (último dia letivo do mês pelo calendário oficial)` : (snapshotReasonText(s.snapshotDateBasis?.reason ?? null) || "não definida")}</dd></div>
          <div><dt className="inline text-muted-foreground">Regra: </dt><dd className="inline">{v.rule ? `${v.rule.id} v${v.rule.version}${v.rule.homologationActRef ? ` (${v.rule.homologationActRef})` : ""}` : "aguardando regra homologada que cubra esta escola"}</dd></div>
          <div><dt className="inline text-muted-foreground">Ano letivo: </dt><dd className="inline">{YEAR_STATE[v.yearState ?? ""] ?? "estado não pôde ser lido"}</dd></div>
          <div><dt className="inline text-muted-foreground">Tipo de informação: </dt><dd className="inline">{officialized && v.status.id === "oficializado" ? "Versão oficial" : "Dados em atualização"}</dd></div>
          {v.openedAt && <div><dt className="inline text-muted-foreground">Aberto em: </dt><dd className="inline">{formatDateTime(v.openedAt)}</dd></div>}
        </dl></details>
        {!v.opened && (
          <div className="mt-3">
            {v.capabilities.prepare
              ? <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={run.isPending} onClick={() => run.mutate(() => open({ data: competence }))}>Abrir competência</Button><Button disabled><Send className="size-4"/>Conferir e Enviar Mapa</Button><p className="w-full text-xs text-muted-foreground">Abra a competência para iniciar a conferência.</p></div>
              : <p className="text-sm text-muted-foreground">Você pode ver a prévia, mas não tem autorização para abrir esta competência.</p>}
          </div>
        )}
        {v.failedSources.length > 0 && <p className="mt-3 text-sm text-warning-foreground">Alguns dados não puderam ser consultados. O envio aguarda a conferência completa.</p>}
      </section>

      <details className="print:hidden"><summary className="cursor-pointer text-sm text-muted-foreground">Outras exportações e revisões</summary><div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => exportMap(v, competence, "csv")}>CSV</Button>
        <Button variant="outline" onClick={() => exportMap(v, competence, "xlsx")}>XLSX</Button>
        <PrintChoice />
        <Button onClick={() => openMapDocument(v, competence)}>Baixar PDF do mapa</Button>
      </div>
      </details>
      <header className="hidden text-center print:block">
        {NETWORK_BRANDING.headerLines.map((l) => <p key={l} className="text-sm font-semibold uppercase">{l}</p>)}
        <p className="font-bold">MAPA ESTATÍSTICO — {MONTHS[competence.month - 1]!.toUpperCase()}/{competence.year}</p>
      </header>

      <details><summary className="cursor-pointer text-sm font-medium">Detalhes da conferência por estrutura</summary>
      <nav aria-label="Estruturas do Mapa (I a VI)" className="sticky top-0 z-10 rounded-lg border border-border bg-background/95 p-2 print:hidden">
        <p className="px-1 pb-1 text-xs text-muted-foreground">Revise cada estrutura. As marcadas “a revisar” têm item sem registro.</p>
        <ol className="flex gap-1 overflow-x-auto sm:flex-wrap">
          {groupByStructure(s.cells).map((g) => (
            <li key={g.id} className="shrink-0">
              <a href={`#est-${g.id}`} className="flex min-h-11 items-center gap-2 rounded-md border border-border px-2 py-1 text-sm hover:bg-muted">
                <strong>{g.id}</strong><span className="max-w-[12rem] truncate">{g.title}</span>
                <span className={cn("rounded px-1.5 text-xs", g.needsReview ? "state-warning" : "state-success")}>{g.needsReview ? `${g.needsReview} a revisar` : "ok"}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {groupByStructure(s.cells).map((g) => (
        <section key={g.id} id={`est-${g.id}`} aria-labelledby={`h-est-${g.id}`} className="scroll-mt-28 print:break-inside-auto">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={`h-est-${g.id}`} className="text-base font-semibold">{g.id} — {g.title}</h2>
            <span className="text-xs text-muted-foreground">{g.cells.length} {g.cells.length === 1 ? "item" : "itens"} · {g.needsReview ? `${g.needsReview} a revisar` : "nada a revisar"}</span>
            <p className="w-full text-sm">O que fazer: {g.action}</p>
          </div>
          {g.cells.length === 0
            ? <p className="text-sm text-muted-foreground">Nenhum dado com fonte no SIGEM para esta estrutura ainda.</p>
            : <ul className="grid gap-2 md:grid-cols-2">{g.cells.map((c) => { const info = v.opened ? v.adjustable.find((a) => a.cellId === c.cellId) : undefined; return <CellRow key={c.cellId} c={c}
              adjust={info ? { info, canAdjust: v.capabilities.prepare || v.capabilities.officialize, busy: run.isPending, onSubmit: (a) => run.mutate(() => doAdjust({ data: { ...competence, cellId: c.cellId, ...a } })) } : undefined} />; })}</ul>}
          {g.id === "III" && competence.schoolId ? <SchoolCompositionStructure schoolId={competence.schoolId} on={`${competence.year}-${String(competence.month).padStart(2, "0")}-15`} /> : null}
        </section>
      ))}

      </details>
      <section aria-labelledby="obs" className="rounded-lg border border-border bg-card p-4">
        <h2 id="obs" className="text-base font-semibold">Observações da escola</h2>
        <p className="text-xs text-muted-foreground">Acrescente informações importantes sobre este mês.</p>
        <textarea aria-label="Observações da escola" className="mt-2 min-h-24 w-full rounded-md border border-input bg-background p-2 text-sm"
          value={obs} maxLength={4000} disabled={!v.opened || !v.capabilities.prepare} onChange={(e) => setObs(e.target.value)} />
        {v.opened && v.capabilities.prepare && (
          <Button variant="outline" className="mt-2" disabled={run.isPending || obs === s.declarations.observations}
            onClick={() => run.mutate(() => saveObs({ data: { ...competence, text: obs } }))}>Registrar observações</Button>
        )}
      </section>

      {v.opened && (
        <section aria-labelledby="conf" className="rounded-lg border border-border bg-card p-4">
          <h2 id="conf" className="text-base font-semibold">{correcting ? "Correção" : "Conferência e oficialização"}</h2>
          <p className="text-sm text-muted-foreground">Conferir registra que esta fotografia foi vista; não a oficializa. Se algo mudar depois, será preciso conferir de novo.</p>
          {v.blocks.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm">{v.blocks.map((b) => <li key={b.detail}>{b.detail}</li>)}</ul>
          )}
          {v.status.id === "conferido" && v.conferredMatches === false && <p className="mt-2 text-sm text-destructive">Algum dado mudou desde a conferência. Confira novamente.</p>}
          {correcting && !v.openCorrection && (
            <div className="mt-2">
              <p className="text-sm">A versão oficial continua valendo. Para corrigir, abra primeiro a correção com o motivo.</p>
              {v.capabilities.correct ? (
                <>
                  <textarea aria-label="Motivo da correção" placeholder="Motivo da correção (obrigatório)" className="mt-2 min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm"
                    value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} />
                  <Button className="mt-2" variant="outline" disabled={run.isPending || !reason.trim()}
                    onClick={() => run.mutate(() => openCorr({ data: { ...competence, reason } }))}>Abrir correção</Button>
                </>
              ) : <p className="text-sm text-muted-foreground">Sem autorização para abrir correção.</p>}
            </div>
          )}
          {v.openCorrection && (
            <p className="mt-2 text-sm">Correção aberta em {formatDateTime(v.openCorrection.openedAt)}. Motivo: {humanizeForScreen(v.openCorrection.reason)}</p>
          )}
          {(!correcting || v.openCorrection) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {v.capabilities.confer
                ? <Button disabled={run.isPending || v.failedSources.length > 0} onClick={() => run.mutate(() => confer({ data: competence }))}><Send className="size-4"/>Conferir e Enviar Mapa</Button>
                : <span className="text-sm text-muted-foreground">Sem autorização para conferir.</span>}
              {v.capabilities.officialize ? (
                <Button disabled={run.isPending || v.status.id !== "conferido" || v.conferredMatches !== true || v.blocks.length > 0}
                  onClick={() => run.mutate(() => officialize({ data: { ...competence, expectedFingerprint: v.fingerprint } }))}>
                  {correcting ? "Oficializar correção" : "Oficializar Mapa"}
                </Button>
              ) : <span className="text-sm text-muted-foreground">Sem autorização para oficializar.</span>}
            </div>
          )}
          {v.pendingConferenceId && v.capabilities.officialize && (
            <div className="mt-3 rounded-md border border-border p-3">
              <p className="text-sm font-medium">Devolver à escola</p>
              <p className="text-xs text-muted-foreground">A escola recebe o Mapa como “Devolvido para ajuste”, corrige e envia de novo. Mapa aprovado não pode ser devolvido: use retificação.</p>
              <textarea aria-label="Motivo da devolução" placeholder="Motivo da devolução (obrigatório)" className="mt-2 min-h-16 w-full rounded-md border border-input bg-background p-2 text-sm"
                value={returnReason} maxLength={2000} onChange={(e) => setReturnReason(e.target.value)} />
              <Button className="mt-2" variant="outline" disabled={run.isPending || !returnReason.trim()}
                onClick={() => run.mutate(() => doReturn({ data: { ...competence, expectedConferenceId: v.pendingConferenceId!, reason: returnReason } }))}>Devolver Mapa</Button>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Quem conferiu esta versão não pode oficializá-la, mesmo que tenha outra atuação.</p>
          {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
        </section>
      )}

      {officialized && (
        <section aria-labelledby="hist">
          <h2 id="hist" className="mb-2 text-base font-semibold">Histórico de versões</h2>
          <ol className="space-y-2">
            {[...v.versions].reverse().map((ver) => (
              <li key={ver.id} className="rounded-md border border-border bg-card p-3 text-sm">
                <p className="font-medium">Versão {ver.version}{ver.superseded ? " — substituída" : " — vigente"}</p>
                <p className="text-muted-foreground">Oficializada em {formatDateTime(ver.recordedAt)} · fotografia de {fmtDate(ver.snapshotDate)} · regra {ver.ruleId} v{ver.ruleVersion}</p>
                {ver.correctionReason && <p className="mt-1">Motivo: {ver.correctionReason}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

const SECTION_TABS = [["I", "Identificação"], ["II", "Movimentação"], ["III", "Matrícula"], ["IV", "Entradas e saídas"], ["V", "Pessoal"], ["VI", "Visitas"]] as const;

function LiveDocument({ competence, conference, controls, onConference }: { competence: { schoolId: string; year: number; month: number }; conference: React.ReactNode; controls: React.ReactNode; onConference: () => void }) {
  const authority = useSessionAuthority();
  const getLive = useServerFn(getLiveMapData);
  const [tab, setTab] = useState<string>("I");
  const [cover, setCover] = useState(true);
  const live = useQuery({ queryKey: ["map-live", competence.schoolId, competence.year, competence.month], retry: false, queryFn: ({ signal }) => withListTimeout(signal, () => getLive({ data: competence })) });
  const doc = live.data ? buildLiveDoc(live.data, { headerLines: NETWORK_BRANDING.headerLines, signatures: ["Responsável pelo estabelecimento de ensino", "Responsável pelo preenchimento"], generatedAt: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) }) : null;
  const qcl = useQueryClient();
  const doFreeze = useServerFn(freezeLiveMap);
  const freeze = useMutation({ mutationFn: () => doFreeze({ data: competence }), onSuccess: () => qcl.invalidateQueries({ queryKey: ["map-live", competence.schoolId, competence.year, competence.month] }) });
  const askFreeze = async () => {
    const mes = `${MONTHS[competence.month - 1]} de ${competence.year}`;
    const first = await confirmAction({ title: `Congelar o mapa de ${mes}?`, consequence: "Todas as informações do mapa deste mês deixam de mudar. O que a escola registrar depois entra no mês seguinte, com observação. Isso não pode ser desfeito.", actionLabel: "Sim, continuar", destructive: true });
    if (!first) return;
    const second = await confirmAction({ title: `Tem certeza? Confirme o congelamento de ${mes}.`, consequence: "Esta é a última confirmação. Depois de congelado, o mapa deste mês não pode mais ser alterado nem descongelado.", actionLabel: "Congelar definitivamente", destructive: true });
    if (second) freeze.mutate();
  };
  const pdf = () => doc && void downloadOfficialMapPdf(doc, `mapa-estatistico-${competence.year}-${String(competence.month).padStart(2, "0")}.pdf`, { cover, emblemUrl: institution.emblemUrl });
  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0"><div className="flex items-center gap-1"><h1 className="text-xl font-semibold">Mapa Estatístico</h1><ContextHint label="Ajuda do Mapa Estatístico" text="Confira os dados por mês. A escola envia o mapa para análise da Estatística; a aprovação preserva a versão histórica." /></div>
          <p className="mt-1 text-xs text-muted-foreground">{live.data ? live.data.frozenAt ? `Fechado em ${formatDateTime(live.data.frozenAt)}` : `Registros atualizados até ${fmtDate(live.data.referenceDate)}` : "Consultando os registros…"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">{controls}<label className="flex items-center gap-1.5 whitespace-nowrap text-sm"><Checkbox checked={cover} onCheckedChange={(v) => setCover(v === true)} /> Com capa</label><Button disabled={!doc} onClick={pdf}><Download className="size-4"/>Baixar PDF</Button></div>
      </header>
      {freeze.isError && <p role="alert" className="text-sm text-destructive">Não foi possível fechar as movimentações. Tente novamente.</p>}
      <div role="tablist" aria-label="Seções do Mapa" className="flex gap-1 overflow-x-auto border-b border-border">
        {[...SECTION_TABS, ["conf", "Conferência e envio"] as const].map(([id, label]) => (
          <Button variant="ghost" key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); if (id === "conf") onConference(); }}
            className={cn("shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap", tab === id ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {<span className="mr-1 text-xs">{id === "conf" ? "VII" : id}</span>}{label}
          </Button>
        ))}
      </div>
      {tab === "conf" ? <div className="space-y-5">
        {doc && live.data && <section className="border-b border-border pb-5"><h2 className="mb-3 text-base font-semibold">Checklist de validação</h2><ul className="grid gap-3 sm:grid-cols-2">{[
          { ok: doc.sections.find((s) => s.id === "I")?.blocks.every((b) => b.kind !== "fields" || b.pairs.every(([,value]) => value !== "—")), label: "Dados da escola", detail: doc.sections.find((s) => s.id === "I")?.blocks.every((b) => b.kind !== "fields" || b.pairs.every(([,value]) => value !== "—")) ? "Campos exibidos preenchidos" : "Confira os campos não informados" },
          { ok: !!live.data.frozenAt, label: "Movimentação", detail: live.data.frozenAt ? "Movimentações fechadas" : "Movimentações ainda em atualização" },
          { ok: !live.data.classes.some((c) => modalityOf(c.stage_label ?? c.class_name) === "Modalidade não informada"), label: "Modalidades das turmas", detail: live.data.classes.some((c) => modalityOf(c.stage_label ?? c.class_name) === "Modalidade não informada") ? `${live.data.classes.filter((c) => modalityOf(c.stage_label ?? c.class_name) === "Modalidade não informada").length} turmas sem modalidade informada` : "Nenhuma modalidade pendente nas turmas consultadas" },
          { ok: live.data.failed.length === 0, label: "Consulta dos dados", detail: live.data.failed.length === 0 ? "Registros consultados" : "Alguns dados não puderam ser consultados" },
        ].map((item) => <li key={item.label} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">{item.ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success"/> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning-foreground"/>}<div><p className="text-sm font-medium">{item.label}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></div></li>)}</ul><p className="mt-3 text-xs text-muted-foreground">A conferência abaixo verifica se o mapa pode ser enviado.</p></section>}
        {live.data?.canFreeze && !live.data.frozenAt && <Button variant="outline" disabled={freeze.isPending} onClick={askFreeze}>{freeze.isPending ? "Fechando…" : "Fechar movimentações do mês"}</Button>}
        {conference}
      </div>
        : live.isPending ? <SkeletonState label="Montando o mapa" />
        : live.isError || !doc ? <StatePanel tone="danger" title="Mapa indisponível" description="Não foi possível ler os registros da escola agora." action={<Button variant="outline" onClick={() => live.refetch()}>Tentar novamente</Button>} />
        : (
          <>
            {(live.data?.failed.length ?? 0) > 0 && <p className="text-sm text-muted-foreground">Parte dos registros não pôde ser lida com o seu acesso; esses campos aparecem com —.</p>}
            <MapSectionView doc={doc} sectionId={tab}
              missingModalities={live.data?.classes.filter((c) => modalityOf(c.stage_label ?? c.class_name) === "Modalidade não informada").length ?? 0}
              canOpenClasses={pathAllowed(authority, "/turmas")}
              editSchool={pathAllowed(authority, "/unidades") ? <Button asChild variant="outline" size="sm"><Link to="/unidades/editar/$id" params={{ id: competence.schoolId }}><Pencil className="size-3.5"/>Editar dados da escola</Link></Button> : undefined} />
          </>
        )}
    </div>
  );
}

export function StatisticalMapWorkspace() {
  const list = useServerFn(listMapSchools);
  const get = useServerFn(getStatisticalMap);
  const qc = useQueryClient();
  const [picked, setSchoolId] = useState<string>("");
  const own = useOwnSchoolId();
  const today = operationalToday();
  const [year, setYear] = useState<number>(Number(today.slice(0, 4)));
  const active = useActiveYear();
  const activeNumber = Number(/\d{4}/.exec(active.label)?.[0] ?? 0);
  useEffect(() => { if (activeNumber) setYear(activeNumber); }, [activeNumber]);
  const [month, setMonth] = useState<number>(Number(today.slice(5, 7)));
  const schools = useQuery({ queryKey: ["map-schools"], queryFn: () => list() });
  const sid = own ?? (picked || (schools.data?.length === 1 ? schools.data[0]!.schoolId : ""));
  const ready = !!sid;
  const competence = { schoolId: sid, year, month };
  const key = ["statistical-map", sid, year, month];
  const [showConf, setShowConf] = useState(false);
  const map = useQuery({ queryKey: key, enabled: ready && showConf, retry: false, queryFn: ({ signal }) => withListTimeout(signal, () => get({ data: competence })) });
  const years = [...new Set([...active.years.flatMap((y) => { const n = /\d{4}/.exec(y.label)?.[0]; return n ? [Number(n)] : []; }), year])].sort((a,b) => b-a);
  const sel = "h-10 rounded-md border border-input bg-card px-2 text-sm";
  const controls = <><label className="flex items-center gap-2 text-xs text-muted-foreground">Mês<select aria-label="Mês do mapa" className={sel} value={month} onChange={(e) => { setMonth(Number(e.target.value)); setShowConf(false); }}>{MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}</select></label><label className="flex items-center gap-2 text-xs text-muted-foreground">Ano<select aria-label="Ano do mapa" className={sel} value={year} onChange={(e) => { const n = Number(e.target.value); setYear(n); setShowConf(false); const match = active.years.find((y) => y.label.includes(String(n))); if (match) active.setYear(match.id); }}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></label></>;
  const conference = !showConf ? (
    <div className="rounded-lg border border-border p-4 text-sm">
      <p>Aqui a escola envia o mapa para a Estatística, que confere, devolve ou aprova.</p>
      <Button className="mt-3" variant="outline" onClick={() => setShowConf(true)}>Abrir conferência</Button>
    </div>
  ) : map.isPending ? <SkeletonState label="Carregando a conferência" />
    : map.isError ? <StatePanel tone="danger" title="Conferência indisponível" description="Não foi possível concluir a consulta. Tente novamente." action={<Button variant="outline" onClick={() => map.refetch()}>Tentar novamente</Button>} />
    : <MapBody key={key.join("|") + map.data.fingerprint} v={map.data} competence={competence} onChange={(nv) => qc.setQueryData(key, nv)} />;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      {schools.isPending ? <SkeletonState label="Carregando" />
        : !schools.data?.length ? <StatePanel tone="neutral" title="Nenhuma escola disponível" description="Seu acesso não inclui o Mapa Estatístico de nenhuma escola." /> : <>
          {!own && schools.data.length > 1 && <label className="flex flex-wrap items-center gap-2 text-sm">Escola<select aria-label="Escola do mapa" className={sel} value={sid} onChange={(e) => { setSchoolId(e.target.value); setShowConf(false); }}><option value="">Escolha a escola</option>{[...schools.data].sort((a,b) => a.label.localeCompare(b.label,"pt-BR")).map((school) => <option key={school.schoolId} value={school.schoolId}>{school.label}</option>)}</select></label>}
          {!ready ? <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-semibold">Mapa Estatístico</h1>{controls}<p className="w-full text-sm text-muted-foreground">Escolha a escola para ver o mapa.</p></div> : <LiveDocument key={`${sid}|${year}|${month}`} competence={competence} controls={controls} conference={conference} onConference={() => setShowConf(true)} />}
        </>}
    </div>
  );
}

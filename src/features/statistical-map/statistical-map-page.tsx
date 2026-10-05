/**
 * 14.10 — Tela operacional do Mapa Estatístico. "O SIGEM preenche; a escola confere."
 * Só apresenta `MapView` do servidor: não calcula, não aceita digitação de totais nem de
 * lacunas; as únicas declarações são observações e o ato de oficialização/correção.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAPA_ESTATISTICO_ESCOLA, NETWORK_BRANDING, mapaEscolaRows } from "@/features/reports/report-registry";
import { runReport, toCsv as reportCsv, toXlsx } from "@/features/reports/report-engine";
import { MAP_SECTIONS, type CellState, type MapCell } from "./map-domain";
import {
  conferStatisticalMap, getStatisticalMap, listMapSchools, officializeStatisticalMap, openMapCorrectionFn, openStatisticalMap, saveMapObservations, type MapView,
} from "./statistical-map.functions";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const STATE: Record<CellState, { label: string; tone: string }> = {
  disponivel: { label: "Disponível", tone: "state-success" },
  ausente: { label: "Sem registro", tone: "state-warning" },
  indeterminado: { label: "Indeterminado", tone: "state-warning" },
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

function CellRow({ c }: { c: MapCell }) {
  const st = STATE[c.state];
  const ref = c.reference?.at ? `em ${fmtDate(c.reference.at)}` : c.reference?.from ? `de ${fmtDate(c.reference.from)} a ${fmtDate(c.reference.to)}` : null;
  return (
    <li className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium break-words">{c.label}</p>
          <p className="text-xs text-muted-foreground">{ORIGIN[c.origin]}{ref ? ` · ${ref}` : ""}</p>
        </div>
        <span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium", st.tone)}>{st.label}</span>
      </div>
      {c.state === "disponivel" && (
        <p className="mt-2 text-lg font-semibold break-words">{c.value === null ? "—" : String(c.value)}{c.unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{c.unit}</span> : null}</p>
      )}
      {c.groups && c.groups.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm">{c.groups.map((g) => <li key={g.key ?? "—"}>{g.key ?? "(sem valor)"}: {g.value ?? "—"}</li>)}</ul>
      )}
      {c.notes.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">{c.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      {c.coverage && !c.coverage.complete && <p className="mt-1 text-xs text-muted-foreground">Cobertura incompleta: {c.coverage.observed} de {c.coverage.eligible} com registro.</p>}
      {(c.source || c.recordRefs.length > 0 || c.ruleRef) && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">Origem da informação</summary>
          <dl className="mt-1 space-y-1 break-all">
            {c.source && <div><dt className="inline font-medium">Fonte: </dt><dd className="inline">{c.source}</dd></div>}
            {c.ruleRef && <div><dt className="inline font-medium">Regra: </dt><dd className="inline">{c.ruleRef}</dd></div>}
            {c.recordRefs.length > 0 && <div><dt className="font-medium">Registros ({c.recordRefs.length}):</dt><dd>{c.recordRefs.slice(0, 20).join(", ")}{c.recordRefs.length > 20 ? " …" : ""}</dd></div>}
          </dl>
        </details>
      )}
    </li>
  );
}

const YEAR_STATE: Record<string, string> = {
  operacional: "operacional", "historico-importado": "histórico (baseline 2026) — sem Mapa operacional",
  "sem-estado": "ainda sem estado operacional — aguarda ato humano de abertura do ano",
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
  const result = runReport(MAPA_ESTATISTICO_ESCOLA, { params: { competence: key, status: STATUS_LABEL[v.status.id] ?? v.status.id } }, mapaEscolaRows(currentCells(v)));
  const meta = [`Competência: ${key}`, `Situação: ${STATUS_LABEL[v.status.id] ?? v.status.id}`, `Marca: ${v.fingerprint}`];
  const branding = { ...NETWORK_BRANDING, title: `MAPA ESTATÍSTICO — ${MONTHS[c.month - 1]!.toUpperCase()}/${c.year}` };
  if (fmt === "csv") download(`mapa-${key}.csv`, new Blob([reportCsv(result, branding, meta)], { type: "text/csv;charset=utf-8" }));
  else download(`mapa-${key}.xlsx`, new Blob([await toXlsx(result, branding, meta)]));
}

function MapBody({ v, competence, onChange }: { v: MapView; competence: { schoolId: string; year: number; month: number }; onChange: (v: MapView) => void }) {
  const open = useServerFn(openStatisticalMap);
  const saveObs = useServerFn(saveMapObservations);
  const confer = useServerFn(conferStatisticalMap);
  const officialize = useServerFn(officializeStatisticalMap);
  const openCorr = useServerFn(openMapCorrectionFn);
  const [obs, setObs] = useState(v.snapshot.declarations.observations);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: async (fn: () => Promise<MapView>) => fn(),
    onSuccess: (nv) => { setError(null); onChange(nv); },
    onError: (e: Error) => setError(e.message),
  });
  const s = v.snapshot;
  const correcting = v.status.id === "oficializado" || (v.status.id === "conferido" && v.versions.length > 0);
  const officialized = v.versions.length > 0;

  return (
    <div className="space-y-6">
      <section aria-labelledby="sit" className="rounded-lg border border-border bg-card p-4">
        <h2 id="sit" className="text-base font-semibold">Situação do Mapa</h2>
        <p className="mt-1 text-sm">
          <strong>{STATUS_LABEL[v.status.id]}</strong>
          {v.status.id === "oficializado" && ` — versão ${v.status.version}${v.status.corrected ? " (corrige a anterior)" : ""}`}
          {"correctionInProgress" in v.status && v.status.correctionInProgress ? " · correção em preparação" : ""}
        </p>
        <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          <div><dt className="inline text-muted-foreground">Competência: </dt><dd className="inline">{MONTHS[competence.month - 1]} de {competence.year}</dd></div>
          <div><dt className="inline text-muted-foreground">Período: </dt><dd className="inline">{fmtDate(s.competence.window.from)} a {fmtDate(s.competence.window.to)}</dd></div>
          <div><dt className="inline text-muted-foreground">Data da fotografia: </dt><dd className="inline">{s.snapshotDate ? fmtDate(s.snapshotDate) : "não definida (falta regra homologada)"}</dd></div>
          <div><dt className="inline text-muted-foreground">Regra: </dt><dd className="inline">{v.rule ? `${v.rule.id} v${v.rule.version}${v.rule.homologationActRef ? ` (${v.rule.homologationActRef})` : ""}` : "aguardando regra homologada que cubra esta escola"}</dd></div>
          <div><dt className="inline text-muted-foreground">Ano letivo: </dt><dd className="inline">{YEAR_STATE[v.yearState ?? ""] ?? "estado não pôde ser lido"}</dd></div>
          <div><dt className="inline text-muted-foreground">Natureza: </dt><dd className="inline">{officialized && v.status.id === "oficializado" ? "Fotografia oficial congelada" : "Dinâmico — não oficial"}</dd></div>
          {v.openedAt && <div><dt className="inline text-muted-foreground">Aberto em: </dt><dd className="inline">{new Date(v.openedAt).toLocaleString("pt-BR")}</dd></div>}
        </dl>
        {!v.opened && (
          <div className="mt-3">
            {v.capabilities.prepare
              ? <Button disabled={run.isPending} onClick={() => run.mutate(() => open({ data: competence }))}>Abrir competência</Button>
              : <p className="text-sm text-muted-foreground">Você pode ver a prévia, mas não tem autorização para abrir esta competência.</p>}
          </div>
        )}
        {v.failedSources.length > 0 && <p className="mt-2 text-sm text-destructive">Algumas fontes não puderam ser lidas agora. Conferir e oficializar ficam indisponíveis.</p>}
      </section>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" onClick={() => exportMap(v, competence, "csv")}>CSV</Button>
        <Button variant="outline" onClick={() => exportMap(v, competence, "xlsx")}>XLSX</Button>
        <Button variant="outline" onClick={() => window.print()}>PDF / imprimir</Button>
      </div>
      <header className="hidden text-center print:block">
        {NETWORK_BRANDING.headerLines.map((l) => <p key={l} className="text-sm font-semibold uppercase">{l}</p>)}
        <p className="font-bold">MAPA ESTATÍSTICO — {MONTHS[competence.month - 1]!.toUpperCase()}/{competence.year}</p>
      </header>

      {MAP_SECTIONS.map((sec) => {
        const cells = s.cells.filter((c) => c.sectionId === sec.id);
        if (!cells.length) return null;
        return (
          <section key={sec.id} aria-labelledby={`sec-${sec.id}`}>
            <h2 id={`sec-${sec.id}`} className="mb-2 text-base font-semibold">{sec.label}</h2>
            <ul className="grid gap-2 md:grid-cols-2">{cells.map((c) => <CellRow key={c.cellId} c={c} />)}</ul>
          </section>
        );
      })}

      <section aria-labelledby="obs" className="rounded-lg border border-border bg-card p-4">
        <h2 id="obs" className="text-base font-semibold">Observações da escola</h2>
        <p className="text-xs text-muted-foreground">Único texto declarado no Mapa. Não substitui nenhum dado sem fonte.</p>
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
            <p className="mt-2 text-sm">Correção aberta em {new Date(v.openCorrection.openedAt).toLocaleString("pt-BR")}. Motivo: {v.openCorrection.reason}</p>
          )}
          {(!correcting || v.openCorrection) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {v.capabilities.confer
                ? <Button variant="outline" disabled={run.isPending || v.failedSources.length > 0} onClick={() => run.mutate(() => confer({ data: competence }))}>Conferir fotografia</Button>
                : <span className="text-sm text-muted-foreground">Sem autorização para conferir.</span>}
              {v.capabilities.officialize ? (
                <Button disabled={run.isPending || v.status.id !== "conferido" || v.conferredMatches !== true || v.blocks.length > 0}
                  onClick={() => run.mutate(() => officialize({ data: { ...competence, expectedFingerprint: v.fingerprint } }))}>
                  {correcting ? "Oficializar correção" : "Oficializar Mapa"}
                </Button>
              ) : <span className="text-sm text-muted-foreground">Sem autorização para oficializar.</span>}
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
                <p className="text-muted-foreground">Oficializada em {new Date(ver.recordedAt).toLocaleString("pt-BR")} · fotografia de {fmtDate(ver.snapshotDate)} · regra {ver.ruleId} v{ver.ruleVersion}</p>
                {ver.correctionReason && <p className="mt-1">Motivo: {ver.correctionReason}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

export function StatisticalMapWorkspace() {
  const list = useServerFn(listMapSchools);
  const get = useServerFn(getStatisticalMap);
  const qc = useQueryClient();
  const now = new Date();
  const [schoolId, setSchoolId] = useState<string>("");
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const schools = useQuery({ queryKey: ["map-schools"], queryFn: () => list() });
  // Escola, ano e competência são escolhas explícitas: nenhum default mistura 2026 e 2027.
  const sid = schoolId;
  const ready = !!sid && year != null && month != null;
  const competence = { schoolId: sid, year: year ?? 0, month: month ?? 1 };
  const key = ["statistical-map", sid, year, month];
  const map = useQuery({ queryKey: key, enabled: ready, queryFn: () => get({ data: competence }) });
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 3 + i);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <PageHeader title="Mapa Estatístico" description="O SIGEM preenche a partir dos registros oficiais; a escola confere e oficializa." />
      {schools.isPending ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : !schools.data?.length ? (
          <StatePanel tone="neutral" title="Nenhuma escola disponível" description="Sua atuação vigente não inclui autorização para consultar o Mapa Estatístico de nenhuma escola." />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
              <label className="flex min-w-0 flex-1 flex-col text-sm">Escola
                <select className="mt-1 w-full rounded-md border border-input bg-background p-2" value={sid} onChange={(e) => setSchoolId(e.target.value)}>
                  <option value="">Escolha a escola</option>
                  {schools.data.map((s) => <option key={s.schoolId} value={s.schoolId}>{s.label}</option>)}
                </select>
              </label>
              <label className="flex flex-col text-sm">Mês
                <select className="mt-1 rounded-md border border-input bg-background p-2" value={month ?? ""} onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Escolha</option>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </label>
              <label className="flex flex-col text-sm">Ano
                <select className="mt-1 rounded-md border border-input bg-background p-2" value={year ?? ""} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Escolha</option>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
            </div>
            {!ready ? <p className="text-sm text-muted-foreground">Escolha escola, mês e ano para montar o Mapa.</p>
              : map.isPending ? <p className="text-sm text-muted-foreground">Montando a fotografia…</p>
              : map.isError ? <StatePanel tone="danger" title="Mapa indisponível" description="Não foi possível montar o Mapa agora. Tente novamente." />
              : <MapBody key={key.join("|") + map.data.fingerprint} v={map.data} competence={competence} onChange={(nv) => qc.setQueryData(key, nv)} />}
          </>
        )}
    </div>
  );
}

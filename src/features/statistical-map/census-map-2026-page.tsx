import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LoadingState } from "@/components/sigem/states";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RegistryHero, RegistryToolbar, registryTd, registryTh, registryRow } from "@/components/sigem/registry-layout";
import { brand } from "@/config/branding";
import {
  CLASS_COLUMNS, MAP_CLASS_REPORT, MAP_SCHOOL_REPORT, classCells, divergences, exportMap, groupClasses, normalizeClasses, normalizeSchools,
  receiptStatus, schoolCells, MAP_GRID_REPORT, gridCells, sliceTotals, mapGrid, classChecks, editableCells, type MapNetworkRow,
} from "./census-map-2026";

type Rpc = (f: string) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
const rpc = supabase.rpc as unknown as Rpc;
async function load() {
  const [s, c, net, rec] = await Promise.all([rpc("census_map_2026_schools"), rpc("census_map_2026_classes"), rpc("census_map_2026_network"),
    supabase.from("census_official_receipt_snapshots").select("school_id, closed_at, version").eq("census_year", "2026")]);
  const err = s.error ?? c.error ?? net.error;
  if (err) throw new Error(err.message);
  const schools = normalizeSchools(s.data ?? []).filter((r) => r.classes > 0 || r.receipt_classes !== null)
    .sort((a, b) => (a.school_name ?? "").localeCompare(b.school_name ?? "", "pt-BR"));
  const network = Object.fromEntries(Object.entries(net.data?.[0] ?? {}).map(([k, v]) => [k, Number(v)])) as MapNetworkRow;
  const refDates = new Map<string, string | null>();
  for (const r of ((rec.data ?? []) as { school_id: string; closed_at: string | null }[])) refDates.set(r.school_id, r.closed_at);
  return { schools, classes: normalizeClasses(c.data ?? []), network, refDates, refError: rec.error ? rec.error.message : null };
}

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "não informado" : v.toLocaleString("pt-BR"));
function Stat({ label, value, note }: { label: string; value: number | null | undefined; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-semibold tabular-nums text-foreground">{fmt(value)}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export function CensusMap2026Page() {
  const q = useQuery({ queryKey: ["census-map-2026"], queryFn: load, staleTime: 60_000 });
  const [schoolId, setSchoolId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [busy, setBusy] = useState(false);

  const names = useMemo(() => new Map((q.data?.schools ?? []).map((s) => [s.school_id, s.school_name ?? s.inep ?? "Escola sem nome"])), [q.data]);
  const divs = useMemo(() => divergences(q.data?.schools ?? []), [q.data]);
  const schools = useMemo(() => (q.data?.schools ?? []).filter((s) => !search || `${s.school_name} ${s.inep}`.toLowerCase().includes(search.toLowerCase())), [q.data, search]);
  const types = useMemo(() => [...new Set((q.data?.classes ?? []).map((c) => c.class_type ?? "não informado"))].sort(), [q.data]);
  const classes = useMemo(() => (q.data?.classes ?? []).filter((c) => (!schoolId || c.school_id === schoolId) && (!type || (c.class_type ?? "não informado") === type))
    .sort((a, b) => `${names.get(a.school_id)}${a.class_name}`.localeCompare(`${names.get(b.school_id)}${b.class_name}`, "pt-BR")), [q.data, schoolId, type, names]);
  const selected = q.data?.schools.find((s) => s.school_id === schoolId) ?? null;

  if (q.isPending) return <LoadingState label="Carregando o mapa 2026" />;
  if (q.isError) return (
    <div role="alert" className="space-y-2 rounded-xl border border-destructive/40 p-4 text-sm">
      <p>Não foi possível ler o mapa com as suas permissões: {(q.error as Error).message}</p>
      <Button size="sm" variant="outline" onClick={() => q.refetch()}>Tentar novamente</Button>
    </div>
  );
  const { network } = q.data;
  const scopeSchools = selected ? [selected] : q.data.schools;
  const slice = sliceTotals(scopeSchools);

  const scopeClasses = q.data.classes.filter((c) => !schoolId || c.school_id === schoolId);
  const grid = mapGrid(scopeClasses);
  const checks = classChecks(scopeClasses);
  const editable = editableCells(null);
  const refDate = selected ? (q.data.refDates.get(selected.school_id) ?? null) : null;
  const printGrid = () => {
    const meta = [`Escola: ${selected ? (selected.school_name ?? "") : "todas as escolas visíveis"} · INEP ${selected?.inep ?? "—"} · Ano 2026`, `Data de referência: ${refDate ? new Date(refDate).toLocaleDateString("pt-BR") : "não declarada"}`, "Turno não declarado no Censo 2026. Células calculadas, somente leitura."];
    exportMap(MAP_GRID_REPORT, gridCells(grid), "pdf", { headerLines: [brand.name], title: MAP_GRID_REPORT.title }, meta).then((b) => { const w = window.open(URL.createObjectURL(b), "_blank"); w?.addEventListener("load", () => w.print()); });
  };
  const download = async (which: "escolas" | "turmas", format: "csv" | "xlsx" | "pdf") => {
    setBusy(true);
    try {
      const branding = { headerLines: [brand.name, "Mapa do Censo Escolar 2026 — descritivo, não é o Mapa Estatístico mensal oficial"], title: which === "escolas" ? MAP_SCHOOL_REPORT.title : MAP_CLASS_REPORT.title };
      const meta = [selected ? `Escola: ${selected.school_name ?? ""} (INEP ${selected.inep ?? "não informado"})` : "Recorte: todas as escolas visíveis para esta conta"];
      const blob = which === "escolas" ? await exportMap(MAP_SCHOOL_REPORT, schoolCells(scopeSchools), format, branding, meta) : await exportMap(MAP_CLASS_REPORT, classCells(classes, names), format, branding, meta);
      const url = URL.createObjectURL(blob);
      if (format === "pdf") { const w = window.open(url, "_blank"); w?.addEventListener("load", () => w.print()); }
      else { const a = document.createElement("a"); a.href = url; a.download = `mapa-censo-2026-${which}.${format}`; a.click(); }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally { setBusy(false); }
  };
  const Exports = ({ which }: { which: "escolas" | "turmas" }) => (
    <div className="flex flex-wrap gap-2">
      {(["pdf", "xlsx", "csv"] as const).map((f) => <Button key={f} size="sm" variant="outline" disabled={busy} onClick={() => download(which, f)}>{f === "pdf" ? "PDF (A4 paisagem)" : f.toUpperCase()}</Button>)}
    </div>
  );

  return (
    <div className="space-y-6">
      <RegistryHero eyebrow="Censo Escolar 2026 · leitura do banco" title={selected ? (selected.school_name ?? "Escola") : "Mapa da rede 2026"}
        lede={selected ? `INEP ${selected.inep ?? "não informado"} · recibo do Censo: ${receiptStatus(selected, divs)}.` : "Números calculados agora, a partir dos registros do Censo 2026, com as permissões da sua conta. Alunos em AEE não contam como alunos novos."}
        actions={selected ? <Button size="sm" variant="outline" onClick={() => setSchoolId("")}>Voltar à rede</Button> : undefined} />

      {!selected && (
        <section aria-label="Totais da rede" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Escolas" value={network.schools} />
          <Stat label="Turmas" value={network.classes} />
          <Stat label="Alunos distintos" value={network.distinct_students} note="Cada aluno conta uma vez na rede" />
          <Stat label="Matrículas escolares" value={network.school_enrollments} note="Aluno em duas escolas conta duas" />
          <Stat label="Vínculos de turma" value={network.bonds} note="Inclui turmas AEE e atividade complementar" />
          <Stat label="Vínculos AEE" value={network.aee_bonds} note={`${fmt(network.aee_students)} alunos distintos`} />
          <Stat label="Profissionais declarados" value={network.professionals} />
          <Stat label="Itens de infraestrutura" value={network.infra_items} />
        </section>
      )}
      {selected && (
        <section aria-label="Totais da escola" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Turmas" value={selected.classes} note={`Recibo: ${fmt(selected.receipt_classes)}`} />
          <Stat label="Alunos distintos" value={selected.distinct_students} note={`Recibo: ${fmt(selected.receipt_students)}`} />
          <Stat label="Vínculos de turma" value={selected.bonds} note={`Recibo: ${fmt(selected.receipt_bonds)}`} />
          <Stat label="Vínculos AEE" value={selected.aee_bonds} note={`Recibo: ${fmt(selected.receipt_aee)} · só AEE: ${fmt(selected.aee_only_students)}`} />
          <Stat label="Matrículas escolares" value={selected.school_enrollments} />
          <Stat label="Docentes declarados" value={selected.teachers} note={`Recibo: ${fmt(selected.receipt_teachers)}`} />
          <Stat label="Profissionais declarados" value={selected.professionals} />
          <Stat label="Infraestrutura informada" value={selected.infra_informed} note={`de ${fmt(selected.infra_items)} itens`} />
        </section>
      )}

      <section aria-label="Conferência com o recibo do Censo" className="rounded-xl border border-border bg-card p-4 text-sm">
        <h2 className="font-display text-lg font-semibold">Conferência com o recibo oficial</h2>
        {divs.length === 0
          ? <p className="text-muted-foreground">Turmas, alunos, vínculos e AEE coincidem com o recibo do Censo em todas as {q.data.schools.length} escolas visíveis.</p>
          : <ul className="list-disc pl-5">{divs.map((d) => <li key={d.school_id + d.measure}>INEP {d.inep ?? "não informado"} — {d.measure}: banco {fmt(d.base)}, recibo {fmt(d.receipt)}</li>)}</ul>}
        <p className="mt-2 text-xs text-muted-foreground">Turno não aparece: o Censo 2026 não traz turno por turma, só o horário declarado.</p>
      </section>

      {!selected && (
        <section aria-labelledby="map-schools" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="map-schools" className="font-display text-xl font-semibold">Escolas</h2>
            <Exports which="escolas" />
          </div>
          <RegistryToolbar summary={`${schools.length} escola(s) · ${fmt(sliceTotals(schools).bonds)} vínculos`}>
            <label className="text-sm">Pesquisar escola ou INEP<Input value={search} onChange={(e) => setSearch(e.target.value)} className="mt-1 w-72" /></label>
          </RegistryToolbar>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Mapa do Censo 2026 por escola</caption>
              <thead><tr>{["INEP", "Escola", "Turmas", "Alunos", "Matrículas", "Vínculos", "AEE", "Docentes", "Recibo", ""].map((h) => <th key={h} scope="col" className={registryTh}>{h}</th>)}</tr></thead>
              <tbody>{schools.map((s) => (
                <tr key={s.school_id} className={registryRow}>
                  <td className={registryTd}>{s.inep ?? "não informado"}</td><td className={registryTd}>{s.school_name ?? "não informado"}</td>
                  <td className={registryTd}>{fmt(s.classes)}</td><td className={registryTd}>{fmt(s.distinct_students)}</td><td className={registryTd}>{fmt(s.school_enrollments)}</td>
                  <td className={registryTd}>{fmt(s.bonds)}</td><td className={registryTd}>{fmt(s.aee_bonds)}</td><td className={registryTd}>{fmt(s.teachers)}</td>
                  <td className={registryTd}>{receiptStatus(s, divs)}</td>
                  <td className={registryTd}><Button size="sm" variant="ghost" onClick={() => { setSchoolId(s.school_id); window.scrollTo({ top: 0 }); }}>Abrir mapa</Button></td>
                </tr>))}</tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-labelledby="map-grid" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="map-grid" className="font-display text-xl font-semibold">Grade do mapa — modalidades e etapas</h2>
          <Button size="sm" variant="outline" onClick={printGrid}>Imprimir grade (A4 paisagem)</Button>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="font-semibold">{brand.name} · Mapa do Censo Escolar · Ano 2026</p>
          <p>Escola: {selected ? (selected.school_name ?? "não informado") : "Todas as escolas visíveis"} · INEP: {selected ? (selected.inep ?? "não informado") : "—"}</p>
          <p>Data de referência: {refDate ? new Date(refDate).toLocaleDateString("pt-BR") : (q.data.refError ? "não lida (sem permissão)" : "não declarada")} (fechamento do recibo do Censo)</p>
          <p className="mt-1 text-xs text-muted-foreground">Turno: não declarado no Censo 2026 por turma. Legenda: Turmas = turmas 2026; Qtd. declarada = alunos informados pelo Censo na turma; Vínculos = matrículas em turma no banco; AEE = vínculos em turmas de atendimento especializado. Vínculos não somam como alunos.</p>
          <p className="mt-1 text-xs text-muted-foreground">Todas as células são calculadas e somente leitura. Campos editáveis: {editable.length ? editable.join(", ") : "nenhum — nenhuma regra homologada do Mapa declara célula ajustável para 2026"}.</p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">Grade do mapa por modalidade e etapa</caption>
            <thead><tr>{["Modalidade / etapa agregada", "Etapa", "Turmas", "Qtd. declarada", "Vínculos", "AEE"].map((h) => <th key={h} scope="col" className={registryTh}>{h}</th>)}</tr></thead>
            <tbody>{grid.map((g, i) => (
              <tr key={i} className={`${registryRow} ${g.kind !== "linha" ? "bg-muted/50 font-semibold" : ""}`}>
                <td className={registryTd}>{g.kind === "linha" ? g.group : ""}</td><td className={registryTd}>{g.stage}</td>
                <td className={registryTd}>{fmt(g.classes)}</td><td className={registryTd}>{fmt(g.declared)}</td><td className={registryTd}>{fmt(g.bonds)}</td><td className={registryTd}>{fmt(g.aee_bonds)}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="map-checks" className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
        <h2 id="map-checks" className="font-display text-lg font-semibold">Comparador por turma (Censo × banco)</h2>
        <p>{checks.filter((c) => c.status === "coincide").length} coincidem · {checks.filter((c) => c.status === "diverge").length} divergem · {checks.filter((c) => c.status === "sem-declaracao").length} sem quantidade declarada.</p>
        {checks.filter((c) => c.status !== "coincide").length > 0 && (
          <ul className="list-disc pl-5">{checks.filter((c) => c.status !== "coincide").map((c) => (
            <li key={c.class_id}>{names.get(c.school_id) ?? "Escola"} — {c.label}: {c.status === "diverge" ? `Censo ${fmt(c.declared)}, banco ${fmt(c.bonds)}` : "Censo não declarou quantidade (erro, não zero)"}</li>))}</ul>
        )}
      </section>

      <section aria-labelledby="map-classes" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="map-classes" className="font-display text-xl font-semibold">Detalhe por turma</h2>
          <Exports which="turmas" />
        </div>
        <RegistryToolbar summary={`${classes.length} turma(s)`}>
          <label className="text-sm">Tipo de turma
            <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 block h-9 rounded-md border border-input bg-background px-2">
              <option value="">Todos</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </RegistryToolbar>
        <div className="max-h-[70vh] overflow-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">Turmas do mapa 2026</caption>
            <thead><tr>{CLASS_COLUMNS.map((c) => <th key={c.id} scope="col" className={registryTh}>{c.label}</th>)}</tr></thead>
            <tbody>{classes.map((c) => (
              <tr key={c.class_id} className={registryRow}>
                <td className={registryTd}>{names.get(c.school_id) ?? "não informado"}</td>
                <td className={registryTd}><Link to="/turmas/$id" params={{ id: c.class_id }} className="text-primary underline-offset-2 hover:underline">{c.class_name ?? c.class_code ?? "Turma"}</Link></td>
                <td className={registryTd}>{c.stage ?? "não informado"}</td><td className={registryTd}>{c.class_type ?? "não informado"}</td>
                <td className={registryTd}>{c.mediation ?? "não informado"}</td><td className={`${registryTd} max-w-xs text-xs`}>{c.schedule_literal ?? "não informado"}</td>
                <td className={registryTd}>{fmt(c.declared_students)}</td><td className={registryTd}>{fmt(c.bonds)}</td><td className={registryTd}>{fmt(c.professionals)}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { governError } from "@/lib/observability/governed-errors";
import { runReport, toPdfFile, toXlsx } from "@/features/reports/report-engine";
import { DERIVED_INDICATORS, RULES_REPORT, RULE_KIND_LABEL, homologatedRules, indicatorReadiness, rulesReportRows, validateRule, type CalcRule, type RuleHomologation, type RuleKind } from "./calc-rules";

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const field = "h-8 rounded-md border bg-background px-2 text-sm";
const save = (b: Blob, n: string) => { const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = n; a.click(); URL.revokeObjectURL(u); };

export function CalcRulesPanel() {
  const [data, setData] = useState<{ rules: CalcRule[]; homs: RuleHomologation[] } | { error: string } | null>(null);
  const [edition, setEdition] = useState("2026");
  const [msg, setMsg] = useState<string | null>(null);
  const [f, setF] = useState({ program: "producao-textual", edition: "2026", kind: "limiar" as RuleKind, key: "", payload: "{}", source: "" });

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([supabase.from("aa_calc_rule_versions").select("*").limit(1000), supabase.from("aa_calc_rule_homologations").select("*").limit(1000)]);
    const err = a.error ?? b.error;
    if (err) { setData({ error: governError(err).userMessage }); return; }
    setData({ rules: (a.data ?? []) as unknown as CalcRule[], homs: (b.data ?? []) as unknown as RuleHomologation[] });
  }, []);
  useEffect(() => { void load(); }, [load]);
  const ok = data && "rules" in data ? data : null;
  const hom = useMemo(() => (ok ? homologatedRules(ok.rules, ok.homs) : []), [ok]);
  const homIds = useMemo(() => new Set(hom.map((r) => r.id)), [hom]);

  if (data == null) return <SkeletonState label="Carregando regras de cálculo" />;
  if (!ok) return <StatePanel tone="danger" title="Não foi possível ler" description={(data as { error: string }).error} />;

  let payload: Record<string, unknown> | null = null; try { const p = JSON.parse(f.payload); payload = p && typeof p === "object" && !Array.isArray(p) ? p : null; } catch { payload = null; }
  const problems = payload ? validateRule(f.kind, payload, f.source) : ["Conteúdo da regra precisa ser um objeto JSON."];
  if (!f.key.trim()) problems.push("Chave da regra obrigatória.");
  const submit = async () => {
    const { error } = await rpc("aa_record_calc_rule", { _logical: null, _expected_version: 0, _program: f.program, _edition: f.edition, _kind: f.kind, _key: f.key, _payload: payload, _source: f.source, _source_hash: null, _reason: null });
    setMsg(error ? governError(error).userMessage : "Regra registrada; aguarda homologação por outra pessoa."); if (!error) void load();
  };
  const decide = async (id: string, decision: "homologado" | "revogado") => {
    const { error } = await rpc("aa_homologate_calc_rule", { _version: id, _decision: decision, _reason: decision === "homologado" ? "Conferida com a fonte documental" : "Revogada pela responsável" });
    setMsg(error ? governError(error).userMessage : decision === "homologado" ? "Regra homologada." : "Regra revogada."); if (!error) void load();
  };
  const exportAs = async (fmt: "pdf" | "xlsx") => {
    const r = runReport(RULES_REPORT, { params: {} }, rulesReportRows(ok.rules, homIds));
    const branding = { headerLines: ["Secretaria Municipal de Educação", "Acompanhamento e Avaliação"], title: RULES_REPORT.title };
    const meta = [`Gerado em ${new Date().toLocaleString("pt-BR")}`, "Regra não homologada não produz indicador derivado; lançamento bruto é preservado."];
    if (fmt === "xlsx") save(new Blob([await toXlsx(r, branding, meta)]), "regras-avaliacao.xlsx");
    else save(await toPdfFile(r, branding, meta, { landscape: true, signatures: ["Coordenação de Acompanhamento e Avaliação"] }), "regras-avaliacao.pdf");
  };

  return (
    <div className="space-y-4">
      <StatePanel tone="info" title="Matrizes e regras de cálculo" description="Pesos, limiares, escalas, rubricas e correspondências eixo × item só valem quando registrados com fonte e homologados por outra pessoa. Sem regra, o indicador derivado fica bloqueado e os lançamentos continuam guardados como foram feitos." />
      {msg && <p role="status" className="text-sm">{msg}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm">Edição <input className={field} value={edition} onChange={(e) => setEdition(e.target.value)} /></label>
        <Button size="sm" variant="outline" onClick={() => void exportAs("pdf")}>PDF</Button>
        <Button size="sm" variant="outline" onClick={() => void exportAs("xlsx")}>XLSX</Button>
      </div>
      <table className="w-full text-sm"><caption className="text-left font-semibold">Indicadores derivados — edição {edition}</caption>
        <thead><tr><th scope="col" className="text-left">Indicador</th><th scope="col" className="text-left">Situação</th><th scope="col" className="text-left">Falta</th></tr></thead>
        <tbody>{DERIVED_INDICATORS.map((i) => { const r = indicatorReadiness(i.key, edition, hom); return (
          <tr key={i.key}><td>{i.label}</td><td>{r.status === "pronto" ? <StatusBadge tone="success">Pronto</StatusBadge> : r.status === "ambiguo" ? <StatusBadge tone="danger">Regras em conflito</StatusBadge> : <StatusBadge tone="warning">Regra pendente</StatusBadge>}</td>
            <td>{r.missing.map((m) => RULE_KIND_LABEL[m]).join(", ") || "—"}</td></tr>); })}</tbody></table>
      {ok.rules.length === 0 ? <StatePanel title="Nenhuma regra registrada" description="Nenhum peso, limiar, escala ou correspondência foi registrado. Os documentos enviados não definem esses valores." /> : (
        <table className="w-full text-sm"><caption className="sr-only">Regras registradas</caption>
          <thead><tr>{["Programa", "Edição", "Tipo", "Chave", "Versão", "Conteúdo", "Fonte", "Situação", ""].map((h) => <th key={h} scope="col" className="text-left">{h}</th>)}</tr></thead>
          <tbody>{ok.rules.sort((a, b) => a.program_key.localeCompare(b.program_key) || a.version - b.version).map((r) => (
            <tr key={r.id}><td>{r.program_key}</td><td>{r.edition_label}</td><td>{RULE_KIND_LABEL[r.rule_kind]}</td><td>{r.rule_key}</td><td>v{r.version}</td>
              <td><code className="text-xs">{JSON.stringify(r.payload)}</code></td><td>{r.source_ref}</td><td>{homIds.has(r.id) ? "Homologada" : "Não homologada"}</td>
              <td>{homIds.has(r.id) ? <Button size="sm" variant="ghost" onClick={() => void decide(r.id, "revogado")}>Revogar</Button> : <Button size="sm" variant="ghost" onClick={() => void decide(r.id, "homologado")}>Homologar</Button>}</td></tr>))}</tbody></table>)}
      <details><summary className="cursor-pointer text-sm font-medium">Registrar regra a partir de documento</summary>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
          <label className="text-xs">Programa<input className={`${field} w-full`} value={f.program} onChange={(e) => setF({ ...f, program: e.target.value })} /></label>
          <label className="text-xs">Edição<input className={`${field} w-full`} value={f.edition} onChange={(e) => setF({ ...f, edition: e.target.value })} /></label>
          <label className="text-xs">Tipo<select className={`${field} w-full`} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as RuleKind })}>{Object.entries(RULE_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-xs">Chave<input className={`${field} w-full`} value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} /></label>
          <label className="text-xs md:col-span-2">Fonte (documento oficial)<input className={`${field} w-full`} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} /></label>
        </div>
        <label className="mt-2 block text-xs">Conteúdo (JSON)<textarea className="w-full rounded-md border bg-background p-2 font-mono text-xs" rows={3} value={f.payload} onChange={(e) => setF({ ...f, payload: e.target.value })} /></label>
        {problems.length > 0 && <ul className="text-sm text-destructive">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        <Button size="sm" className="mt-2" disabled={problems.length > 0} onClick={() => void submit()}>Registrar</Button>
      </details>
    </div>
  );
}

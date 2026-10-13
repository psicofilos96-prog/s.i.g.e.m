import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GUIA_2026, officialBlockers, parseFile, specSummary, type Issue } from "./layout/layout-schema";
import { educacensoMessage } from "./educacenso-control";

const rpc = (fn: string, args?: object) => (supabase as unknown as { rpc: (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }> }).rpc(fn, args);
const db = supabase as unknown as { from: (t: string) => any };
type SpecRow = { version: number; source_kind: string; source_file: string; source_sha256: string; content_sha256: string; record_count: number; field_count: number; recorded_at: string };

/** Catálogo de leiaute do ano: versões gravadas, bloqueios para envio oficial e validação local de arquivo. */
export function LayoutCatalogPanel({ year, stage, canConfigure }: { year: string; stage: string; canConfigure: boolean }) {
  const [rows, setRows] = useState<SpecRow[]>([]); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<{ name: string; lines: number; issues: Issue[] } | null>(null);
  const spec = year === GUIA_2026.year && stage === GUIA_2026.stage ? GUIA_2026 : null;
  const blockers = useMemo(() => (spec ? officialBlockers(spec) : []), [spec]);
  const load = useCallback(async () => {
    const r = await db.from("educacenso_layout_specs").select("version, source_kind, source_file, source_sha256, content_sha256, record_count, field_count, recorded_at").eq("census_year", year).eq("stage_key", stage).order("version");
    setRows((r.data ?? []) as SpecRow[]);
  }, [year, stage]);
  useEffect(() => { void load(); }, [load]);
  const register = async () => {
    setBusy(true); const r = await rpc("educacenso_register_layout_spec", { _year: year, _stage_key: stage, _content: spec, _expected_version: rows.at(-1)?.version ?? 0, _layout: null, _reason: "Catálogo extraído do guia do usuário (não confrontado com o INEP)" }); setBusy(false);
    setMsg(r.error ? educacensoMessage(r.error.message) : "Catálogo registrado."); await load();
  };
  const validate = async (f: File) => {
    const text = new TextDecoder("iso-8859-1").decode(await f.arrayBuffer());
    const p = parseFile(text, spec!, /^(\d{2})\|/.test(text) ? "importacao" : "identificacao");
    setCheck({ name: f.name, lines: p.lines.length, issues: p.issues });
  };
  const sameAsCode = rows.at(-1)?.source_sha256 === GUIA_2026.source.sha256;

  return (
    <section className="space-y-3 rounded-md border p-3" aria-label="Catálogo de leiaute">
      <h2 className="text-sm font-semibold">Catálogo de leiaute (campos e regras)</h2>
      {!spec ? <p className="text-xs text-muted-foreground">Não há catálogo para {year} / {stage}. Só existe o catálogo da 1ª etapa 2026, extraído do guia que você enviou.</p> : <>
        <p hidden data-provenance className="text-xs text-muted-foreground">Fonte: <strong>{spec.source.file}</strong> (guia do usuário, impressão digital {spec.source.sha256.slice(0, 12)}…). Não confrontado com a documentação oficial do INEP.</p>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left"><th scope="col">Registro</th><th scope="col">Conteúdo</th><th scope="col">Campos</th><th scope="col">Obrigatórios</th><th scope="col">Condicionais</th><th scope="col">Com lista de códigos</th></tr></thead>
          <tbody>{specSummary(spec).map((r) => <tr key={r.record} className="border-t"><td>{r.record === "ID" ? "Identificação" : r.record}</td><td>{r.title}</td><td>{r.extracted}/{r.declared}</td><td>{r.required}</td><td>{r.conditional}</td><td>{r.withCodes}</td></tr>)}</tbody></table></div>
        <details className="rounded-md border p-2"><summary className="cursor-pointer text-xs font-medium text-destructive">Envio oficial bloqueado — {blockers.length} pendência(s)</summary>
          <ul className="mt-2 max-h-60 space-y-1 overflow-auto text-xs">{blockers.map((b, i) => <li key={i}>• {b.text}</li>)}</ul></details>
        <div className="text-xs">
          <span className="font-medium">Versões gravadas: </span>
          {rows.length === 0 ? "nenhuma" : rows.map((r) => <span key={r.version} className="mr-3">v{r.version} · {r.record_count} registros/{r.field_count} campos · {new Date(r.recorded_at).toLocaleDateString("pt-BR")}{r.source_sha256 === GUIA_2026.source.sha256 ? "" : " · fonte diferente da atual"}</span>)}
        </div>
        {canConfigure && !sameAsCode && <Button size="sm" variant="outline" disabled={busy} onClick={() => void register()}>Registrar catálogo do guia como nova versão</Button>}
        <label className="block text-xs">Conferir um arquivo (.txt) contra o catálogo — o arquivo é lido só no seu navegador<br />
          <input type="file" accept=".txt" className="text-xs" onChange={(e) => { const f = e.target.files?.[0]; if (f) void validate(f); }} /></label>
        {check && <div className="rounded-md border p-2 text-xs" role="status">
          <div className="font-medium">{check.name}: {check.lines} linha(s) lida(s) · {check.issues.filter((i) => i.severity === "erro").length} erro(s) · {check.issues.filter((i) => i.severity === "bloqueio").length} item(ns) não confirmáveis</div>
          <ul className="mt-1 max-h-60 overflow-auto">{check.issues.slice(0, 200).map((i, k) => <li key={k}>{i.severity === "erro" ? "✕" : "!"} {i.line ? `linha ${i.line} · ` : ""}{i.record ? `reg. ${i.record} · ` : ""}{i.field ? `campo ${i.field} · ` : ""}{i.text}</li>)}</ul>
          <p className="mt-1 text-muted-foreground">Conferência estrutural pelo guia; não substitui a validação do INEP.</p>
        </div>}
      </>}
      {msg && <p role="status" className="text-xs">{msg}</p>}
    </section>
  );
}

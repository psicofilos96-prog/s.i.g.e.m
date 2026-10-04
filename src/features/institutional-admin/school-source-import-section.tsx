import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/sigem/date-input";
import { parseAcademicDate } from "@/lib/academic-date";
import { buildSchoolProposal, CENSO_2026_SOURCE, importInputProblem, importSelectedSchools, type ImportOutcome } from "./school-source-import";

const STATUS: Record<string, string> = {
  novo: "ainda não cadastrada", "ja-cadastrado": "INEP já cadastrado — não será gravada",
  "inep-invalido": "INEP inválido na fonte", "duplicado-na-fonte": "INEP repetido na fonte",
};

export function SchoolSourceImportSection({ canMaintain }: { canMaintain: boolean }) {
  const [existing, setExisting] = useState<Set<string> | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [act, setAct] = useState(""); const [from, setFrom] = useState(""); const [useLoc, setUseLoc] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<ImportOutcome[]>([]);

  const load = useCallback(async () => {
    const r = await supabase.from("institutional_school_identifiers").select("value").eq("identifier_kind", "inep");
    if (r.error) { setLoadErr(true); return; }
    setLoadErr(false); setExisting(new Set((r.data ?? []).map((x) => x.value)));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => (existing ? buildSchoolProposal(CENSO_2026_SOURCE, existing) : []), [existing]);
  const novos = rows.filter((r) => r.status === "novo");

  async function run() {
    const validFrom = parseAcademicDate(from) ?? from;
    const p = importInputProblem({ act, validFrom, useSheetLocation: useLoc });
    if (p) return setErr(p);
    setErr(null); setBusy(true);
    try {
      const out = await importSelectedSchools(rows.filter((r) => sel.has(r.inep)), { act, validFrom, useSheetLocation: useLoc },
        (fn, args) => (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(fn, args));
      setResults(out);
      setSel(new Set(out.filter((o) => !o.ok).map((o) => o.inep).filter((i) => novos.some((n) => n.inep === i))));
      await load();
    } finally { setBusy(false); }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5" aria-labelledby="school-src-h">
      <h2 id="school-src-h" className="font-display text-lg font-semibold text-foreground">Importar unidades do Censo 2026 (proposta)</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Fonte {CENSO_2026_SOURCE.fonte} ({CENSO_2026_SOURCE.escolas.length} unidades). {CENSO_2026_SOURCE.uso} A dependência é só informativa; nenhuma etapa, modalidade ou calendário é atribuído.
      </p>
      {loadErr && <p className="mt-2 text-sm text-destructive">Não foi possível ler os INEPs já cadastrados; a prévia não é exibida.</p>}
      {!canMaintain && <p className="mt-2 text-sm text-muted-foreground">Sua atuação vigente não concede manter o cadastro de unidades; a prévia é só consulta.</p>}
      {existing && (
        <>
          {canMaintain && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setSel(new Set(novos.map((n) => n.inep)))}>Selecionar as {novos.length} não cadastradas</Button>
              <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Limpar seleção</Button>
            </div>
          )}
          <ul className="mt-3 grid max-h-96 gap-1 overflow-y-auto text-sm">
            {rows.map((r) => (
              <li key={`${r.sheet}-${r.line}`} className="flex items-start gap-2 rounded border border-border p-2">
                <input type="checkbox" aria-label={`Selecionar ${r.name}`} disabled={!canMaintain || r.status !== "novo"} checked={sel.has(r.inep)}
                  onChange={(e) => setSel((s) => { const n = new Set(s); e.target.checked ? n.add(r.inep) : n.delete(r.inep); return n; })} />
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{r.name}</span>
                  <span className="block text-xs text-muted-foreground">INEP {r.inep} · {r.sheet}, linha {r.line} · dependência na fonte: {r.dependency} · {STATUS[r.status]}</span>
                </span>
              </li>
            ))}
          </ul>
          {canMaintain && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="ssi-act">Ato ou origem real</Label><Input id="ssi-act" value={act} onChange={(e) => setAct(e.target.value)} /></div>
              <div><Label htmlFor="ssi-from">Início da vigência</Label><DateInput id="ssi-from" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={useLoc} onChange={(e) => setUseLoc(e.target.checked)} />
                Registrar localização urbana/rural conforme a aba da fonte (Conveniadas ficam sem localização)
              </label>
              {err && <p className="text-sm text-destructive sm:col-span-2">{err}</p>}
              <Button className="sm:col-span-2" disabled={busy || sel.size === 0} onClick={run}>Registrar {sel.size} unidade(s) selecionada(s)</Button>
            </div>
          )}
          {results.length > 0 && (
            <div className="mt-3 text-sm" role="status">
              <p>{results.filter((r) => r.ok).length} gravada(s); {results.filter((r) => !r.ok).length} não gravada(s). As não gravadas continuam selecionadas para nova tentativa.</p>
              <ul className="mt-1 text-xs text-destructive">{results.filter((r) => !r.ok).map((r) => <li key={r.inep}>INEP {r.inep}: {r.message}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

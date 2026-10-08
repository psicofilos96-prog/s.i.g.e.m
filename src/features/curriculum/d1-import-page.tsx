/**
 * D1 — tela do importador governado da Deliberação CME nº 3/2026.
 * Prévia/diff/validação sempre visíveis; gravação só com confirmação humana,
 * capacidades de rede efetivas e pelos writers canônicos (ver d1-import.ts).
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DateInput } from "@/components/sigem/date-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { canMaintainCatalogs, loadCatalog } from "@/features/institutional-admin/institutional-catalog-source";
import { canMaintainMatrices, humanMatrixError, loadInstitutionalMatrices, loadInstitutionalMatrixLayout } from "@/features/curriculum/curricular-matrix-source";
import { useR5Capabilities } from "@/features/curriculum/r5-homologation-panel";
import {
  CME_SOURCE, D1_CONTRACT, buildPlan, executePlan, layoutSignature, preflight,
  type CurrentState, type ExecOutcome, type ImportInput, type PlanStep, type Rpc,
} from "@/features/curriculum/d1-import";

const STATUS_LABEL: Record<PlanStep["status"], string> = {
  novo: "será gravado", identico: "já existe idêntico (ignorado)", divergente: "divergente — bloqueia",
  "fonte-diferente": "fonte diferente — bloqueia", "vigencia-incompativel": "vigência incompatível — bloqueia",
};

async function loadState(validOn: string): Promise<CurrentState> {
  const knownAt = new Date().toISOString();
  const catalog = (await loadCatalog()).flatMap((s) => s.values.flatMap((v) => v.versions.map((x) => ({
    scheme: x.schemeId, value: x.valueId, version: x.version, label: x.label, status: x.status, validFrom: x.validFrom,
  }))));
  const ms = await loadInstitutionalMatrices({ validOn, knownAt });
  const matrices = await Promise.all(ms.map(async (m) => {
    const l = await loadInstitutionalMatrixLayout(m.matrixId, { validOn, knownAt });
    return {
      matrixId: m.matrixId, versionId: m.versionId, locator: l?.source.locator ?? "", sha256: l?.source.sha256 ?? null,
      layoutSignature: l ? layoutSignature({ columns: l.columns.map((c) => ({ key: c.key, header: c.header, ref: c.ref })), rows: l.rows, cells: l.cells, notes: l.notes }) : "",
    };
  }));
  return { catalog, matrices };
}

export function D1ImportPage() {
  const caps = useR5Capabilities();
  const capFlags = { catalog: canMaintainCatalogs(caps), matrix: canMaintainMatrices(caps) };
  const qc = useQueryClient();
  const [validFrom, setValidFrom] = useState("");
  const [docRef, setDocRef] = useState("");
  const [ack, setAck] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExecOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const state = useQuery({ queryKey: ["d1-import-state", validFrom], queryFn: () => loadState(validFrom), enabled: /^\d{4}-\d{2}-\d{2}$/.test(validFrom) });
  const input: ImportInput = { configuredValidFrom: validFrom, documentRef: docRef || null, acknowledgeWarnings: ack, confirmed };
  const plan = useMemo(() => buildPlan(CME_SOURCE, D1_CONTRACT, state.data ?? { catalog: [], matrices: [] }, input),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.data, validFrom, docRef]);
  const problem = state.data ? preflight(plan, input, capFlags) : "Informe a data configurada para conferir o estado atual.";
  const errors = plan.issues.filter((i) => i.level === "erro");
  const warnings = plan.issues.filter((i) => i.level === "aviso");

  const run = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      const rpc = supabase.rpc as unknown as Rpc;
      const r = await executePlan(plan, input, capFlags, rpc);
      setResult(r); setConfirmed(false);
      await qc.invalidateQueries({ queryKey: ["d1-import-state"] });
    } catch (e) { setError(humanMatrixError(e instanceof Error ? e.message : String(e))); }
    finally { setBusy(false); }
  };

  return (
    <section className="space-y-4" aria-labelledby="d1-title">
      <h1 id="d1-title" className="text-xl font-semibold text-foreground">Importação governada — {CME_SOURCE.source.act_ref}</h1>
      <p className="text-sm text-muted-foreground">
        Fonte transcrita (SHA-256 <code className="break-all">{CME_SOURCE.source.document_sha256}</code>), {CME_SOURCE.annexes.length} anexos,
        {" "}{D1_CONTRACT.positions.length} posições e {D1_CONTRACT.elements.length} elementos curriculares. Os literais (X, --, *, 1*, números) são
        transcritos sem interpretação. A data abaixo é configuração do SIGEM, não data de publicação da norma (publicação não comprovada).
      </p>
      {!capFlags.catalog || !capFlags.matrix ? (
        <p data-testid="d1-capability-blocked" role="note" className="rounded-md border border-border p-3 text-sm text-muted-foreground">
          A gravação exige, com alcance de rede, {[!capFlags.catalog && "manter-catalogos-institucionais", !capFlags.matrix && "manter-matrizes-curriculares"].filter(Boolean).join(" e ")}.
          A prévia continua disponível; o banco confere de novo ao gravar.
        </p>
      ) : null}

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Parâmetros</legend>
        <div className="space-y-1">
          <Label htmlFor="d1-from">Início de vigência configurado no SIGEM (decisão interna)</Label>
          <DateInput id="d1-from" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="d1-ref">Referência documental/fonte complementar (opcional)</Label>
          <Input id="d1-ref" value={docRef} onChange={(e) => setDocRef(e.target.value)} />
        </div>
      </fieldset>

      {errors.length > 0 && (
        <div role="alert" className="rounded-md border border-destructive p-3 text-sm">
          <p className="font-medium text-destructive">A fonte não confere com o contrato; nada pode ser gravado.</p>
          <ul className="list-disc pl-5">{errors.map((i, k) => <li key={k}>{i.message}</li>)}</ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-md border border-border p-3 text-sm" data-testid="d1-warnings">
          <p className="font-medium text-foreground">Avisos da fonte (transcritos sem correção)</p>
          <ul className="list-disc pl-5 text-muted-foreground">{warnings.map((i, k) => <li key={k}>{i.message}</li>)}</ul>
          <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Estou ciente destes avisos.</label>
        </div>
      )}

      {state.isLoading && <p role="status" className="text-sm text-muted-foreground">Conferindo o estado atual…</p>}
      {state.error && <p role="alert" className="text-sm text-destructive">Não foi possível ler o estado atual: {(state.error as Error).message}</p>}

      <table className="w-full text-sm" aria-label="Proposta de importação">
        <caption className="sr-only">Proposta de importação: cada linha é um elemento do contrato</caption><thead><tr className="text-left text-muted-foreground"><th scope="col">Tipo</th><th scope="col">Identificador</th><th scope="col">Rótulo</th><th scope="col">Situação</th></tr></thead>
        <tbody>
          {plan.steps.map((s, k) => (
            <tr key={k} className="border-t border-border">
              <td>{s.kind === "catalogo" ? s.scheme : "matriz"}</td>
              <td><code>{s.kind === "catalogo" ? s.value : `Anexo ${s.annex}`}</code></td>
              <td>{s.kind === "catalogo" ? s.label : s.officialName}</td>
              <td>{state.data ? STATUS_LABEL[s.status] : "—"}{s.detail ? ` · ${s.detail}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        Conferi a prévia e confirmo a gravação pelos registros canônicos.
      </label>
      {problem && <p className="text-sm text-muted-foreground" data-testid="d1-problem">{problem}</p>}
      <Button type="button" onClick={run} disabled={!!problem || busy}>{busy ? "Gravando…" : "Importar"}</Button>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {result && (
        <div role="status" className="rounded-md border border-border p-3 text-sm">
          <p>{result.done.length} gravados, {result.skipped.length} já existentes.</p>
          {result.failed && <p className="text-destructive">Parou em {result.failed.step.kind === "catalogo" ? result.failed.step.value : `Anexo ${result.failed.step.annex}`}: {humanMatrixError(result.failed.message)}. {result.notStarted.length} passos não iniciados; reexecutar é seguro.</p>}
        </div>
      )}
    </section>
  );
}

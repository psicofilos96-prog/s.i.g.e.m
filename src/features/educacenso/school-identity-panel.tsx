import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { readPages } from "@/lib/list-paging";
import { loadSchoolRegistryRows } from "@/features/units/school-registry-source";
import { unitsFromRows } from "@/features/schools/school-registry";
import { identityDuplicates, projectIdentity, summarizeIdentities, type ReceiptInput, type SchoolIdentity, type FieldState } from "./school-identity";

const STATE: Record<FieldState, string> = { informado: "informado", pendente: "pendente", "sem-fonte": "sem fonte no SIGEM", "nao-aplicavel": "não se aplica", divergente: "divergente do recibo" };
const CAT = { municipal: "Municipal", conveniada: "Conveniada", outra: "Outra", desconhecida: "Não classificada" } as const;

type Loaded = { rows: SchoolIdentity[]; duplicates: string[]; infraTruncated: boolean } | "error" | null;

export function SchoolIdentityPanel({ year, referenceDate }: { year: string; referenceDate: string | null }) {
  const [data, setData] = useState<Loaded>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [only, setOnly] = useState(false);
  const asOf = referenceDate ?? `${year}-12-31`;
  useEffect(() => {
    let live = true; setData(null);
    void (async () => {
      const reg = await loadSchoolRegistryRows();
      const rec = await supabase.from("census_official_receipt_snapshots").select("school_id, census_year, version, school_declared, recorded_at, source_ref").eq("census_year", year);
      const infra = await readPages<{ school_id: string }>((a, b) => supabase.from("school_infrastructure_observations").select("school_id").order("id").range(a, b), 20000);
      if (!live) return;
      if (!reg || rec.error) return setData("error");
      const units = unitsFromRows(reg.schools, reg.identifiers, reg.versions);
      const receipts = new Map<string, ReceiptInput>();
      for (const r of [...(rec.data ?? [])].sort((x, y) => x.version - y.version))
        receipts.set(r.school_id, { censusYear: Number(r.census_year), declared: r.school_declared as never, recordedAt: r.recorded_at, sourceRef: r.source_ref });
      const counts = new Map<string, number>();
      for (const r of infra.data ?? []) counts.set(r.school_id, (counts.get(r.school_id) ?? 0) + 1);
      const infraKnown = !infra.error && !infra.truncated;
      setData({ rows: units.map((u) => projectIdentity(u, asOf, receipts.get(u.schoolId) ?? null, infraKnown ? counts.get(u.schoolId) ?? 0 : null)).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
        duplicates: identityDuplicates(units), infraTruncated: infra.truncated });
    })();
    return () => { live = false; };
  }, [year, asOf]);
  const sum = useMemo(() => (data && data !== "error" ? summarizeIdentities(data.rows) : null), [data]);

  return (
    <section className="rounded-md border p-3" aria-label="Identidade censitária das escolas">
      <h2 className="text-sm font-semibold">Identidade censitária das escolas (Registro 00)</h2>
      <p className="mb-2 text-xs text-muted-foreground">Leitura do cadastro institucional vigente em {new Date(asOf + "T12:00").toLocaleDateString("pt-BR")}, confrontada com o recibo do Censo importado. Nada é copiado: correções são feitas na ficha da unidade.</p>
      {data === null ? <p className="text-xs" role="status">Carregando…</p> : data === "error" ? <p className="text-xs" role="alert">Não foi possível ler o cadastro das escolas com a sua sessão.</p> : sum && <>
        <div className="mb-2 flex flex-wrap gap-3 text-xs">
          <span>{sum.total} escolas no seu escopo</span><span>{sum.municipal} municipais</span><span>{sum.conveniada} conveniadas</span>
          {sum.desconhecida > 0 && <span>{sum.desconhecida} sem classificação</span>}
          <span>{sum.complete} sem pendências</span><span>{sum.divergent} com divergência do recibo</span>
        </div>
        {data.duplicates.length > 0 && <p role="alert" className="mb-2 text-xs">Identificadores duplicados: {data.duplicates.join("; ")}</p>}
        {data.infraTruncated && <p className="mb-2 text-xs">Contagem de infraestrutura parcial (lista truncada).</p>}
        <label className="mb-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} />Só escolas com divergência</label>
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left"><th scope="col">Escola</th><th scope="col">INEP</th><th scope="col">Categoria</th><th scope="col">Infraestrutura</th><th scope="col">Pendências</th><th scope="col" /></tr></thead>
          <tbody>{data.rows.filter((r) => !only || r.fields.some((f) => f.state === "divergente")).map((r) => <Fragment key={r.schoolId}>
            <tr className="border-t">
              <td>{r.name ?? "—"}</td><td>{r.inep ?? "—"}</td><td>{CAT[r.category]}</td>
              <td>{r.infraFacts == null ? "não apurado" : `${r.infraFacts} atributos`}</td><td>{r.pendencies.length}</td>
              <td><button type="button" className="underline" aria-expanded={open === r.schoolId} onClick={() => setOpen(open === r.schoolId ? null : r.schoolId)}>{open === r.schoolId ? "Fechar" : "Detalhar"}</button></td>
            </tr>
            {open === r.schoolId && <tr><td colSpan={6} className="bg-muted/40 p-2">
              <table className="w-full"><thead><tr className="text-left"><th scope="col">Campo</th><th scope="col">Valor</th><th scope="col">Estado</th><th scope="col">Origem</th></tr></thead>
                <tbody>{r.fields.map((f) => <tr key={f.n}><td>{f.n}. {f.label}</td><td>{f.value ?? "—"}</td><td>{STATE[f.state]}{f.note ? ` — ${f.note}` : ""}</td>
                  <td>{f.provenance ? `${f.provenance.source}${f.provenance.validFrom ? ` · vigente desde ${f.provenance.validFrom}` : ""}${f.provenance.knownAt ? ` · conhecido em ${new Date(f.provenance.knownAt).toLocaleDateString("pt-BR")}` : ""}` : "—"}</td></tr>)}</tbody></table>
              <Link to="/unidades/$id" params={{ id: r.schoolId }} className="mt-2 inline-block underline">Abrir ficha da unidade para corrigir</Link>
            </td></tr>}
          </Fragment>)}</tbody>
        </table></div>
      </>}
    </section>
  );
}

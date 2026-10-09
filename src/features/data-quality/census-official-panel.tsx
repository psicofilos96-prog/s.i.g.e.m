import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DIVERGENCE_LABEL, MEASURE_LABEL, bySchool, loadCensusReconciliation, type Divergence } from "./census-official";

const fmt = (n: number | null) => (n === null ? "não disponível" : n.toLocaleString("pt-BR"));

export function CensusOfficialPanel({ uid, schoolNames }: { uid: string; schoolNames: Map<string, string> }) {
  const [knownAt] = useState(() => new Date().toISOString());
  const [only, setOnly] = useState<Divergence | "">("");
  const q = useQuery({ queryKey: ["dq-census", uid, knownAt], queryFn: () => loadCensusReconciliation(knownAt) });
  if (q.isLoading) return <p role="status">Lendo o Censo oficial…</p>;
  if (q.isError) return <p role="alert" className="text-sm text-destructive">{(q.error as Error).message} <button type="button" className="underline" onClick={() => void q.refetch()}>Tentar novamente</button></p>;
  const schools = bySchool(q.data ?? []);
  if (!schools.length) return <p className="text-sm text-muted-foreground">Nenhum recibo do Censo visível à sua conta.</p>;
  const counts = schools.reduce<Record<string, number>>((a, s) => ({ ...a, [s.worst]: (a[s.worst] ?? 0) + 1 }), {});
  const shown = only ? schools.filter((s) => s.worst === only) : schools;
  return (
    <section aria-labelledby="dq-census" className="space-y-3 rounded-md border p-4">
      <h2 id="dq-census" className="font-medium">Censo oficial × base operacional</h2>
      <p className="text-sm text-muted-foreground">Recibo Educacenso importado de cada escola comparado com turmas, matrículas (vínculos aluno × turma) e alunos registrados. Nada é corrigido aqui.</p>
      <label className="text-sm">Classificação{" "}
        <select className="ml-1 min-h-11 rounded-md border bg-background px-2" value={only} onChange={(e) => setOnly(e.target.value as Divergence | "")}>
          <option value="">Todas ({schools.length})</option>
          {(Object.keys(DIVERGENCE_LABEL) as Divergence[]).map((d) => <option key={d} value={d}>{DIVERGENCE_LABEL[d]} ({counts[d] ?? 0})</option>)}
        </select>
      </label>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Comparação por escola e medida</caption>
          <thead><tr>{["Escola", "Medida", "Censo oficial", "Base operacional", "Diferença", "Cobertura", "Classificação", "Fonte"].map((h) => <th key={h} scope="col" className="border-b p-2 text-left">{h}</th>)}</tr></thead>
          <tbody>{shown.flatMap((s) => s.measures.map((m, i) => (
            <tr key={`${s.schoolId}-${m.measure}`} className="border-b">
              <td className="p-2">{i === 0 ? `${schoolNames.get(s.schoolId) ?? "Escola"}${s.inep ? ` · INEP ${s.inep}` : ""}` : ""}</td>
              <td className="p-2">{MEASURE_LABEL[m.measure] ?? "Medida não reconhecida"}</td>
              <td className="p-2">{fmt(m.official)}</td><td className="p-2">{fmt(m.operational)}</td>
              <td className="p-2">{m.diff === null ? "não disponível" : m.diff > 0 ? `+${m.diff}` : String(m.diff)}</td>
              <td className="p-2">{m.coverage === null ? "não disponível" : `${m.coverage.toLocaleString("pt-BR")}%`}</td>
              <td className="p-2">{DIVERGENCE_LABEL[m.divergence]}</td>
              <td className="p-2 text-xs text-muted-foreground">{i === 0 ? `Recibo v${s.receiptVersion}${s.issuedAt ? ` · emitido em ${new Date(s.issuedAt).toLocaleDateString("pt-BR")}` : ""}${s.sourceRef ? ` · ${s.sourceRef}` : ""}` : ""}</td>
            </tr>)))}</tbody>
        </table>
      </div>
    </section>
  );
}

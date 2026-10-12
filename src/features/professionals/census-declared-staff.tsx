/** L40 — profissionais declarados no Educacenso 2026 da escola (leitura pela RLS da sessão). */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SkeletonState } from "@/components/sigem/guidance";
import { EmptyState, StatePanel } from "@/components/sigem/patterns";
import { censusSummary, groupCensusDeclarations, type CensusDeclRow } from "./census-declared-staff-model";

async function loadCensusDeclarations(school: string): Promise<CensusDeclRow[]> {
  const { data, error } = await supabase
    .from("professional_census_declarations")
    .select("person_id, class_code, class_id, function_literal, regime_literal, institutional_persons!professional_census_declarations_person_id_fkey(display_name)")
    .eq("school_id", school)
    .order("class_code")
    .range(0, 999);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CensusDeclRow[];
}

export function CensusDeclaredStaff({ school }: { school: string }) {
  const q = useQuery({ queryKey: ["census-declared-staff", school], enabled: !!school, queryFn: () => loadCensusDeclarations(school), retry: false });
  if (q.isLoading) return <SkeletonState label="Lendo declarações do Educacenso 2026" />;
  if (q.isError) return <StatePanel tone="danger" title="Declarações do Educacenso indisponíveis" description="Sua conta não alcança esta escola ou a leitura falhou." />;
  const rows = q.data ?? [];
  if (!rows.length) return <EmptyState title="Nenhuma declaração visível" description="Não há profissionais declarados no Educacenso 2026 que sua atuação alcance nesta escola." />;
  const s = censusSummary(rows);
  const people = groupCensusDeclarations(rows);
  return (
    <section aria-labelledby="census-staff" className="space-y-3">
      <h2 id="census-staff" className="font-semibold">Profissionais declarados no Educacenso 2026</h2>
      <p className="text-xs text-muted-foreground">Dado declarado pela escola ao Censo Escolar 2026 (INEP). Não é lotação, regência nem vínculo funcional do DP; matrícula funcional só aparece após ligação comprovada.</p>
      <dl className="grid gap-2 sm:grid-cols-4 text-sm">
        <div className="rounded-md border p-2"><dt className="text-xs text-muted-foreground">Profissionais</dt><dd className="tabular-nums text-lg">{s.pessoas}</dd></div>
        <div className="rounded-md border p-2"><dt className="text-xs text-muted-foreground">Atuações em turma</dt><dd className="tabular-nums text-lg">{s.atuacoes}</dd></div>
        <div className="rounded-md border p-2"><dt className="text-xs text-muted-foreground">Turmas (código INEP)</dt><dd className="tabular-nums text-lg">{s.turmas}</dd></div>
        <div className="rounded-md border p-2"><dt className="text-xs text-muted-foreground">Sem turma correspondente</dt><dd className="tabular-nums text-lg">{s.semTurma}</dd></div>
      </dl>
      <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Profissionais declarados no Educacenso 2026</caption>
        <thead><tr className="text-left"><th scope="col">Profissional</th><th scope="col">Função(ões) na turma</th><th scope="col">Situação declarada</th><th scope="col">Turmas</th></tr></thead>
        <tbody>{people.map((p) => (
          <tr key={p.personId} className="border-t align-top">
            <td className="py-2">{p.name}</td><td>{p.functions.join("; ")}</td><td>{p.regimes.join("; ") || "Não declarada"}</td>
            <td className="tabular-nums">{p.classes.map((c) => c.matched ? c.code : `${c.code} (sem correspondência)`).join(", ")}</td>
          </tr>))}</tbody></table></div>
    </section>
  );
}

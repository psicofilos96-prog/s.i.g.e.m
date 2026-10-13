import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CardFact } from "@/components/sigem/registry-layout";
import { formatAcademicDate } from "@/lib/academic-date";

type Obs = {
  source_file: string; source_row: number; recorded_at: string; civil_name: string | null; birth_date: string | null; sex_literal: string | null;
  race_literal: string | null; nee_literal: string | null; father_name: string | null; mother_name: string | null; birthplace: string | null; birthplace_uf: string | null;
  nationality: string | null; guardian_name: string | null; guardian_occupation: string | null; phones: string[]; enrollment_status_literal: string | null;
  class_literal: string | null; grade_literal: string | null; sensitive_visible: boolean;
};
type Rpc = (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const NI = "não informado";
const school = (f: string) => f.replace(/^Banco_de_dados_-_/, "").replace(/(-\d)?\.xlsx$/, "").replace(/_/g, " ");

/** Dados das planilhas das escolas: observação com fonte, não a identidade oficial. */
export function RegistrationObservationsPanel({ studentId }: { studentId: string }) {
  const q = useQuery({ queryKey: ["student-registration-observations", studentId], retry: 1, queryFn: async () => {
    const { data, error } = await (supabase.rpc as unknown as Rpc)("student_registration_observations_for", { _student: studentId });
    if (error) throw new Error(error.message);
    return (data as Obs[]) ?? [];
  } });
  if (q.isLoading || q.error || !q.data?.length) return null;
  return (
    <section aria-label="Dados das planilhas das escolas" className="space-y-3">
      <h2 className="font-display text-xl font-semibold">Dados cadastrais informados pelas escolas</h2>
      <p className="text-sm text-muted-foreground">Copiados das planilhas "Banco de dados" de cada escola. Mostram o que a escola informou, com a fonte; se duas planilhas divergem, as duas aparecem.</p>
      {q.data.map((o) => (
        <div key={`${o.source_file}-${o.source_row}`} className="rounded-lg border p-4">
          <p hidden data-provenance className="mb-2 text-xs text-muted-foreground">Fonte: {school(o.source_file)} · linha {o.source_row}</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <CardFact label="Nome">{o.civil_name ?? NI}</CardFact>
            <CardFact label="Nascimento">{o.birth_date ? formatAcademicDate(o.birth_date) : NI}</CardFact>
            <CardFact label="Sexo">{o.sex_literal ?? NI}</CardFact>
            <CardFact label="Mãe">{o.mother_name ?? NI}</CardFact>
            <CardFact label="Pai">{o.father_name ?? NI}</CardFact>
            <CardFact label="Naturalidade">{o.birthplace ? `${o.birthplace}${o.birthplace_uf ? `/${o.birthplace_uf}` : ""}` : NI}</CardFact>
            <CardFact label="Nacionalidade">{o.nationality ?? NI}</CardFact>
            <CardFact label="Responsável">{o.guardian_name ? `${o.guardian_name}${o.guardian_occupation ? ` (${o.guardian_occupation})` : ""}` : NI}</CardFact>
            <CardFact label="Telefones">{o.phones.length ? o.phones.join(", ") : NI}</CardFact>
            <CardFact label="Ano/turma na planilha">{[o.grade_literal, o.class_literal].filter(Boolean).join(" · ") || NI}</CardFact>
            <CardFact label="Situação na planilha">{o.enrollment_status_literal ?? NI}</CardFact>
            {o.sensitive_visible
              ? <><CardFact label="Cor/raça">{o.race_literal ?? NI}</CardFact><CardFact label="NEE">{o.nee_literal ?? NI}</CardFact></>
              : <CardFact label="Cor/raça e NEE">Restrito: exige permissão de dado sensível</CardFact>}
          </dl>
        </div>
      ))}
    </section>
  );
}

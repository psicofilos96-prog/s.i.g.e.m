/**
 * Frente F — vínculos aluno × turma declarados pelo EducaCenso 2026 (observação no snapshot).
 * Leitura só pelo banco, sob RLS (capacidade escolar de consulta de matrícula). Início não declarado
 * aparece como "não informado"; nada aqui é participação/alocação constituída.
 */
import { SkeletonState } from "@/components/sigem/guidance";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatAcademicDate, civilDateOf } from "@/lib/academic-date";

export type CensusClassBond = Readonly<{
  id: string; studentId: string; studentName: string | null; enrollmentCode: string; stage: string | null;
  multiStage: string | null; validFrom: string | null; knownAt: string;
}>;

export async function censusClassBonds(classId: string): Promise<CensusClassBond[]> {
  const { data, error } = await supabase
    .from("student_class_bond_observations")
    .select("id, student_id, enrollment_code, stage_literal, multi_stage_literal, valid_from, known_at, institutional_students(display_name)")
    .eq("class_id", classId)
    .order("enrollment_code");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id, studentId: r.student_id, enrollmentCode: r.enrollment_code, stage: r.stage_literal, multiStage: r.multi_stage_literal,
    validFrom: r.valid_from, knownAt: r.known_at,
    studentName: (r.institutional_students as { display_name: string } | null)?.display_name ?? null,
  }));
}

export function CensusClassBondsPanel({ classId }: { classId: string }) {
  const q = useQuery({ queryKey: ["census-class-bonds", classId], queryFn: () => censusClassBonds(classId) });
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Users className="size-4" />Alunos declarados no Censo Escolar 2026</h2>
      <p className="mb-3 text-xs text-muted-foreground">Observação da fonte na data de emissão. Início do vínculo não informado pela fonte; não substitui a enturmação oficial.</p>
      {q.isLoading ? <SkeletonState label="Carregando" />
        : q.error ? <p className="text-sm text-destructive">Não foi possível consultar os vínculos declarados.</p>
        : !q.data?.length ? <p className="text-sm text-muted-foreground">Nenhum vínculo visível para a sua atuação.</p>
        : (
          <ul className="grid gap-1 text-sm">
            {q.data.map((b) => (
              <li key={b.id} className="flex flex-wrap justify-between gap-2 border-b py-1 last:border-0">
                <Link to="/alunos/$id" params={{ id: b.studentId }} className="font-medium hover:underline">{b.studentName ?? "Nome não informado"}</Link>
                <span className="text-muted-foreground">
                  Matrícula {b.enrollmentCode} · {b.stage ?? "etapa não informada"}{b.multiStage ? ` · etapa de vínculo: ${b.multiStage}` : ""}
                  {" · "}início {b.validFrom ? formatAcademicDate(b.validFrom) : "não informado"} · observado em {formatAcademicDate(civilDateOf(b.knownAt))}
                </span>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

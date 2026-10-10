import { SkeletonState } from "@/components/sigem/guidance";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  formatInfraValue,
  observationValue,
  schoolInfrastructureAt,
  type InfraAttributeRow,
  type InfraObservationRow,
} from "@/features/schools/school-infrastructure";
import { observationsKnownAt } from "@/features/units/school-profile";
import { groupInfra, INFRA_GROUP_LABEL } from "./infrastructure-groups";

/**
 * Lê só a escola pedida (antes lia a rede inteira e era cortado em 1000 linhas pelo servidor).
 * RLS decide o alcance; recusa vira erro, nunca lista vazia "sem infraestrutura".
 */
export async function readSchoolInfrastructure(schoolId: string, signal?: AbortSignal) {
  let a = supabase.from("school_infrastructure_attribute_versions").select("*").limit(1000);
  let o = supabase.from("school_infrastructure_observations").select("*").eq("school_id", schoolId).limit(1000);
  if (signal) { a = a.abortSignal(signal); o = o.abortSignal(signal); }
  const [ar, or] = await Promise.all([a, o]);
  if (ar.error || or.error) throw new Error("leitura-infraestrutura");
  return { attributes: (ar.data ?? []) as InfraAttributeRow[], observations: (or.data ?? []) as InfraObservationRow[] };
}

/** Cadastro da Unidade > Infraestrutura: lê só fatos reais; sem observação = "não informado". */
export function UnitInfrastructurePanel({ schoolId, on, knownAt }: { schoolId: string; on: string; knownAt?: string | null }) {
  const q = useQuery({ queryKey: ["school-infrastructure", schoolId], queryFn: ({ signal }) => readSchoolInfrastructure(schoolId, signal) });
  if (q.isLoading) return <SkeletonState label="Carregando infraestrutura" />;
  if (q.error || !q.data) return <p role="alert" className="text-sm text-muted-foreground">Não foi possível consultar a infraestrutura. Nenhum dado substituto é exibido.</p>;
  const facts = schoolInfrastructureAt(schoolId, q.data.attributes, observationsKnownAt(q.data.observations, knownAt), on);
  if (facts.length === 0)
    return <p className="text-sm text-muted-foreground">Nenhum atributo de infraestrutura registrado na rede ainda: todos os itens estão não informados.</p>;
  const informed = facts.filter((f) => f.current).length;
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{informed} de {facts.length} itens informados pela fonte. Item sem observação aparece como “não informado” — não significa que a escola não tem.</p>
      {groupInfra(facts).map(({ group, items }) => (
        <section key={group} aria-label={INFRA_GROUP_LABEL[group]}>
          <h3 className="mb-1 text-sm font-semibold">{INFRA_GROUP_LABEL[group]}</h3>
          {!items.length ? <p className="text-xs text-muted-foreground">A fonte 2026 não traz campos de equipamentos: não informado.</p> : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {items.map((f) => (
                <li key={f.attributeId} className="rounded-md border border-border p-2 text-sm">
                  <span className="font-medium">{f.label.replace(/\s*\(G\d\)$/, "")}:</span> {f.display}
                  {f.current ? (
                    <span className="block text-xs text-muted-foreground">
                      Fonte: {f.current.source_ref}
                      {f.current.source_locator ? ` · ${f.current.source_locator}` : ""} · vigente desde {formatAcademicDate(f.current.valid_from)}
                      {f.current.technical_operation_id ? " · carga técnica" : ""}
                    </span>
                  ) : <span className="block text-xs text-muted-foreground">Sem observação da fonte.</span>}
                  {f.history.length > 1 && (
                    <details className="mt-1 text-xs">
                      <summary>Histórico ({f.history.length})</summary>
                      <ol>{f.history.map((h) => <li key={h.id}>{formatAcademicDate(h.valid_from)}: {formatInfraValue(observationValue(h))} — {h.source_ref}</li>)}</ol>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

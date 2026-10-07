import { SkeletonState } from "@/components/sigem/guidance";
import { useEffect, useState } from "react";
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

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; attributes: InfraAttributeRow[]; observations: InfraObservationRow[] };

/** Cadastro da Unidade > Infraestrutura: lê só fatos reais; sem observação = "não informado". */
export function UnitInfrastructurePanel({ schoolId, on, knownAt }: { schoolId: string; on: string; knownAt?: string | null }) {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    void Promise.all([
      supabase.from("school_infrastructure_attribute_versions").select("*"),
      supabase.from("school_infrastructure_observations").select("*"),
    ]).then(([a, o]) => {
      if (!alive) return;
      if (a.error || o.error) return setState({ status: "error" });
      setState({ status: "ready", attributes: (a.data ?? []) as InfraAttributeRow[], observations: (o.data ?? []) as InfraObservationRow[] });
    }).catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [schoolId]);

  if (state.status === "loading") return <SkeletonState label="Carregando infraestrutura" />;
  if (state.status === "error") return <p className="text-sm text-muted-foreground">Não foi possível consultar a infraestrutura. Nenhum dado substituto é exibido.</p>;
  const facts = schoolInfrastructureAt(schoolId, state.attributes, observationsKnownAt(state.observations, knownAt), on);
  if (facts.length === 0)
    return <p className="text-sm text-muted-foreground">Nenhum atributo de infraestrutura registrado na rede ainda: todos os itens estão não informados.</p>;
  return (
    <ul aria-label="Infraestrutura da unidade" className="space-y-2">
      {facts.map((f) => (
        <li key={f.attributeId} className="rounded-md border border-border p-2 text-sm">
          <span className="font-medium">{f.label}:</span> {f.display}
          {f.current && (
            <span className="block text-xs text-muted-foreground">
              Fonte: {f.current.source_ref}
              {f.current.source_locator ? ` · ${f.current.source_locator}` : ""} · vigente desde {formatAcademicDate(f.current.valid_from)}
              {f.current.technical_operation_id ? " · carga técnica" : ""}
            </span>
          )}
          {f.history.length > 1 && (
            <details className="mt-1 text-xs">
              <summary>Histórico ({f.history.length})</summary>
              <ol>
                {f.history.map((h) => (
                  <li key={h.id}>
                    {formatAcademicDate(h.valid_from)}: {formatInfraValue(observationValue(h))} — {h.source_ref}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

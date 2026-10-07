/** N5.3.1 — composição (simples/multisseriada) e capacidade na ficha da turma; só leitores canônicos. */
import { useQuery } from "@tanstack/react-query";
import { Layers, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { todayIso } from "./institutional-class-source";
import { CompositionBreakdownTable } from "./class-composition-views";
import { classCompositionAt, positionCatalogs } from "./class-wizard-source";

export function CompositionPanel({ classId }: { classId: string }) {
  const on = todayIso();
  const q = useQuery({ queryKey: ["class-composition", classId, on], queryFn: () => classCompositionAt(classId, on) });
  const cat = useQuery({ queryKey: ["wizard-positions", on], queryFn: () => positionCatalogs(on) });
  const label = (scheme: string, value: string) => cat.data?.get(scheme)?.find((p) => p.value === value)?.label ?? "Etapa sem rótulo homologado";
  return (
    <section aria-labelledby="comp-title" className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 id="comp-title" className="mb-2 flex items-center gap-2 text-sm font-semibold"><Layers className="size-4" />Etapa / composição</h2>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : q.error ? <p role="alert" className="text-sm text-destructive">Não foi possível consultar a composição.</p>
        : !q.data ? <p className="text-sm text-muted-foreground">Composição não declarada para esta turma.</p>
        : (
          <div className="grid gap-2 text-sm">
            <Badge variant="secondary" className="w-fit">{q.data.kind === "multisseriada" ? "Multisseriada" : "Etapa única"}</Badge>
            <p>{q.data.positions.map((p) => label(p.scheme, p.value)).join(", ")}</p>
            <CompositionBreakdownTable classId={classId} on={on} />
            <p className="text-xs text-muted-foreground">O ano/etapa de cada estudante é registrado na enturmação.</p>
          </div>
        )}
    </section>
  );
}

export function CapacityPanel({ classId }: { classId: string }) {
  const on = todayIso();
  const q = useQuery({
    queryKey: ["class-capacity", classId, on],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
        "class_capacity_at", { _class: classId, _valid_on: on, _known_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { reference_limit: number | null; annulled?: boolean }[];
      const live = rows.filter((r) => !r.annulled && r.reference_limit != null);
      return live.length === 1 ? live[0]!.reference_limit : null;
    },
  });
  return (
    <section aria-labelledby="cap-title" className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 id="cap-title" className="mb-2 flex items-center gap-2 text-sm font-semibold"><Users className="size-4" />Capacidade</h2>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : q.error ? <p role="alert" className="text-sm text-destructive">Não foi possível consultar a capacidade.</p>
        : <p className="text-sm">{q.data ? `${q.data} estudantes` : "Capacidade não informada"}</p>}
      <p className="mt-1 text-xs text-muted-foreground">Ocupação e vagas: veja Secretaria → Vagas.</p>
    </section>
  );
}

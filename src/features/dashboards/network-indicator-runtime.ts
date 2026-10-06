// AD.1 — disponibilidade em tempo de execução: o catálogo declara dependências,
// e cada dependência é resolvida lendo a fonte canônica com a sessão (RLS).
// Nenhuma tabela "frente pronta"; leitura negada ou erro ⇒ indisponível com motivo.
import type { DependencyState } from "./network-indicator-catalog";

export type DependencyProbe = Readonly<{ front: string; table: string; requireRows?: string }>;

/** Fonte canônica de cada dependência. `requireRows`: motivo quando ler é possível mas não há fato que sustente o indicador. */
export const DEPENDENCY_SOURCES: Readonly<Record<string, DependencyProbe>> = {
  cadastro: { front: "Cadastro das escolas", table: "institutional_school_record_versions" },
  infraestrutura: { front: "Infraestrutura", table: "school_infrastructure_attribute_versions" },
  matricula: { front: "Matrículas", table: "school_enrollments" },
  movimentacao: { front: "Movimentações", table: "student_movement_events" },
  mapa: { front: "Mapa Estatístico", table: "statistical_map_versions", requireRows: "Nenhuma versão oficializada do Mapa." },
  curriculo: { front: "Posição curricular", table: "allocation_curricular_positions" },
  oferta: { front: "Grade", table: "class_schedule_blocks" },
  docente: { front: "Atribuição docente", table: "teaching_assignment_versions" },
  diario: { front: "Diário", table: "lesson_record_versions" },
  frequencia: { front: "Frequência", table: "attendance_record_versions" },
  avaliacao: { front: "Avaliação", table: "assessment_instrument_status_events" },
  acompanhamento: { front: "Acompanhamento", table: "school_pedagogical_records" },
};

export type CountReader = (table: string) => Promise<{ count: number | null; error: string | null }>;

/** Resolve o estado das dependências pelas fontes; nunca lê de constante. */
export async function resolveDependencies(read: CountReader, keys: readonly string[] = Object.keys(DEPENDENCY_SOURCES)) {
  const out: Record<string, DependencyState & { count: number | null }> = {};
  await Promise.all(keys.map(async (k) => {
    const p = DEPENDENCY_SOURCES[k];
    if (!p) { out[k] = { front: k, ready: false, reason: "Dependência sem fonte declarada.", count: null }; return; }
    const r = await read(p.table).catch((e: unknown) => ({ count: null, error: String(e) }));
    if (r.error || r.count == null) { out[k] = { front: p.front, ready: false, reason: "Fonte não legível com esta sessão.", count: null }; return; }
    if (p.requireRows && r.count === 0) { out[k] = { front: p.front, ready: false, reason: p.requireRows, count: 0 }; return; }
    out[k] = { front: p.front, ready: true, reason: r.count === 0 ? "Fonte legível; nenhum registro no recorte." : "Fonte legível.", count: r.count };
  }));
  return out;
}

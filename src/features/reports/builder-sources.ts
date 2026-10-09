/**
 * NREL.2 — Assuntos do gerador. Cada um lê pelo reader canônico com a sessão do usuário; a RLS e as
 * capabilities do dado de origem decidem o que volta. Nenhum adaptador usa privilégio de serviço.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CellValue, ColumnDef, ReportDefinition } from "./report-engine";
import type { BuilderSource, Page } from "./report-builder";
import { REPORTING_REPORTS, toReportRow, type Dataset } from "@/features/school-meals/reporting-model";

const C = (id: string, label: string, kind: ColumnDef["kind"] = "text"): ColumnDef => ({ id, label, kind });
const v = (x: unknown): CellValue => (x === null || x === undefined || x === "" ? null : typeof x === "number" ? x : typeof x === "boolean" ? (x ? "sim" : "não") : String(x));
const fail = (): never => { throw new Error("Não foi possível ler os dados com o seu acesso."); };

const SCHOOLS_DEF: ReportDefinition = {
  id: "gerador-escolas", version: 1, title: "Cadastro das escolas", description: "Versão vigente do cadastro de cada escola visível à conta.",
  source: "institutional_school_record_versions (versão mais recente por escola)", params: [],
  columns: [C("name", "Escola"), C("dependency", "Dependência"), C("location", "Localização"), C("district", "Bairro/distrito"), C("rooms", "Salas", "number"), C("active", "Ativa"), C("valid_from", "Vigente desde", "date")],
  formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 5000,
};

const CLASSES_DEF: ReportDefinition = {
  id: "gerador-turmas", version: 1, title: "Turmas", description: "Turmas registradas visíveis à conta.",
  source: "institutional_classes", params: [{ id: "from", label: "Vigentes a partir de", type: "date", required: false }, { id: "to", label: "Até", type: "date", required: false }],
  columns: [C("school", "Escola"), C("year", "Ano letivo"), C("name", "Turma"), C("code", "Código"), C("stage", "Etapa"), C("valid_from", "Início", "date"), C("valid_until", "Fim", "date")],
  formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 5000,
};

async function loadSchools({ offset, limit }: { offset: number; limit: number }): Promise<Page> {
  const r = await supabase.from("institutional_school_record_versions")
    .select("school_id, official_name, administrative_dependency, location_kind, district, classroom_count, active, valid_from, version_number", { count: "exact" })
    .order("school_id").order("version_number", { ascending: false }).range(offset, offset + limit - 1);
  if (r.error) fail();
  // Linhas de versão: o gerador mantém só a mais recente por escola dentro do que a RLS devolveu.
  return { rows: (r.data ?? []).map((x) => ({ _sid: x.school_id, _v: x.version_number, name: v(x.official_name), dependency: v(x.administrative_dependency), location: v(x.location_kind), district: v(x.district), rooms: v(x.classroom_count), active: v(x.active), valid_from: v(x.valid_from) })), total: r.count ?? null };
}

async function loadClasses({ from, to, offset, limit }: { from: string | null; to: string | null; offset: number; limit: number }): Promise<Page> {
  let q = supabase.from("institutional_classes").select("id, school_label_snapshot, academic_year_label, name, code, stage_label_snapshot, valid_from, valid_until", { count: "exact" });
  if (from) q = q.gte("valid_from", from);
  if (to) q = q.lte("valid_from", to);
  const r = await q.order("id").range(offset, offset + limit - 1);
  if (r.error) fail();
  return { rows: (r.data ?? []).map((x) => ({ school: v(x.school_label_snapshot), year: v(x.academic_year_label), name: v(x.name), code: v(x.code), stage: v(x.stage_label_snapshot), valid_from: v(x.valid_from), valid_until: v(x.valid_until) })), total: r.count ?? null };
}

const ENROLL_DEF: ReportDefinition = {
  id: "gerador-matriculas", version: 1, title: "Matrículas", description: "Registros de matrícula vigentes (sem correção posterior) visíveis à conta, sem dado nominal.",
  source: "school_enrollments (registro sem versão substituta)", params: [{ id: "from", label: "Abertas a partir de", type: "date", required: false }, { id: "to", label: "Até", type: "date", required: false }],
  columns: [C("school", "Escola"), C("year", "Ano letivo"), C("offer", "Oferta"), C("opened_on", "Aberta em", "date")],
  formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 50000,
};

async function loadEnrollments({ from, to, offset, limit }: { from: string | null; to: string | null; offset: number; limit: number }): Promise<Page> {
  let q = supabase.from("school_enrollments").select("id, school_id, academic_year_id, educational_offer_value_id, opened_on, supersedes_id", { count: "exact" });
  if (from) q = q.gte("opened_on", from);
  if (to) q = q.lte("opened_on", to);
  const r = await q.order("id").range(offset, offset + limit - 1);
  if (r.error) fail();
  return { rows: (r.data ?? []).map((x) => ({ _id: x.id, _sup: v(x.supersedes_id), school: v(x.school_id), year: v(x.academic_year_id), offer: v(x.educational_offer_value_id), opened_on: v(x.opened_on) })), total: r.count ?? null };
}
/** Mantém só o registro corrente: descarta os que foram substituídos por correção. */
export function dropSuperseded(rows: readonly Record<string, CellValue>[]): Record<string, CellValue>[] {
  const sup = new Set(rows.map((r) => r["_sup"]).filter((x) => x !== null));
  return rows.filter((r) => !sup.has(r["_id"] ?? null));
}

function mealSource(ds: Dataset): BuilderSource {
  const def = REPORTING_REPORTS[ds];
  return {
    id: `nae-${ds}`, title: `Alimentação — ${def.title}`, sectors: ["nae", "op-direcao"], definition: def,
    methodology: def.description, period: true, pageSize: 500,
    acl: "Escola só a própria (consultar-alimentacao-escolar); rede inteira só com acompanhar-alimentacao-rede. Sem dado pessoal nem arquivo.",
    filterable: def.columns.filter((c) => c.kind === "text" && c.id !== "school").map((c) => c.id),
    load: async ({ from, to, offset, limit }) => {
      if (!from || !to) throw new Error("Informe o período (de e até).");
      const r = await supabase.rpc("meal_reporting_rows", { _dataset: ds, _school: null as unknown as string, _from: from, _to: to, _filters: {}, _limit: limit, _offset: offset });
      if (r.error) fail();
      const rows = r.data ?? [];
      return { rows: rows.map((x) => toReportRow(ds, x.school_id, (x.row_data ?? {}) as Record<string, unknown>)), total: rows[0]?.total ?? (rows.length ? null : 0) };
    },
  };
}

/** Assunto catalogado sem leitura transversal: recusa por extenso, nunca linha vazia como se fosse zero. */
const pending = (id: string, title: string, sectors: BuilderSource["sectors"], reason: string): BuilderSource => ({
  id, title, sectors, methodology: "—", acl: "—", period: false, pageSize: 1, filterable: [], unavailable: reason,
  definition: { id, version: 1, title, description: reason, source: "—", params: [], columns: [], formats: [], reproducible: false, syncRowLimit: 0 },
});

export function dedupeLatestSchools(rows: readonly Record<string, CellValue>[]): Record<string, CellValue>[] {
  const best = new Map<string, Record<string, CellValue>>();
  for (const r of rows) { const k = String(r["_sid"]); const cur = best.get(k); if (!cur || Number(cur["_v"]) < Number(r["_v"])) best.set(k, r); }
  return [...best.values()];
}

export const BUILDER_SOURCES: readonly BuilderSource[] = [
  { id: "gerador-escolas", title: "Cadastro das escolas", sectors: ["secretaria", "ciece", "supervisao", "op-direcao", "admin"], definition: SCHOOLS_DEF,
    methodology: "Uma linha por escola: a versão de cadastro mais recente que a conta pode ler. Campo não informado sai como \"não disponível\".",
    acl: "RLS do cadastro escolar com a sessão de quem gera.", period: false, pageSize: 1000, filterable: ["dependency", "location", "district", "active"], load: loadSchools, finalize: (r) => dedupeLatestSchools(r) },
  { id: "gerador-turmas", title: "Turmas", sectors: ["secretaria", "ciece", "op-direcao", "supervisao"], definition: CLASSES_DEF,
    methodology: "Uma linha por turma registrada; o período filtra pela data de início da turma. Nada é inferido.",
    acl: "RLS de turmas com a sessão de quem gera (escola vê só as próprias).", period: true, pageSize: 1000, filterable: ["school", "year", "stage"], load: loadClasses },
  { id: "gerador-matriculas", title: "Matrículas", sectors: ["secretaria", "ciece", "supervisao", "op-direcao", "admin"], definition: ENROLL_DEF,
    methodology: "Uma linha por matrícula corrente (registro sem correção posterior); o período filtra pela data de abertura. Sem nome, documento ou dado pessoal.",
    acl: "RLS de matrículas com a sessão de quem gera (escola vê só as próprias).", period: true, pageSize: 1000, filterable: ["school", "year", "offer"],
    load: loadEnrollments, finalize: (r) => dropSuperseded(r), schoolIdColumn: "school" },
  ...(["pedidos", "entregas", "nao-conformidades", "movimentos", "execucoes"] as const).map(mealSource),
  pending("gerador-avaliacao", "Avaliação — resultados por habilidade", ["avaliacao"], "Os resultados saem pela tela de Desempenho, com a política de supressão dela; leitura transversal ainda não liberada."),
  pending("gerador-dp", "DP — vínculos funcionais", ["dp"], "Sem leitor transversal autorizado para dados funcionais; use a estação do DP."),
  pending("gerador-censo", "CIECE — fotografia do Censo", ["ciece"], "Use a aba Relatórios do Censo Escolar, que exporta a fotografia oficializada."),
  pending("gerador-infraestrutura", "Infraestrutura das escolas", ["supervisao", "ciece"], "Sem adaptador governado de infraestrutura no gerador; use Unidades Escolares."),
  pending("gerador-alunos", "Alunos (nominal)", ["secretaria"], "Dado nominal de estudante: leitura transversal exige reader com supressão por campo ainda não registrado."),
  pending("gerador-movimentacoes", "Movimentações", ["secretaria"], "Depende de enturmação 2026 (ENROLLMENT_EPISODES_2026_PENDING) e de reader de movimentações."),
  pending("gerador-mapa", "Mapa Estatístico", ["supervisao", "secretaria"], "O Mapa exporta pelas próprias células oficializadas; não há reader transversal."),
  pending("gerador-jornadas", "Jornadas e horários", ["op-direcao"], "Sem fonte de jornada profissional (PROFESSIONAL_SCHEDULE_SOURCE_ABSENT)."),
  pending("gerador-frequencia", "Diário e frequência", ["op-direcao"], "Frequência só com fechamento homologado; sem reader transversal."),
  pending("gerador-inclusao", "Inclusão / AEE / Mediador", ["op-direcao"], "Dado sensível: sem reader com política de supressão aprovada."),
  pending("gerador-auditoria", "Auditoria", ["admin"], "Exige capability exportar-auditoria (não atribuída)."),
];

export const sourceById = (id: string) => BUILDER_SOURCES.find((s) => s.id === id) ?? null;

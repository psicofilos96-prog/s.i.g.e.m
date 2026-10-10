/**
 * NREL.2 — Assuntos do gerador. Cada um lê pelo reader canônico com a sessão do usuário; a RLS e as
 * capabilities do dado de origem decidem o que volta. Nenhum adaptador usa privilégio de serviço.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CellValue, ColumnDef, ReportDefinition } from "./report-engine";
import type { BuilderSource, Page } from "./report-builder";
import { structureOf } from "@/features/statistical-map/map-structures";
import { DIVERGENCE_LABEL, MEASURE_LABEL, classify, coverage as censusCoverage, difference } from "@/features/data-quality/census-official";
import { classCountRows, infraValue, journeySchoolRows, panoramaRows, type DayObsRow, type EpisodeRow, type ReconRow } from "./cross-reports";
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
  const sup = new Set<CellValue>(rows.map((r) => r["_sup"] ?? null).filter((x) => x !== null));
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


// NDIARY.FINAL.2 — fontes do Diário. Leitura com a sessão do usuário (RLS de cada tabela).
// Nenhuma coluna de professor/autor: o gerador não produz ranking docente.
type Raw = Record<string, unknown>;
const headsBy = (rows: Raw[], k: string, ver: string) => { const m = new Map<string, Raw>(); for (const r of rows) { const c = m.get(String(r[k])); if (!c || Number(c[ver]) < Number(r[ver])) m.set(String(r[k]), r); } return [...m.values()]; };
const tdb = supabase as unknown as { from: (t: string) => any };
function diaryDef(id: string, title: string, description: string, source: string, columns: ColumnDef[]): ReportDefinition {
  return { id, version: 1, title, description, source, params: [{ id: "from", label: "De", type: "date", required: false }, { id: "to", label: "Até", type: "date", required: false }], columns, formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 50000 };
}
async function page(table: string, cols: string, dateCol: string | null, a: { from: string | null; to: string | null; offset: number; limit: number }) {
  let q = tdb.from(table).select(cols, { count: "exact" });
  if (dateCol && a.from) q = q.gte(dateCol, a.from);
  if (dateCol && a.to) q = q.lte(dateCol, a.to);
  const r = await q.order("id").range(a.offset, a.offset + a.limit - 1);
  if (r.error) fail();
  return { rows: (r.data ?? []) as Raw[], total: (r.count ?? null) as number | null };
}
export function attendanceCounts(marks: unknown) {
  let p = 0, f = 0;
  for (const slot of Object.values((marks ?? {}) as Record<string, Record<string, string>>)) for (const m of Object.values(slot ?? {})) { if (m === "Presente") p++; else if (m === "Ausente") f++; }
  return { presentes: p, faltas: f };
}
const DIARY_ACL = "RLS do Diário com a sessão de quem gera (professor vê só as próprias atuações; escola só a própria).";
const DIARY_SOURCES: BuilderSource[] = [
  { id: "diario-aulas", title: "Diário — aulas previstas × registradas", sectors: ["op-direcao", "supervisao"], definition: diaryDef("diario-aulas", "Aulas previstas × registradas", "Uma linha por registro de aula concluído (versão vigente).", "lesson_record_versions (cabeça por registro lógico)",
      [C("class", "Turma"), C("component", "Componente"), C("date", "Data", "date"), C("previstas", "Horários da grade citados", "number"), C("registradas", "Aulas registradas", "number")]),
    methodology: "Prevista = horário da grade citado no registro; registrada = quantidade declarada ao concluir. Dia sem registro não gera linha nem zero.", acl: DIARY_ACL, period: true, pageSize: 1000, filterable: ["class", "component"],
    load: async (a) => { const r = await page("lesson_record_versions", "id, logical_record_id, version_number, class_id, component_id, lesson_date, facts, schedule_block_ids", "lesson_date", a);
      return { rows: r.rows.map((x) => ({ _k: v(x["logical_record_id"]), _v: v(x["version_number"]), class: v(x["class_id"]), component: v(x["component_id"]), date: v(x["lesson_date"]), previstas: Array.isArray(x["schedule_block_ids"]) ? (x["schedule_block_ids"] as unknown[]).length : null, registradas: v(((x["facts"] ?? {}) as { quantity?: number }).quantity ?? null) })), total: r.total }; },
    finalize: (rows) => headsBy(rows as Raw[], "_k", "_v") as Record<string, CellValue>[] },
  { id: "diario-frequencia", title: "Diário — frequência", sectors: ["op-direcao", "supervisao"], definition: diaryDef("diario-frequencia", "Frequência", "Uma linha por chamada (versão vigente), contagem de presenças e faltas registradas.", "attendance_record_versions (cabeça por chamada lógica)",
      [C("class", "Turma"), C("component", "Componente"), C("recorded", "Registrada em", "date"), C("presentes", "Presenças", "number"), C("faltas", "Faltas", "number")]),
    methodology: "Conta só marcações explícitas; ausência de marcação não entra como presença nem falta. Valor armazenado \"Ausente\" é exibido como falta.", acl: DIARY_ACL, period: true, pageSize: 1000, filterable: ["class", "component"],
    load: async (a) => { const r = await page("attendance_record_versions", "id, logical_attendance_id, version_number, class_id, component_id, marks, recorded_at", "recorded_at", a);
      return { rows: r.rows.map((x) => ({ _k: v(x["logical_attendance_id"]), _v: v(x["version_number"]), class: v(x["class_id"]), component: v(x["component_id"]), recorded: v(String(x["recorded_at"] ?? "").slice(0, 10)), ...attendanceCounts(x["marks"]) })), total: r.total }; },
    finalize: (rows) => headsBy(rows as Raw[], "_k", "_v") as Record<string, CellValue>[] },
  { id: "diario-justificativas", title: "Diário — faltas e justificativas", sectors: ["op-direcao", "secretaria"], definition: diaryDef("diario-justificativas", "Faltas e justificativas", "Ocorrências de frequência registradas (versão vigente), sem nome do estudante.", "student_attendance_occurrences (cabeça por ocorrência lógica)",
      [C("class", "Turma"), C("type", "Tipo de ocorrência"), C("from", "De", "date"), C("until", "Até", "date"), C("annulled", "Anulada")]),
    methodology: "Uma linha por ocorrência; tipo vem do catálogo configurado. Anulação é fato próprio, nunca exclusão.", acl: DIARY_ACL, period: true, pageSize: 1000, filterable: ["class", "type", "annulled"],
    load: async (a) => { const r = await page("student_attendance_occurrences", "id, logical_id, version, class_id, occurrence_type_id, from_date, until_date, annulled", "from_date", a);
      return { rows: r.rows.map((x) => ({ _k: v(x["logical_id"]), _v: v(x["version"]), class: v(x["class_id"]), type: v(x["occurrence_type_id"]), from: v(x["from_date"]), until: v(x["until_date"]), annulled: v(x["annulled"]) })), total: r.total }; },
    finalize: (rows) => headsBy(rows as Raw[], "_k", "_v") as Record<string, CellValue>[] },
  { id: "diario-cobertura", title: "Diário — cobertura de registros", sectors: ["op-direcao", "supervisao"], definition: diaryDef("diario-cobertura", "Cobertura de registros", "Por aula registrada, se há chamada vinculada.", "lesson_record_versions + attendance_record_versions",
      [C("class", "Turma"), C("date", "Data", "date"), C("chamada", "Chamada registrada")]),
    methodology: "Cobertura = aula concluída com chamada vinculada (lesson_logical_id). Não compara docentes.", acl: DIARY_ACL, period: true, pageSize: 1000, filterable: ["class", "chamada"],
    load: async (a) => { const r = await page("lesson_record_versions", "id, logical_record_id, version_number, class_id, lesson_date", "lesson_date", a);
      const ids = [...new Set(r.rows.map((x) => String(x["logical_record_id"])))];
      const at = ids.length ? await tdb.from("attendance_record_versions").select("lesson_logical_id").in("lesson_logical_id", ids) : { data: [], error: null };
      if (at.error) fail();
      const has = new Set(((at.data ?? []) as Raw[]).map((x) => String(x["lesson_logical_id"])));
      return { rows: r.rows.map((x) => ({ _k: v(x["logical_record_id"]), _v: v(x["version_number"]), class: v(x["class_id"]), date: v(x["lesson_date"]), chamada: has.has(String(x["logical_record_id"])) ? "sim" : "não" })), total: r.total }; },
    finalize: (rows) => headsBy(rows as Raw[], "_k", "_v") as Record<string, CellValue>[] },
  { id: "diario-avaliacoes", title: "Diário — avaliações", sectors: ["op-direcao", "avaliacao"], definition: diaryDef("diario-avaliacoes", "Avaliações", "Resultados lançados (versão vigente), sem nome do estudante.", "assessment_entry_versions (cabeça por lançamento lógico)",
      [C("class", "Turma"), C("period", "Período"), C("instrument", "Instrumento"), C("value", "Resultado")]),
    methodology: "Resultado como registrado (rótulo ou valor). Sem lançamento não há linha; nada é presumido.", acl: DIARY_ACL, period: true, pageSize: 1000, filterable: ["class", "period", "instrument"],
    load: async (a) => { const r = await page("assessment_entry_versions", "id, logical_entry_id, version_number, class_id, period_id, instrument_id, value, value_label, recorded_at", "recorded_at", a);
      return { rows: r.rows.map((x) => ({ _k: v(x["logical_entry_id"]), _v: v(x["version_number"]), class: v(x["class_id"]), period: v(x["period_id"]), instrument: v(x["instrument_id"]), value: v(x["value_label"] ?? x["value"]) })), total: r.total }; },
    finalize: (rows) => headsBy(rows as Raw[], "_k", "_v") as Record<string, CellValue>[] },
  { id: "diario-planejamento", title: "Diário — planejamento", sectors: ["op-direcao"], definition: diaryDef("diario-planejamento", "Planejamento", "Planos na versão vigente (compartilhados ou do próprio autor, conforme a RLS).", "teaching_plan_versions (cabeça por plano)",
      [C("school", "Escola"), C("class", "Turma"), C("title", "Plano"), C("status", "Situação"), C("from", "De", "date"), C("until", "Até", "date")]),
    methodology: "Uma linha por plano; o período filtra pelo início coberto. Planejar não significa conteúdo ministrado.", acl: DIARY_ACL, period: true, pageSize: 1000, filterable: ["school", "class", "status"],
    load: async (a) => { const r = await page("teaching_plan_versions", "id, plan_id, version, school_id, class_id, title, status, covers_from, covers_until", "covers_from", a);
      return { rows: r.rows.map((x) => ({ _k: v(x["plan_id"]), _v: v(x["version"]), school: v(x["school_id"]), class: v(x["class_id"]), title: v(x["title"]), status: v(x["status"]), from: v(x["covers_from"]), until: v(x["covers_until"]) })), total: r.total }; },
    finalize: (rows) => headsBy(rows as Raw[], "_k", "_v") as Record<string, CellValue>[] },
];

// NCIECE.FINAL.2 — Mapa Estatístico e Censo oficial no gerador. Leitura com a sessão (RLS por escola);
// Mapa: só versões gravadas (oficializadas/retificadas), uma linha por célula da versão vigente.
const MAP_DEF: ReportDefinition = {
  id: "gerador-mapa", version: 1, title: "Mapa Estatístico", description: "Células da versão vigente de cada Mapa oficializado, por estrutura I–VI, com calculado × ajustado.",
  source: "statistical_maps + statistical_map_versions (cabeça por Mapa) + statistical_map_events + statistical_map_cell_adjustments", params: [],
  columns: [C("school", "Escola"), C("competence", "Competência"), C("structure", "Estrutura"), C("cell", "Item"), C("calculated", "Calculado"), C("value", "Valor efetivo"), C("adjusted", "Ajustado"), C("state", "Estado da célula"), C("status", "Situação do Mapa"), C("version", "Versão", "number")],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 50000,
};
export function mapRows(maps: Raw[], versions: Raw[], events: Raw[]): Record<string, CellValue>[] {
  const head = headsBy(versions, "map_id", "version");
  const byMap = new Map(maps.map((m) => [String(m["id"]), m]));
  const lastEvent = new Map<string, string>();
  for (const e of [...events].sort((a, b) => String(a["recorded_at"]).localeCompare(String(b["recorded_at"])))) lastEvent.set(String(e["map_id"]), String(e["kind"]));
  return head.flatMap((ver) => {
    const m = byMap.get(String(ver["map_id"])); if (!m) return [];
    const cells = (((ver["snapshot"] ?? {}) as { cells?: Record<string, unknown>[] }).cells ?? []);
    return cells.map((c) => {
      const adj = c["adjustment"] as { calculatedValue?: unknown; adjustedValue?: unknown } | undefined;
      return {
        school: v(m["school_id"]), competence: `${m["competence_year"]}-${String(m["competence_month"]).padStart(2, "0")}`,
        structure: structureOf({ cellId: String(c["cellId"]), sectionId: String(c["sectionId"] ?? "") }), cell: v(c["label"]),
        calculated: v(adj ? adj.calculatedValue : c["value"]), value: v(c["value"]), adjusted: adj ? "sim" : "não", state: v(c["state"]),
        status: v(ver["correction_reason"] ? "retificado" : lastEvent.get(String(ver["map_id"])) ?? "oficializado"), version: v(ver["version"]),
      };
    });
  });
}
const CENSUS_DEF: ReportDefinition = {
  id: "gerador-censo", version: 1, title: "Censo oficial × base operacional", description: "Por escola e medida: recibo Educacenso importado, base operacional, diferença, cobertura e classificação.",
  source: "census_official_reconciliation (recibos census_official_receipt_snapshots × turmas/matrículas/enturmações)", params: [],
  columns: [C("school", "Escola"), C("inep", "INEP"), C("measure", "Medida"), C("official", "Censo oficial", "number"), C("operational", "Base operacional", "number"), C("diff", "Diferença", "number"), C("coverage", "Cobertura (%)", "number"), C("divergence", "Classificação"), C("issued", "Emissão do recibo", "date")],
  formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 5000,
};
const CIECE_SOURCES: BuilderSource[] = [
  { id: "gerador-mapa", title: "Mapa Estatístico", sectors: ["ciece", "supervisao", "secretaria"], definition: MAP_DEF,
    methodology: "Uma linha por célula da versão vigente de cada Mapa gravado. Remanejados é grupo próprio da Estrutura IV e não altera o total. \"Calculado\" é o valor do servidor; \"Valor efetivo\" difere só quando há ajuste auditável. Mapa em rascunho não entra.",
    acl: "RLS do Mapa por capability de escola com a sessão de quem gera.", period: false, pageSize: 1000, filterable: ["school", "competence", "structure", "status", "adjusted", "state"],
    load: async ({ offset, limit }) => {
      if (offset > 0) return { rows: [], total: null };
      const [m, ver, ev] = await Promise.all([
        tdb.from("statistical_maps").select("id, school_id, competence_year, competence_month").range(0, 999),
        tdb.from("statistical_map_versions").select("map_id, version, snapshot, correction_reason").range(0, 999),
        tdb.from("statistical_map_events").select("map_id, kind, recorded_at").range(0, 999),
      ]);
      if (m.error || ver.error || ev.error) fail();
      if ([m, ver, ev].some((r) => (r.data ?? []).length >= 1000)) throw new Error("Há mais Mapas do que esta leitura comporta; filtre pela tela do Mapa.");
      const rows = mapRows(m.data ?? [], ver.data ?? [], ev.data ?? []);
      return { rows: rows.slice(0, limit), total: rows.length };
    } },
  { id: "gerador-censo", title: "CIECE — Censo oficial × base operacional", sectors: ["ciece", "supervisao"], definition: CENSUS_DEF,
    methodology: "Matrículas = vínculos aluno × turma (semântica do recibo Educacenso); alunos = pessoas com matrícula; turmas = turmas registradas. Base não legível ou ausente fica \"não disponível\", nunca zero.",
    acl: "Recibos e bases com a RLS de quem gera.", period: false, pageSize: 5000, filterable: ["school", "measure", "divergence"],
    load: async ({ offset }) => {
      if (offset > 0) return { rows: [], total: null };
      const r = await (supabase.rpc as unknown as (f: string, p: object) => Promise<{ data: Raw[] | null; error: unknown }>)("census_official_reconciliation", { _known_at: new Date().toISOString() });
      if (r.error) fail();
      const rows = (r.data ?? []).map((x) => { const o = x["official_value"] == null ? null : Number(x["official_value"]); const b = x["operational_value"] == null ? null : Number(x["operational_value"]);
        return { school: v(x["school_id"]), inep: v(x["inep"]), measure: v(MEASURE_LABEL[String(x["measure"])] ?? "Medida não reconhecida"), official: o, operational: b, diff: difference(o, b), coverage: censusCoverage(o, b), divergence: DIVERGENCE_LABEL[classify(o, b)], issued: v(String(x["issued_at"] ?? "").slice(0, 10)) }; });
      return { rows, total: rows.length };
    }, schoolIdColumn: "school" },
];
const PANORAMA_DEF: ReportDefinition = {
  id: "gerador-panorama-escolas", version: 1, title: "Panorama 2026 por escola", description: "Escola × turmas × matrículas × alunos distintos × registros de pessoal, conferido com o Censo.",
  source: "census_official_reconciliation (base operacional) + institutional_school_record_versions + staff_administrative_records", params: [],
  columns: [C("school", "Escola"), C("inep", "INEP"), C("classes", "Turmas", "number"), C("enrollments", "Matrículas (vínculos aluno × turma)", "number"), C("students", "Alunos distintos", "number"), C("enrollments_per_class", "Matrículas por turma", "number"), C("staff_records", "Registros de pessoal (planilha ago–set)", "number"), C("census_match", "Confere com o Censo")],
  formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 5000,
};
const STAFF_DEF: ReportDefinition = {
  id: "gerador-pessoal", version: 1, title: "Pessoal por escola e setor", description: "Registros administrativos das planilhas de pessoal 2026 (escolas ago–set e SEMED por setor).",
  source: "staff_administrative_records", params: [],
  columns: [C("place", "Escola / setor"), C("cargo", "Cargo"), C("funcao", "Função"), C("vinculo", "Vínculo"), C("grupo", "Grupo da planilha"), C("situacao", "Situação"), { id: "name", label: "Nome", kind: "text", sensitive: true }, C("source", "Fonte"), C("reference", "Referência")],
  formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 5000,
};
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; ; off += 1000) { const r = await page(off, off + 999); if (r.error) fail(); out.push(...(r.data ?? [])); if ((r.data ?? []).length < 1000) return out; }
}
const CROSS_SOURCES: BuilderSource[] = [
  { id: "gerador-panorama-escolas", title: "Panorama 2026 por escola", sectors: ["secretaria", "ciece", "supervisao", "op-direcao", "admin"], definition: PANORAMA_DEF,
    methodology: "Unidades: turmas registradas; matrículas = vínculos aluno × turma (um aluno em duas turmas conta duas); alunos = pessoas distintas. Base operacional do dia da geração, conferida com o recibo Educacenso 2026. Pessoal = linhas das planilhas de pessoal, que não são atuação no SIGEM. Total só quando todas as escolas têm o dado.",
    acl: "Cada parte é lida com a RLS de quem gera; o que a conta não pode ler sai \"não disponível\".", period: false, pageSize: 5000, filterable: ["school", "census_match"],
    load: async ({ offset }) => {
      if (offset > 0) return { rows: [], total: null };
      const rec = await (supabase.rpc as unknown as (f: string, p: object) => Promise<{ data: ReconRow[] | null; error: unknown }>)("census_official_reconciliation", { _known_at: new Date().toISOString() });
      if (rec.error) fail();
      const sv = await readAll<{ school_id: string; official_name: string | null; version_number: number }>((a, b) => supabase.from("institutional_school_record_versions").select("school_id, official_name, version_number").order("school_id").order("version_number", { ascending: false }).range(a, b));
      const names = new Map<string, string>(); for (const x of sv) if (!names.has(x.school_id) && x.official_name) names.set(x.school_id, x.official_name);
      let staff: Map<string, number> | null = null;
      try {
        const st = await readAll<{ school_id: string | null }>((a, b) => tdb.from("staff_administrative_records").select("school_id").not("school_id", "is", null).order("id").range(a, b));
        staff = new Map(); for (const x of st) if (x.school_id) staff.set(x.school_id, (staff.get(x.school_id) ?? 0) + 1);
      } catch { staff = null; }
      const rows = panoramaRows(rec.data ?? [], names, staff).map((r) => ({ ...r }));
      return { rows, total: rows.length };
    } },
  { id: "gerador-pessoal", title: "Pessoal por escola e setor", sectors: ["dp", "supervisao", "op-direcao", "admin"], definition: STAFF_DEF,
    methodology: "Uma linha por pessoa listada nas planilhas de pessoal 2026, com a aba de origem (em atuação, afastados, a conferir). Registro administrativo: não concede acesso nem prova atuação. O nome é dado pessoal e só sai se você incluir a coluna.",
    acl: "RLS do quadro de pessoal: rede ou a própria escola, com a sessão de quem gera.", period: false, pageSize: 1000, filterable: ["place", "cargo", "funcao", "vinculo", "situacao", "grupo"],
    load: async ({ offset, limit }) => {
      const r = await tdb.from("staff_administrative_records").select("school_name_source, sector, cargo, funcao, vinculo, grupo, situacao, full_name, source_file, reference_period", { count: "exact" }).order("id").range(offset, offset + limit - 1);
      if (r.error) fail();
      return { rows: ((r.data ?? []) as Raw[]).map((x) => ({ place: v(x["school_name_source"] ?? x["sector"]), cargo: v(x["cargo"]), funcao: v(x["funcao"]), vinculo: v(x["vinculo"]), grupo: v(x["grupo"]), situacao: v(x["situacao"]), name: v(x["full_name"]), source: v(x["source_file"]), reference: v(x["reference_period"]) })), total: r.count ?? null };
    } },
  ...LOTE11_SOURCES(),
];
function LOTE11_SOURCES(): BuilderSource[] {
  const names = async () => {
    const sv = await readAll<{ school_id: string; official_name: string | null; version_number: number }>((a, b) => supabase.from("institutional_school_record_versions").select("school_id, official_name, version_number").order("school_id").order("version_number", { ascending: false }).range(a, b));
    const m = new Map<string, string>(); for (const x of sv) if (!m.has(x.school_id) && x.official_name) m.set(x.school_id, x.official_name); return m;
  };
  const once = (fn: () => Promise<Record<string, CellValue>[]>) => async ({ offset }: { offset: number }) => { if (offset > 0) return { rows: [], total: null }; const rows = await fn(); return { rows, total: rows.length }; };
  return [
    { id: "gerador-turma-contagens", title: "Turmas 2026 — vínculos × estudantes distintos", sectors: ["secretaria", "ciece", "supervisao", "op-direcao", "admin"],
      definition: { id: "gerador-turma-contagens", version: 1, title: "Turmas 2026 — vínculos × estudantes distintos", description: "Por turma: vínculos aluno × turma correntes e estudantes distintos, sem nomes.", source: "class_enrollment_episodes (sem episódio substituído)", params: [],
        columns: [C("school", "Escola"), C("class_label", "Turma"), C("bonds", "Vínculos de turma", "number"), C("students", "Estudantes distintos", "number")], formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 5000 },
      methodology: "Vínculo = episódio de turma corrente (correção substitui o anterior). Estudante distinto conta uma vez por turma; não some estudantes de turmas diferentes como total da rede.",
      acl: "RLS de episódios com a sessão de quem gera (escola vê só as próprias turmas).", period: false, pageSize: 5000, filterable: ["school", "class_label"],
      load: once(async () => { const [n, eps] = await Promise.all([names(), readAll<EpisodeRow>((a, b) => supabase.from("class_enrollment_episodes").select("id, supersedes_id, student_id, school_id, class_id, class_label_snapshot").order("id").range(a, b))]); return classCountRows(eps, n); }) },
    { id: "gerador-jornada-alunos", title: "Jornada declarada 2026 por escola", sectors: ["secretaria", "op-direcao", "supervisao", "ciece"],
      definition: { id: "gerador-jornada-alunos", version: 1, title: "Jornada declarada 2026 por escola", description: "Declarações de jornada de estudantes (fonte 2026) e estudantes distintos por escola.", source: "student_school_day_observations", params: [],
        columns: [C("school", "Escola"), C("declarations", "Declarações de jornada", "number"), C("students", "Estudantes distintos", "number")], formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 5000 },
      methodology: "Jornada declarada do estudante na planilha 2026; não é grade oficial da turma nem carga de professor. Escola sem linha na fonte não aparece (nunca zero inventado).",
      acl: "RLS das observações de jornada com a sessão de quem gera.", period: false, pageSize: 5000, filterable: ["school"],
      load: once(async () => { const [n, obs] = await Promise.all([names(), readAll<DayObsRow>((a, b) => supabase.from("student_school_day_observations").select("school_id, student_id").order("id").range(a, b))]); return journeySchoolRows(obs, n); }) },
    { id: "gerador-infraestrutura", title: "Infraestrutura das escolas 2026", sectors: ["supervisao", "ciece", "op-direcao", "admin"],
      definition: { id: "gerador-infraestrutura", version: 1, title: "Infraestrutura das escolas 2026", description: "Uma linha por item observado, com fonte e data.", source: "school_infrastructure_observations", params: [],
        columns: [C("school", "Escola"), C("item", "Item"), C("value", "Valor"), C("valid_from", "Desde"), C("source", "Fonte")], formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 5000 },
      methodology: "Item sem dado sai \"não disponível\", nunca \"não\". Carga técnica do Censo 2026.",
      acl: "Leitura autenticada (dado institucional, sem dado pessoal).", period: false, pageSize: 5000, filterable: ["school", "item", "value"],
      load: once(async () => {
        const [n, obs] = await Promise.all([names(), readAll<Raw>((a, b) => supabase.from("school_infrastructure_observations").select("school_id, attribute_id, value_boolean, value_integer, value_decimal, value_text, value_catalog, valid_from, source_ref").order("id").range(a, b) as never)]);
        return obs.map((o) => ({ school: v(n.get(String(o["school_id"])) ?? "Escola sem nome cadastrado"), item: v(o["attribute_id"]), value: v(infraValue(o as never)), valid_from: v(o["valid_from"]), source: v(o["source_ref"]) }));
      }) },
  ];
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
  ...CROSS_SOURCES,
  pending("gerador-alunos", "Alunos (nominal)", ["secretaria"], "Dado nominal de estudante: leitura transversal exige reader com supressão por campo ainda não registrado."),
  pending("gerador-movimentacoes", "Movimentações", ["secretaria"], "Depende de enturmação 2026 (ENROLLMENT_EPISODES_2026_PENDING) e de reader de movimentações."),
  pending("gerador-jornadas", "Jornadas e horários", ["op-direcao"], "Sem fonte de jornada profissional (PROFESSIONAL_SCHEDULE_SOURCE_ABSENT)."),
  ...DIARY_SOURCES,
  ...CIECE_SOURCES,
  pending("gerador-inclusao", "Inclusão / AEE / Mediador", ["op-direcao"], "Dado sensível: sem reader com política de supressão aprovada."),
  pending("gerador-auditoria", "Auditoria", ["admin"], "Exige capability exportar-auditoria (não atribuída)."),
];

export const sourceById = (id: string) => BUILDER_SOURCES.find((s) => s.id === id) ?? null;

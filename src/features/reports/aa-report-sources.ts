/**
 * A&A Lote 8 — assuntos do setor Avaliação no gerador universal (leitura com a sessão; RLS decide).
 * Só entram assuntos com fonte canônica já gravada; os demais ficam catalogados com o motivo por extenso.
 * Nenhum assunto expõe nome de estudante; Educação Infantil nunca recebe coluna de promoção/retenção.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CellValue, ColumnDef, ReportDefinition } from "./report-engine";
import type { BuilderSource, LoadCtx, Page } from "./report-builder";

const C = (id: string, label: string, kind: ColumnDef["kind"] = "text"): ColumnDef => ({ id, label, kind });
const v = (x: unknown): CellValue => (x === null || x === undefined || x === "" ? null : typeof x === "number" ? x : typeof x === "boolean" ? (x ? "sim" : "não") : String(x));
const fail = (): never => { throw new Error("Não foi possível ler os dados com o seu acesso."); };
const def = (id: string, title: string, description: string, source: string, columns: ColumnDef[]): ReportDefinition =>
  ({ id, version: 1, title, description, source, params: [], columns, formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 5000 });
type Raw = Record<string, unknown>;
export const headsBy = (rows: readonly Record<string, CellValue>[], k: string, ver: string) => {
  const m = new Map<string, Record<string, CellValue>>();
  for (const r of rows) { const key = String(r[k]); const c = m.get(key); if (!c || Number(c[ver]) < Number(r[ver])) m.set(key, r); }
  return [...m.values()];
};
async function page(table: string, cols: string, order: string, a: LoadCtx, dateCol?: string) {
  let q = (supabase.from as unknown as (t: string) => any)(table).select(cols, { count: "exact" }).order(order).range(a.offset, a.offset + a.limit - 1); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (dateCol && a.from) q = q.gte(dateCol, a.from);
  if (dateCol && a.to) q = q.lte(dateCol, a.to);
  const r = await q; if (r.error) fail();
  return { rows: (r.data ?? []) as Raw[], total: (r.count as number | null) ?? null };
}
const ACL = "RLS do setor: intervenção por capability de escola/rede; calendário por conta autenticada; importação só com importar-resultados-avaliacao.";
const pending = (id: string, title: string, reason: string): BuilderSource => ({
  id, title, sectors: ["avaliacao"], methodology: "—", acl: "—", period: false, pageSize: 1, filterable: [], unavailable: reason,
  definition: { id, version: 1, title, description: reason, source: "—", params: [], columns: [], formats: [], reproducible: false, syncRowLimit: 0 },
});

export const AA_SOURCES: readonly BuilderSource[] = [
  { id: "aa-intervencoes", title: "A&A — planos de intervenção", sectors: ["avaliacao", "op-direcao", "supervisao"],
    definition: def("aa-intervencoes", "Planos de intervenção", "Versão vigente de cada plano visível à conta.", "aa_intervention_versions (cabeça por plano)",
      [C("school", "Escola"), C("class", "Turma"), C("segment", "Etapa"), C("infant", "Educação Infantil"), C("origin", "Origem"), C("objective", "Objetivo"), C("responsible", "Responsável (função)"), C("due", "Prazo", "date"), C("version", "Versão", "number")]),
    methodology: "Uma linha por plano (versão mais recente). Plano não decide promoção nem retenção.", acl: ACL, period: true, pageSize: 1000,
    filterable: ["school", "segment", "origin", "infant"], schoolIdColumn: "school",
    load: async (a) => { const r = await page("aa_intervention_versions", "logical_id, version, school_id, class_id, segment, is_infant, origin_kind, objective, responsible_label, due_date", "recorded_at", a, "due_date");
      return { rows: r.rows.map((x) => ({ _k: v(x["logical_id"]), version: v(x["version"]), school: v(x["school_id"]), class: v(x["class_id"]), segment: v(x["segment"]), infant: v(x["is_infant"]), origin: v(x["origin_kind"]), objective: v(x["objective"]), responsible: v(x["responsible_label"]), due: v(x["due_date"]) })), total: r.total }; },
    finalize: (rows) => headsBy(rows, "_k", "version") },
  { id: "aa-devolutivas", title: "A&A — ações, devolutivas e reavaliações", sectors: ["avaliacao", "op-direcao", "supervisao"],
    definition: def("aa-devolutivas", "Histórico das intervenções", "Eventos append-only dos planos (ação, evidência, devolutiva, progresso, reavaliação, encerramento).", "aa_intervention_events",
      [C("school", "Escola"), C("kind", "Registro"), C("progress", "Progresso"), C("responsible", "Responsável (função)"), C("due", "Prazo", "date"), C("date", "Data", "date"), C("body", "Descrição")]),
    methodology: "Uma linha por registro; nada é editado depois de gravado.", acl: ACL, period: true, pageSize: 1000, filterable: ["school", "kind", "progress"], schoolIdColumn: "school",
    load: async (a) => { const r = await page("aa_intervention_events", "school_id, kind, progress, responsible_label, due_date, recorded_at, body", "recorded_at", a, "recorded_at");
      return { rows: r.rows.map((x) => ({ school: v(x["school_id"]), kind: v(x["kind"]), progress: v(x["progress"]), responsible: v(x["responsible_label"]), due: v(x["due_date"]), date: v(String(x["recorded_at"] ?? "").slice(0, 10)), body: v(x["body"]) })), total: r.total }; } },
  { id: "aa-calendario", title: "A&A — calendário operacional (cobertura de aplicações)", sectors: ["avaliacao", "op-direcao", "supervisao"],
    definition: def("aa-calendario", "Calendário operacional de avaliações", "Versão vigente de cada ação do calendário da edição.", "aa_calendar_items (cabeça por ação)",
      [C("year", "Edição", "number"), C("start", "Início", "date"), C("end", "Fim", "date"), C("segment", "Segmento"), C("kind", "Tipo"), C("program", "Programa"), C("action", "Ação"), C("event", "Situação da versão"), C("version", "Versão", "number")]),
    methodology: "Datas valem só para a edição registrada; nunca são repetidas para outro ano.", acl: ACL, period: true, pageSize: 1000, filterable: ["year", "segment", "kind", "program", "event"],
    load: async (a) => { const r = await page("aa_calendar_items", "logical_id, version, edition_year, start_date, end_date, segment, kind, program_key, action, event_kind", "start_date", a, "start_date");
      return { rows: r.rows.map((x) => ({ _k: v(x["logical_id"]), version: v(x["version"]), year: v(x["edition_year"]), start: v(x["start_date"]), end: v(x["end_date"]), segment: v(x["segment"]), kind: v(x["kind"]), program: v(x["program_key"]), action: v(x["action"]), event: v(x["event_kind"]) })), total: r.total }; },
    finalize: (rows) => headsBy(rows, "_k", "version") },
  { id: "aa-importacao", title: "A&A — cobertura das importações", sectors: ["avaliacao"],
    definition: def("aa-importacao", "Cobertura das importações de resultados", "Contagem de linhas por lote e situação de identificação (sem nome de estudante).", "aa_import_batches + aa_import_rows",
      [C("file", "Arquivo"), C("sheet", "Aba"), C("program", "Programa"), C("year", "Edição", "number"), C("measure", "Medida"), C("school", "Escola (rótulo da planilha)"), C("state", "Identificação"), C("rows", "Linhas", "number")]),
    methodology: "Contagem por lote e situação; acertos locais e proficiência TRI são medidas distintas. Sem política de divulgação registrada, nenhuma contagem é suprimida nem alterada.", acl: ACL, period: false, pageSize: 1000,
    filterable: ["program", "year", "measure", "state"],
    load: async (a) => {
      const b = await page("aa_import_batches", "id, file_name, sheet, program_key, edition_year, measure_kind, school_label", "recorded_at", a);
      const ids = b.rows.map((x) => String(x["id"]));
      const r = ids.length ? await supabase.from("aa_import_rows").select("batch_id, match_state").in("batch_id", ids).limit(10000) : { data: [], error: null };
      if (r.error) fail();
      const cnt = new Map<string, number>();
      for (const x of (r.data ?? []) as Raw[]) { const k = `${x["batch_id"]}|${x["match_state"]}`; cnt.set(k, (cnt.get(k) ?? 0) + 1); }
      const rows = b.rows.flatMap((x) => [...cnt.entries()].filter(([k]) => k.startsWith(`${x["id"]}|`)).map(([k, n]) => ({
        file: v(x["file_name"]), sheet: v(x["sheet"]), program: v(x["program_key"]), year: v(x["edition_year"]), measure: v(x["measure_kind"]), school: v(x["school_label"]), state: k.split("|")[1] ?? null, rows: n })));
      return { rows, total: b.total === null ? null : rows.length };
    } },
  pending("aa-sintese-municipal", "A&A — síntese municipal de resultados", "Sem resultados avaliativos confirmados no registro oficial; a síntese sai quando houver resultados e política de divulgação registrada (planos e calendário já têm assunto próprio)."),
  pending("aa-boletim", "A&A — boletim da escola/turma", "Depende de resultados oficiais por escola/turma (importação confirmada ainda não vira resultado sem registro humano)."),
  pending("aa-habilidades", "A&A — avaliação por habilidade", "Depende de matrizes com fonte carregada e questões ligadas a habilidades (Lote 2: famílias ainda aguardando fonte)."),
  pending("aa-ideb", "A&A — séries SAEB/IDEB", "Série histórica 2007–2025 ainda não carregada como dado oficial com fonte."),
  pending("aa-saber-ler", "A&A — Saber Ler", "Sem resultados do Saber Ler registrados; as listas de presença enviadas não são resultados."),
  pending("aa-diagnosticas", "A&A — diagnósticas e formativas", "Sem resultados registrados das diagnósticas/formativas."),
  pending("aa-producao-textual", "A&A — produção textual", "Rubricas sem fonte homologada; sem resultados registrados."),
  pending("aa-educacao-infantil", "A&A — Educação Infantil", "Relatório só agregado e com política de supressão registrada; sem política, não é emitido. Nunca traz promoção/retenção."),
  pending("aa-infrequencia", "A&A — infrequência (<75%)", "Frequência do Diário ainda não ligada às horas previstas da grade/calendário (Lote 3)."),
  pending("aa-busca-ativa", "A&A — busca ativa", "Fluxo de busca ativa ainda não é gravado no banco (Lote 3)."),
];

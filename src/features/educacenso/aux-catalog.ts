/**
 * Tabelas auxiliares do Censo Escolar (fonte documental do usuário, versionada por ano).
 * Validações cruzadas puras: tabela de um ano nunca é aplicada a outro; ausência da tabela
 * do ano devolve "sem-tabela-do-ano", nunca "permitido". Não é homologação de leiaute.
 */
import type { Classified } from "./export-builder";

export type AuxRule = { reference_year: string; rule_kind: string; left_key: string; right_key: string | null; attrs: Record<string, string> };
export type AuxCode = { reference_year: string; table_key: string; code: string; label: string | null; parent_code: string | null };
export type CheckResult = "permitido" | "nao-previsto" | "nao-habilitado" | "nao-pertence" | "existe" | "inexistente" | "sem-tabela-do-ano";

const k = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function resourceAllowed(rules: readonly AuxRule[], year: string, kind: "deficiencia-recurso" | "transtorno-recurso", need: string, resource: string): CheckResult {
  const ofYear = rules.filter((r) => r.rule_kind === kind && r.reference_year === year);
  if (ofYear.length === 0) return "sem-tabela-do-ano";
  return ofYear.some((r) => k(r.left_key) === k(need) && k(r.right_key) === k(resource)) ? "permitido" : "nao-previsto";
}

export function stageAllowed(rules: readonly AuxRule[], year: string, mediation: string, classType: string, stage: string): CheckResult {
  const ofYear = rules.filter((r) => r.rule_kind === "etapa-tipo-turma" && r.reference_year === year);
  if (ofYear.length === 0) return "sem-tabela-do-ano";
  return ofYear.some((r) => k(r.attrs["mediacao"]) === k(mediation) && k(r.attrs["tipo_turma"]) === k(classType) && r.right_key === stage.trim()) ? "permitido" : "nao-habilitado";
}

export function codeExists(codes: readonly AuxCode[], year: string, table: string, code: string, parent?: string): CheckResult {
  const t = codes.filter((c) => c.table_key === table && c.reference_year === year);
  if (t.length === 0) return "sem-tabela-do-ano";
  const hit = t.filter((c) => c.code === code);
  if (parent === undefined) return hit.length ? "existe" : "inexistente";
  return hit.some((c) => c.parent_code === parent) ? "permitido" : "nao-pertence";
}

/** Integração com o arquivo de conferência: confere município (8), distrito (9) e órgão regional (18) do Registro 00. */
export function record00AuxIssues(lines: { record: string; values: string[] }[], codes: readonly AuxCode[], year: string): Classified[] {
  const out: Classified[] = [];
  lines.forEach((l, i) => {
    if (l.record !== "00") return;
    const mun = l.values[7] ?? "", dis = l.values[8] ?? "", org = l.values[17] ?? "";
    const push = (field: number, code: string, text: string, impeditive: boolean) => out.push({ severity: impeditive ? "erro" : "aviso", line: i + 1, record: "00", field, code, text, impeditive });
    if (mun) { const r = codeExists(codes, year, "municipios", mun); if (r === "inexistente") push(8, "municipio-inexistente", `Município ${mun} não consta da Tabela de Municípios ${year}`, true); if (r === "sem-tabela-do-ano") push(8, "tabela-ausente", `Sem Tabela de Municípios ${year}`, false); }
    if (dis && mun) {
      // O Registro 00 usa o código de 2 dígitos ("Código para ser usado na importação"); o código completo é município+distrito.
      const r = codeExists(codes, year, "distritos", mun + dis, mun);
      if (r === "nao-pertence" || r === "inexistente") push(9, "distrito-fora-do-municipio", `Distrito ${dis} não pertence ao município ${mun} na tabela ${year}`, true);
    }
    if (org && mun) { const r = codeExists(codes, year, "orgaos_regionais", org, mun); if (r === "nao-pertence" || r === "inexistente") push(18, "orgao-fora-do-municipio", `Órgão regional ${org} não atende o município ${mun} na tabela ${year}`, true); }
  });
  return out;
}

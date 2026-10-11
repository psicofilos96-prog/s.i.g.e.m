/**
 * TSEMED.10 — Tabela 10 (escolarização do servidor): regras puras.
 * Quadro = TODOS os servidores do cadastro central da escola (sem limite de linhas); identidade, cargo e função
 * nunca são digitados. Formação = ledger append-only por servidor; a versão vigente de cada formação é a última
 * não retirada. Nada aqui cria pessoa.
 */
import type { Block } from "./semed-export";

export type T10Level = "fundamental" | "medio" | "superior" | "pos";
export const T10_KINDS: Record<T10Level, Record<string, string>> = {
  fundamental: { completo: "Fund. Completo", incompleto: "Fund. Incompleto" },
  medio: { "formacao-geral": "Formação Geral", "normal-magisterio": "Normal/Magistério", tecnico: "Curso Técnico" },
  superior: { licenciatura: "Licenciatura em", bacharelado: "Bacharelado em", tecnologico: "Tecnológico em" },
  pos: { especializacao: "Especialização em", mestrado: "Mestrado em", doutorado: "Doutorado em" },
};
export const T10_LEVEL_LABEL: Record<T10Level, string> = { fundamental: "Fundamental", medio: "Médio", superior: "Superior", pos: "Pós-graduação" };
export const T10_DIVERGENCE: Record<string, string> = {
  "linhas-repetidas": "aparece em mais de uma linha do cadastro (tratado como uma pessoa)",
  "sem-matricula": "sem matrícula funcional no cadastro",
  "cargos-diferentes": "cargos diferentes entre as linhas do cadastro",
  "sem-cargo": "sem cargo no cadastro",
  "sem-pessoa-conciliada": "não conciliado com pessoa do cadastro de pessoas",
  "homonimo-na-escola": "outro servidor da escola com o mesmo nome",
};
export function divergenceText(d: string): string {
  const [k, n] = d.split(":");
  return (T10_DIVERGENCE[k!] ?? k!) + (n ? ` (${n} linhas)` : "");
}

export type T10Staff = { staff_key: string; staff_record_id: string; nome: string; matricula: string | null; cargo: string; funcao: string; vinculo: string; situacao: string; periodos: string | null; divergencias: string[] };
export type T10Version = { id: string; formation_id: string; version: number; staff_key: string; level: T10Level; kind: string; course: string | null; institution: string | null; conclusion_year: number | null; withdrawn: boolean; reason: string | null; evidence_path: string | null; evidence_name: string | null; recorded_at: string };
export type T10Formation = T10Version & { evidence: { path: string; name: string | null } | null; history: T10Version[] };

/** Formações vigentes por servidor: última versão de cada cadeia, retiradas fora; comprovante = o mais recente da cadeia. */
export function currentFormations(versions: readonly T10Version[]): Map<string, T10Formation[]> {
  const chains = new Map<string, T10Version[]>();
  for (const v of versions) chains.set(v.formation_id, [...(chains.get(v.formation_id) ?? []), v]);
  const out = new Map<string, T10Formation[]>();
  for (const ch of chains.values()) {
    ch.sort((a, b) => a.version - b.version);
    const last = ch[ch.length - 1]!;
    if (last.withdrawn) continue;
    const ev = [...ch].reverse().find((x) => x.evidence_path);
    const f: T10Formation = { ...last, evidence: ev ? { path: ev.evidence_path!, name: ev.evidence_name } : null, history: ch };
    out.set(last.staff_key, [...(out.get(last.staff_key) ?? []), f]);
  }
  const order: T10Level[] = ["fundamental", "medio", "superior", "pos"];
  for (const l of out.values()) l.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
  return out;
}

export function formationText(f: Pick<T10Version, "level" | "kind" | "course">): string {
  const k = T10_KINDS[f.level][f.kind] ?? f.kind;
  return f.course ? `${k} ${f.course}`.replace(/ em (.+)$/, " em $1") : k;
}

/** Colunas do guia: uma linha por servidor; várias formações do mesmo nível saem juntas na célula. */
export function t10Blocks(staff: readonly T10Staff[], formations: Map<string, T10Formation[]>): Block[] {
  const cell = (k: string, l: T10Level) => (formations.get(k) ?? []).filter((f) => f.level === l).map(formationText).join("; ") || "—";
  const body = staff.map((s, i) => [i + 1, s.nome, s.cargo || "—", s.funcao || "—", cell(s.staff_key, "fundamental"), cell(s.staff_key, "medio"), cell(s.staff_key, "superior"), cell(s.staff_key, "pos")]);
  const out: Block[] = [{ title: `SERVIDORES DA UNIDADE (${staff.length} no cadastro central)`, head: ["Nº", "Nome do servidor", "Cargo", "Função", "Fundamental", "Médio", "Superior", "Pós-graduação"], body }];
  const sem = staff.filter((s) => !(formations.get(s.staff_key) ?? []).length).length;
  const div = staff.filter((s) => s.divergencias.length);
  out.push({ title: "SITUAÇÃO DO PREENCHIMENTO", head: ["Item", "Quantidade"], body: [["Servidores no cadastro central", staff.length], ["Sem formação informada", sem], ["Com divergência no cadastro", div.length]] });
  if (div.length) out.push({ title: "DIVERGÊNCIAS DO CADASTRO (corrigir na origem, não nesta tabela)", head: ["Servidor", "Divergência"], body: div.map((s) => [s.nome, s.divergencias.map(divergenceText).join("; ")]) });
  return out;
}

export function formationProblem(level: T10Level, kind: string, course: string): string | null {
  if (!T10_KINDS[level]?.[kind]) return "Tipo de formação inválido para o nível.";
  if ((level === "superior" || level === "pos") && course.trim().length < 3) return "Informe o curso ou a área.";
  return null;
}

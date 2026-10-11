/**
 * CIECE Lote 06 — auditor de qualidade (regras versionadas, puras). Complementa
 * data-quality/integrity-catalog.ts (que segue dono de unicidade/chave/divergência por nome) e nunca corrige:
 * cada achado tem fundamento, evidência e writer que corrige. Fonte não lida ⇒ "nao-aplicavel", nunca achado.
 */
import { validCode } from "@/features/territory/territory-catalog";

export type Dimension = "completude" | "unicidade" | "validade" | "consistencia" | "integridade-referencial" | "temporalidade" | "rastreabilidade";
export type Grade = "erro-confirmado" | "provavel" | "alerta" | "pendencia" | "nao-aplicavel";
export type Rule = { id: string; version: number; dimension: Dimension; basis: string; fix: string };
export type Finding = { ruleId: string; version: number; grade: Grade; subject: string; evidence: string; fix: string };

export const RULES: readonly Rule[] = [
  { id: "inep-invalido", version: 1, dimension: "validade", basis: "INEP tem 8 dígitos", fix: "ficha da unidade (register_school_record_version)" },
  { id: "ibge-invalido", version: 1, dimension: "validade", basis: "código IBGE de município tem 7 dígitos e existe no DTB do ano", fix: "ficha da unidade" },
  { id: "inep-duplicado", version: 1, dimension: "unicidade", basis: "um INEP identifica uma escola", fix: "ficha da unidade" },
  { id: "distrito-ausente", version: 1, dimension: "completude", basis: "território exige distrito para panorama territorial", fix: "ficha da unidade" },
  { id: "matricula-sem-inicio", version: 1, dimension: "temporalidade", basis: "vigência sem início não pode ser contada na data", fix: "Secretaria (correção da matrícula)" },
  { id: "matricula-multiescola", version: 1, dimension: "consistencia", basis: "duas matrículas na mesma rede/ano exigem transferência explícita", fix: "Secretaria (movimentação)" },
  { id: "sem-enturmacao", version: 1, dimension: "integridade-referencial", basis: "matrícula vigente sem alocação vigente", fix: "Secretaria (enturmação)" },
  { id: "turma-incompleta", version: 1, dimension: "completude", basis: "turma sem oferta, turno ou capacidade declarados", fix: "Secretaria (cadastro da turma)" },
  { id: "vinculo-incompleto", version: 1, dimension: "completude", basis: "vínculo funcional sem início ou sem lotação", fix: "DP administrativo" },
  { id: "duplicidade-suspeita", version: 1, dimension: "unicidade", basis: "mesmo nome normalizado e nascimento em cadastros distintos", fix: "revisão humana; nunca fusão automática" },
  { id: "sem-proveniencia", version: 1, dimension: "rastreabilidade", basis: "fato sem autor ou ato originador", fix: "setor dono" },
];

export type AuditInput = {
  schools?: { id: string; inep: string | null; ibge: string | null; district: string | null }[];
  ibgeKnown?: (code: string) => boolean;
  enrollments?: { id: string; studentId: string; schoolId: string; yearId: string; openedOn: string | null; hasAllocation: boolean | null; author: string | null }[];
  classes?: { id: string; offering: string | null; shift: string | null; capacity: number | null }[];
  links?: { id: string; from: string | null; posted: boolean | null }[];
  people?: { id: string; normName: string; birth: string | null }[];
};

const r = (id: string) => RULES.find((x) => x.id === id)!;
const f = (id: string, grade: Grade, subject: string, evidence: string): Finding => ({ ruleId: id, version: r(id).version, grade, subject, evidence, fix: r(id).fix });

export function audit(i: AuditInput): Finding[] {
  const out: Finding[] = [];
  const na = (ids: string[]) => ids.forEach((id) => out.push(f(id, "nao-aplicavel", "*", "fonte não lida")));
  if (!i.schools) na(["inep-invalido", "ibge-invalido", "inep-duplicado", "distrito-ausente"]);
  else {
    const byInep = new Map<string, string[]>();
    for (const s of i.schools) {
      if (s.inep == null) out.push(f("inep-invalido", "pendencia", s.id, "INEP não informado"));
      else if (!/^\d{8}$/.test(s.inep)) out.push(f("inep-invalido", "erro-confirmado", s.id, `INEP "${s.inep}"`));
      else byInep.set(s.inep, [...(byInep.get(s.inep) ?? []), s.id]);
      if (s.ibge != null) { const c = validCode("municipio", s.ibge); if (!c) out.push(f("ibge-invalido", "erro-confirmado", s.id, `IBGE "${s.ibge}"`)); else if (i.ibgeKnown && !i.ibgeKnown(c)) out.push(f("ibge-invalido", "erro-confirmado", s.id, `IBGE ${c} fora do DTB`)); }
      if (!s.district?.trim()) out.push(f("distrito-ausente", "pendencia", s.id, "distrito em branco"));
    }
    for (const [inep, ids] of byInep) if (ids.length > 1) out.push(f("inep-duplicado", "erro-confirmado", ids.join(","), `INEP ${inep}`));
  }
  if (!i.enrollments) na(["matricula-sem-inicio", "matricula-multiescola", "sem-enturmacao", "sem-proveniencia"]);
  else {
    const g = new Map<string, Set<string>>();
    for (const e of i.enrollments) {
      if (e.openedOn == null) out.push(f("matricula-sem-inicio", "pendencia", e.id, "opened_on nulo"));
      if (e.hasAllocation === false) out.push(f("sem-enturmacao", e.openedOn ? "provavel" : "alerta", e.id, "nenhuma alocação ligada"));
      if (!e.author) out.push(f("sem-proveniencia", "alerta", e.id, "sem autor registrado"));
      const k = `${e.studentId}|${e.yearId}`; g.set(k, (g.get(k) ?? new Set()).add(e.schoolId));
    }
    // sem datas não há como saber se é transferência sequencial: "provável", não erro
    for (const [k, schools] of g) if (schools.size > 1) out.push(f("matricula-multiescola", "provavel", k.split("|")[0]!, `${schools.size} escolas no ano ${k.split("|")[1]}`));
  }
  if (!i.classes) na(["turma-incompleta"]);
  else for (const c of i.classes) { const miss = [c.offering ? null : "oferta", c.shift ? null : "turno", c.capacity != null ? null : "capacidade"].filter(Boolean); if (miss.length) out.push(f("turma-incompleta", "pendencia", c.id, `sem ${miss.join(", ")}`)); }
  if (!i.links) na(["vinculo-incompleto"]);
  else for (const l of i.links) if (l.from == null || l.posted === false) out.push(f("vinculo-incompleto", "pendencia", l.id, [l.from == null ? "sem início" : null, l.posted === false ? "sem lotação" : null].filter(Boolean).join(", ")));
  if (!i.people) na(["duplicidade-suspeita"]);
  else {
    const m = new Map<string, string[]>();
    for (const p of i.people) if (p.birth) { const k = `${p.normName}|${p.birth}`; m.set(k, [...(m.get(k) ?? []), p.id]); }
    for (const ids of m.values()) if (ids.length > 1) out.push(f("duplicidade-suspeita", "alerta", ids.join(","), "nome e nascimento iguais — só candidata"));
  }
  return out;
}

export function summary(fs: Finding[]) {
  const s: Record<string, Partial<Record<Grade, number>>> = {};
  for (const x of fs) { s[x.ruleId] ??= {}; s[x.ruleId]![x.grade] = (s[x.ruleId]![x.grade] ?? 0) + 1; }
  return s;
}

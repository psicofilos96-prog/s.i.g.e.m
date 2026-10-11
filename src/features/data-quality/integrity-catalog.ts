/**
 * Lote 01 (Expansão) — catálogo das entidades canônicas e regras de integridade versionadas.
 * Pura: nunca corrige, nunca funde pessoas; só descreve e detecta sobre linhas já lidas pela RLS de quem consulta.
 * Entrada `null` = fonte não lida ⇒ "não verificável", nunca zero.
 */
import type { Evidence } from "./quality-model";

export type CanonicalEntity = Readonly<{ id: string; label: string; key: string; source: string; fix: string }>;

export const CANONICAL_ENTITIES: readonly CanonicalEntity[] = [
  { id: "escola", label: "Escola", key: "Código INEP", source: "Cadastro de unidades", fix: "/escolas" },
  { id: "pessoa", label: "Pessoa", key: "Identificador interno (CPF nunca é chave)", source: "Cadastro de pessoas", fix: "/pessoas" },
  { id: "servidor", label: "Servidor", key: "Pessoa + vínculo funcional", source: "DP / lotações", fix: "/administracao" },
  { id: "aluno", label: "Aluno", key: "Pessoa + identificador escolar", source: "Secretaria", fix: "/alunos" },
  { id: "matricula", label: "Matrícula", key: "Aluno + ciclo + vigência", source: "Secretaria", fix: "/matriculas" },
  { id: "turma", label: "Turma", key: "Escola + ano + identificação", source: "Secretaria", fix: "/turmas" },
  { id: "alocacao", label: "Alocação", key: "Matrícula + turma + vigência", source: "Enturmação", fix: "/enturmacoes" },
  { id: "jornada", label: "Jornada", key: "Turma + versão", source: "Horários", fix: "/horarios" },
  { id: "frequencia", label: "Frequência", key: "Aula + aluno + versão", source: "Diário", fix: "/diario" },
  { id: "nota", label: "Notas", key: "Instrumento + aluno + versão", source: "Pauta", fix: "/diario" },
  { id: "documento", label: "Documentos", key: "Documento + versão de arquivo", source: "DocServ / documentos escolares", fix: "/docserv" },
];

export type IntegrityKind = "unicidade" | "chave" | "temporal" | "obrigatorio" | "completude" | "divergencia";
export type IntegrityRule = Readonly<{ id: string; version: number; entity: string; kind: IntegrityKind; label: string; explain: string }>;

export const INTEGRITY_RULES: readonly IntegrityRule[] = [
  { id: "vigencia-invertida", version: 1, entity: "matricula", kind: "temporal", label: "Vigência com fim antes do início",
    explain: "A data final é anterior à data inicial; corrija no cadastro de origem." },
  { id: "nascimento-impossivel", version: 1, entity: "aluno", kind: "temporal", label: "Data de nascimento impossível",
    explain: "Nascimento posterior à data de referência ou anterior a 1900." },
  { id: "inep-invalido", version: 1, entity: "escola", kind: "chave", label: "Código INEP ausente ou fora do formato",
    explain: "O código INEP da escola deve ter 8 dígitos." },
  { id: "inep-repetido", version: 1, entity: "escola", kind: "unicidade", label: "Mesmo INEP em escolas diferentes",
    explain: "Duas unidades compartilham o código INEP." },
  { id: "pessoa-possivel-duplicata", version: 1, entity: "pessoa", kind: "unicidade", label: "Possível pessoa duplicada",
    explain: "Mesmo nome normalizado e mesma data de nascimento. Nunca é fundido automaticamente: decisão humana na origem." },
  { id: "campo-obrigatorio", version: 1, entity: "aluno", kind: "obrigatorio", label: "Campo obrigatório ausente",
    explain: "Campo exigido pelo cadastro está vazio." },
  { id: "divergencia-entre-fontes", version: 1, entity: "escola", kind: "divergencia", label: "Divergência entre fontes",
    explain: "Contagens diferentes entre fontes (Tabelas SEMED, Educacenso, Diário, DocServ). Nenhuma fonte é sobrescrita." },
];

export type IntegrityFinding = Readonly<{ ruleId: string; ruleVersion: number; entityId: string; evidence: Evidence }>;
export type IntegrityInputs = Readonly<{
  referenceDate: string;
  periods: readonly { id: string; validFrom: string; validUntil: string | null }[] | null;
  people: readonly { id: string; name: string | null; birthDate: string | null }[] | null;
  schools: readonly { id: string; inep: string | null }[] | null;
  required: readonly { id: string; field: string; value: string | null }[] | null;
  sourceCounts: readonly { schoolId: string; measure: string; bySource: Readonly<Record<string, number | null>> }[] | null;
}>;

export const normalizeName = (n: string) =>
  n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function detectIntegrity(i: IntegrityInputs): { findings: IntegrityFinding[]; unverifiable: string[] } {
  const out: IntegrityFinding[] = []; const unv = new Set<string>();
  const add = (ruleId: string, entityId: string, evidence: Evidence) =>
    out.push({ ruleId, ruleVersion: INTEGRITY_RULES.find((r) => r.id === ruleId)!.version, entityId, evidence });

  if (i.periods == null) unv.add("vigencia-invertida");
  else for (const p of i.periods) if (p.validUntil != null && p.validUntil < p.validFrom)
    add("vigencia-invertida", p.id, { inicio: p.validFrom, fim: p.validUntil });

  if (i.people == null) { unv.add("nascimento-impossivel"); unv.add("pessoa-possivel-duplicata"); }
  else {
    const groups = new Map<string, string[]>();
    for (const p of i.people) {
      if (p.birthDate != null && (p.birthDate > i.referenceDate || p.birthDate < "1900-01-01"))
        add("nascimento-impossivel", p.id, { nascimento: p.birthDate, referencia: i.referenceDate });
      if (p.name && p.birthDate) {
        const k = `${normalizeName(p.name)}|${p.birthDate}`;
        groups.set(k, [...(groups.get(k) ?? []), p.id]);
      }
    }
    for (const ids of groups.values()) if (ids.length > 1) {
      const sorted = [...new Set(ids)].sort();
      if (sorted.length > 1) add("pessoa-possivel-duplicata", sorted.join("+"), { candidatos: sorted.length, decisao: "manual" });
    }
  }

  if (i.schools == null) { unv.add("inep-invalido"); unv.add("inep-repetido"); }
  else {
    const byInep = new Map<string, string[]>();
    for (const s of i.schools) {
      if (s.inep == null || !/^\d{8}$/.test(s.inep)) add("inep-invalido", s.id, { inep: s.inep });
      else byInep.set(s.inep, [...(byInep.get(s.inep) ?? []), s.id]);
    }
    for (const [inep, ids] of byInep) if (ids.length > 1) add("inep-repetido", inep, { inep, escolas: ids.length });
  }

  if (i.required == null) unv.add("campo-obrigatorio");
  else for (const r of i.required) if (r.value == null || r.value.trim() === "")
    add("campo-obrigatorio", `${r.id}:${r.field}`, { campo: r.field });

  if (i.sourceCounts == null) unv.add("divergencia-entre-fontes");
  else for (const c of i.sourceCounts) {
    const known = Object.entries(c.bySource).filter(([, v]) => v != null) as [string, number][];
    if (known.length < 2) continue; // comparação exige ao menos duas fontes lidas
    if (new Set(known.map(([, v]) => v)).size > 1)
      add("divergencia-entre-fontes", `${c.schoolId}:${c.measure}`, { medida: c.measure, ...Object.fromEntries(known) });
  }
  return { findings: out, unverifiable: [...unv] };
}

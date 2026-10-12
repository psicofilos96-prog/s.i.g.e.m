// SIGEM 2.0 A&A Lote 09 — Diagnóstico por habilidade. Núcleo puro e auditável:
// itens → habilidades → respostas. Não grava; lê respostas já consolidadas (Lote 07)
// e mapeamento item↔habilidade (Lote 03). Ausência nunca vira erro nem zero.
import { suppressSmallGroups } from "./aa-suppression";

export type ItemMap = { itemId: string; skillId: string; correctOption: string | null; validatedKey: boolean };
export type Answer = { studentId: string; schoolId: string; classId: string; itemId: string; option: string | null; status: "respondida" | "em-branco" | "nao-lida" | "anulada"; correct: boolean | null };
export type Participation = { studentId: string; schoolId: string; classId: string; state: "participou" | "ausente" | "nao-realizada" | "invalidada" | "excepcional" };
export type BandRule = { ruleRef: string; version: number; homologated: boolean; bands: { label: string; min: number; max: number }[] } | null;
export type Scope = "rede" | "escola" | "turma";

export type SkillDiagnosis = {
  skillId: string;
  nItems: number;
  nStudents: number;           // participantes com ao menos uma resposta válida na habilidade
  nResponses: number;          // denominador: respostas corrigíveis
  nCorrect: number;
  rate: number | null;         // acerto bruto, nunca proficiência
  distribution: Record<string, number>; // por alternativa, inclui "em-branco"
  recurrentErrors: { itemId: string; option: string; share: number }[];
  band: { label: string; ruleRef: string; version: number } | null;
  limitations: string[];
  criteria: string[];
  suppressed: boolean;
};

export const DISTRACTOR_NOTE = "Distribuição de alternativas indica padrão de resposta; não prova o raciocínio do estudante.";
const RECURRENT_SHARE = 0.3; // critério declarado de exibição, não norma pedagógica

export function diagnose(p: { items: ItemMap[]; answers: Answer[]; participation: Participation[]; bandRule: BandRule; minN: number | null; filter?: { schoolId?: string; classId?: string } }): SkillDiagnosis[] {
  const participants = new Set(p.participation.filter(x => x.state === "participou" && (!p.filter?.schoolId || x.schoolId === p.filter.schoolId) && (!p.filter?.classId || x.classId === p.filter.classId)).map(x => x.studentId));
  const bySkill = new Map<string, ItemMap[]>();
  for (const it of p.items) bySkill.set(it.skillId, [...(bySkill.get(it.skillId) ?? []), it]);
  const out: SkillDiagnosis[] = [];
  for (const [skillId, items] of bySkill) {
    const lim: string[] = [];
    const usable = items.filter(i => i.validatedKey && i.correctOption);
    if (usable.length < items.length) lim.push(`${items.length - usable.length} item(ns) sem gabarito validado excluído(s)`);
    if (usable.length < 2) lim.push("habilidade medida por menos de 2 itens: leitura frágil");
    const ids = new Set(usable.map(i => i.itemId));
    const ans = p.answers.filter(a => ids.has(a.itemId) && participants.has(a.studentId));
    const naoLidas = ans.filter(a => a.status === "nao-lida").length;
    if (naoLidas) lim.push(`${naoLidas} resposta(s) não lida(s) fora do denominador`);
    const valid = ans.filter(a => a.status === "respondida" || a.status === "em-branco");
    const nCorrect = valid.filter(a => a.status === "respondida" && a.correct === true).length;
    const students = new Set(valid.map(a => a.studentId)).size;
    const dist: Record<string, number> = {};
    for (const a of valid) { const k = a.status === "em-branco" ? "em-branco" : (a.option ?? "em-branco"); dist[k] = (dist[k] ?? 0) + 1; }
    const recurrent: SkillDiagnosis["recurrentErrors"] = [];
    for (const it of usable) {
      const r = valid.filter(a => a.itemId === it.itemId);
      const wrong = new Map<string, number>();
      for (const a of r) if (a.status === "respondida" && a.option && a.option !== it.correctOption) wrong.set(a.option, (wrong.get(a.option) ?? 0) + 1);
      for (const [opt, c] of wrong) if (r.length && c / r.length >= RECURRENT_SHARE) recurrent.push({ itemId: it.itemId, option: opt, share: c / r.length });
    }
    const rate = valid.length ? nCorrect / valid.length : null;
    if (rate === null) lim.push("sem respostas corrigíveis: não apurado");
    let band: SkillDiagnosis["band"] = null;
    if (!p.bandRule || !p.bandRule.homologated) lim.push("faixa pedagógica não exibida: sem regra homologada e versionada");
    else if (rate !== null) { const b = p.bandRule.bands.find(b => rate * 100 >= b.min && rate * 100 <= b.max); if (b) band = { label: b.label, ruleRef: p.bandRule.ruleRef, version: p.bandRule.version }; }
    const sup = suppressSmallGroups([{ key: skillId, n: students }], p.minN);
    const suppressed = sup.rows[0].suppressed;
    if (sup.policy === "sem-politica") lim.push("sem política de divulgação: supressão de grupo pequeno não aplicada");
    out.push({ skillId, nItems: usable.length, nStudents: students, nResponses: valid.length, nCorrect: suppressed ? 0 : nCorrect, rate: suppressed ? null : rate, distribution: suppressed ? {} : dist, recurrentErrors: suppressed ? [] : recurrent, band: suppressed ? null : band, limitations: suppressed ? [...lim, "grupo abaixo do limiar: valores retidos"] : lim, criteria: ["acerto bruto = corretas / (respondidas + em branco) de participantes", "não lida e anulada fora do denominador", `erro recorrente ≥ ${RECURRENT_SHARE * 100}% das respostas do item`, DISTRACTOR_NOTE], suppressed });
  }
  return out.sort((a, b) => a.skillId.localeCompare(b.skillId));
}

/** Prioridades: só habilidades com faixa homologada marcada como prioritária, ordenadas por acerto. */
export function priorities(d: SkillDiagnosis[], priorityBands: ReadonlySet<string>) {
  const rows = d.filter(x => x.band && priorityBands.has(x.band.label) && x.rate !== null).sort((a, b) => (a.rate! - b.rate!));
  return rows.length || d.some(x => x.band) ? { state: "lido" as const, rows } : { state: "sem-regra" as const, reason: "prioridade exige faixa pedagógica homologada" };
}

/** Drill-down rede → escola → turma; nunca nominal. */
export function drillScope(from: Scope, key: string, f: { schoolId?: string; classId?: string }, allowed: { network: boolean; schools: ReadonlySet<string> }): { scope: Scope; filter: { schoolId?: string; classId?: string } } | { refused: string } {
  if (from === "rede") return allowed.network || allowed.schools.has(key) ? { scope: "escola", filter: { schoolId: key } } : { refused: "escola fora do alcance" };
  if (from === "escola") return f.schoolId && (allowed.network || allowed.schools.has(f.schoolId)) ? { scope: "turma", filter: { schoolId: f.schoolId, classId: key } } : { refused: "escola fora do alcance" };
  return { refused: "drill-down para em turma: diagnóstico nunca é nominal" };
}

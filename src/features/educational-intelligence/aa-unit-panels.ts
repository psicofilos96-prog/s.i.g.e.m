// SIGEM 2.0 A&A Lote 12 — Painéis de turma/escola, grupos temporários e comparação
// contextualizada. Núcleo puro sobre linhas já lidas com a sessão; não grava.
import { suppressSmallGroups } from "./aa-suppression";

export type StudentResult = { studentId: string; unitId: string; eligible: boolean; participated: boolean; rate: number | null; skillRates: Record<string, number | null> };
export type BandRule = { ruleRef: string; version: number; homologated: boolean; bands: { label: string; min: number; max: number }[] } | null;

export function unitPanel(p: { unitId: string; rows: StudentResult[]; bandRule: BandRule; minN: number | null; plans: { id: string; skill: string; status: string }[]; history: { editionId: string; date: string; scaleKey: string; rate: number | null }[]; scaleKey: string }) {
  const rs = p.rows.filter(r => r.unitId === p.unitId);
  const eligible = rs.filter(r => r.eligible).length;
  const part = rs.filter(r => r.eligible && r.participated);
  const notes: string[] = ["percentual = acerto bruto, não proficiência"];
  const sup = suppressSmallGroups([{ key: p.unitId, n: part.length }], p.minN);
  if (sup.policy === "sem-politica") notes.push("sem política de divulgação: supressão não aplicada");
  const suppressed = sup.rows[0]?.suppressed ?? false;
  let distribution: Record<string, number> | null = null;
  if (!p.bandRule?.homologated) notes.push("distribuição por faixa exige regra homologada");
  else if (!suppressed) { distribution = {}; for (const r of part) { if (r.rate === null) continue; const b = p.bandRule.bands.find(b => r.rate! * 100 >= b.min && r.rate! * 100 <= b.max); const k = b?.label ?? "fora das faixas"; distribution[k] = (distribution[k] ?? 0) + 1; } }
  const skills = new Map<string, number[]>();
  for (const r of part) for (const [s, v] of Object.entries(r.skillRates)) if (v !== null) skills.set(s, [...(skills.get(s) ?? []), v]);
  const skillAvg = [...skills].map(([s, v]) => ({ skill: s, n: v.length, rate: v.reduce((a, b) => a + b, 0) / v.length })).sort((a, b) => a.rate - b.rate);
  const evolution = p.history.filter(h => h.scaleKey === p.scaleKey).sort((a, b) => a.date.localeCompare(b.date));
  if (evolution.length < p.history.length) notes.push("edições de escala diferente fora da evolução");
  return { unitId: p.unitId, eligible, participants: part.length, participation: eligible ? part.length / eligible : null, suppressed, distribution, lowestSkills: suppressed ? [] : skillAvg.slice(0, 5), evolution, plans: p.plans, notes };
}

// Grupos temporários: critério declarado, validade, revisão; nome neutro; nunca rótulo.
export type TempGroup = { id: string; skill: string; criterion: string; createdAt: string; reviewBy: string; members: string[]; name: string };
const STIGMA = /\b(fraco|lento|atrasad|problem|ruim|piores|baixo rendimento|reforço dos)/i;

export function proposeGroup(p: { id: string; skill: string; criterion: { max: number; ruleRef: string } | null; rows: StudentResult[]; today: string; reviewDays: number; name: string }): TempGroup | { refused: string } {
  if (!p.criterion) return { refused: "grupo exige critério declarado e referência de regra" };
  if (!(p.reviewDays > 0 && p.reviewDays <= 120)) return { refused: "revisão periódica obrigatória (1–120 dias)" };
  if (STIGMA.test(p.name)) return { refused: "nome do grupo estigmatizante: use nome neutro pela habilidade" };
  const members = p.rows.filter(r => r.participated && r.skillRates[p.skill] != null && r.skillRates[p.skill]! <= p.criterion!.max).map(r => r.studentId).sort();
  const d = new Date(p.today); d.setUTCDate(d.getUTCDate() + p.reviewDays);
  return { id: p.id, skill: p.skill, criterion: `${p.skill} ≤ ${Math.round(p.criterion.max * 100)}% (${p.criterion.ruleRef})`, createdAt: p.today, reviewBy: d.toISOString().slice(0, 10), members, name: p.name };
}

export function groupStatus(g: TempGroup, today: string): "vigente" | "revisao-vencida" {
  return today > g.reviewBy ? "revisao-vencida" : "vigente";
}

// Comparação contextualizada: sem ordenação por desempenho; só mesmo instrumento; contexto sempre junto.
export type SchoolContext = { schoolId: string; instrumentVersion: string; eligible: number; participants: number; rate: number | null; population: string | null };
export function compareSchools(rows: SchoolContext[], minParticipation: number | null) {
  const instruments = new Set(rows.map(r => r.instrumentVersion));
  if (instruments.size > 1) return { refused: "escolas com instrumentos diferentes não são comparáveis" };
  return { rows: [...rows].sort((a, b) => a.schoolId.localeCompare(b.schoolId)).map(r => {
    const participation = r.eligible ? r.participants / r.eligible : null;
    const caveats: string[] = [];
    if (minParticipation === null) caveats.push("sem limiar homologado de participação");
    else if (participation === null || participation < minParticipation) caveats.push("participação abaixo do limiar: resultado não representativo");
    if (!r.population) caveats.push("perfil da população não informado");
    return { ...r, participation, caveats };
  }), notes: ["ordem alfabética: comparação não é ranking", "diferenças refletem participação, população e contexto"] };
}

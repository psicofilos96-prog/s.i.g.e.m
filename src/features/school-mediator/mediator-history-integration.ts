/**
 * PERFIL MEDIADOR — LOTE 16 Meu histórico e integração transversal (núcleo puro).
 * Histórico profissional = projeção de fatos da própria pessoa (designações,
 * escolas, períodos, registros autorados, emissões, formações). Estudante antigo
 * aparece só como referência mínima (iniciais) sem abrir ficha, salvo designação
 * vigente. Integração = contratos canônicos fechados por setor (direção lê/grava?
 * nunca: cada setor só recebe o que o contrato declara, pelo reader/writer dono).
 */
export interface Designation { logicalId: string; schoolId: string; schoolName: string; studentId: string; studentName: string; from: string; to: string | null; functionId: string | null }
export interface AuthoredRef { id: string; kind: "registro" | "observacao" | "ocorrencia" | "solicitacao" | "relatorio"; date: string; designationId: string }
export interface Training { id: string; title: string; hours: number | null; date: string; source: "formacao-continuada" }

export function myHistory(p: { today: string; designations: Designation[] | null; authored: AuthoredRef[] | null; trainings: Training[] | null }) {
  const lim: string[] = [];
  if (p.designations === null) lim.push("Designações não lidas.");
  if (p.authored === null) lim.push("Registros autorados não lidos.");
  if (p.trainings === null) lim.push("Formações não lidas.");
  const des = (p.designations ?? []).map((d) => {
    const active = d.from <= p.today && (!d.to || p.today <= d.to);
    const recs = (p.authored ?? []).filter((a) => a.designationId === d.logicalId);
    return { designationId: d.logicalId, school: d.schoolName, from: d.from, to: d.to, active,
      student: active ? d.studentName : initials(d.studentName), canOpenStudent: active,
      records: recs.length, reports: recs.filter((r) => r.kind === "relatorio").length };
  }).sort((a, b) => (a.from < b.from ? 1 : -1));
  const schools = [...new Set((p.designations ?? []).map((d) => d.schoolName))].sort();
  return { designations: des, schools, trainings: (p.trainings ?? []).map((t) => ({ ...t, hours: t.hours })), limitations: lim };
}
function initials(n: string) { return n.split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase() + ".").join(" "); }

/** Contratos canônicos por setor: o que o mediador recebe e o que entrega; nada fora da lista. */
export type Sector = "direcao" | "secretaria" | "docente" | "nei" | "orientacao" | "supervisao" | "aa" | "familia";
export interface Contract { sector: Sector; receives: string[]; sends: string[]; via: string; capability: string | null }
export const CONTRACTS: readonly Contract[] = [
  { sector: "direcao", receives: ["designacao"], sends: ["ocorrencia", "solicitacao"], via: "record_inclusion_mediation / apply_workflow_transition", capability: "manter-mediacao-escolar" },
  { sector: "secretaria", receives: ["enturmacao-vigente"], sends: [], via: "class_enrollment_episodes (reader)", capability: null },
  { sector: "docente", receives: ["orientacao", "estrategia-confirmada"], sends: ["observacao", "estrategia-proposta", "devolutiva"], via: "solicitacao-escola", capability: null },
  { sector: "nei", receives: ["orientacao-publicada", "plano-operacional"], sends: ["observacao", "pedido-revisao", "solicitacao", "registro-diario"], via: "protocolo-nei / inclusion_records_at", capability: null },
  { sector: "orientacao", receives: ["orientacao"], sends: ["solicitacao", "ocorrencia"], via: "apply_workflow_transition", capability: null },
  { sector: "supervisao", receives: [], sends: ["relatorio"], via: "report_emissions", capability: "consultar-documentos-mediacao" },
  { sector: "aa", receives: [], sends: ["participacao-contagem"], via: "aa readers (sem nome)", capability: null },
  { sector: "familia", receives: [], sends: ["comunicado-institucional"], via: "comunicacao-escolar (publicação da escola)", capability: "comunicados" },
];

export function canShare(sector: Sector, item: string, ctx: { hasCapability: (c: string) => boolean; familyAuthorizationActive?: boolean; viaInstitutionalChannel?: boolean }) {
  const c = CONTRACTS.find((x) => x.sector === sector);
  if (!c || !c.sends.includes(item)) return { ok: false as const, reason: "Fora do contrato com este setor." };
  if (sector === "familia") {
    if (!ctx.viaInstitutionalChannel) return { ok: false as const, reason: "Família só pelo canal institucional da escola, nunca mensagem direta do mediador." };
    if (!ctx.familyAuthorizationActive) return { ok: false as const, reason: "Sem autorização vigente do responsável na seção de comunicados." };
    return { ok: true as const, via: c.via };
  }
  if (c.capability && sector !== "direcao" && !ctx.hasCapability(c.capability)) return { ok: false as const, reason: `Destino exige a capacidade ${c.capability}.` };
  return { ok: true as const, via: c.via };
}

export function canReceive(sector: Sector, item: string) { return !!CONTRACTS.find((c) => c.sector === sector)?.receives.includes(item); }

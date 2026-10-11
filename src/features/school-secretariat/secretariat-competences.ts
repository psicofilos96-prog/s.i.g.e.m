// SIGEM 2.0 — Secretaria por unidade, Lote 01: competências × política homologada (núcleo puro, sem migration).
// A autorização real é só `effective_capabilities()` sobre a política HOMOLOGADA; este módulo apenas confronta o
// documento "Secretaria Escolar — pedidos e decisões" com as regras observadas, para listar lacunas por extenso.
// Nunca concede capacidade: competência nova = nova versão da política homologada pela autoridade da rede.

export type Role = "secretario" | "auxiliar-de-secretaria" | "direcao" | "supervisao" | "estatistica";

/** Tipo de atuação da política que corresponde ao papel; null = não existe na política (lacuna). */
export const ROLE_ENGAGEMENT: Record<Role, string | null> = {
  secretario: "secretaria-escolar",
  "auxiliar-de-secretaria": null, // não há tipo de atuação próprio; nunca herdar do secretário por cargo
  direcao: "direcao-escolar",
  supervisao: null, // Supervisão age por designação explícita (calendário/acompanhamento), não por regra da política
  estatistica: "ciece-estatistica",
};

/** Exigências do documento, por papel: capacidades que devem existir (deve) ou não existir (nunca). */
export const DOCUMENT_REQUIREMENTS: { role: Role; capability: string; expect: "deve" | "nunca"; section: string }[] = [
  { role: "secretario", capability: "manter-identidade-cadastral-do-estudante", expect: "deve", section: "§1/§2 única que cadastra/edita aluno" },
  { role: "secretario", capability: "manter-matricula-e-enturmacao", expect: "deve", section: "§4/§5" },
  { role: "secretario", capability: "manter-cadastro-de-turmas", expect: "deve", section: "§4" },
  { role: "secretario", capability: "registrar-movimentacao-escolar", expect: "deve", section: "§5" },
  { role: "secretario", capability: "preparar-mapa-estatistico", expect: "deve", section: "§7" },
  { role: "secretario", capability: "registrar-registro-de-aula", expect: "nunca", section: "§1 não acessa Diário" },
  { role: "secretario", capability: "consultar-planejamento-docente", expect: "nunca", section: "§1 não acessa Planejamento" },
  { role: "secretario", capability: "consultar-frequencia", expect: "nunca", section: "§1 não acessa painel de Rendimento/Frequência" },
  { role: "direcao", capability: "manter-matricula-e-enturmacao", expect: "nunca", section: "Direção não edita matrícula" },
  { role: "direcao", capability: "manter-identidade-cadastral-do-estudante", expect: "nunca", section: "só a Secretaria edita aluno" },
  { role: "direcao", capability: "oficializar-mapa-estatistico", expect: "deve", section: "§7 envio/aprovação" },
  { role: "estatistica", capability: "consultar-mapa-estatistico", expect: "deve", section: "§7 CIECE administra" },
];

export type Finding = { role: Role; capability: string; section: string; kind: "papel-sem-atuacao" | "falta" | "excesso" | "ok" };

/** Confronto puro: regras = { tipoDeAtuação: capacidades[] } lidas da política homologada vigente. */
export function confront(rules: Record<string, string[]>): Finding[] {
  return DOCUMENT_REQUIREMENTS.map((req) => {
    const kind = ROLE_ENGAGEMENT[req.role];
    if (!kind) return { ...req, kind: "papel-sem-atuacao" as const };
    const has = (rules[kind] ?? []).includes(req.capability);
    if (req.expect === "deve") return { ...req, kind: has ? ("ok" as const) : ("falta" as const) };
    return { ...req, kind: has ? ("excesso" as const) : ("ok" as const) };
  }).map(({ role, capability, section, kind }) => ({ role, capability, section, kind }));
}

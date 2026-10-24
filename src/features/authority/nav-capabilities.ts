/**
 * NPERM.3 — opções de menu que só existem para quem tem a capacidade exigida pela PRÓPRIA tela.
 * Só entram rotas cuja tela inteira recusa sem a capacidade (prova no código da tela); as demais
 * mostram dados filtrados pelo banco e continuam visíveis. Esconder menu nunca autoriza: o banco
 * (RLS/writers) e a recusa da tela seguem valendo para deep link.
 */
import type { EffectiveCapability } from "./session-authority";
import { stationAllowsPath, type SectorPrincipal } from "./station-navigation";

export const NAV_REQUIRED_CAPABILITY: Readonly<Record<string, readonly string[]>> = {
  // Sector entry points must not inherit a teacher's classroom-read permissions.
  "/gestao-escolar": ["consultar-supervisao-da-propria-escola", "consultar-quadro-profissional-da-escola", "registrar-acompanhamento-pedagogico"],
  "/direcao": ["consultar-acompanhamento-pedagogico", "registrar-acompanhamento-pedagogico"],
  "/orientacao": ["consultar-acompanhamento-pedagogico", "registrar-acompanhamento-pedagogico"],
  "/supervisao-escolar": ["consultar-acompanhamento-da-supervisao", "registrar-acompanhamento-da-supervisao", "construir-calendario-da-rede"],
  "/secretaria": ["consultar-matricula-e-movimentacao", "cadastrar-estudante-na-rede"],
  // O assistente de matrícula só oferece escolas com esta competência; consulta não autoriza criar.
  "/matriculas/nova": ["manter-matricula-e-enturmacao"],
  // O espaço de movimentações lê matrículas; a gravação revalida a competência no banco.
  "/transferencias": ["consultar-matricula-e-movimentacao", "manter-matricula-e-enturmacao"],
  "/ciece": ["consultar-censo-escolar", "preparar-censo-escolar", "consultar-indicador-agregado"],
  "/mapa-estatistico": ["consultar-matricula-e-movimentacao", "corrigir-mapa-estatistico"],
  "/mapa-estatistico-rede": ["consultar-censo-escolar", "corrigir-mapa-estatistico"],
  "/mapa-censo-2026": ["consultar-censo-escolar", "consultar-matricula-e-movimentacao"],
  "/inclusao": ["consultar-apoio-inclusivo", "acompanhar-educacao-inclusiva-rede"],
  "/alimentacao-escolar": ["consultar-alimentacao-escolar", "registrar-execucao-alimentacao", "submeter-pedido-alimentar", "registrar-estoque-alimentar"],
  "/acompanhamento-planejamento": ["revisar-trabalho-docente"],
  "/alunos": ["consultar-identidade-cadastral-do-estudante", "consultar-matricula-e-movimentacao", "cadastrar-estudante-na-rede"],
  "/turmas": ["consultar-organizacao-da-oferta"],
  "/profissionais": ["consultar-registro-funcional", "consultar-quadro-profissional-da-escola", "consultar-quadro-profissional-da-rede"],
  "/departamento-pessoal": ["consultar-registro-funcional", "manter-registro-funcional"],
  "/unidades": ["manter-cadastro-unidade-escolar"],
  "/horarios": ["consultar-organizacao-da-oferta"],
  "/importacoes": ["gerir-importacao-de-dados"],
  "/documentos-escolares": ["consultar-documento-escolar", "emitir-documento-escolar"],
  // Administrative capabilities already declared by sigem_administrative_capabilities (0051).
  "/central-de-acessos": ["manter-pessoas-institucionais", "manter-contas-institucionais", "manter-atuacoes-institucionais", "registrar-politica-de-capacidades", "homologar-politica-de-capacidades"],
  "/estacao-administrativa": ["registrar-politica-de-capacidades", "homologar-politica-de-capacidades"],
  // publications-admin-page.tsx: sem a capacidade ⇒ "Sem permissão para publicar".
  "/publicacoes": ["publicar-conteudo-publico"],
  // NPERM.4 — integration-page/institutional-page: integration_require_admin() recusa a tela
  // inteira sem `administrar-integracoes` em alcance de rede (has_network_capability, 0091/0092).
  "/integracoes": ["administrar-integracoes"],
  "/central-de-integracoes": ["administrar-integracoes"],
  // EDUCACENSO.1 — educacenso_control_at só lista escolas com estas capacidades (0354).
  "/educacenso": ["preparar-censo-escolar", "consultar-censo-escolar", "consultar-pendencias-do-censo"],
  // 2026-10-23 — Sistema/Normas: só quem tem competência sobre a área (antes ficavam abertos a todos).
  "/paineis": ["manter-painel-inteligencia", "consultar-indicador-agregado", "consultar-desempenho-educacional"],
  "/avaliacao-desempenho": ["consultar-desempenho-educacional", "manter-avaliacao-institucional", "manter-programa-avaliativo"],
  "/relatorios": ["consultar-indicador-agregado", "consultar-matricula-e-movimentacao", "consultar-alimentacao-escolar", "consultar-desempenho-educacional", "consultar-acompanhamento-da-supervisao", "consultar-acompanhamento-pedagogico"],
  "/consolidado-2026": ["consultar-censo-escolar", "corrigir-mapa-estatistico"],
  "/parametros": ["registrar-politica-de-capacidades", "construir-calendario-da-rede", "manter-parametros-nutricionais", "manter-regra-de-competencia-do-mapa"],
  "/auditoria": ["consultar-auditoria", "exportar-auditoria"],
  "/senhas-de-setores": ["manter-contas-institucionais"],
  "/configuracao-inicial": ["manter-cadastro-unidade-escolar", "preparar-ano-letivo"],
  "/prontidao-piloto": ["registrar-politica-de-capacidades"],
  "/qualidade-dos-dados": ["revisar-qualidade-dos-dados"],
  "/revisao-de-anomalias": ["revisar-qualidade-dos-dados", "consultar-indicador-agregado"],
  "/quadro-docente": ["consultar-quadro-profissional-da-escola", "consultar-quadro-profissional-da-rede", "manter-atribuicao-docente"],
  "/simulador": ["registrar-politica-de-capacidades", "manter-cadastro-de-turmas"],
  "/sugestoes-de-horario": ["manter-grade-da-turma"],
  "/pendencias": ["gerir-tarefas-operacionais", "registrar-politica-de-capacidades"],
  "/areas": ["registrar-politica-de-capacidades"],
  "/matrizes-curriculares": ["manter-matrizes-curriculares", "homologar-matrizes-curriculares", "consultar-organizacao-da-oferta"],
  "/regras-avaliativas": ["registrar-norma-homologada", "manter-programa-avaliativo"],
  "/regras-de-situacao": ["registrar-norma-homologada", "registrar-situacao-academica"],
  "/identidade-institucional": ["manter-catalogos-institucionais", "registrar-politica-de-capacidades"],
  "/referencias-curriculares": ["construir-referencia-curricular", "homologar-referencia-curricular", "consultar-planejamento-docente", "revisar-trabalho-docente"],
  "/mapa-mensal-2026": ["consultar-matricula-e-movimentacao", "corrigir-mapa-estatistico"],
};

/** Rotas cuja capacidade só vale em alcance de rede (sem escola/turma), espelhando o banco. */
export const NAV_NETWORK_SCOPE: ReadonlySet<string> = new Set(["/integracoes", "/central-de-integracoes"]);

const CAPABILITY_ROUTES = Object.keys(NAV_REQUIRED_CAPABILITY).sort((a, b) => b.length - a.length);

/** Sem regra ⇒ visível; com regra ⇒ exige ao menos uma das capacidades efetivas. */
export function navItemAllowed(path: string, caps: readonly EffectiveCapability[]): boolean {
  // NACL.UI.1: deep link (`/rota/123`) obedece à regra da rota base.
  const pathname = path.split(/[?#]/)[0] ?? "";
  const base = CAPABILITY_ROUTES.find((r) => pathname === r || pathname.startsWith(`${r}/`));
  if (!base) return true;
  const need = NAV_REQUIRED_CAPABILITY[base];
  if (!need) return false;
  const network = NAV_NETWORK_SCOPE.has(base);
  return caps.some((c) => need.includes(c.capabilityId) && (!network || (c.schoolId === null && c.classId === null)));
}

/**
 * NACL.UI.1 — regra ÚNICA de "esta área pode ser oferecida/aberta" para menu, paleta, busca,
 * cards de início e deep link: estação do principal setorial (se houver) E capacidade exigida
 * pela tela. Capacidades = união de todas as atuações (lidas por inteiro, sem corte em 1000).
 * Autoridade ainda não completa ⇒ nada é oferecido. Nunca é segurança: o banco recusa de todo modo.
 */
export type PathAuthority =
  | { status: "loading" | "signed-out" }
  | { status: "signed-in"; principal?: SectorPrincipal | null; capabilities: readonly EffectiveCapability[] };

export function pathAllowed(authority: PathAuthority, path: string): boolean {
  if (authority.status !== "signed-in") return false;
  const clean = (path.split(/[?#]/)[0] ?? "").replace(/\/\$[a-z]+$/i, "");
  const principal = authority.principal ?? null;
  if (principal && !stationAllowsPath(principal.station, clean)) return false;
  return navItemAllowed(clean, authority.capabilities);
}

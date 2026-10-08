/**
 * NTEST.2 — fluxos principais por estação, com a camada que de fato os prova.
 * Dado de teste, não regra: rotas vêm de station-navigation, permissões da política homologada.
 * `proof` declara a camada mais forte que o harness alcança HOJE para o fluxo:
 *  - static: regra pura (navegação/catálogo), não prova RLS nem tela;
 *  - authenticated-layer: JWT real de usuário sintético (bo-fixture-harness) contra RLS/capabilities;
 *  - browser: só com sessão aprovada pela plataforma — nunca presumido aqui.
 */
export type HarnessLayer = "static" | "authenticated-layer" | "browser";
export type StationFlow = Readonly<{
  area: "Secretaria" | "CIECE" | "Supervisão" | "Avaliação" | "OP" | "Direção" | "Alimentação" | "Docente" | "Admin";
  flow: string;
  station: string | null; // null = perfil de pessoa (Docente/Admin), sem estação setorial
  routes: string[];
  profile: string | null; // tipo do manifesto bo-fixture-harness; null = sem perfil sintético
  proof: HarnessLayer;
}>;

export const STATION_FLOWS: readonly StationFlow[] = [
  { area: "Secretaria", flow: "Abrir estação e listar estudantes da própria escola", station: "secretaria_escolar", routes: ["/secretaria", "/alunos"], profile: "secretaria-escolar", proof: "authenticated-layer" },
  { area: "Secretaria", flow: "Enturmação e vagas", station: "secretaria_escolar", routes: ["/enturmacoes", "/turmas"], profile: "secretaria-escolar", proof: "authenticated-layer" },
  { area: "Secretaria", flow: "Documentos escolares", station: "secretaria_escolar", routes: ["/documentos-escolares"], profile: "secretaria-escolar", proof: "static" },
  { area: "CIECE", flow: "Censo e qualidade dos dados", station: "ciece", routes: ["/ciece", "/censo-escolar", "/qualidade-dos-dados"], profile: "ciece-estatistica", proof: "authenticated-layer" },
  { area: "CIECE", flow: "Mapa estatístico da rede", station: "ciece", routes: ["/mapa-estatistico-rede"], profile: "ciece-auditoria-coordenacao", proof: "authenticated-layer" },
  { area: "Supervisão", flow: "Calendário e home da Supervisão", station: "supervisao", routes: ["/supervisao-escolar"], profile: null, proof: "static" },
  { area: "Supervisão", flow: "Exportar acompanhamento (CSV sem responsável por padrão)", station: "supervisao", routes: ["/supervisao-escolar"], profile: null, proof: "static" },
  { area: "Supervisão", flow: "Registrar/retificar acompanhamento (record_school_supervision)", station: "supervisao", routes: ["/supervisao-escolar", "/unidades"], profile: null, proof: "static" },
  { area: "Avaliação", flow: "Desempenho e painéis", station: "avaliacao", routes: ["/avaliacao-desempenho", "/paineis"], profile: null, proof: "static" },
  { area: "Avaliação", flow: "Exportar mapa/evolução (bloqueado sem política; ≥3 edições)", station: "avaliacao", routes: ["/avaliacao-desempenho"], profile: null, proof: "static" },
  { area: "Avaliação", flow: "Conferência e oficialização (writers de governança)", station: "avaliacao", routes: ["/avaliacao-desempenho"], profile: null, proof: "static" },
  { area: "OP", flow: "Orientação e planejamento", station: "orientacao_pedagogica", routes: ["/orientacao", "/planejamento"], profile: "orientacao-pedagogica", proof: "authenticated-layer" },
  { area: "Direção", flow: "Dossiê, profissionais e horários", station: "direcao_escolar", routes: ["/direcao", "/profissionais", "/horarios"], profile: "direcao-escolar", proof: "authenticated-layer" },
  { area: "Alimentação", flow: "Estação de Alimentação", station: "alimentacao", routes: ["/alimentacao-escolar"], profile: null, proof: "static" },
  { area: "Alimentação", flow: "Exportar relatórios da Central (ausência ≠ zero)", station: "alimentacao", routes: ["/alimentacao-escolar"], profile: null, proof: "static" },
  { area: "Alimentação", flow: "Estação Cozinha: execução e movimento de estoque", station: "alimentacao", routes: ["/alimentacao-escolar/cozinha"], profile: null, proof: "static" },
  { area: "Docente", flow: "Diário e turmas da própria atuação", station: null, routes: [], profile: "professor", proof: "authenticated-layer" },
  { area: "Admin", flow: "Central de acessos e cobertura do administrador geral", station: null, routes: [], profile: "administrador-geral-do-sigem", proof: "authenticated-layer" },
];

/** Resumo de cobertura por área: nunca declara browser sem sessão aprovada. */
export function coverageReport(browserApproved: boolean) {
  return STATION_FLOWS.map((f) => ({
    area: f.area,
    flow: f.flow,
    layer: browserApproved && f.proof === "authenticated-layer" ? "browser" : f.proof,
    pending: browserApproved ? null : "INTERACTIVE_BROWSER_VALIDATION_PENDING",
  }));
}

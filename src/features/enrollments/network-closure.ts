/**
 * Organização da Rede — Lote 24: matriz de fechamento (42 seções + 20 critérios).
 * Cada linha cita fonte, testes, tela e status; `closureProblems` confere tudo em
 * disco. "homologado" não existe como status: nenhuma homologação humana, ato
 * oficial ou critério municipal foi registrado por este código.
 */
export type NetClosureStatus = "persistido-com-tela" | "persistido" | "nucleo-testado" | "bloqueado";
export interface NetClosureRow { n: number; title: string; status: NetClosureStatus; source: string[]; tests: string[]; screen: string | null; blocker: string }

/** Commit de referência em que a matriz foi conferida. */
export const CLOSURE_BASE_SHA = "53518786d87ccdc536a7d8a69d8b885f5ede15a5";

const E = "src/features/enrollments";
const R = "src/routes";
const M = "drizzle/migrations";
const HUB = `${R}/organizacao-da-rede.tsx`;
const s = (f: string) => `${E}/${f}.ts`;
const t = (f: string) => `${E}/${f}.test.ts`;
const RLS = "supabase/tests/net24_enrollment_rls.sql";
const row = (n: number, title: string, status: NetClosureStatus, mods: string[], screen: string | null = null, blocker = "", extra: string[] = []): NetClosureRow =>
  ({ n, title, status, source: [...mods.map(s), ...extra], tests: mods.map(t), screen, blocker });

const NO_WRITER = "Regra testada; falta writer/reader institucional no banco.";
const NO_HUMAN = "Nenhuma homologação humana registrada.";

export const NET_CLOSURE_SECTIONS: readonly NetClosureRow[] = [
  row(1, "Finalidade", "nucleo-testado", ["network-closure"], HUB),
  row(2, "Objetivos", "nucleo-testado", ["network-enrollment-audit"], HUB),
  row(3, "Princípios: fonte única", "persistido", ["network-enrollment-audit"], null, "", [RLS]),
  row(4, "Conceitos fundamentais", "persistido", ["network-enrollment-audit"], null, "", [`${M}/0001_b3_cycle_enrollment_participation_allocation.sql`]),
  row(5, "Perfis e competências", "bloqueado", ["official-confirmation"], null, "Competências por etapa da central de matrículas sem política homologada."),
  row(6, "Organização da rede", "persistido-com-tela", ["network-enrollment-audit"], `${R}/administracao.tsx`),
  row(7, "Território e zoneamento", "bloqueado", ["territorial-map"], HUB, "Provedor de mapa, coordenadas e limiar de supressão não definidos."),
  row(8, "Infraestrutura e capacidade física", "nucleo-testado", ["capacity-model"], null, NO_WRITER),
  row(9, "Oferta por escola", "nucleo-testado", ["school-offer-lifecycle"], null, NO_WRITER),
  row(10, "Capacidades", "nucleo-testado", ["capacity-model"], null, NO_WRITER),
  row(11, "Planejamento de turmas", "nucleo-testado", ["class-planning"], null, NO_WRITER),
  row(12, "Quadro de vagas", "nucleo-testado", ["vacancy-board"], HUB, NO_WRITER),
  row(13, "Campanhas de matrícula", "nucleo-testado", ["enrollment-campaigns"], null, NO_WRITER),
  row(14, "Inscrição / pré-matrícula", "nucleo-testado", ["pre-registration"], null, NO_WRITER),
  row(15, "Pedidos de vagas", "nucleo-testado", ["vacancy-requests"], null, NO_WRITER),
  row(16, "Distribuição", "bloqueado", ["distribution-engine"], null, "Critério municipal de prioridade não fornecido."),
  row(17, "Reservas concorrentes", "nucleo-testado", ["reservation-ledger"], null, "Prazo de reserva e quem reserva não definidos."),
  row(18, "Lista de espera", "bloqueado", ["waiting-list"], null, "Quem ordena/reclassifica não definido."),
  row(19, "Confirmação oficial", "bloqueado", ["official-confirmation"], null, "Documentos bloqueantes e competências por etapa não definidos."),
  row(20, "Matrícula escolar", "persistido-com-tela", ["official-confirmation"], `${R}/matriculas.tsx`, "", [RLS]),
  row(21, "Enturmação temporal", "persistido-com-tela", ["temporal-allocation"], `${R}/enturmacoes.tsx`, "", [RLS]),
  row(22, "Transferências", "persistido-com-tela", ["transfer-flow"], `${R}/transferencias.tsx`),
  row(23, "Remanejamento", "persistido", ["transfer-flow"]),
  row(24, "Painel de ocupação e alertas", "nucleo-testado", ["occupancy-panel"], HUB, "Limiar de ocupação não homologado."),
  row(25, "Mapa territorial", "bloqueado", ["territorial-map"], HUB, "Sem provedor de mapa nem coordenadas institucionais."),
  row(26, "Educação Infantil", "bloqueado", ["early-childhood"], null, "Ato oficial com data de corte e faixas não registrado."),
  row(27, "Ensino Fundamental", "nucleo-testado", ["fundamental-eja"]),
  row(28, "EJA semestral", "nucleo-testado", ["fundamental-eja"]),
  row(29, "Acessibilidade e NEI", "bloqueado", ["accessibility-planning"], null, "Tipos de recurso oficiais e transporte acessível não definidos."),
  row(30, "Demanda → Gestão de Pessoas", "nucleo-testado", ["staffing-bridge"]),
  row(31, "SIGEM Família", "nucleo-testado", ["family-enrollment-portal"], null, "Prazo de confirmação de vaga não definido."),
  row(32, "Simulador isolado", "nucleo-testado", ["network-simulator"], null, "Salas por escola/turno não cadastradas."),
  row(33, "Relatórios", "nucleo-testado", ["enrollment-reports"], null, "Parte dos 22 relatórios aguarda fonte persistida ou norma."),
  row(34, "GED de editais, atos e decisões", "nucleo-testado", ["enrollment-ged"], null, NO_WRITER),
  row(35, "Integração Educacenso/Mapa", "persistido", ["network-enrollment-audit"]),
  row(36, "Integração com Diário", "persistido", ["network-enrollment-audit"]),
  row(37, "Painéis da rede", "nucleo-testado", ["occupancy-panel", "network-closure"], HUB),
  row(38, "Segurança, RLS e LGPD", "persistido", ["accessibility-planning"], null, "", [RLS, `${M}/0384_net24_revoke_students_direct_dml.sql`]),
  row(39, "Auditoria e rastreabilidade", "nucleo-testado", ["enrollment-ged", "reservation-ledger"]),
  row(40, "Interface responsiva e acessível", "nucleo-testado", ["network-closure"], HUB, "Verificação móvel autenticada não executada."),
  row(41, "Plano de implementação", "nucleo-testado", ["network-closure"]),
  row(42, "Resultado institucional", "bloqueado", ["network-closure"], null, NO_HUMAN),
];

export const NET_CLOSURE_CRITERIA: readonly NetClosureRow[] = [
  row(1, "Uma pessoa, um estudante", "persistido", ["network-enrollment-audit"], null, "", [RLS]),
  row(2, "Matrícula, participação e enturmação distintas", "persistido", ["temporal-allocation"]),
  row(3, "Temporalidade", "persistido", ["temporal-allocation"]),
  row(4, "Histórico preservado em movimentações", "persistido", ["transfer-flow"]),
  row(5, "Vagas derivadas de capacidade autorizada", "nucleo-testado", ["vacancy-board", "capacity-model"]),
  row(6, "Ausência nunca vira zero", "nucleo-testado", ["occupancy-panel", "enrollment-reports"]),
  row(7, "Fila com critério homologado", "bloqueado", ["waiting-list"], null, "Critério de prioridade não fornecido."),
  row(8, "Reserva concorrente sem sobreocupação", "nucleo-testado", ["reservation-ledger"], null, "Writer do banco ainda não implementado."),
  row(9, "Transferência atômica", "nucleo-testado", ["transfer-flow"]),
  row(10, "Remanejados como grupo próprio", "persistido", ["transfer-flow"]),
  row(11, "Ano seguinte não copia fatos", "nucleo-testado", ["network-simulator"]),
  row(12, "Protocolo idempotente", "nucleo-testado", ["pre-registration"]),
  row(13, "Apoio não exclui matrícula", "nucleo-testado", ["accessibility-planning"]),
  row(14, "Escrita só por writer canônico", "persistido", ["official-confirmation"], null, "", [RLS]),
  row(15, "Leitura por escopo (RLS)", "persistido", ["family-enrollment-portal"], null, "", [RLS]),
  row(16, "Dados sensíveis minimizados", "nucleo-testado", ["pre-registration", "accessibility-planning"]),
  row(17, "Relatórios com fonte, metodologia e data", "nucleo-testado", ["enrollment-reports"]),
  row(18, "Executor técnico nunca aprova", "nucleo-testado", ["enrollment-ged", "school-offer-lifecycle"]),
  row(19, "Simulação não altera a oferta", "nucleo-testado", ["network-simulator"]),
  row(20, "Fluxos homologados pelos responsáveis", "bloqueado", ["network-closure"], null, NO_HUMAN),
];

export function netClosureProblems(exists: (p: string) => boolean): string[] {
  const out: string[] = [];
  for (const r of [...NET_CLOSURE_SECTIONS, ...NET_CLOSURE_CRITERIA]) {
    for (const f of [...r.source, ...r.tests, ...(r.screen ? [r.screen] : [])]) if (!exists(f)) out.push(`${r.n}: ausente ${f}`);
    if (r.status === "bloqueado" && !r.blocker) out.push(`${r.n}: bloqueio sem motivo`);
    if (r.status === "persistido-com-tela" && !r.screen) out.push(`${r.n}: tela não indicada`);
  }
  return out;
}

export const netClosureSummary = (rows: readonly NetClosureRow[]) =>
  rows.reduce<Record<NetClosureStatus, number>>((a, r) => ((a[r.status] += 1), a), { "persistido-com-tela": 0, persistido: 0, "nucleo-testado": 0, bloqueado: 0 });

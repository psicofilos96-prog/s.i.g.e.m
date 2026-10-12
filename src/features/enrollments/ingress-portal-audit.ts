/**
 * SIGEM Matrículas — Portal de Ingresso e Gestão de Vagas — Lote 01: auditoria e fonte única.
 * 45 seções + 22 critérios → fontes canônicas, núcleo existente, tela, status e lacuna. Não cria entidade:
 * reaproveita a Organização da Rede (L02–L24), Secretaria, Família, cadeia B3 e o protocolo único do SIGEM Documentos.
 * Nenhum status "homologado": aprovação humana nunca é afirmada pelo código.
 * Títulos agrupados por tema; a numeração deve ser conferida com o documento do usuário.
 */
import { CANONICAL_ENTITIES, FORBIDDEN_DUPLICATES } from "./network-enrollment-audit";

export type IngressStatus = "existente" | "parcial" | "lacuna" | "bloqueado";
export interface IngressRow { n: number; title: string; status: IngressStatus; tables: readonly string[]; evidence: readonly string[]; gap: string }

const E = "src/features/enrollments";
const SS = "src/features/school-secretariat";
const FP = "src/features/family-portal";
const DM = "src/features/document-management";
const R = "src/routes";
const B3 = "drizzle/migrations/0001_b3_cycle_enrollment_participation_allocation.sql";
const r = (n: number, title: string, status: IngressStatus, gap: string, tables: readonly string[] = [], evidence: readonly string[] = []): IngressRow => ({ n, title, status, gap, tables, evidence });
const NOPERSIST = "Núcleo puro testado; sem tabela/writer no banco nem tela operacional.";

/** Fontes reaproveitadas pelo Portal de Ingresso (além das entidades acadêmicas canônicas). */
export const INGRESS_SOURCES = {
  ...CANONICAL_ENTITIES,
  protocolo: "protocol_registrations",
  protocoloEventos: "protocol_registration_events",
  reservaDeDesignacao: "class_designation_reservations",
} as const;

/** Duplicações encontradas na auditoria e a decisão de fonte única. */
export const DUPLICATIONS = [
  { a: `${SS}/vacancy-center.ts`, b: `${E}/vacancy-board.ts`, decision: "Quadro de vagas canônico = vacancy-board (autorizadas L03 − ocupantes distintos − reservas); vacancy-center fica como leitura da Secretaria sobre `secretariat_class_vacancies_at` até migrar para o mesmo núcleo." },
  { a: `${E}/pre-registration.ts`, b: `${DM}/protocol-registry.ts`, decision: "Protocolo de inscrição não terá sequência própria: persistência futura usa `register_protocol` (protocolo único)." },
] as const;

export const INGRESS_SECTIONS: readonly IngressRow[] = [
  r(1, "Finalidade do Portal de Ingresso", "parcial", "Rede e Secretaria existem; portal público de ingresso não.", [], [`${R}/organizacao-da-rede.tsx`, `${R}/matriculas.tsx`]),
  r(2, "Objetivos", "parcial", "Matrícula/enturmação operam; inscrição, fila e reserva sem persistência.", [], [`${E}/network-closure.ts`]),
  r(3, "Princípio: fonte única", "existente", "", Object.values(CANONICAL_ENTITIES), [`${E}/network-enrollment-audit.ts`]),
  r(4, "Conceitos: estudante, matrícula, participação, enturmação", "existente", "", ["institutional_students", "school_enrollments", "cycle_participations", "class_enrollment_episodes"], [B3]),
  r(5, "Atores e competências", "parcial", "Capacidades por etapa só configuradas; nenhuma atribuída.", [], [`${E}/vacancy-requests.ts`]),
  r(6, "Oferta por escola", "parcial", NOPERSIST, [], [`${E}/school-offer-lifecycle.ts`]),
  r(7, "Capacidade instalada/operacional/autorizada", "parcial", "Só `class_capacity_records` persistido; autorizada L03 sem writer.", ["class_capacity_records"], [`${E}/capacity-model.ts`]),
  r(8, "Planejamento de turmas", "parcial", NOPERSIST, [], [`${E}/class-planning.ts`]),
  r(9, "Quadro de vagas", "parcial", "Dois núcleos (ver DUPLICATIONS); sem ledger de vagas.", [], [`${E}/vacancy-board.ts`, `${SS}/vacancy-center.ts`]),
  r(10, "Tela de vagas da Secretaria", "existente", "", [], [`${R}/secretaria_.vagas.tsx`]),
  r(11, "Campanhas de matrícula", "parcial", NOPERSIST, [], [`${E}/enrollment-campaigns.ts`]),
  r(12, "Edital e calendário da campanha", "bloqueado", "Edital e prazos exigem ato e política homologada da rede."),
  r(13, "Critérios de prioridade", "bloqueado", "Nenhum critério homologado registrado; motor recusa sem ele.", [], [`${E}/distribution-engine.ts`]),
  r(14, "Inscrição pública (pré-matrícula)", "parcial", NOPERSIST, [], [`${E}/pre-registration.ts`]),
  r(15, "Identificação do candidato sem duplicar pessoa", "parcial", "CPF por HMAC e candidatos fortes/fracos; sem writer.", ["institutional_persons"], [`${E}/pre-registration.ts`]),
  r(16, "Responsável e vínculo", "existente", "", ["guardian_authorizations"], [`${FP}/guardian-link.ts`]),
  r(17, "Documentos da inscrição", "parcial", "Caminho privado declarado; bucket e política não criados.", [], [`${E}/pre-registration.ts`]),
  r(18, "Protocolo de inscrição", "parcial", "Protocolo único existe; inscrição ainda não o usa.", ["protocol_registrations"], [`${DM}/protocol-registry.ts`]),
  r(19, "Consulta pública do protocolo", "lacuna", "Sem rota pública; deve responder só situação."),
  r(20, "Solicitações de vaga", "parcial", NOPERSIST, [], [`${E}/vacancy-requests.ts`]),
  r(21, "Conferência e análise", "parcial", NOPERSIST, [], [`${E}/vacancy-requests.ts`]),
  r(22, "Distribuição/classificação", "parcial", "Proposta com `writes: []`; aprovação sem writer.", [], [`${E}/distribution-engine.ts`]),
  r(23, "Empates", "existente", "", [], [`${E}/distribution-engine.ts`]),
  r(24, "Reservas de vaga", "parcial", "Contrato compare-and-set testado; writer com lock ausente.", [], [`${E}/reservation-ledger.ts`]),
  r(25, "Listas de espera", "parcial", NOPERSIST, [], [`${E}/waiting-list.ts`]),
  r(26, "Convocação e comunicação", "parcial", "Sem provedor externo; notificação só pela camada única.", [], [`${E}/vacancy-requests.ts`]),
  r(27, "Confirmação pelo responsável", "parcial", NOPERSIST, [], [`${E}/official-confirmation.ts`]),
  r(28, "Matrícula oficial", "existente", "", ["school_enrollments"], [B3, `${R}/matriculas.tsx`]),
  r(29, "Matrícula guiada da escola", "existente", "", [], [`${R}/matriculas.nova.tsx`, "drizzle/migrations/0212_n5_2_1_enrollment_wizard.sql"]),
  r(30, "Enturmação temporal", "existente", "", ["class_enrollment_episodes"], [`${E}/temporal-allocation.ts`]),
  r(31, "Transferências", "parcial", "Fluxo testado; efetivação pelo writer B3 existente.", ["student_movement_events"], [`${E}/transfer-flow.ts`]),
  r(32, "Remanejamento", "parcial", "Grupamento próprio no Mapa; sem fluxo dedicado no portal.", ["student_movement_events"]),
  r(33, "Educação Infantil (creche/pré)", "bloqueado", "Data de corte e faixas exigem regra homologada.", [], [`${E}/early-childhood.ts`]),
  r(34, "Fundamental e EJA semestral", "parcial", "Janelas só do calendário aplicável.", [], [`${E}/fundamental-eja.ts`]),
  r(35, "Inclusão/NEI na inscrição", "parcial", "Texto clínico recusado; atendimento segue no NEI.", [], [`${E}/accessibility-planning.ts`]),
  r(36, "Transporte e território", "parcial", "Mapa só agregado; sem provedor de mapa.", [], [`${E}/territorial-map.ts`]),
  r(37, "Ocupação e alertas", "parcial", "Projeção pura; limiar sem homologação.", [], [`${E}/occupancy-panel.ts`]),
  r(38, "Portal da Família", "existente", "", ["guardian_authorizations"], [`${FP}/family-access.ts`, `${R}/familia.tsx`]),
  r(39, "Acompanhamento pela família", "parcial", "Consulta da própria posição testada; sem persistência.", [], [`${E}/family-enrollment-portal.ts`]),
  r(40, "Simulador de vagas", "existente", "", [], [`${E}/network-simulator.ts`]),
  r(41, "Relatórios", "parcial", "Definições catalogadas; sem dados persistidos para inscrição.", [], [`${E}/enrollment-reports.ts`]),
  r(42, "GED e atos", "parcial", "Atos pelo SIGEM Documentos.", [], [`${E}/enrollment-ged.ts`]),
  r(43, "Painel e telas", "parcial", "Hub da rede existe; telas do ingresso não.", [], [`${E}/network-hub-page.tsx`]),
  r(44, "Integração externa (Educacenso/estadual)", "bloqueado", "Sem leiaute e contrato reais."),
  r(45, "Fechamento e evidências", "lacuna", "Lote 24."),
];

const K = (n: number, title: string, status: IngressStatus, evidence: readonly string[] = [], gap = ""): IngressRow => ({ n, title, status, tables: [], evidence, gap });
export const INGRESS_CRITERIA: readonly IngressRow[] = [
  K(1, "Estudante só do cadastro canônico", "existente", [`${E}/network-enrollment-audit.test.ts`]),
  K(2, "Nenhuma tabela duplicada de estudante/matrícula/vaga", "existente", [`${E}/ingress-portal-audit.test.ts`]),
  K(3, "Inscrição nunca cria matrícula nem pessoa", "existente", [`${E}/pre-registration.ts`]),
  K(4, "Protocolo único e idempotente", "parcial", [`${DM}/protocol-registry.ts`], "Inscrição ainda não usa o protocolo único."),
  K(5, "Vaga só de capacidade autorizada", "parcial", [`${E}/vacancy-board.ts`], "Autorizada sem writer."),
  K(6, "Disponível sem dupla contagem", "existente", [`${E}/vacancy-board.ts`]),
  K(7, "Reserva concorrente com lock", "parcial", [`${E}/reservation-ledger.ts`], "Lock no banco ausente."),
  K(8, "Critério só homologado", "existente", [`${E}/distribution-engine.ts`]),
  K(9, "Empate nunca decidido pelo sistema", "existente", [`${E}/distribution-engine.ts`]),
  K(10, "Aprovador ≠ gerador/proponente", "existente", [`${E}/distribution-engine.ts`]),
  K(11, "Autoria = pessoa natural da sessão", "existente", [`${E}/school-offer-lifecycle.ts`]),
  K(12, "Família vê só a própria posição", "existente", [`${E}/waiting-list.ts`]),
  K(13, "CPF/contato só por HMAC", "existente", [`${E}/pre-registration.ts`]),
  K(14, "Sem texto clínico na inscrição", "existente", [`${E}/pre-registration.ts`]),
  K(15, "Documentos em caminho privado", "parcial", [`${E}/pre-registration.ts`], "Bucket/política não criados."),
  K(16, "Ausência nunca vira zero", "existente", [`${E}/occupancy-panel.ts`]),
  K(17, "Matrícula/enturmação só pelos writers B3", "existente", [B3]),
  K(18, "RLS e sem DML direta", "existente", ["drizzle/migrations/0384_net24_revoke_students_direct_dml.sql"]),
  K(19, "Consulta pública sem dado pessoal", "lacuna", [], "Rota pública não existe."),
  K(20, "Exportação auditada", "parcial", [`${E}/enrollment-reports.ts`], "Telas ainda não exportam pela trilha de emissões."),
  K(21, "Simulação nunca altera oferta oficial", "existente", [`${E}/network-simulator.ts`]),
  K(22, "Evidência SQL/TS/E2E", "parcial", [`${E}/ingress-portal-audit.test.ts`], "E2E autenticado não executado."),
];

export const ingressSummary = (rows: readonly IngressRow[]) =>
  rows.reduce<Record<IngressStatus, number>>((a, x) => ({ ...a, [x.status]: a[x.status] + 1 }), { existente: 0, parcial: 0, lacuna: 0, bloqueado: 0 });

export function ingressAuditProblems(exists: (p: string) => boolean): string[] {
  const p: string[] = [];
  if (INGRESS_SECTIONS.length !== 45 || INGRESS_CRITERIA.length !== 22) p.push("Esperadas 45 seções e 22 critérios.");
  for (const x of [...INGRESS_SECTIONS, ...INGRESS_CRITERIA]) {
    if (x.status === "existente" && x.evidence.length === 0) p.push(`#${x.n} existente sem evidência`);
    if (x.status !== "existente" && !x.gap) p.push(`#${x.n} sem lacuna descrita`);
    for (const e of x.evidence) if (!exists(e)) p.push(`#${x.n}: evidência ausente ${e}`);
  }
  for (const d of DUPLICATIONS) if (!exists(d.a) || !exists(d.b)) p.push(`duplicação citada sem arquivo: ${d.a}`);
  return p;
}
export { FORBIDDEN_DUPLICATES };

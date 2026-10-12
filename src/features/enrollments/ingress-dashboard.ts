// Matrículas L23 — painel de distribuição/ocupação, mapa agregado, recursos e 24 relatórios (migration 0476).
// Tudo é projeção lida na hora dos ledgers canônicos (`enr_ingress_dashboard`); nada é gravado. As quatro unidades
// (solicitações, estudantes, reservas, matrículas) nunca se somam nem se substituem, porque misturá-las criaria número falso.
import { buildTerritorialMap, type PrivacyPolicy, type SchoolPlace } from "./territorial-map";

export type Unit = "solicitacoes" | "estudantes" | "reservas" | "matriculas" | "vagas" | "recursos";
export interface DashboardRow {
  cell_key: string; school_key: string; authorized: number | null; reservations_active: number | null;
  confirmed: number | null; requests: number | null; students: number | null; enrollments: number | null; read_at: string;
}

/** Disponível só com autorizada e ocupação lidas; nunca negativo escondido. */
export function cellView(r: DashboardRow) {
  const available = r.authorized === null || r.reservations_active === null ? null : r.authorized - r.reservations_active;
  const rate = r.authorized && r.reservations_active !== null ? r.reservations_active / r.authorized : null;
  return { ...r, available, occupancyRate: rate, overbooked: available !== null && available < 0 };
}

/** Totais por unidade: só somam quando TODAS as linhas têm o dado; estudantes por escola não somam como rede. */
export function totals(rows: readonly DashboardRow[]) {
  const sum = (k: keyof DashboardRow) => rows.length && rows.every((r) => typeof r[k] === "number") ? rows.reduce((a, r) => a + (r[k] as number), 0) : null;
  return {
    solicitacoes: sum("requests"), reservas: sum("reservations_active"), matriculas: sum("enrollments"), vagas: sum("authorized"),
    estudantes: null as number | null, estudantesNota: "Estudantes distintos são contados por escola; a soma entre escolas não é o total da rede.",
  };
}

export function territorialView(places: readonly SchoolPlace[], rows: readonly DashboardRow[], policy: PrivacyPolicy) {
  const by = new Map<string, { authorized: number | null; occupants: number | null }>();
  for (const r of rows) {
    const p = by.get(r.school_key) ?? { authorized: 0, occupants: 0 };
    by.set(r.school_key, {
      authorized: p.authorized === null || r.authorized === null ? null : p.authorized + r.authorized,
      occupants: p.occupants === null || r.reservations_active === null ? null : p.occupants + r.reservations_active,
    });
  }
  const ind = [...by].map(([schoolId, v]) => ({ schoolId, ...v, available: v.authorized === null || v.occupants === null ? null : v.authorized - v.occupants, waiting: null }));
  const demand = rows.map((r) => ({ schoolId: r.school_key, districtCode: places.find((p) => p.schoolId === r.school_key)?.districtCode ?? "sem-distrito", count: r.requests ?? 0 }));
  return buildTerritorialMap(places, ind, demand, {}, policy);
}

// Recursos/revisões/exceções: estado é projeção do ledger.
export interface AppealEvent { appeal_id: string; seq: number; kind: "recurso" | "revisao" | "excecao"; action: "registrar" | "analisar" | "deferir" | "indeferir"; person_id: string; act_ref: string | null }
export function appealState(events: readonly AppealEvent[]) {
  const last = [...events].sort((a, b) => b.seq - a.seq)[0];
  if (!last) return "inexistente" as const;
  return ({ registrar: "registrado", analisar: "em-analise", deferir: "deferido", indeferir: "indeferido" } as const)[last.action];
}

export interface IngressReport { id: string; title: string; unit: Unit; source: string; methodology: string; filters: readonly string[]; referenceDate: "leitura" | "data-informada"; dependency?: string }
const F = ["campanha", "escola", "etapa", "modalidade", "periodo"] as const;
const R = (id: string, title: string, unit: Unit, source: string, methodology: string, dependency?: string): IngressReport =>
  ({ id, title, unit, source, methodology, filters: F, referenceDate: "leitura", ...(dependency ? { dependency } : {}) });

export const INGRESS_REPORTS: readonly IngressReport[] = [
  R("r01", "Solicitações por campanha", "solicitacoes", "enr_applications", "Contagem de pedidos enviados; um estudante pode ter vários."),
  R("r02", "Solicitações por escola preferida", "solicitacoes", "enr_applications", "Pedidos pela 1ª escola preferida."),
  R("r03", "Solicitações por etapa e modalidade", "solicitacoes", "enr_applications", "Pedidos por etapa/modalidade declaradas."),
  R("r04", "Solicitações por tipo de requerente", "solicitacoes", "enr_applications", "Responsável × estudante adulto."),
  R("r05", "Solicitações por atendimento assistido", "solicitacoes", "enr_assisted_attendances", "Pedidos com atendente identificado, por canal."),
  R("r06", "Estudantes distintos por escola", "estudantes", "enr_applications", "Distintos por CPF (HMAC) ou nome+nascimento; não somáveis entre escolas."),
  R("r07", "Estudantes com mais de um pedido", "estudantes", "enr_applications", "Distintos com 2+ pedidos na campanha."),
  R("r08", "Estudantes reconciliados", "estudantes", "enr_student_reconciliations", "Reconciliações supervisionadas registradas."),
  R("r09", "Vagas autorizadas por célula", "vagas", "enr_seat_pool_versions", "Última versão por célula, com ato."),
  R("r10", "Ocupação por célula", "reservas", "enr_seat_occupancy", "Reservas vigentes + confirmadas na hora da leitura."),
  R("r11", "Vagas disponíveis por célula", "vagas", "enr_ingress_dashboard", "Autorizadas − ocupação; ausente se qualquer parcela ausente."),
  R("r12", "Reservas ativas", "reservas", "enr_seat_events", "Reservar sem liberar/confirmar e não expiradas."),
  R("r13", "Reservas confirmadas", "reservas", "enr_seat_events", "Eventos confirmar."),
  R("r14", "Reservas liberadas e expiradas", "reservas", "enr_seat_events", "Liberar com motivo + vencidas sem confirmação."),
  R("r15", "Aceites familiares", "reservas", "enr_family_acceptances", "Manifestações registradas pelo portal."),
  R("r16", "Validações administrativas", "reservas", "enr_admin_validations", "Validações com comprovante."),
  R("r17", "Matrículas formalizadas pela Secretaria", "matriculas", "enr_formalization_links", "Vínculos a matrícula canônica criada pela Secretaria."),
  R("r18", "Enturmações do ingresso", "matriculas", "enr_allocation_links", "Enturmações pelo writer canônico."),
  R("r19", "Transferências do ingresso", "matriculas", "enr_transfer_events", "Último evento por transferência."),
  R("r20", "Lista de espera por célula", "estudantes", "enr_waitlist_versions", "Versão vigente; sem nomes para a família."),
  R("r21", "Convocações da lista de espera", "reservas", "enr_waitlist_calls", "Convocações via reserva canônica."),
  R("r22", "Recursos, revisões e exceções", "recursos", "enr_appeal_events", "Estado = último evento; deferimento com ato e decisor ≠ autor."),
  R("r23", "Encaminhamentos de apoio por destino", "solicitacoes", "enr_support_referrals", "Só código, escola e tipo; nunca critério de vaga."),
  R("r24", "Demanda territorial agregada", "solicitacoes", "enr_ingress_dashboard", "Por distrito com supressão por limiar declarado.", "limiar-de-supressao-aprovado"),
];

export function canRun(r: IngressReport, approved: ReadonlySet<string>) {
  return !r.dependency || approved.has(r.dependency) ? { ok: true as const } : { ok: false as const, reason: `Depende de: ${r.dependency}` };
}

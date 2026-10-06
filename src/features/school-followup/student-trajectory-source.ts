/**
 * Ficha longitudinal (AB.2): leitura única por `student_trajectory_at` (reader do banco, escopo
 * e capacidade revalidados lá). Esta camada só valida o formato e projeta para a tela/relatório;
 * não guarda cópia nem agrega, porque tabela paralela criaria segunda verdade.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CellValue, ReportDefinition } from "@/features/reports/report-engine";

export const TRAJECTORY_DOMAINS = ["matricula", "alocacao", "movimentacao", "frequencia", "avaliacao", "fechamento", "acompanhamento"] as const;
export type TrajectoryDomain = (typeof TRAJECTORY_DOMAINS)[number];
export type DomainState = "nao-solicitado" | "nao-autorizado" | "com-fatos" | "sem-fatos-legiveis";

export const DOMAIN_LABEL: Record<TrajectoryDomain, string> = {
  matricula: "Matrícula", alocacao: "Turma", movimentacao: "Movimentação", frequencia: "Frequência",
  avaliacao: "Avaliação", fechamento: "Fechamento", acompanhamento: "Acompanhamento pedagógico",
};
export const DOMAIN_STATE_LABEL: Record<DomainState, string> = {
  "nao-solicitado": "Não incluído no filtro",
  "nao-autorizado": "Sua atuação não autoriza esta consulta",
  "com-fatos": "Com registros",
  "sem-fatos-legiveis": "Nenhum registro legível — isso não significa zero",
};

export type TrajectoryEvent = Readonly<{
  domain: TrajectoryDomain; on: string; label: string; schoolId: string | null; classId: string | null;
  source: string; sourceId: string; knownAt: string; mark: string | null; value: unknown; returnOn: string | null;
}>;
export type Trajectory =
  | Readonly<{ result: "ok"; studentId: string; asOf: string; knownAt: string; domains: Record<TrajectoryDomain, DomainState>; events: readonly TrajectoryEvent[]; alertsState: string }>
  | Readonly<{ result: "access-denied" }>
  | Readonly<{ result: "unavailable"; reason: string }>;

const str = (v: unknown) => (typeof v === "string" ? v : null);

/** Valida o JSON do reader; qualquer formato inesperado ⇒ indisponível (nunca preencher lacunas). */
export function parseTrajectory(raw: unknown): Trajectory {
  if (!raw || typeof raw !== "object") return { result: "unavailable", reason: "Resposta vazia do banco." };
  const o = raw as Record<string, unknown>;
  if (o["result"] === "access-denied") return { result: "access-denied" };
  if (o["result"] !== "ok") return { result: "unavailable", reason: "Resposta não reconhecida." };
  const d = (o["domains"] ?? {}) as Record<string, unknown>;
  const domains = {} as Record<TrajectoryDomain, DomainState>;
  for (const k of TRAJECTORY_DOMAINS) {
    const s = d[k];
    domains[k] = s === "nao-solicitado" || s === "nao-autorizado" || s === "com-fatos" || s === "sem-fatos-legiveis" ? s : "sem-fatos-legiveis";
  }
  const events: TrajectoryEvent[] = [];
  for (const e of Array.isArray(o["events"]) ? o["events"] : []) {
    const r = e as Record<string, unknown>;
    const domain = r["domain"] as TrajectoryDomain;
    if (!TRAJECTORY_DOMAINS.includes(domain) || !str(r["on"]) || !str(r["source"]) || r["source_id"] == null) continue;
    events.push({
      domain, on: str(r["on"])!, label: str(r["label"]) ?? "", schoolId: str(r["school_id"]), classId: str(r["class_id"]),
      source: str(r["source"])!, sourceId: String(r["source_id"]), knownAt: str(r["known_at"]) ?? "",
      mark: str(r["mark"]), value: r["value"] ?? null, returnOn: str(r["return_on"]),
    });
  }
  events.sort((a, b) => (a.on === b.on ? a.domain.localeCompare(b.domain) : a.on.localeCompare(b.on)));
  const alerts = (o["alerts"] ?? {}) as Record<string, unknown>;
  return { result: "ok", studentId: String(o["student_id"] ?? ""), asOf: String(o["as_of"] ?? ""), knownAt: String(o["known_at"] ?? ""), domains, events, alertsState: str(alerts["state"]) ?? "bloqueado-sem-regra-homologada" };
}

export async function readStudentTrajectory(args: { studentId: string; asOf: string; knownAt?: string | null; yearId?: string | null; periodId?: string | null; domains?: readonly TrajectoryDomain[] | null }): Promise<Trajectory> {
  const { data, error } = await supabase.rpc("student_trajectory_at", {
    _student: args.studentId, _as_of: args.asOf, _known_at: args.knownAt ?? undefined,
    _year: args.yearId ?? undefined, _period: args.periodId ?? undefined,
    _domains: args.domains && args.domains.length ? [...args.domains] : undefined,
  } as never);
  if (error) return { result: "unavailable", reason: "O banco não devolveu a ficha agora." };
  return parseTrajectory(data);
}

/** Texto do valor bruto: marca ausente = pendente (nunca falta); valor ausente ≠ zero. */
export function eventValueText(e: TrajectoryEvent): string | null {
  if (e.domain === "frequencia") return e.mark ?? "Sem marcação (pendente)";
  if (e.domain === "avaliacao") {
    const v = e.value as { value?: unknown } | null;
    if (v == null) return "Sem resultado registrado";
    return v.value !== undefined ? String(v.value) : JSON.stringify(v);
  }
  return null;
}

export const FICHA_LONGITUDINAL: ReportDefinition = {
  id: "ficha-longitudinal-aluno", version: 1, title: "Ficha longitudinal do aluno",
  description: "Linha do tempo autorizada (matrícula, turma, movimentação, frequência, avaliação, fechamento e acompanhamento) com proveniência; sem nome, texto livre ou conteúdo de registro.",
  source: "student_trajectory_at (escopo e capacidade revalidados no banco)",
  params: [{ id: "asOf", label: "Data de referência", type: "date", required: true }],
  columns: [
    { id: "data", label: "data", kind: "date" }, { id: "dominio", label: "dominio", kind: "text" },
    { id: "evento", label: "evento", kind: "text" }, { id: "valor", label: "valor", kind: "text" },
    { id: "escola", label: "escola", kind: "text" }, { id: "turma", label: "turma", kind: "text" },
    { id: "fonte", label: "fonte", kind: "text" }, { id: "registro", label: "registro", kind: "text" },
    { id: "conhecido_em", label: "conhecido_em", kind: "text" },
  ],
  formats: ["csv"], reproducible: false, syncRowLimit: 5000,
};

export function trajectoryRows(t: Trajectory): Record<string, CellValue>[] {
  if (t.result !== "ok") return [];
  return t.events.map((e) => ({
    data: e.on, dominio: DOMAIN_LABEL[e.domain], evento: e.label || null, valor: eventValueText(e),
    escola: e.schoolId, turma: e.classId, fonte: e.source, registro: e.sourceId, conhecido_em: e.knownAt || null,
  }));
}

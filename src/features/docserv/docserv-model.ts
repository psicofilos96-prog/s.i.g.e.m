/** DocServ no SIGEM (LOTE 01): papéis vêm de capacidades e da pessoa canônica, nunca de "tipo de usuário" do DocServ. */
export type DocservContext = { person_id: string | null; servidor: boolean; escola_schools: string[]; nie: boolean };
export type Outcome = "vinculado" | "ambiguo" | "sem-correspondencia" | "descartado";
export type QueueItem = {
  key: string; seq: number; kind: "servidor" | "escola"; outcome: Outcome; matricula: string | null; cpf: boolean; inep: string | null;
  candidates: { person_id?: string; school_id?: string; via?: string }[]; masked_names: string[] | null; manual: boolean; recorded_at: string;
};

/** Mapa de rotas do DocServ de origem → painel nativo SIGEM. */
export const ORIGIN_ROUTE_MAP = [
  { origin: "/dashboard/servidor", panel: "servidor", requires: "pessoa natural vinculada à conta" },
  { origin: "/dashboard/escola", panel: "escola", requires: "gerir-documentos-funcionais na escola" },
  { origin: "/dashboard/nie", panel: "rede", requires: "administrar-docserv na rede" },
] as const;

export type Panel = (typeof ORIGIN_ROUTE_MAP)[number]["panel"];

export function availablePanels(c: DocservContext | null): Panel[] {
  if (!c) return [];
  const out: Panel[] = [];
  if (c.servidor && c.person_id) out.push("servidor");
  if (c.escola_schools.length > 0) out.push("escola");
  if (c.nie) out.push("rede");
  return out;
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  vinculado: "vinculado", ambiguo: "ambíguo — decidir manualmente", "sem-correspondencia": "sem correspondência", descartado: "descartado",
};

/** CPF só é aceito com 11 dígitos; nunca sai do formulário além da chamada ao servidor (lá vira HMAC). */
export const cpfDigits = (v: string) => { const d = v.replace(/\D/g, ""); return d.length === 11 ? d : null; };

export function needsManualDecision(q: QueueItem) { return q.outcome === "ambiguo"; }

/** Rotas de API do DocServ e situação no SIGEM — evita prometer o que ainda não foi portado. */
export const API_PORT_STATUS: { route: string; status: "portado" | "pendente"; lote: string }[] = [
  { route: "servidores/buscar + vínculos (identidade)", status: "portado", lote: "01" },
  { route: "escolas (identidade INEP)", status: "portado", lote: "01" },
  { route: "servidores/cadastrar", status: "pendente", lote: "cadastro canônico do SIGEM — não duplicar pessoas" },
  { route: "upload presigned-url", status: "pendente", lote: "02" },
  { route: "documentos confirmar/revisar/excluir/excluir-permanente", status: "pendente", lote: "02" },
  { route: "documentos download-url/download-zip", status: "pendente", lote: "02" },
  { route: "alertas marcar-lido", status: "pendente", lote: "03" },
  { route: "vinculação-anual confirmar, solicitações, desvinculação", status: "pendente", lote: "03" },
  { route: "scripts de importação", status: "pendente", lote: "importação governada (staging)" },
];

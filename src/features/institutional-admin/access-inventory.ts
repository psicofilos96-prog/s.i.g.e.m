import type { CellValue, ReportDefinition } from "@/features/reports/report-engine";

/** Linha do inventário vinda de `access_center_inventory()` (já autorizada no banco). */
export type InventoryRow = Readonly<{
  user_id: string; login: string | null; account_kind: string; station_code: string | null; scope_kind: string | null;
  school_id: string | null; school_name: string | null; inep: string | null; revoked: boolean; banned: boolean;
  last_sign_in_at: string | null; created_at: string | null; origin: string | null; person_name: string | null;
}>;

export const KIND_LABEL: Record<string, string> = {
  setorial: "Conta de setor", orgao: "Órgão institucional", humano: "Pessoa", tecnico: "Técnica (sem vínculo)",
};
export const STATION_LABEL: Record<string, string> = {
  ciece: "CIECE / Estatística", supervisao: "Supervisão Escolar", alimentacao: "Alimentação Escolar",
  avaliacao: "Acompanhamento e Avaliação", orientacao_pedagogica: "Orientação Pedagógica",
  direcao_escolar: "Direção Escolar", secretaria_escolar: "Secretaria Escolar", administracao_geral: "Administração Geral",
};

export const kindLabel = (k: string) => KIND_LABEL[k] ?? k;
export const stationLabel = (s: string | null) => (s ? (STATION_LABEL[s] ?? s) : "Sem estação");
export const scopeLabel = (r: InventoryRow) =>
  r.scope_kind === "network" ? "Toda a rede" : r.school_name ? r.school_name : r.scope_kind === "school" ? "Uma escola" : "Não definido";

export type AccessState = "ativa" | "revogada" | "bloqueada";
export const accessState = (r: InventoryRow): AccessState => (r.revoked ? "revogada" : r.banned ? "bloqueada" : "ativa");
export const STATE_LABEL: Record<AccessState, string> = { ativa: "Pode entrar", revogada: "Acesso revogado", bloqueada: "Bloqueada" };

export type InventoryFilter = Readonly<{ station?: string; school?: string; kind?: string; state?: AccessState; text?: string }>;

export function filterInventory(rows: readonly InventoryRow[], f: InventoryFilter): InventoryRow[] {
  const t = f.text?.trim().toLowerCase();
  return rows.filter((r) =>
    (!f.station || r.station_code === f.station) &&
    (!f.school || r.school_id === f.school) &&
    (!f.kind || r.account_kind === f.kind) &&
    (!f.state || accessState(r) === f.state) &&
    (!t || [r.login, r.school_name, r.inep, r.person_name].some((v) => v?.toLowerCase().includes(t))));
}

/** Lote só de contas de setor que podem entrar; as demais exigem ação individual. */
export function resetEligibility(selected: readonly InventoryRow[]): { ok: true } | { ok: false; reason: string } {
  if (selected.length === 0) return { ok: false, reason: "Escolha ao menos uma conta." };
  if (selected.some((r) => r.revoked)) return { ok: false, reason: "Conta com acesso revogado não recebe senha nova." };
  if (selected.length > 1 && selected.some((r) => r.account_kind !== "setorial"))
    return { ok: false, reason: "Em lote, só contas de setor. Para pessoas, órgãos ou contas técnicas, redefina uma de cada vez." };
  return { ok: true };
}

export const PASSWORD_MIN = 12;
export function passwordProblem(p: string, confirm: string): string | null {
  if (p.length < PASSWORD_MIN) return `Use pelo menos ${PASSWORD_MIN} caracteres.`;
  if (p.length > 128) return "Senha longa demais.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Misture letras e números.";
  if (p !== confirm) return "As duas senhas não são iguais.";
  return null;
}

export const LOGINS_REPORT: ReportDefinition = {
  id: "inventario-de-logins", version: 1, title: "Inventário de logins do SIGEM",
  description: "Todas as contas de acesso, classificadas por tipo, estação e escopo. Sem senhas, hashes ou tokens.",
  source: "access_center_inventory()",
  params: [],
  columns: [
    { id: "login", label: "Login", kind: "text" },
    { id: "tipo", label: "Tipo", kind: "text" },
    { id: "estacao", label: "Estação/perfil", kind: "text" },
    { id: "escopo", label: "Escopo", kind: "text" },
    { id: "escola", label: "Escola", kind: "text" },
    { id: "inep", label: "INEP", kind: "text" },
    { id: "situacao", label: "Situação", kind: "text" },
    { id: "ultimo_acesso", label: "Último acesso", kind: "date" },
    { id: "criada_em", label: "Criada em", kind: "date" },
    { id: "origem", label: "Origem/provisionamento", kind: "text" },
  ],
  formats: ["csv", "xlsx"], reproducible: false, syncRowLimit: 5000,
};

export function exportRows(rows: readonly InventoryRow[]): Record<string, CellValue>[] {
  return rows.map((r) => ({
    login: r.login, tipo: kindLabel(r.account_kind), estacao: r.station_code ? stationLabel(r.station_code) : null,
    escopo: r.scope_kind === "network" ? "Rede" : r.scope_kind === "school" ? "Escola" : null,
    escola: r.school_name, inep: r.inep, situacao: STATE_LABEL[accessState(r)],
    ultimo_acesso: r.last_sign_in_at?.slice(0, 10) ?? null, criada_em: r.created_at?.slice(0, 10) ?? null, origem: r.origin,
  }));
}

export function humanizeAccessError(msg: string): string {
  if (msg.includes("not-holder")) return "Só o Administrador Geral pode usar esta área.";
  if (msg.includes("bulk-only-sector")) return "Em lote, só contas de setor.";
  if (msg.includes("revoked")) return "Há conta com acesso revogado na seleção.";
  if (msg.includes("unknown-account")) return "Alguma conta não existe mais. Atualize a lista.";
  if (msg.includes("too-many")) return "Seleção grande demais (máximo 500).";
  return "Não foi possível concluir. Nada foi alterado.";
}

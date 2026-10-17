/** Proteção judicial do estudante (0557): alerta operacional separado do conteúdo sigiloso. */
export type ProtectionKind = "impedimento-de-retirada" | "medida-protetiva" | "guarda-judicial";
export type ProtectionAlert = { measure_id: string; seq: number; kind: ProtectionKind; restricted_person: string | null; valid_from: string; valid_until: string | null; active: boolean };

export const PROTECTION_KIND_LABEL: Record<ProtectionKind, string> = {
  "impedimento-de-retirada": "Impedimento de retirada", "medida-protetiva": "Medida protetiva", "guarda-judicial": "Guarda definida judicialmente",
};

/** Caminho privado: <escola>/<aluno>/<id>-<nome seguro>; o banco recusa documento de outra escola. */
export function protectionDocPath(school: string, student: string, id: string, fileName: string): string {
  const safe = fileName.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80) || "documento";
  return `${school}/${student}/${id}-${safe}`;
}

/** Vigente: não encerrada e dentro do período (mesma regra do banco). */
export function isActive(fromOn: string, until: string | null, ended: boolean, today: string): boolean {
  return !ended && fromOn <= today && (until == null || until >= today);
}

export const PROTECTION_MESSAGES: Record<string, string> = {
  "protection:capability-missing": "Sua conta não pode registrar ou ver medidas desta escola.",
  "protection:person-required": "Informe o nome da pessoa impedida de retirar o aluno.",
  "protection:reason-required": "Escreva o motivo (pelo menos 5 letras).",
  "protection:stale-base": "A medida mudou enquanto você trabalhava. Recarregue e tente de novo.",
  "protection:transition-invalid": "Esta medida já está encerrada.",
  "protection:file-type": "Envie o documento em PDF ou foto.",
  "protection:upload": "Não foi possível enviar o documento.",
  "protection:document-path": "Documento fora da pasta da escola.",
  "protection:date-invalid": "Informe a data de início.",
};

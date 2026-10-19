// Direção — resumo executivo: projeção pura de leituras já autorizadas (vagas, Mapa do mês, ocorrências).
// Leitura falha = null ("não disponível"), nunca zero; capacidade não informada fica fora das contas e é contada à parte.

export type VacancyRow = { class_id: string; capacity: number | null; occupancy: number | null };
export function vacancySummary(rows: VacancyRow[] | null) {
  if (!rows) return null;
  let open = 0, full = 0, over = 0, unknown = 0;
  for (const r of rows) {
    if (r.capacity == null || r.occupancy == null) unknown++;
    else if (r.occupancy > r.capacity) over++;
    else if (r.occupancy === r.capacity) full++;
    else open++;
  }
  return { open, full, over, unknown, total: rows.length };
}

export const MAP_STAGE_LABEL: Record<string, string> = {
  rascunho: "Em preenchimento", enviado: "Enviado", reenviado: "Reenviado", devolvido: "Devolvido", aprovado: "Aprovado", "em-retificacao": "Em retificação",
};
export function mapStageLabel(stage: string | null, opened: boolean, frozen: boolean): string {
  if (frozen) return "Fechado (congelado)";
  if (!opened) return "Ainda não aberto";
  return (stage && MAP_STAGE_LABEL[stage]) ?? "Situação não reconhecida";
}

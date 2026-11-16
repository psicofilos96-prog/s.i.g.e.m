export function FollowupSituationBadge({ situation, overdue = false }: { situation: string; overdue?: boolean }) {
  const tone = overdue ? "bg-destructive/10 text-destructive" : situation === "concluída" ? "bg-success/10 text-success-foreground" : situation === "sem atualização" ? "bg-warning/15 text-warning-foreground" : "bg-info/10 text-info-foreground";
  return <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${tone}`}>{overdue ? "Prazo vencido" : situation}</span>;
}
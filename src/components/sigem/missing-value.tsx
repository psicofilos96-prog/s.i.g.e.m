import { cn } from "@/lib/utils";

/** Ausência visual discreta; o motivo permanece disponível em tooltip e para leitores de tela. */
export function MissingValue({ label = "Informação não registrada", className }: { label?: string; className?: string }) {
  return <span aria-label={label} title={label} className={cn("inline-block text-muted-foreground/60", className)}>—</span>;
}

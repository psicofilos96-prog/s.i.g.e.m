/** Tipos de visitante "Padrão do sistema" — espelho de `school_visit_default_kinds()` no banco. */
export const VISITOR_KIND_DEFAULTS = [
  { id: "supervisao-escolar", label: "Supervisão Escolar" },
  { id: "orientacao-pedagogica", label: "Orientação Pedagógica" },
  { id: "nei", label: "NEI" },
  { id: "ciece", label: "CIECE" },
  { id: "acompanhamento-institucional", label: "Acompanhamento das Unidades" },
  { id: "gabinete", label: "Gabinete" },
  { id: "conselho-tutelar", label: "Conselho Tutelar" },
  { id: "ministerio-publico", label: "Ministério Público" },
  { id: "vigilancia-sanitaria", label: "Vigilância Sanitária" },
  { id: "outro", label: "Outro" },
] as const;

export function visitorKindLabel(id: string): string {
  return VISITOR_KIND_DEFAULTS.find((k) => k.id === id)?.label ?? "Tipo não reconhecido";
}

// L15 Tecnologia — catálogo de sistemas e serviços digitais (0488). Entrada vigente = última versão do serviço,
// e só se aprovada por pessoa ≠ autor; versão nova não aprovada suspende a entrada (nunca cai para a anterior).
export interface ServiceVersion { id: string; serviceKey: string; version: number; name: string; kind: string; audience: string[]; operator: "rede" | "municipio" | "terceiro"; status: "em-uso" | "em-implantacao" | "descontinuado"; dataClasses: string[]; personId: string }
export interface Approval { versionId: string; personId: string }

export const DIGITAL_CATALOG_WRITERS = ["record_tech_digital_service", "approve_tech_digital_service"] as const;

export function catalog(vs: readonly ServiceVersion[], as: readonly Approval[]) {
  const latest = new Map<string, ServiceVersion>();
  for (const v of vs) if ((latest.get(v.serviceKey)?.version ?? 0) < v.version) latest.set(v.serviceKey, v);
  return [...latest.values()].map((v) => {
    const a = as.find((x) => x.versionId === v.id);
    const approved = !!a && a.personId !== v.personId;
    return { ...v, approved, situation: !approved ? "pendente-de-aprovacao" : v.status };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/** Alertas de governança: dado de criança/sensível tratado por terceiro exige atenção LGPD (não bloqueia, sinaliza). */
export const lgpdAttention = (e: ReturnType<typeof catalog>[number]) =>
  e.approved && e.status !== "descontinuado" && e.operator !== "rede" && e.dataClasses.some((d) => d === "sensiveis" || d === "criancas");

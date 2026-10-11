/**
 * Educacenso LOTE 03 — identidade censitária da escola (Registro 00) como PROJEÇÃO
 * do cadastro canônico (institutional_school_record_versions + identificadores),
 * do recibo oficial importado (census_official_receipt_snapshots) e das observações
 * de infraestrutura. Nada é gravado aqui: correção só pela origem
 * (register_school_record_version), porque cópia censitária seria segunda verdade.
 * Ausente ⇒ "pendente", nunca valor presumido; campos sem fonte no SIGEM ficam
 * "sem-fonte" (não são preenchidos a partir de nome nem de suposição).
 */
import { schoolVersionAt, type SchoolUnit, type SchoolRecordVersion } from "@/features/schools/school-registry";

export type Provenance = { source: "cadastro" | "identificador" | "recibo-inep" | "infraestrutura"; validFrom?: string | null; knownAt?: string | null; ref?: string | null };
export type FieldState = "informado" | "pendente" | "sem-fonte" | "nao-aplicavel" | "divergente";
export type IdentityField = { n: number; label: string; value: string | null; state: FieldState; provenance: Provenance | null; note?: string | undefined };
export type ReceiptDeclared = { name?: string; dependencia?: string; localizacao?: string; situacao?: string } | null;
export type ReceiptInput = { censusYear: number; declared: ReceiptDeclared; recordedAt: string; sourceRef: string | null } | null;
export type SchoolCategory = "municipal" | "conveniada" | "outra" | "desconhecida";
export type SchoolIdentity = { schoolId: string; name: string | null; inep: string | null; category: SchoolCategory; fields: IdentityField[]; pendencies: string[]; infraFacts: number | null };

const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** Código INEP do Registro 00 (campo 19/21): só mapeia valores literais conhecidos. */
export function locationCode(v: string | null | undefined): "1" | "2" | null {
  const k = norm(v); return k === "urbana" ? "1" : k === "rural" ? "2" : null;
}
export function dependencyCode(v: string | null | undefined): "1" | "2" | "3" | "4" | null {
  return ({ federal: "1", estadual: "2", municipal: "3", privada: "4" } as const)[norm(v) as "federal"] ?? null;
}

/**
 * Conveniada = privada COM poder público parceiro declarado no cadastro.
 * Privada sem parceria declarada fica "desconhecida" (não se presume convênio).
 */
export function schoolCategory(v: SchoolRecordVersion | null): SchoolCategory {
  const d = dependencyCode(v?.administrativeDependency);
  if (!d) return "desconhecida";
  if (d === "3") return "municipal";
  if (d === "4") return v?.partnershipPublicAuthority ? "conveniada" : "desconhecida";
  return "outra";
}

/** 2026 = ano-base; data de referência escolhe a versão cadastral vigente. */
export function projectIdentity(unit: SchoolUnit, asOf: string, receipt: ReceiptInput, infraFacts: number | null): SchoolIdentity {
  const v = schoolVersionAt(unit, asOf);
  const inepId = unit.identifiers.find((i) => i.kind === "inep")?.value ?? null;
  const cad = (validFrom?: string | null): Provenance => ({ source: "cadastro", validFrom: v?.validFrom ?? validFrom ?? null, knownAt: v?.registeredAt ?? null, ref: v?.originatingActRef ?? null });
  const f = (n: number, label: string, value: string | null | undefined, prov: Provenance | null, missing: FieldState = "pendente", note?: string): IdentityField =>
    ({ n, label, value: value ?? null, state: value ? "informado" : missing, provenance: value ? prov : null, note });
  const dep = dependencyCode(v?.administrativeDependency);
  const isPrivate = dep === "4";
  const fields: IdentityField[] = [
    f(2, "Código de escola - INEP", inepId && /^\d{8}$/.test(inepId) ? inepId : null, { source: "identificador" }, "pendente", inepId && !/^\d{8}$/.test(inepId) ? "Identificador não tem 8 dígitos" : undefined),
    f(3, "Situação de funcionamento", v ? (v.active ? "1" : null) : null, cad(), "pendente", v && !v.active ? "Cadastro inativo: situação (paralisada/extinta) não declarada" : undefined),
    f(6, "Nome da escola", v?.officialName, cad()),
    f(7, "CEP", null, null, "sem-fonte", "Cadastro não tem CEP"),
    f(8, "Município", null, null, "sem-fonte", "Código IBGE depende de tabela auxiliar INEP"),
    f(9, "Distrito", v?.district, cad(), "pendente", "Código depende de tabela auxiliar INEP"),
    f(10, "Endereço", v?.address, cad()),
    f(15, "Telefone", v?.phone, cad(), "pendente"),
    f(17, "E-mail da escola", v?.institutionalEmail, cad(), "pendente"),
    f(19, "Localização / Zona", locationCode(v?.locationKind), cad()),
    f(20, "Localização diferenciada", null, null, "sem-fonte", "Não há atributo no cadastro"),
    f(21, "Dependência administrativa", dep, cad()),
    isPrivate ? f(32, "Categoria da escola privada", v?.privateSchoolCategory, cad()) : { n: 32, label: "Categoria da escola privada", value: null, state: "nao-aplicavel", provenance: null },
    isPrivate ? f(34, "Poder público parceiro (convênio)", v?.partnershipPublicAuthority, cad(), "pendente", "Sem parceria declarada não se presume conveniada") : { n: 34, label: "Poder público parceiro (convênio)", value: null, state: "nao-aplicavel", provenance: null },
    isPrivate ? f(47, "CNPJ da mantenedora", null, null, "sem-fonte", "Mantenedora não cadastrada no SIGEM") : { n: 47, label: "CNPJ da mantenedora", value: null, state: "nao-aplicavel", provenance: null },
  ];
  // Confronto com o recibo oficial importado: divergência é exibida, nunca resolvida aqui.
  const d = receipt?.declared;
  if (d) {
    const rp: Provenance = { source: "recibo-inep", knownAt: receipt.recordedAt, ref: receipt.sourceRef };
    const check = (n: number, theirs: string | null) => {
      const fl = fields.find((x) => x.n === n); if (!fl || theirs == null) return;
      if (fl.value == null) fl.note = `Recibo ${receipt.censusYear} declara “${theirs}”; corrigir na origem`;
      else if (fl.value !== theirs) { fl.state = "divergente"; fl.note = `Recibo ${receipt.censusYear}: “${theirs}”`; fl.provenance = fl.provenance ?? rp; }
    };
    const nameF = fields.find((x) => x.n === 6)!;
    if (d.name && nameF.value && norm(nameF.value) !== norm(d.name)) { nameF.state = "divergente"; nameF.note = `Recibo ${receipt.censusYear}: “${d.name}”`; }
    check(19, locationCode(d.localizacao));
    check(21, dependencyCode(d.dependencia));
    const sit = norm(d.situacao) === "em atividade" ? "1" : null;
    check(3, sit);
  }
  const pendencies = fields.filter((x) => x.state === "pendente" || x.state === "divergente").map((x) => `${x.n} ${x.label}${x.state === "divergente" ? " (divergente)" : ""}`);
  if (!v) pendencies.unshift("Sem versão cadastral vigente na data");
  if (infraFacts === 0) pendencies.push("Infraestrutura sem observações");
  return { schoolId: unit.schoolId, name: v?.officialName ?? null, inep: inepId, category: schoolCategory(v), fields, pendencies, infraFacts };
}

/** Duplicidade: mesmo INEP em duas escolas ou escola com dois INEP — só sinaliza. */
export function identityDuplicates(units: readonly SchoolUnit[]): string[] {
  const out: string[] = []; const byInep = new Map<string, string[]>();
  for (const u of units) {
    const ineps = [...new Set(u.identifiers.filter((i) => i.kind === "inep").map((i) => i.value))];
    if (ineps.length > 1) out.push(`${u.schoolId}: ${ineps.length} códigos INEP`);
    for (const i of ineps) byInep.set(i, [...(byInep.get(i) ?? []), u.schoolId]);
  }
  for (const [i, s] of byInep) if (s.length > 1) out.push(`INEP ${i} em ${s.length} escolas`);
  return out;
}

export function summarizeIdentities(rows: readonly SchoolIdentity[]) {
  const by = (c: SchoolCategory) => rows.filter((r) => r.category === c).length;
  return { total: rows.length, municipal: by("municipal"), conveniada: by("conveniada"), desconhecida: by("desconhecida"), outra: by("outra"),
    complete: rows.filter((r) => r.pendencies.length === 0).length, divergent: rows.filter((r) => r.fields.some((f) => f.state === "divergente")).length };
}

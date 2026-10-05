/**
 * Documentos escolares oficiais — motor genérico (puro).
 *
 * O modelo é APRESENTAÇÃO versionada: blocos que citam fatos por chave. Ele não
 * calcula nada: nenhuma média, frequência, situação ou regra pedagógica nasce
 * aqui. Fato ausente permanece ausente (o bloco declara a ausência; nunca é
 * preenchido com zero, traço ou valor presumido). A emissão congela o snapshot
 * dos fatos usados; o banco calcula o SHA-256 oficial.
 */

export type FactValue = string | number;
export type FactMap = Readonly<Record<string, FactValue | null | undefined>>;

/** Tipos de documento suportados pelo motor. Lista de opções, não limite do domínio. */
export type DocumentKindInfo = { id: string; label: string; dependsOn: string; pendingWithoutRule?: string };
export const DOCUMENT_KINDS: readonly DocumentKindInfo[] = [
  { id: "declaracao-de-matricula", label: "Declaração de matrícula", dependsOn: "matrícula e participação" },
  { id: "declaracao-de-frequencia", label: "Declaração de frequência", dependsOn: "matrícula, turma e frequência",
    pendingWithoutRule: "Os números de frequência dependem de fechamento de frequência homologado; sem ele, não aparecem." },
  { id: "declaracao-escolar", label: "Comprovante / declaração escolar", dependsOn: "matrícula" },
  { id: "boletim", label: "Boletim", dependsOn: "fechamentos de período",
    pendingWithoutRule: "Notas e conceitos dependem de configuração de avaliação e fechamento homologados." },
  { id: "ficha-individual", label: "Ficha individual", dependsOn: "fechamentos e frequência",
    pendingWithoutRule: "Depende de fechamentos homologados." },
  { id: "historico-escolar", label: "Histórico escolar", dependsOn: "encerramentos de ciclo",
    pendingWithoutRule: "Depende de encerramento de ciclo e situação final homologados." },
  { id: "transferencia", label: "Documento de transferência", dependsOn: "movimentação registrada",
    pendingWithoutRule: "Depende de tipos de movimentação homologados." },
];
export const kindLabel = (id: string) => DOCUMENT_KINDS.find((k) => k.id === id)?.label ?? id;

/** Condição de bloco: só a presença/ausência de um fato. Nada de comparar valor (seria regra). */
export type BlockCondition = { fact: string; present: boolean };
export type DocumentBlock =
  | { type: "heading"; text: string; when?: BlockCondition }
  | { type: "paragraph"; text: string; when?: BlockCondition }
  | { type: "field"; label: string; fact: string; when?: BlockCondition }
  | { type: "signature"; label: string; when?: BlockCondition };

export type InstitutionalIdentity = {
  header_lines?: string[];
  /** Referência a ativo configurado (URL); nunca imagem embutida no código. */
  logo_url?: string | null;
  footer?: string | null;
};

export type TemplateVersion = {
  template_id: string; document_kind: string; version_id: string; version_no: number;
  supersedes_id: string | null; title: string; blocks: DocumentBlock[];
  identity: InstitutionalIdentity; numbering: { prefix?: string; digits?: number } | null;
  public_fields: string[]; source_ref: string | null; change_reason: string | null; recorded_at: string;
};

const PLACEHOLDER = /\{\{\s*([a-z0-9_.-]+)\s*\}\}/gi;
const present = (v: unknown): v is FactValue => (typeof v === "string" && v.trim() !== "") || (typeof v === "number" && Number.isFinite(v));

export type RenderedBlock =
  | { type: "heading" | "paragraph"; text: string; missing: string[] }
  | { type: "field"; label: string; value: string | null; fact: string }
  | { type: "signature"; label: string };

export type RenderResult = { blocks: RenderedBlock[]; usedFacts: string[]; missingFacts: string[] };

/** Renderiza sem inventar: placeholder sem fato vira marcador de ausência, nunca valor. */
export function renderDocument(blocks: readonly DocumentBlock[], facts: FactMap): RenderResult {
  const used = new Set<string>(); const missing = new Set<string>();
  const out: RenderedBlock[] = [];
  const mark = (k: string) => (present(facts[k]) ? used.add(k) : missing.add(k));
  for (const b of blocks) {
    if (b.when) {
      if (present(facts[b.when.fact]) !== b.when.present) continue;
      if (b.when.present) used.add(b.when.fact);
    }
    if (b.type === "heading" || b.type === "paragraph") {
      const miss: string[] = [];
      const text = b.text.replace(PLACEHOLDER, (_, k: string) => {
        mark(k);
        const v = facts[k];
        if (present(v)) return String(v);
        miss.push(k); return `[${k}: sem registro]`;
      });
      out.push({ type: b.type, text, missing: miss });
    } else if (b.type === "field") {
      mark(b.fact);
      const v = facts[b.fact];
      out.push({ type: "field", label: b.label, fact: b.fact, value: present(v) ? String(v) : null });
    } else out.push({ type: "signature", label: b.label });
  }
  return { blocks: out, usedFacts: [...used].sort(), missingFacts: [...missing].sort() };
}

export type FactSource = { fact: string; reader: string; validOn: string | null; knownAt: string | null };

export type DocumentSnapshot = {
  schema: "sigem.school-document-snapshot.v1";
  template: { template_id: string; version_id: string; version_no: number; title: string; blocks: DocumentBlock[]; identity: InstitutionalIdentity };
  fields: Record<string, FactValue>;
  absent: string[];
  sources: FactSource[];
  context: { school_id: string; student_id: string; valid_on: string; known_at: string | null };
};

/** Snapshot imutável: SÓ os fatos usados e presentes; ausentes são listados, nunca preenchidos. */
export function buildSnapshot(a: {
  template: TemplateVersion; facts: FactMap; sources: readonly FactSource[];
  context: DocumentSnapshot["context"];
}): DocumentSnapshot {
  const r = renderDocument(a.template.blocks, a.facts);
  const fields: Record<string, FactValue> = {};
  for (const k of r.usedFacts) fields[k] = a.facts[k] as FactValue;
  const relevant = new Set([...r.usedFacts, ...r.missingFacts]);
  return {
    schema: "sigem.school-document-snapshot.v1",
    template: { template_id: a.template.template_id, version_id: a.template.version_id, version_no: a.template.version_no,
      title: a.template.title, blocks: structuredClone(a.template.blocks), identity: structuredClone(a.template.identity) },
    fields, absent: r.missingFacts,
    sources: a.sources.filter((s) => relevant.has(s.fact)).map((s) => ({ ...s })),
    context: { ...a.context },
  };
}

/** Reproduz um documento emitido a partir do PRÓPRIO snapshot — nunca dos fatos atuais. */
export function renderFromSnapshot(s: DocumentSnapshot): RenderResult {
  return renderDocument(s.template.blocks, s.fields);
}

/** Campos que a verificação pública jamais expõe (o banco aplica a mesma regra). */
export const PUBLIC_FORBIDDEN = /(nota|conceito|media|avalia|frequen|falta|saude|laudo|defici|cpf|rg|nis|certid|document|endere|telefone|email|responsa|nascimento|filia|mae|pai)/i;
export const publicFieldAllowed = (k: string) => !PUBLIC_FORBIDDEN.test(k);
export function publicPayload(s: DocumentSnapshot, allowed: readonly string[]): Record<string, FactValue> {
  const out: Record<string, FactValue> = {};
  for (const k of allowed) if (publicFieldAllowed(k) && k in s.fields) out[k] = s.fields[k]!;
  return out;
}

export type EmissionRow = {
  id: string; verification_code: string; emission_kind: "original" | "reproducao"; reproduces_id: string | null;
  retifies_id: string | null; template_version_id: string; document_kind: string; snapshot: DocumentSnapshot;
  snapshot_sha256: string; emission_number: string | null; emitted_by_person: string | null; emitted_at: string;
  event_kind: "cancelamento" | "retificacao" | null; event_reason: string | null;
  replacement_emission_id: string | null; event_recorded_at: string | null;
};
export type EmissionStatus = "valida" | "cancelada" | "retificada";
export function emissionStatus(row: EmissionRow, all: readonly EmissionRow[]): EmissionStatus {
  const base = row.reproduces_id ? all.find((r) => r.id === row.reproduces_id) ?? row : row;
  return base.event_kind === "cancelamento" ? "cancelada" : base.event_kind === "retificacao" ? "retificada" : "valida";
}

export function documentMessage(error: unknown): string {
  const m = error instanceof Error ? error.message : String(error);
  if (/capability:/.test(m)) return "Sua conta não tem permissão para esta operação nesta escola. A permissão ainda não foi atribuída a nenhuma atuação.";
  if (/session-required/.test(m)) return "Sua sessão expirou. Entre novamente.";
  if (/base-superseded/.test(m)) return "Este registro foi alterado por outra pessoa. Recarregue antes de continuar.";
  if (/base-unknown/.test(m)) return "O modelo de referência não existe mais. Recarregue.";
  if (/correction-reason-required/.test(m)) return "Informe o motivo.";
  if (/public-field-forbidden:(.+)/.test(m)) return `O campo "${m.match(/public-field-forbidden:([^\s"]+)/)?.[1]}" não pode aparecer na verificação pública.`;
  if (/student-not-enrolled-in-school/.test(m)) return "O aluno não tem matrícula registrada nesta escola.";
  if (/emission-not-active/.test(m)) return "Documento cancelado ou retificado não pode ser reproduzido.";
  if (/kind-immutable/.test(m)) return "O tipo de documento de um modelo não pode mudar.";
  return m;
}

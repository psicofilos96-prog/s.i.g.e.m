/**
 * SIGEM Documentos — Lote 02: núcleo canônico (regra pura, sem tabela nova).
 * Tipo documental versionado (só "aprovado" produz efeito), documento com
 * identidade imutável (tipo, unidade, módulo de origem), versões append-only
 * com arquivo (hash SHA-256 + caminho privado), metadados por allowlist do
 * tipo, autoria de pessoa natural (ou órgão declarado), classificação só de
 * plano aprovado e relações com processos/módulos. Formalizar congela: depois
 * disso só retificação (nova versão com justificativa) ou cancelamento.
 * Executor técnico nunca é autor nem formaliza. Persistência futura estende
 * as tabelas do Studio/DocServ (L01), nunca cria GED paralelo.
 */
export type ActorNature = "pessoa-natural" | "orgao-institucional" | "executor-tecnico";
export interface DocActor { personId: string | null; nature: ActorNature; capabilities: readonly { id: string; unitId: string | null }[] }

export interface DocTypeVersion {
  typeId: string; version: number; name: string; status: "rascunho" | "aprovado" | "revogado";
  approvedBy: string | null; approvalRef: string | null;
  metadataFields: readonly { id: string; required: boolean; sensitive: boolean }[];
  createCapability: string; formalizeCapability: string; readCapability: string;
}
export interface ClassificationPlan { version: number; status: "rascunho" | "aprovado"; codes: readonly string[] }

export type OriginModule = string; // docserv, secretaria, mapa, diario... (aberto)
export interface DocumentIdentity { docId: string; typeId: string; typeVersion: number; unitId: string; origin: { module: OriginModule; ref: string } | null; createdBy: string; createdAt: string }

export interface DocFile { path: string; sha256: string; mime: string; bytes: number }
export interface DocVersion {
  docId: string; version: number; kind: "rascunho" | "formalizacao" | "retificacao" | "cancelamento";
  authorPersonId: string; authorNature: ActorNature; recordedAt: string; validFrom: string | null;
  file: DocFile | null; metadata: Readonly<Record<string, string>>; classificationCode: string | null;
  justification: string | null; expectedPrevious: number;
}
export interface DocRelation { docId: string; kind: "processo" | "documento" | "modulo"; targetRef: string; recordedBy: string; recordedAt: string }

const SHA = /^[a-f0-9]{64}$/;
export const safePath = (p: string) => /^[a-z0-9-]+\/[A-Za-z0-9/_.-]+$/.test(p) && !p.includes("..") && !/^https?:/i.test(p) && !p.startsWith("public/");

const has = (a: DocActor, cap: string, unit: string) => a.capabilities.some((c) => c.id === cap && (c.unitId === null || c.unitId === unit));
const human = (a: DocActor) => !!a.personId && a.nature !== "executor-tecnico";

export function approvedType(types: readonly DocTypeVersion[], typeId: string): DocTypeVersion | null {
  const ok = types.filter((t) => t.typeId === typeId && t.status === "aprovado" && t.approvedBy && t.approvalRef);
  if (types.some((t) => t.typeId === typeId && t.status === "revogado")) return null;
  return ok.sort((a, b) => b.version - a.version)[0] ?? null;
}

export function createDocument(id: Omit<DocumentIdentity, "createdBy" | "typeVersion">, actor: DocActor, types: readonly DocTypeVersion[]): DocumentIdentity {
  if (!human(actor)) throw new Error("doc:author-must-be-human");
  const t = approvedType(types, id.typeId);
  if (!t) throw new Error("doc:type-not-approved");
  if (!has(actor, t.createCapability, id.unitId)) throw new Error("doc:forbidden");
  if (id.origin && (!id.origin.module.trim() || !id.origin.ref.trim())) throw new Error("doc:origin-incomplete");
  return { ...id, typeVersion: t.version, createdBy: actor.personId! };
}

export function docState(docId: string, versions: readonly DocVersion[]) {
  const h = versions.filter((v) => v.docId === docId).sort((a, b) => a.version - b.version);
  const formal = h.some((v) => v.kind === "formalizacao");
  const cancelled = h.some((v) => v.kind === "cancelamento");
  return { head: h.at(-1) ?? null, formalized: formal, cancelled, status: cancelled ? "cancelado" : formal ? "formalizado" : h.length ? "rascunho" : "inexistente" } as const;
}

export function appendVersion(doc: DocumentIdentity, v: DocVersion, versions: readonly DocVersion[], actor: DocActor, types: readonly DocTypeVersion[], plan: ClassificationPlan | null): DocVersion[] {
  const errs: string[] = [];
  const t = types.find((x) => x.typeId === doc.typeId && x.version === doc.typeVersion);
  const st = docState(doc.docId, versions);
  const last = st.head?.version ?? 0;
  if (!human(actor) || actor.personId !== v.authorPersonId || v.authorNature !== actor.nature) errs.push("autoria deve ser a pessoa da sessão; executor técnico recusado");
  if (!t) errs.push("tipo documental desconhecido");
  if (v.docId !== doc.docId) errs.push("documento divergente");
  if (v.version !== last + 1 || v.expectedPrevious !== last) errs.push(`versão esperada ${last + 1} sobre ${last}`);
  if (st.cancelled) errs.push("documento cancelado é imutável");
  if (st.formalized && (v.kind === "rascunho" || v.kind === "formalizacao")) errs.push("documento formalizado é imutável: só retificação ou cancelamento");
  if (!st.formalized && (v.kind === "retificacao" || v.kind === "cancelamento") && v.kind === "retificacao") errs.push("retificação só após formalização");
  if ((v.kind === "retificacao" || v.kind === "cancelamento") && !v.justification?.trim()) errs.push("justificativa obrigatória");
  if (v.file && (!SHA.test(v.file.sha256) || !safePath(v.file.path) || v.file.bytes <= 0)) errs.push("arquivo exige hash SHA-256, caminho privado e tamanho");
  if (t) {
    const allowed = new Set(t.metadataFields.map((f) => f.id));
    for (const k of Object.keys(v.metadata)) if (!allowed.has(k)) errs.push(`metadado não previsto: ${k}`);
    if (v.kind === "formalizacao" || v.kind === "retificacao") {
      for (const f of t.metadataFields) if (f.required && !v.metadata[f.id]?.trim()) errs.push(`metadado obrigatório: ${f.id}`);
      if (!v.file) errs.push("formalização exige arquivo");
      if (!v.validFrom) errs.push("formalização exige vigência");
      if (!has(actor, t.formalizeCapability, doc.unitId)) errs.push("sem competência para formalizar");
    } else if (v.kind === "cancelamento") {
      if (!has(actor, t.formalizeCapability, doc.unitId)) errs.push("sem competência para cancelar");
    } else if (!has(actor, t.createCapability, doc.unitId)) errs.push("sem competência para editar rascunho");
  }
  if (v.classificationCode !== null && (!plan || plan.status !== "aprovado" || !plan.codes.includes(v.classificationCode))) errs.push("classificação só de plano aprovado");
  if (errs.length) throw new Error(`doc:refused:${errs.join("; ")}`);
  return [...versions, v];
}

/** Versão formal vigente na data e conhecida até knownAt; rascunho nunca é vigente. */
export function formalVersionAt(docId: string, versions: readonly DocVersion[], day: string, knownAt: string): DocVersion | null {
  const h = versions.filter((v) => v.docId === docId && v.recordedAt <= knownAt).sort((a, b) => a.version - b.version);
  if (h.some((v) => v.kind === "cancelamento")) return null;
  const f = h.filter((v) => v.kind === "formalizacao" || v.kind === "retificacao").at(-1);
  return f && f.validFrom && f.validFrom <= day ? f : null;
}

export function relate(rel: DocRelation, rels: readonly DocRelation[], actor: DocActor): DocRelation[] {
  if (!human(actor) || actor.personId !== rel.recordedBy) throw new Error("doc:relation-author");
  if (!rel.targetRef.trim()) throw new Error("doc:relation-target");
  if (rel.kind === "documento" && rel.targetRef === rel.docId) throw new Error("doc:relation-self");
  if (rels.some((r) => r.docId === rel.docId && r.kind === rel.kind && r.targetRef === rel.targetRef)) return [...rels]; // idempotente
  return [...rels, rel];
}

/** Leitura com supressão de metadado sensível sem capacidade. */
export function readDocument(doc: DocumentIdentity, versions: readonly DocVersion[], actor: DocActor, types: readonly DocTypeVersion[]) {
  const t = types.find((x) => x.typeId === doc.typeId && x.version === doc.typeVersion);
  if (!t || !has(actor, t.readCapability, doc.unitId)) return { ok: false as const, reason: "indisponivel" };
  const head = docState(doc.docId, versions).head;
  const sensitive = new Set(t.metadataFields.filter((f) => f.sensitive).map((f) => f.id));
  const metadata = head ? Object.fromEntries(Object.entries(head.metadata).filter(([k]) => !sensitive.has(k) || has(actor, `${t.readCapability}:sensivel`, doc.unitId))) : {};
  return { ok: true as const, status: docState(doc.docId, versions).status, version: head?.version ?? null, metadata };
}

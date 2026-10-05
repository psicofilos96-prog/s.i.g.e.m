// Base de conhecimento institucional — núcleo puro.
// Pipeline: documento → classificação/escopo → extração → chunks → índice → versão → revogação.
// O índice nunca amplia acesso: cada resultado carrega a ACL da versão e o banco filtra por RLS.
import { sanitizeRetrieved } from "@/features/assistant/assistant-core";

export type SourceKind = "documentacao-sigem" | "norma-oficial" | "manual-institucional" | "conteudo-autorizado";
export type Classification = "publico" | "interno";
export const SOURCE_KINDS: readonly SourceKind[] = ["documentacao-sigem", "norma-oficial", "manual-institucional", "conteudo-autorizado"];

export type IngestInput = {
  documentId: string;
  sourceKind: string;
  title: string;
  classification: string;
  requiredCapability: string | null;
  originalRef: string;
  /** Texto extraído, com marcação opcional de página (\f) e seções (linhas iniciadas por #). */
  text: string;
};

export type Chunk = { section: string | null; page: number | null; body: string };
export type IngestPlan = { ok: true; documentId: string; sourceKind: SourceKind; title: string; classification: Classification; requiredCapability: string | null; originalRef: string; originalSha256: string; chunks: Chunk[] } | { ok: false; error: string };

/** Conteúdo que nunca entra no índice automaticamente: prontuário, anexo sensível, nota, dado pessoal. */
const SENSITIVE = [
  { re: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, why: "CPF" },
  { re: /\bprontu[aá]rio|laudo|diagn[oó]stico|\bCID[-\s]?\d|defici[eê]ncia\s+de\s+\w+\s+(do|da)\s+(aluno|estudante)/i, why: "conteúdo de saúde/prontuário" },
  { re: /\bnota\s+(do|da|de)\s+(aluno|estudante)|boletim\s+(do|da)\s+/i, why: "notas individuais" },
  { re: /\b(data de nascimento|nome da m[aã]e|endere[cç]o residencial|telefone)\s*:/i, why: "dados pessoais" },
  { re: /\b(senha|token|api[_-]?key|segredo)\s*[:=]/i, why: "credencial" },
];

export function detectSensitive(text: string): string[] {
  return SENSITIVE.filter((s) => s.re.test(text)).map((s) => s.why);
}

export async function sha256Hex(text: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Divide por página (\f) e seção (#), em blocos de até ~maxChars, preservando página/seção para citação. */
export function chunkText(text: string, maxChars = 1200): Chunk[] {
  const out: Chunk[] = [];
  const pages = text.split("\f");
  pages.forEach((pageText, pi) => {
    let section: string | null = null;
    let buf = "";
    const flush = () => { const b = buf.trim(); if (b) out.push({ section, page: pages.length > 1 ? pi + 1 : null, body: b }); buf = ""; };
    for (const line of pageText.split("\n")) {
      const h = line.match(/^#{1,6}\s+(.+)/);
      if (h) { flush(); section = h[1]!.trim().slice(0, 300); continue; }
      for (const para of [line]) {
        if (buf.length + para.length + 1 > maxChars) flush();
        if (para.length > maxChars) { for (let i = 0; i < para.length; i += maxChars) { buf = para.slice(i, i + maxChars); flush(); } }
        else buf += (buf ? "\n" : "") + para;
      }
    }
    flush();
  });
  return out;
}

export async function planIngestion(input: IngestInput): Promise<IngestPlan> {
  if (!/^kb-[a-z0-9-]{3,80}$/.test(input.documentId)) return { ok: false, error: "Identificador do documento inválido (use kb-…)." };
  if (!SOURCE_KINDS.includes(input.sourceKind as SourceKind)) return { ok: false, error: "Fonte não elegível para a base de conhecimento." };
  if (input.classification !== "publico" && input.classification !== "interno") return { ok: false, error: "Classificação deve ser público ou interno; conteúdo sensível não é indexado." };
  if (input.classification === "interno" && !input.requiredCapability) return { ok: false, error: "Documento interno exige a capacidade que dá acesso." };
  if (!input.title.trim() || !input.originalRef.trim()) return { ok: false, error: "Título e referência ao original são obrigatórios." };
  const sensitive = detectSensitive(input.text);
  if (sensitive.length) return { ok: false, error: `Indexação recusada: o texto parece conter ${sensitive.join(", ")}.` };
  const chunks = chunkText(input.text);
  if (!chunks.length) return { ok: false, error: "Nada extraído do documento." };
  return { ok: true, documentId: input.documentId, sourceKind: input.sourceKind as SourceKind, title: input.title.trim(), classification: input.classification, requiredCapability: input.classification === "interno" ? input.requiredCapability : null, originalRef: input.originalRef.trim(), originalSha256: await sha256Hex(input.text), chunks };
}

// ---------- Busca ----------
export type VersionStatus = "vigente" | "substituida" | "revogada";
export type Hit = { chunkId: string; documentId: string; versionId: string; version: number; title: string; classification: Classification; section: string | null; page: number | null; body: string; score: number; status: VersionStatus };

/** Contrato para busca semântica. Sem provedor configurado usa-se `lexicalRanker`, que nada envia para fora. */
export interface Ranker { name: string; external: boolean; rank(query: string, hits: Hit[]): Promise<Hit[]> }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const tokens = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2);

export const lexicalRanker: Ranker = {
  name: "lexical-local", external: false,
  async rank(query, hits) {
    const q = new Set(tokens(query));
    return hits.map((h) => {
      const t = tokens(`${h.section ?? ""} ${h.title} ${h.body}`);
      const tf = t.filter((w) => q.has(w)).length;
      const cover = [...q].filter((w) => t.includes(w)).length / Math.max(1, q.size);
      return { ...h, score: cover * 2 + tf / Math.max(10, t.length) };
    }).filter((h) => h.score > 0).sort((a, b) => b.score - a.score);
  },
};

/** Ordena vigentes primeiro; versões conflitantes do mesmo documento colapsam na vigente, com as demais como histórico. */
export function present(hits: Hit[]): { current: Hit[]; history: Hit[] } {
  const vigenteDocs = new Set(hits.filter((h) => h.status === "vigente").map((h) => h.documentId));
  const current: Hit[] = [], history: Hit[] = [];
  for (const h of hits) {
    const safe = { ...h, body: sanitizeRetrieved(h.body, 800) };
    if (h.status === "vigente") current.push(safe);
    else if (!vigenteDocs.has(h.documentId) || h.status === "revogada" || h.status === "substituida") history.push(safe);
  }
  return { current, history };
}

export function statusNote(h: Hit): string | null {
  if (h.status === "revogada") return `Versão ${h.version} revogada — não vale como atual; mostrada só como histórico.`;
  if (h.status === "substituida") return `Versão ${h.version} substituída por versão mais recente; mostrada só como histórico.`;
  return null;
}

export function citation(h: Hit): string {
  const where = [h.section ? `seção “${h.section}”` : null, h.page ? `p. ${h.page}` : null].filter(Boolean).join(", ");
  return `${h.title}, v${h.version}${where ? `, ${where}` : ""} [${h.documentId}]`;
}

import { UPLOAD_MIME } from "@/lib/file-formats";
// ACV.1 — Acervo Documental por setor: regras puras espelhando o banco (migration 0497).
// O banco é a garantia (RLS + funções acv_*); aqui só validação antecipada, árvore e apresentação.

export const ROLES = ["visualizar", "enviar", "editar", "organizar", "excluir", "compartilhar", "administrar"] as const;
export type Role = (typeof ROLES)[number];
export const roleRank = (r: string): number => ROLES.indexOf(r as Role) + 1;
export const can = (rank: number, needed: Role): boolean => rank >= roleRank(needed);

/** Mesmo critério de acv_name_ok. */
export function nameOk(name: string): boolean {
  return name.length >= 1 && name.length <= 180 && name === name.trim() && !/[\u0000-\u001f\u007f/\\<>:"|?*]/.test(name)
    && name !== "." && name !== ".." && !name.endsWith(".");
}

export const ALLOWED: Readonly<Record<string, string>> = UPLOAD_MIME;
export const MAX_BYTES = 52_428_800;

export const extOf = (name: string): string => /\.([A-Za-z0-9]{1,8})$/.exec(name)?.[1]?.toLowerCase() ?? "";

/** MIME real pelos primeiros bytes (assinatura); texto sem assinatura só se não houver byte nulo. */
export function sniffMime(head: Uint8Array, ext: string): string | null {
  const starts = (...b: number[]) => b.every((x, i) => head[i] === x);
  if (starts(0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (starts(0x52, 0x49, 0x46, 0x46) && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) return "image/webp";
  if (starts(0x50, 0x4b, 0x03, 0x04)) return ["docx", "xlsx", "pptx", "odt", "ods", "odp"].includes(ext) ? ALLOWED[ext]! : null;
  if ((ext === "txt" || ext === "csv") && !head.includes(0)) {
    const text = new TextDecoder().decode(head).trimStart().toLowerCase();
    if (text.startsWith("<!doctype") || text.startsWith("<html") || text.startsWith("<script") || text.startsWith("<svg")) return null;
    return ALLOWED[ext]!;
  }
  return null;
}

export type FileCheck = { ok: true; mime: string; ext: string } | { ok: false; reason: string };

export function checkFile(name: string, size: number, head: Uint8Array): FileCheck {
  if (!nameOk(name)) return { ok: false, reason: "nome-invalido" };
  const ext = extOf(name);
  if (!ALLOWED[ext]) return { ok: false, reason: "tipo-nao-permitido" };
  if (size > MAX_BYTES) return { ok: false, reason: "tamanho-excedido" };
  const mime = sniffMime(head, ext);
  if (mime !== ALLOWED[ext]) return { ok: false, reason: "conteudo-nao-confere-com-extensao" };
  return { ok: true, mime, ext };
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Pré-visualização só para formatos sem conteúdo ativo; nada de HTML/SVG/Office executado no navegador. */
export type Preview = "pdf" | "imagem" | "texto" | "nenhuma";
export function previewKind(mime: string): Preview {
  if (mime === "application/pdf") return "pdf";
  if (["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime)) return "imagem";
  if (mime === "text/plain" || mime === ALLOWED.csv) return "texto";
  return "nenhuma";
}

export interface ArchiveNode { id: string; parentId: string | null; kind: "pasta" | "arquivo"; name: string; updatedAt: string; trashedAt: string | null; mime?: string | null; size?: number | null }

export function breadcrumbs(nodes: readonly ArchiveNode[], id: string | null): ArchiveNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: ArchiveNode[] = [];
  const seen = new Set<string>();
  let cur = id ? byId.get(id) : undefined;
  while (cur && !seen.has(cur.id)) { seen.add(cur.id); out.unshift(cur); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
  return out;
}

export type SortKey = "nome" | "data" | "tamanho";
export interface ListFilter { query?: string; kind?: "pasta" | "arquivo" | ""; ext?: string; from?: string; to?: string }

/** Pastas antes de arquivos; ordenação estável; filtros por nome/tipo/data. */
export function listChildren(nodes: readonly ArchiveNode[], parentId: string | null, f: ListFilter, sort: SortKey, asc: boolean): ArchiveNode[] {
  const q = (f.query ?? "").trim().toLowerCase();
  const rows = nodes.filter((n) => !n.trashedAt && (q ? n.name.toLowerCase().includes(q) : n.parentId === parentId)
    && (!f.kind || n.kind === f.kind) && (!f.ext || extOf(n.name) === f.ext)
    && (!f.from || n.updatedAt.slice(0, 10) >= f.from) && (!f.to || n.updatedAt.slice(0, 10) <= f.to));
  const dir = asc ? 1 : -1;
  return rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "pasta" ? -1 : 1;
    const c = sort === "data" ? a.updatedAt.localeCompare(b.updatedAt) : sort === "tamanho" ? (a.size ?? 0) - (b.size ?? 0) : a.name.localeCompare(b.name, "pt-BR");
    return (c || a.id.localeCompare(b.id)) * dir;
  });
}

/** Mensagem humana para recusas do banco. */
export const REASON: Readonly<Record<string, string>> = {
  "sem-permissao": "Você não tem permissão para esta ação.",
  "sem-permissao-no-destino": "Você não tem permissão na pasta de destino.",
  "nome-em-uso": "Já existe um item com esse nome nesta pasta.",
  "nome-invalido": "Nome inválido.",
  "tipo-nao-permitido": "Tipo de arquivo não permitido.",
  "conteudo-nao-confere-com-extensao": "O conteúdo do arquivo não corresponde à extensão.",
  "tamanho-excedido": "Arquivo acima de 50 MB.",
  "cota-excedida": "A cota do acervo deste setor foi atingida.",
  "ciclo": "Não é possível mover uma pasta para dentro dela mesma.",
  "pasta-de-origem-na-lixeira": "Restaure antes a pasta de origem.",
  "destinatario-sem-vinculo": "A pessoa não tem atuação vigente.",
  "somente-conta-de-setor": "O acervo é aberto pela conta do setor.",
  "extensao-nao-pode-mudar": "A extensão do arquivo não pode ser alterada.",
};
export const reasonText = (msg: string): string => REASON[msg] ?? "Não foi possível concluir a ação.";

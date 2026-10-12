// SIGEM 2.0 A&A Lote 15 — Avaliações externas e importações. Núcleo puro de staging:
// fonte verificada → validação → reconciliação → prévia. Gravação continua só pelos
// writers canônicos já existentes (staging `aa_import_batches` 0370 e `ext_record_result` 0373).

export type Source = { program: string; publisher: string | null; officialUrl: string | null; documentHash: string | null; year: number | null; method: string | null; version: string | null };
export type Row = { line: number; inep: string; year: number | null; stage: string | null; component: string | null; participants: number | null; eligible: number | null; scaleKey: string | null; value: number | null; levels: Record<string, number> | null; kind: "proficiencia" | "acerto-bruto" | "nivel" | null };
export type SchoolRef = { schoolId: string; inep: string };

const OFFICIAL_HOSTS = [/\.gov\.br$/i, /(^|\.)inep\.gov\.br$/i, /caed(digital)?\.(ufjf\.br|net)$/i];

export function verifySource(s: Source): string[] {
  const g: string[] = [];
  if (!s.publisher?.trim()) g.push("publicador");
  let host = ""; try { host = s.officialUrl ? new URL(s.officialUrl).hostname : ""; } catch { /* inválido */ }
  if (!host) g.push("endereço oficial"); else if (!OFFICIAL_HOSTS.some(r => r.test(host))) g.push("endereço não é de domínio oficial reconhecido");
  if (!s.documentHash || !/^[a-f0-9]{64}$/i.test(s.documentHash)) g.push("hash SHA-256 do arquivo");
  if (!s.year) g.push("ano");
  if (!s.method?.trim()) g.push("método");
  if (!s.version?.trim()) g.push("versão");
  return g;
}

export function batchKey(s: Source, sheet: string) { return `${s.program}|${s.version}|${s.documentHash}|${sheet}`; }

export type Classified = { line: number; status: "valida" | "rejeitada" | "sem-escola" | "duplicada"; schoolId: string | null; problems: string[] };

export function validateRow(r: Row, s: Source): string[] {
  const p: string[] = [];
  if (!/^\d{8}$/.test(r.inep)) p.push("INEP inválido");
  if (r.year !== s.year) p.push("ano diferente da fonte");
  if (!r.stage) p.push("etapa");
  if (!r.component) p.push("componente");
  if (!r.kind) p.push("tipo de medida");
  if (r.kind === "proficiencia") {
    if (!r.scaleKey || !r.scaleKey.startsWith(`${s.program.toLowerCase()}:`)) p.push("escala deve ser do próprio programa");
  }
  if (r.kind === "acerto-bruto" && r.scaleKey) p.push("acerto bruto não tem escala de proficiência");
  if (r.kind === "acerto-bruto" && r.value !== null && (r.value < 0 || r.value > 100)) p.push("acerto bruto fora de 0–100");
  if (r.kind === "nivel" && (!r.levels || !Object.keys(r.levels).length)) p.push("distribuição por níveis ausente");
  if (r.participants !== null && r.eligible !== null && r.participants > r.eligible) p.push("participantes > previstos");
  return p;
}

export function stage(p: { source: Source; sheet: string; rows: Row[]; schools: SchoolRef[]; alreadyStaged: ReadonlySet<string> }) {
  const sourceGaps = verifySource(p.source);
  if (sourceGaps.length) return { refused: `fonte não verificada: falta ${sourceGaps.join(", ")}` } as const;
  const key = batchKey(p.source, p.sheet);
  if (p.alreadyStaged.has(key)) return { refused: "arquivo já está em staging (idempotente)", key } as const;
  const byInep = new Map(p.schools.map(s => [s.inep, s.schoolId]));
  const seen = new Set<string>();
  const rows: Classified[] = p.rows.map(r => {
    const problems = validateRow(r, p.source);
    const dupKey = `${r.inep}|${r.stage}|${r.component}|${r.kind}`;
    if (seen.has(dupKey)) return { line: r.line, status: "duplicada", schoolId: null, problems: ["linha repetida no arquivo"] };
    seen.add(dupKey);
    if (problems.length) return { line: r.line, status: "rejeitada", schoolId: null, problems };
    const schoolId = byInep.get(r.inep) ?? null;
    return schoolId ? { line: r.line, status: "valida", schoolId, problems: [] } : { line: r.line, status: "sem-escola", schoolId: null, problems: ["INEP não encontrado no cadastro"] };
  });
  const count = (s: Classified["status"]) => rows.filter(r => r.status === s).length;
  return { key, preview: { total: rows.length, valid: count("valida"), rejected: count("rejeitada"), noSchool: count("sem-escola"), duplicated: count("duplicada") }, rows, confirmable: rows.length > 0 && count("valida") === rows.length, notes: ["staging não grava resultado oficial: confirmação humana e homologação por outra pessoa seguem pelos writers canônicos", "proficiência só existe quando o programa publica escala própria"] } as const;
}

/** Apresentação: nunca mistura escala de proficiência com acerto bruto na mesma série. */
export function presentable(rows: { kind: Row["kind"]; scaleKey: string | null; value: number | null }[]) {
  const kinds = new Set(rows.map(r => r.kind === "proficiencia" ? `prof:${r.scaleKey}` : r.kind));
  return kinds.size <= 1 ? { ok: true as const } : { ok: false as const, reason: "medidas de natureza ou escala diferente não entram na mesma série" };
}

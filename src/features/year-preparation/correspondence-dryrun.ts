/**
 * NCFG.3 — correspondências candidatas para a preparação de 2027. PURO e somente leitura:
 * não grava, não abre ano, não cria turma, não altera política. Toda saída é CANDIDATA;
 * a aplicação futura só ocorre pelos writers canônicos, após revisão humana.
 */
export type Verdict = "match" | "ambiguo" | "recusa";
export type Candidate = { domain: string; key: string; verdict: Verdict; reason: string; target: string | null; idempotencyKey: string | null };

const norm = (v: unknown) => (v == null ? "" : String(v).trim());

function idem(domain: string, version: number, sha: string, key: string) {
  return `${domain}@${version}:${sha}:${key}`;
}

/** Chave estável de texto (FNV-1a 32 bits, hex) — determinística, sem dependência de runtime. */
export function stableHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

/** "hh:mm" → minutos; inválido ⇒ null (nunca zero). */
export function parseHhmm(v: unknown): number | null {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(norm(v));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

type Ctx = { version: number; sourceSha256: string; schools: ReadonlyMap<string, string> };

/** Profissional × escola (chave inep-pessoa|código-escola). Pessoa conhecida em várias escolas é lotação candidata, não ambiguidade. */
export function professionalCandidates(ctx: Ctx & { persons: ReadonlyMap<string, string> },
  rows: ReadonlyArray<{ person: unknown; school: unknown }>): Candidate[] {
  const seen = new Set<string>(); const out: Candidate[] = [];
  const blanks = rows.filter((r) => !norm(r.person) || !norm(r.school)).length;
  for (const r of rows) {
    const p = norm(r.person), s = norm(r.school); if (!p || !s) continue;
    const key = `${p}|${s}`; if (seen.has(key)) continue; seen.add(key);
    const pid = ctx.persons.get(p) ?? null, sid = ctx.schools.get(s) ?? null;
    if (!sid) out.push({ domain: "lotacao", key, verdict: "recusa", reason: "escola-desconhecida", target: null, idempotencyKey: null });
    else if (!pid) out.push({ domain: "lotacao", key, verdict: "ambiguo", reason: "pessoa-nao-cadastrada-revisao-humana", target: sid, idempotencyKey: null });
    else out.push({ domain: "lotacao", key, verdict: "match", reason: "pessoa-e-escola-conhecidas", target: `${pid}|${sid}`, idempotencyKey: idem("lotacao", ctx.version, ctx.sourceSha256, key) });
  }
  for (let i = 0; i < blanks; i++) out.push({ domain: "lotacao", key: "", verdict: "recusa", reason: "sem-chave", target: null, idempotencyKey: null });
  return sortCandidates(out);
}

/** Jornada pessoa × escola × turma; carga hh:mm inválida recusa; mesma chave com cargas distintas é ambígua. */
export function journeyCandidates(ctx: Ctx, rows: ReadonlyArray<{ person: unknown; school: unknown; classCode: unknown; weekly: unknown }>): Candidate[] {
  const groups = new Map<string, Set<string>>(); let blanks = 0;
  for (const r of rows) {
    const p = norm(r.person), s = norm(r.school), c = norm(r.classCode);
    if (!p || !s || !c) { blanks++; continue; }
    const k = `${p}|${s}|${c}`; if (!groups.has(k)) groups.set(k, new Set()); groups.get(k)!.add(norm(r.weekly));
  }
  const out: Candidate[] = [];
  for (const [k, loads] of groups) {
    const s = k.split("|")[1]!;
    if (!ctx.schools.get(s)) { out.push({ domain: "jornada", key: k, verdict: "recusa", reason: "escola-desconhecida", target: null, idempotencyKey: null }); continue; }
    if (loads.size > 1) { out.push({ domain: "jornada", key: k, verdict: "ambiguo", reason: "cargas-divergentes", target: null, idempotencyKey: null }); continue; }
    const mins = parseHhmm([...loads][0]);
    if (mins == null) { out.push({ domain: "jornada", key: k, verdict: "recusa", reason: "carga-ilegivel", target: null, idempotencyKey: null }); continue; }
    out.push({ domain: "jornada", key: k, verdict: "match", reason: `carga-${mins}min`, target: null, idempotencyKey: idem("jornada", ctx.version, ctx.sourceSha256, k) });
  }
  for (let i = 0; i < blanks; i++) out.push({ domain: "jornada", key: "", verdict: "recusa", reason: "sem-chave", target: null, idempotencyKey: null });
  return sortCandidates(out);
}

/** Turma da fonte. Fonte não-2027 nunca vira turma 2027: todo match é "referencia-historica". */
export function classCandidates(ctx: Ctx & { sourceYear: number; targetYear: number },
  rows: ReadonlyArray<{ classCode: unknown; school: unknown }>): Candidate[] {
  const count = new Map<string, number>(); const school = new Map<string, string>(); let blanks = 0;
  for (const r of rows) { const c = norm(r.classCode); if (!c) { blanks++; continue; } count.set(c, (count.get(c) ?? 0) + 1); school.set(c, norm(r.school)); }
  const out: Candidate[] = [];
  for (const [c, n] of count) {
    if (n > 1) { out.push({ domain: "turma", key: c, verdict: "ambiguo", reason: "codigo-repetido", target: null, idempotencyKey: null }); continue; }
    const sid = ctx.schools.get(school.get(c)!) ?? null;
    if (!sid) { out.push({ domain: "turma", key: c, verdict: "recusa", reason: "escola-desconhecida", target: null, idempotencyKey: null }); continue; }
    if (ctx.sourceYear !== ctx.targetYear) { out.push({ domain: "turma", key: c, verdict: "recusa", reason: `fonte-${ctx.sourceYear}-nao-e-${ctx.targetYear}`, target: sid, idempotencyKey: null }); continue; }
    out.push({ domain: "turma", key: c, verdict: "match", reason: "fonte-do-ano-alvo", target: sid, idempotencyKey: idem("turma", ctx.version, ctx.sourceSha256, c) });
  }
  for (let i = 0; i < blanks; i++) out.push({ domain: "turma", key: "", verdict: "recusa", reason: "sem-chave", target: null, idempotencyKey: null });
  return sortCandidates(out);
}

/** Valores de catálogo (etapa/turno/componente) × catálogo homologado. Catálogo vazio ⇒ todos ambíguos (DADO_AGUARDADO). */
export function catalogCandidates(ctx: { version: number; sourceSha256: string; domain: string; homologated: ReadonlyMap<string, string> },
  values: ReadonlyArray<unknown>): Candidate[] {
  const out: Candidate[] = [];
  for (const v of [...new Set(values.map(norm).filter(Boolean))]) {
    const t = ctx.homologated.get(v.toLocaleLowerCase("pt-BR")) ?? null;
    out.push(t
      ? { domain: ctx.domain, key: v, verdict: "match", reason: "valor-homologado-identico", target: t, idempotencyKey: idem(ctx.domain, ctx.version, ctx.sourceSha256, v) }
      : { domain: ctx.domain, key: v, verdict: "ambiguo", reason: ctx.homologated.size ? "sem-valor-homologado-identico" : "catalogo-vazio-DADO_AGUARDADO", target: null, idempotencyKey: null });
  }
  return sortCandidates(out);
}

export function sortCandidates(c: Candidate[]): Candidate[] {
  return c.sort((a, b) => (a.domain + "\u0000" + a.key + "\u0000" + a.reason).localeCompare(b.domain + "\u0000" + b.key + "\u0000" + b.reason));
}

export function summarize(c: readonly Candidate[]) {
  const s: Record<string, Record<string, number>> = {};
  for (const x of c) { s[x.domain] ??= {}; const k = `${x.verdict}:${x.reason.startsWith("carga-") ? "carga-valida" : x.reason}`; s[x.domain]![k] = (s[x.domain]![k] ?? 0) + 1; }
  return s;
}

export function planFingerprint(c: readonly Candidate[]): string {
  return stableHash(c.map((x) => `${x.domain}|${x.key}|${x.verdict}|${x.reason}|${x.target ?? ""}|${x.idempotencyKey ?? ""}`).join("\n"));
}

/** Ordem futura de importação; cada passo nomeia o bloqueio que ainda o impede. */
export const FUTURE_IMPORT_SEQUENCE = [
  { step: 1, what: "Confirmação humana do mapeamento de colunas das fontes sem cabeçalho", blocker: "DEPENDE_DECISAO" },
  { step: 2, what: "Catálogos homologados de etapa/ano/turno/componente", blocker: "DADO_AGUARDADO" },
  { step: 3, what: "Matriz curricular oficial da rede (homologar-matrizes-curriculares)", blocker: "DADO_AGUARDADO + ASSIGNMENT_PENDING" },
  { step: 4, what: "Pessoas novas por staging governado (stage_import_batch), revisão das ambíguas", blocker: "PENDENTE" },
  { step: 5, what: "Abertura do ano 2027 pelo writer canônico", blocker: "DEPENDE_DECISAO (fora deste lote)" },
  { step: 6, what: "Turmas 2027 só de fonte 2027 real", blocker: "DADO_AGUARDADO" },
  { step: 7, what: "Lotações e jornadas 2027 após turmas e regra de vigência", blocker: "DEPENDE_DECISAO" },
] as const;

/**
 * EDUCACENSO.2 — catálogo de leiaute (puro). Parser e gerador usam ESTE esquema e nada mais.
 * O esquema vem do guia enviado pelo usuário (extração determinística em `scripts/educacenso-extract-layout.mjs`),
 * não do INEP: todo envio oficial fica bloqueado enquanto `officialBlockers` não estiver vazio.
 */
import guia from "./educacenso-2026-guia.json";
import regras from "./educacenso-2026-guia-regras.json";

export type FieldKind = "num" | "alfa" | "selec" | "data" | "email" | "hora" | "reservado" | "desconhecido";
export type FieldSpec = { n: number; name: string; obligation: string; size: { length?: number; fixed?: boolean; raw?: string }; type: string | null; rule: string | null; codes: { list: { code: string; label: string }[]; truncated: boolean } | null };
export type RecordSpec = { file: string; record: string; title: string; declaredFieldCount: number; fields: FieldSpec[]; groups: { from: number; to: number; title: string }[] };
export type FileRules = Omit<typeof regras, "lineTerminator"> & { lineTerminator: "pipe" | "sem-pipe" | null };
export type LayoutSpec = { source: { kind: string; file: string; sha256: string; inepConfronted: boolean }; year: string; stage: string; records: RecordSpec[]; rules: FileRules };

export const GUIA_2026: LayoutSpec = { ...(guia as unknown as Omit<LayoutSpec, "rules">), rules: regras as FileRules };

export function kindOf(f: FieldSpec): FieldKind {
  const t = (f.type ?? "").toLowerCase();
  if (f.obligation === "reservado" || f.size.length === 0) return "reservado";
  if (t === "num" || t.startsWith("numérico")) return "num";
  if (t === "alfa" || t === "texto" || t.startsWith("alfa")) return "alfa";
  if (t === "selec") return "selec";
  if (t === "data") return "data";
  if (t === "email") return "email";
  if (t === "hora") return "hora";
  return "desconhecido";
}

export type Severity = "erro" | "bloqueio" | "aviso";
export type Issue = { severity: Severity; line: number | null; record: string | null; field: number | null; code: string; text: string };

const validDate = (s: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s); if (!m) return false; const [dd, mm, yy] = [Number(m[1]), Number(m[2]), Number(m[3])]; const d = new Date(Date.UTC(yy, mm - 1, dd)); return d.getUTCDate() === dd && d.getUTCMonth() === mm - 1; };

/** Validação de UM campo exclusivamente pelo esquema. Vazio só é erro quando obrigatório "sim". */
export function checkField(rec: RecordSpec, f: FieldSpec, v: string, line: number | null): Issue[] {
  const out: Issue[] = []; const at = { line, record: rec.record, field: f.n };
  const k = kindOf(f);
  if (v === "") { if (f.obligation === "sim") out.push({ severity: "erro", ...at, code: "obrigatorio", text: `${f.name}: obrigatório` }); return out; }
  if (k === "reservado") { out.push({ severity: "erro", ...at, code: "reservado", text: `${f.name}: campo reservado deve ficar vazio` }); return out; }
  if (k === "desconhecido") { out.push({ severity: "bloqueio", ...at, code: "tipo-desconhecido", text: `${f.name}: tipo "${f.type}" não modelado` }); return out; }
  if (/[a-zà-ÿ]/.test(v) && k !== "email") out.push({ severity: "erro", ...at, code: "minuscula-ou-acento", text: `${f.name}: sem minúsculas nem acentos` });
  const L = f.size.length;
  if (L !== undefined) { if (f.size.fixed && v.length !== L) out.push({ severity: "erro", ...at, code: "tamanho-fixo", text: `${f.name}: exatamente ${L} caracteres` }); else if (!f.size.fixed && v.length > L) out.push({ severity: "erro", ...at, code: "tamanho-max", text: `${f.name}: até ${L} caracteres` }); }
  if (k === "num" && !/^\d+$/.test(f.type?.includes("XX") ? v.replace(/XX$/, "") : v)) out.push({ severity: "erro", ...at, code: "numerico", text: `${f.name}: só números` });
  if (k === "data" && !validDate(v)) out.push({ severity: "erro", ...at, code: "data", text: `${f.name}: data DD/MM/AAAA válida` });
  if (k === "hora" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) out.push({ severity: "erro", ...at, code: "hora", text: `${f.name}: hora HH:MM` });
  if (k === "selec" && f.codes) {
    if (!f.codes.list.some((c) => c.code === v)) out.push({ severity: f.codes.truncated ? "bloqueio" : "erro", ...at, code: "codigo", text: f.codes.truncated ? `${f.name}: código ${v} não confirmável (lista incompleta no guia)` : `${f.name}: código ${v} fora da lista` });
  } else if (k === "selec") out.push({ severity: "bloqueio", ...at, code: "lista-ausente", text: `${f.name}: lista de códigos não está no guia` });
  return out;
}

export type ParsedLine = { line: number; record: string; values: string[]; terminatedByPipe: boolean };
export function recordSpec(spec: LayoutSpec, code: string, file: "importacao" | "identificacao" = "importacao") {
  return spec.records.find((r) => r.file === file && (file === "identificacao" || r.record === code));
}

/** Separa uma linha. Com terminador não definido, aceita as duas formas só quando a contagem desambigua. */
export function splitLine(raw: string, count: number, terminator: "pipe" | "sem-pipe" | null): { values: string[] | null; terminatedByPipe: boolean } {
  const parts = raw.split("|");
  const asPipe = parts.length === count + 1 && parts[parts.length - 1] === "" ? parts.slice(0, -1) : null;
  const asBare = parts.length === count ? parts : null;
  if (terminator === "pipe") return { values: asPipe, terminatedByPipe: true };
  if (terminator === "sem-pipe") return { values: asBare, terminatedByPipe: false };
  if (asBare) return { values: asBare, terminatedByPipe: false };
  return { values: asPipe, terminatedByPipe: !!asPipe };
}

export function parseFile(text: string, spec: LayoutSpec, file: "importacao" | "identificacao" = "importacao"): { lines: ParsedLine[]; issues: Issue[] } {
  const issues: Issue[] = []; const lines: ParsedLine[] = [];
  const rows = text.replace(/\r\n/g, "\n").split("\n");
  if (rows.at(-1) === "") rows.pop();
  let prev = "^"; const perSchool: Record<string, number> = {}; let schools = 0; let ended = false;
  rows.forEach((raw, i) => {
    const ln = i + 1;
    if (file === "importacao" && /^99\|?$/.test(raw)) { if (ended) issues.push({ severity: "erro", line: ln, record: "99", field: null, code: "fim-duplicado", text: "Mais de um registro 99" }); ended = true; prev = "99"; return; }
    if (ended) { issues.push({ severity: "erro", line: ln, record: null, field: null, code: "apos-fim", text: "Linha depois do registro 99" }); return; }
    const code = file === "identificacao" ? "ID" : raw.slice(0, 2);
    const rec = recordSpec(spec, code, file);
    if (!rec) { issues.push({ severity: "erro", line: ln, record: code, field: null, code: "registro-desconhecido", text: `Registro "${code}" não existe no leiaute` }); return; }
    const sp = splitLine(raw, rec.declaredFieldCount, spec.rules.lineTerminator);
    if (!sp.values) { issues.push({ severity: "erro", line: ln, record: code, field: null, code: "contagem", text: `Registro ${code} exige ${rec.declaredFieldCount} campos (linha tem ${raw.split("|").length} partes)` }); return; }
    if (file === "importacao") {
      const allowed = (spec.rules.follows as Record<string, string[]>)[code] ?? [];
      if (!allowed.includes(prev) && !allowed.includes("*")) issues.push({ severity: "erro", line: ln, record: code, field: null, code: "ordem", text: `Registro ${code} não pode vir depois de ${prev === "^" ? "início do arquivo" : prev}` });
      if (code === "00") { schools++; for (const k of Object.keys(perSchool)) delete perSchool[k]; }
      perSchool[code] = (perSchool[code] ?? 0) + 1;
      const max = (spec.rules.maxRecordPerSchool as Record<string, number>)[code];
      if (max !== undefined && perSchool[code]! > max) issues.push({ severity: "erro", line: ln, record: code, field: null, code: "cardinalidade", text: `Registro ${code}: no máximo ${max} por escola` });
      if (code === "20" && perSchool[code]! > spec.rules.maxClassesPerSchool) issues.push({ severity: "erro", line: ln, record: code, field: null, code: "cardinalidade", text: `Mais de ${spec.rules.maxClassesPerSchool} turmas na escola` });
    }
    rec.fields.forEach((f, j) => issues.push(...checkField(rec, f, sp.values![j] ?? "", ln)));
    lines.push({ line: ln, record: code, values: sp.values, terminatedByPipe: sp.terminatedByPipe });
    prev = code;
  });
  if (file === "importacao") {
    if (!ended && rows.length) issues.push({ severity: "erro", line: null, record: "99", field: null, code: "sem-fim", text: "Arquivo sem registro 99 final" });
    if (schools > spec.rules.maxSchoolsPerFile) issues.push({ severity: "erro", line: null, record: "00", field: null, code: "cardinalidade", text: `Mais de ${spec.rules.maxSchoolsPerFile} escolas no arquivo` });
  }
  return { lines, issues };
}

export type GenerateMode = { mode: "oficial" } | { mode: "conferencia"; terminator: "pipe" | "sem-pipe" };
/** Gerador: mesma especificação do parser. Oficial recusa com qualquer bloqueio; conferência exige escolha explícita do terminador. */
export function generateFile(spec: LayoutSpec, lines: { record: string; values: string[] }[], opt: GenerateMode, file: "importacao" | "identificacao" = "importacao"): { text: string | null; issues: Issue[]; official: boolean } {
  const blockers = officialBlockers(spec);
  if (opt.mode === "oficial" && blockers.length) return { text: null, issues: blockers, official: false };
  const term = opt.mode === "oficial" ? (spec.rules.lineTerminator ?? "sem-pipe") : opt.terminator;
  const out: string[] = []; const issues: Issue[] = [];
  for (const l of lines) {
    const rec = recordSpec(spec, l.record, file);
    if (!rec) { issues.push({ severity: "erro", line: null, record: l.record, field: null, code: "registro-desconhecido", text: `Registro ${l.record}` }); continue; }
    if (l.values.length !== rec.declaredFieldCount) { issues.push({ severity: "erro", line: null, record: l.record, field: null, code: "contagem", text: `Registro ${l.record}: ${l.values.length}/${rec.declaredFieldCount} campos` }); continue; }
    if (l.values.some((v) => v.includes("|") || v.includes("\n"))) { issues.push({ severity: "erro", line: null, record: l.record, field: null, code: "separador-no-valor", text: "Valor contém separador" }); continue; }
    out.push(l.values.join("|") + (term === "pipe" ? "|" : ""));
  }
  if (file === "importacao") out.push(spec.rules.fileTerminator.line);
  const text = out.join("\n") + "\n";
  const reparsed = parseFile(text, { ...spec, rules: { ...spec.rules, lineTerminator: term } }, file);
  issues.push(...reparsed.issues);
  return { text: issues.some((i) => i.severity === "erro") ? null : text, issues, official: opt.mode === "oficial" };
}

/** Tudo o que impede gerar arquivo para envio oficial. Nunca vazio enquanto a fonte for só o guia. */
export function officialBlockers(spec: LayoutSpec): Issue[] {
  const b: Issue[] = [];
  const g = (code: string, text: string, record: string | null = null, field: number | null = null) => b.push({ severity: "bloqueio", line: null, record, field, code, text });
  if (!spec.source.inepConfronted) g("fonte-nao-confrontada", `Leiaute extraído de "${spec.source.file}" (guia do usuário), não confrontado com a documentação oficial INEP ${spec.year}.`);
  if (spec.rules.lineTerminator === null) g("terminador-indefinido", spec.rules.lineTerminatorNote);
  for (const r of spec.records) {
    const cond = r.fields.filter((f) => f.obligation === "condicional").length;
    if (cond) g("condicional-nao-modelada", `Registro ${r.record}: ${cond} campo(s) condicionais sem regra modelada.`, r.record);
    for (const f of r.fields) {
      if (f.codes?.truncated) g("lista-truncada", `Registro ${r.record} campo ${f.n} (${f.name}): lista de códigos incompleta no guia.`, r.record, f.n);
      if (kindOf(f) === "desconhecido") g("tipo-desconhecido", `Registro ${r.record} campo ${f.n}: tipo não modelado.`, r.record, f.n);
      if (kindOf(f) === "selec" && !f.codes) g("lista-ausente", `Registro ${r.record} campo ${f.n} (${f.name}): lista de códigos ausente.`, r.record, f.n);
    }
  }
  g("tabelas-auxiliares", "Tabelas auxiliares (Municípios, Distritos, DDD, Etapas, Países, IES, Cursos…) não carregadas: códigos de referência não são verificáveis.");
  g("anexos-nao-modelados", "Anexos 2–8 (campos comuns, idades, recursos×deficiência, etapas×organização, mediação, carga horária) não modelados.");
  g("certidao-dv", "Dígito verificador da certidão de nascimento não modelado.");
  return b;
}

export function specSummary(spec: LayoutSpec) {
  return spec.records.map((r) => ({ record: r.record, title: r.title, declared: r.declaredFieldCount, extracted: r.fields.length,
    required: r.fields.filter((f) => f.obligation === "sim").length, conditional: r.fields.filter((f) => f.obligation === "condicional").length,
    withCodes: r.fields.filter((f) => f.codes).length }));
}

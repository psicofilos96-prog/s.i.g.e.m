/**
 * Frente D — matching determinístico e auditável de profissionais (puro, sem gravação).
 * Pessoa ≠ vínculo ≠ cargo ≠ função ≠ lotação ≠ atuação ≠ regência ≠ capability.
 * CPF só entra como fingerprint (função injetada pelo pipeline seguro, com segredo de sessão);
 * nenhuma saída deste módulo contém CPF, nome completo, contato ou dado bancário.
 */
export type Fingerprint = (sensitive: string) => string;

export type SourceProfessionalRow = {
  locator: string; // arquivo/aba/linha
  cpf?: string | null;
  name?: string | null;
  functionalRegistration?: string | null; // matrícula pertence ao VÍNCULO
  role?: string | null; // cargo
  fn?: string | null; // função
  schoolInep?: string | null; // lotação
  sector?: string | null; // lotação em setor da SEMED
  validFrom?: string | null;
  validUntil?: string | null;
  declaredClassCode?: string | null; // "turma de atuação": só catalogada, nunca vira regência
};

export type ExistingPerson = { personId: string; cpfFingerprint: string | null };

export type StagedLink = { linkKey: string; registration: string | null; role: string | null; validFrom: string | null; validUntil: string | null; locators: string[] };
export type StagedPosting = { linkKey: string; target: { kind: "escola"; schoolId: string } | { kind: "setor"; sector: string }; fn: string | null; validFrom: string | null; validUntil: string | null; locator: string };
export type StagedPerson = { personKey: string; personId: string | null; links: StagedLink[]; postings: StagedPosting[]; declaredClassCodes: string[] };

export type ReconciliationIssue = { locator: string; code: string; ref?: string };

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
const digits = (v: string | null | undefined) => (v ? v.replace(/\D/g, "") : "");

export function validCpf(cpf: string): boolean {
  const d = digits(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function stageProfessionals(input: {
  rows: SourceProfessionalRow[];
  fingerprint: Fingerprint;
  existing: readonly ExistingPerson[];
  knownIneps: ReadonlySet<string>;
}): { persons: StagedPerson[]; issues: ReconciliationIssue[]; stats: Record<string, number> } {
  const issues: ReconciliationIssue[] = [];
  const byFp = new Map(input.existing.filter((p) => p.cpfFingerprint).map((p) => [p.cpfFingerprint!, p.personId]));
  const persons = new Map<string, StagedPerson>();
  const nameFp = new Map<string, Set<string>>();
  for (const r of input.rows) {
    const cpf = digits(r.cpf);
    // Sem CPF válido não há chave segura: nome sozinho nunca casa (risco de homônimo).
    if (!cpf) { issues.push({ locator: r.locator, code: "cpf-ausente-sem-chave-segura" }); continue; }
    if (!validCpf(cpf)) { issues.push({ locator: r.locator, code: "cpf-invalido", ref: input.fingerprint(cpf).slice(0, 12) }); continue; }
    const fp = input.fingerprint(cpf);
    const nm = clean(r.name)?.toLocaleLowerCase("pt-BR");
    if (nm) (nameFp.get(nm) ?? nameFp.set(nm, new Set()).get(nm)!).add(fp);
    let p = persons.get(fp);
    if (!p) { p = { personKey: fp, personId: byFp.get(fp) ?? null, links: [], postings: [], declaredClassCodes: [] }; persons.set(fp, p); }
    const reg = clean(r.functionalRegistration);
    const role = clean(r.role);
    if (!reg) issues.push({ locator: r.locator, code: "matricula-ausente", ref: fp.slice(0, 12) });
    // Vínculo: matrícula quando existe; sem matrícula, cargo+início (nunca funde com vínculo de matrícula).
    const linkKey = reg ? `mat:${reg}` : `sem-mat:${role ?? "?"}:${clean(r.validFrom) ?? "?"}`;
    let link = p.links.find((l) => l.linkKey === linkKey);
    if (!link) { link = { linkKey, registration: reg, role, validFrom: clean(r.validFrom), validUntil: clean(r.validUntil), locators: [] }; p.links.push(link); }
    else if (link.role !== role) issues.push({ locator: r.locator, code: "cargo-divergente-no-mesmo-vinculo", ref: fp.slice(0, 12) });
    link.locators.push(r.locator);
    const inep = clean(r.schoolInep);
    const sector = clean(r.sector);
    if (inep) {
      if (!input.knownIneps.has(inep)) issues.push({ locator: r.locator, code: "escola-inexistente" });
      else p.postings.push({ linkKey, target: { kind: "escola", schoolId: `inep-${inep}` }, fn: clean(r.fn), validFrom: clean(r.validFrom), validUntil: clean(r.validUntil), locator: r.locator });
    } else if (sector) {
      p.postings.push({ linkKey, target: { kind: "setor", sector }, fn: clean(r.fn), validFrom: clean(r.validFrom), validUntil: clean(r.validUntil), locator: r.locator });
    } else issues.push({ locator: r.locator, code: "lotacao-ausente", ref: fp.slice(0, 12) });
    const cc = clean(r.declaredClassCode);
    if (cc && !p.declaredClassCodes.includes(cc)) p.declaredClassCodes.push(cc);
  }
  let homonyms = 0;
  for (const set of nameFp.values()) if (set.size > 1) homonyms += set.size;
  const list = [...persons.values()];
  for (const p of list) if (!p.personId) issues.push({ locator: p.links[0]?.locators[0] ?? "?", code: "pessoa-nao-cadastrada", ref: p.personKey.slice(0, 12) });
  return {
    persons: list,
    issues,
    stats: {
      pessoas: list.length,
      pessoasCadastradas: list.filter((p) => p.personId).length,
      vinculos: list.reduce((n, p) => n + p.links.length, 0),
      lotacoes: list.reduce((n, p) => n + p.postings.length, 0),
      regencias: 0, // nunca inferida
      homonimosDistinguidosPorCpf: homonyms,
      erros: issues.length,
    },
  };
}

/** Relatório publicável: só contagens e códigos; nenhum fingerprint, nome ou CPF. */
export function aggregateReport(r: ReturnType<typeof stageProfessionals>) {
  const byCode: Record<string, number> = {};
  for (const i of r.issues) byCode[i.code] = (byCode[i.code] ?? 0) + 1;
  return { stats: r.stats, issuesByCode: byCode };
}

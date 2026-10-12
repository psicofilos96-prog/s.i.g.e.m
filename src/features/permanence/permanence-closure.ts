/**
 * SIGEM Permanência — L24: matriz de fechamento (41 seções + 18 critérios).
 * Cada lote declara evidência em disco; cada seção/critério do L01 é reavaliado pelos
 * lotes que o cobrem. Nenhum status "homologado": homologação exige ato real de pessoa
 * competente, e nenhuma regra, limiar, perfil ou modelo foi aprovado até aqui.
 */
import { PERM_CRITERIA, PERM_SECTIONS, type PermRow } from "./permanence-audit";

export const PERM_CLOSURE_BASE_SHA = "39f90b310a44e3706be8a9e2676849cdbefe2946";
export type PermClosureStatus = "persistido-com-tela" | "persistido" | "nucleo-testado" | "bloqueado";
export interface PermLot { lot: number; title: string; status: PermClosureStatus; evidence: string[]; blocker: string | null }

const F = "src/features/permanence";
const M = "drizzle/migrations";
const CAP = "Capacidade não atribuída em política homologada (decisão da rede).";
const ev = (name: string, mig?: string) => [`${F}/${name}.ts`, `${F}/${name}.test.ts`, ...(mig ? [`${M}/${mig}.sql`] : [])];

export const PERM_LOTS: readonly PermLot[] = [
  { lot: 1, title: "Auditoria", status: "nucleo-testado", evidence: ev("permanence-audit"), blocker: null },
  { lot: 2, title: "Monitoramento de frequência", status: "nucleo-testado", evidence: ev("attendance-monitoring"), blocker: null },
  { lot: 3, title: "Regras preventivas", status: "persistido", evidence: ev("preventive-rules", "0394_perm03_preventive_rules"), blocker: "Nenhuma regra aprovada." },
  { lot: 4, title: "Comunicações legais", status: "nucleo-testado", evidence: ev("legal-notifications"), blocker: "Redação normativa, limiar e destinatários não aprovados." },
  { lot: 5, title: "Central de alertas", status: "persistido", evidence: ev("alert-center", "0395_perm05_alert_center"), blocker: "Sem regra aprovada não nasce alerta." },
  { lot: 6, title: "Casos e sinalização fora da escola", status: "persistido", evidence: ev("permanence-cases", "0396_perm06_cases_out_of_school"), blocker: "Catálogo de prioridades não configurado." },
  { lot: 7, title: "Fluxo de acompanhamento", status: "nucleo-testado", evidence: ev("follow-up-flow"), blocker: "Fluxo só como rascunho não homologado." },
  { lot: 8, title: "Ficha individual", status: "nucleo-testado", evidence: ev("case-dossier"), blocker: CAP },
  { lot: 9, title: "Barreiras", status: "persistido", evidence: ev("barrier-catalog", "0397_perm09_barrier_catalog"), blocker: "Catálogo sem tipos aprovados." },
  { lot: 10, title: "Contatos com a família", status: "persistido", evidence: ev("family-contacts", "0398_perm10_contact_attempts"), blocker: null },
  { lot: 11, title: "Visitas e atendimentos", status: "persistido", evidence: ev("visits", "0399_perm11_visits"), blocker: CAP },
  { lot: 12, title: "Plano individual", status: "persistido", evidence: ev("individual-plan", "0400_perm12_individual_plans"), blocker: null },
  { lot: 13, title: "Encaminhamentos intersetoriais", status: "persistido", evidence: ev("referrals", "0401_perm13_referrals"), blocker: "Nenhum destino aprovado nem convênio registrado." },
  { lot: 14, title: "Retorno e acolhimento", status: "persistido", evidence: ev("school-return", "0402_perm14_school_return"), blocker: CAP },
  { lot: 15, title: "Pós-retorno e reincidência", status: "nucleo-testado", evidence: ev("post-return"), blocker: "Competência de encerrar/reabrir não decidida." },
  { lot: 16, title: "Ponte com Orientação Pedagógica", status: "nucleo-testado", evidence: ev("guidance-bridge"), blocker: CAP },
  { lot: 17, title: "Perfis por segmento (EI/EF/EJA)", status: "nucleo-testado", evidence: ev("segment-profiles"), blocker: "Nenhum perfil de segmento aprovado." },
  { lot: 18, title: "Mapa territorial agregado", status: "nucleo-testado", evidence: ev("territorial-map"), blocker: "Limiar de supressão não decidido." },
  { lot: 19, title: "Agenda", status: "nucleo-testado", evidence: ev("case-agenda"), blocker: "Destinatários de avisos não cadastrados." },
  { lot: 20, title: "Integrações setoriais e Família", status: "nucleo-testado", evidence: ev("sector-integrations"), blocker: "Modelo de aviso à família não aprovado." },
  { lot: 21, title: "Busca Ativa Escolar nacional", status: "bloqueado", evidence: ev("national-bae"), blocker: "Adesão municipal não comprovada; sem API documentada." },
  { lot: 22, title: "Relatórios", status: "nucleo-testado", evidence: ev("permanence-reports"), blocker: "Seis relatórios dependem de normas não aprovadas." },
  { lot: 23, title: "Painel, central e ficha", status: "persistido-com-tela", evidence: [...ev("permanence-hub-model"), `${F}/permanence-hub-page.tsx`, "src/routes/sigem-permanencia.tsx"], blocker: CAP },
  { lot: 24, title: "Fechamento e evidências", status: "nucleo-testado", evidence: [...ev("permanence-closure"), "supabase/tests/perm24_permanence_rls.sql"], blocker: "E2E autenticado no navegador não executado." },
];

/** Seção/critério do L01 → lotes que o cobrem (atribuição explícita, conferida por teste). */
const SECTION_LOTS: Record<number, number[]> = {
  1: [1], 2: [2], 3: [2], 4: [14], 5: [2, 14], 6: [2], 7: [2], 8: [3, 5], 9: [2, 3], 10: [2], 11: [2], 12: [5, 6],
  13: [7], 14: [7], 15: [10], 16: [11], 17: [13], 18: [4, 13], 19: [13], 20: [16], 21: [12], 22: [14, 15], 23: [15],
  24: [3], 25: [20], 26: [20], 27: [6], 28: [21], 29: [19, 20], 30: [19], 31: [23], 32: [18], 33: [22], 34: [22],
  35: [23], 36: [24], 37: [8, 20], 38: [8, 11, 13], 39: [5, 6], 40: [1], 41: [24],
};
const CRITERIA_LOTS: Record<number, number[]> = {
  1: [2], 2: [2], 3: [2], 4: [3, 5], 5: [5, 6], 6: [3], 7: [10, 11, 14], 8: [7], 9: [10], 10: [4, 20], 11: [13],
  12: [21], 13: [24], 14: [18], 15: [8, 13], 16: [5, 6], 17: [22], 18: [24],
};

/** Seções que permanecem bloqueadas por natureza normativa, mesmo com código pronto. */
const NORMATIVE_BLOCK = new Set(["s8", "s14", "s17", "s18", "s19", "s24", "s28", "s34", "c4", "c11", "c12", "c14"]);

export interface PermClosureRow { n: number; title: string; before: PermRow["status"]; status: PermClosureStatus; lots: number[]; blocker: string | null }

function close(rows: readonly PermRow[], map: Record<number, number[]>, prefix: "s" | "c"): PermClosureRow[] {
  const rank: PermClosureStatus[] = ["persistido-com-tela", "persistido", "nucleo-testado"];
  return rows.map((row) => {
    const lots = (map[row.n] ?? []).map((n) => PERM_LOTS.find((l) => l.lot === n)!).filter(Boolean);
    const best = rank.find((s) => lots.some((l) => l.status === s));
    const blocked = NORMATIVE_BLOCK.has(`${prefix}${row.n}`) || !best;
    return {
      n: row.n, title: row.title, before: row.status, lots: lots.map((l) => l.lot),
      status: blocked ? "bloqueado" : best!,
      blocker: blocked ? (lots.find((l) => l.blocker)?.blocker ?? (row.gap || "Sem lote que cubra.")) : (lots.find((l) => l.blocker)?.blocker ?? null),
    };
  });
}
export const PERM_CLOSURE_SECTIONS = close(PERM_SECTIONS, SECTION_LOTS, "s");
export const PERM_CLOSURE_CRITERIA = close(PERM_CRITERIA, CRITERIA_LOTS, "c");
export const permClosureSummary = (rows: readonly { status: PermClosureStatus }[]) =>
  rows.reduce<Record<PermClosureStatus, number>>((a, r) => ({ ...a, [r.status]: a[r.status] + 1 }), { "persistido-com-tela": 0, persistido: 0, "nucleo-testado": 0, bloqueado: 0 });

/** Cenários exigidos pelo L24 → teste que os prova (arquivo + trecho que deve existir nele). */
export const PERM_SCENARIOS: readonly { scenario: string; file: string; needle: string; layer: "ts" | "sql" | "e2e-pendente" }[] = [
  { scenario: "Frequência não lançada ≠ falta", file: `${F}/attendance-monitoring.test.ts`, needle: "sem lançamento", layer: "ts" },
  { scenario: "Alerta duplicado", file: `${F}/alert-center.test.ts`, needle: "idempot", layer: "ts" },
  { scenario: "Abertura concorrente de caso", file: `${M}/0395_perm05_alert_center.sql`, needle: "UNIQUE", layer: "sql" },
  { scenario: "Transferência", file: `${F}/attendance-monitoring.test.ts`, needle: "transferência", layer: "ts" },
  { scenario: "Criança sem matrícula", file: `${F}/permanence-cases.test.ts`, needle: "matr", layer: "ts" },
  { scenario: "EI/EF/EJA", file: `${F}/segment-profiles.test.ts`, needle: "EJA", layer: "ts" },
  { scenario: "Retorno", file: `${F}/school-return.test.ts`, needle: "retorno", layer: "ts" },
  { scenario: "Reincidência", file: `${F}/post-return.test.ts`, needle: "reincid", layer: "ts" },
  { scenario: "Notificação sem comprovante", file: `${F}/legal-notifications.test.ts`, needle: "comprov", layer: "ts" },
  { scenario: "Família não recebe ficha interna", file: `${F}/sector-integrations.test.ts`, needle: "familyNeverReceives", layer: "ts" },
  { scenario: "RLS e DML direto", file: "supabase/tests/perm24_permanence_rls.sql", needle: "perm24-ok", layer: "sql" },
  { scenario: "Documentos restritos", file: `${F}/case-agenda.test.ts`, needle: "read_sensitive_case_document", layer: "ts" },
  { scenario: "Fluxo autenticado no navegador", file: `${F}/permanence-hub-model.test.ts`, needle: "describe", layer: "e2e-pendente" },
];

export function permClosureProblems(exists: (p: string) => boolean, read: (p: string) => string): string[] {
  const p: string[] = [];
  if (PERM_LOTS.length !== 24) p.push("Esperados 24 lotes.");
  if (PERM_CLOSURE_SECTIONS.length !== 41 || PERM_CLOSURE_CRITERIA.length !== 18) p.push("Esperadas 41 seções e 18 critérios.");
  for (const l of PERM_LOTS) for (const e of l.evidence) if (!exists(e)) p.push(`L${l.lot}: evidência ausente ${e}`);
  for (const r of [...PERM_CLOSURE_SECTIONS, ...PERM_CLOSURE_CRITERIA]) if (r.lots.length === 0) p.push(`#${r.n} sem lote`);
  for (const s of PERM_SCENARIOS) {
    if (!exists(s.file)) { p.push(`${s.scenario}: arquivo ausente`); continue; }
    if (!read(s.file).toLowerCase().includes(s.needle.toLowerCase())) p.push(`${s.scenario}: "${s.needle}" não encontrado`);
  }
  return p;
}

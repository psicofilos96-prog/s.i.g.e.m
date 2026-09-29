/**
 * 6D.4.4 — Registro da Situação Acadêmica oficial.
 *
 * O ato materializa EXCLUSIVAMENTE a determinação canônica vigente. A
 * conferência captura uma impressão digital (fingerprint) dos fatos, da regra
 * e da deliberação oficial; no instante do registro a determinação é
 * reconstruída e, se a impressão divergir, nada é registrado (mesmo padrão de
 * Pauta/Fechamento). O lote reaproveita o ato estudante a estudante e só
 * registra depois de revalidar TODOS: divergência em qualquer um aborta o lote.
 */
import type { AcademicStandingStore } from "./academic-standing-store";
import { standingScopeKey } from "./academic-standing-store";
import type {
  AcademicStandingDetermination,
  AcademicStandingRecord,
  StandingActor,
} from "./academic-standing-types";

export const REGISTRATION_CONFIRMATION_NOTE =
  "Ao registrar, esta situação passa a integrar oficialmente a vida acadêmica do estudante com os fatos e a regra vigentes neste momento.";
export const REGISTRATION_STALE_REASON =
  "A situação acadêmica mudou desde a conferência. Nada foi registrado; a conferência foi refeita com os fatos atuais.";

/** Impressão digital do que seria materializado. Ordem estável. */
export function standingFingerprint(d: AcademicStandingDetermination): string {
  return JSON.stringify({
    standing: d.standingId ?? null,
    state: d.operationalState,
    rule: d.ruleSetId ? `${d.ruleSetId}@${d.ruleSetVersion}` : null,
    deliberation: d.deliberation
      ? `${d.deliberation.id}|${d.deliberation.minuteSource?.minuteId ?? ""}#${d.deliberation.minuteSource?.minuteVersion ?? ""}`
      : null,
    facts: d.facts
      .map((f) => ({
        k: `${f.factId}|${f.scopeKey}`,
        v: f.value,
        s: f.provenance.sources.map((s) => `${s.kind}:${s.id}@${s.version ?? ""}`).sort(),
      }))
      .sort((a, b) => a.k.localeCompare(b.k)),
  });
}

export type StandingRegistrability =
  | { registrable: true }
  | { registrable: false; reason: string };

export function standingRegistrability(
  d: AcademicStandingDetermination,
  store: Pick<AcademicStandingStore, "current">,
): StandingRegistrability {
  if (store.current(standingScopeKey({ cycleId: d.cycleId, studentId: d.studentId })))
    return { registrable: false, reason: "Já existe situação acadêmica oficial registrada." };
  if (d.operationalState !== "situacao-determinada" || !d.standingId)
    return {
      registrable: false,
      reason: d.reasons[0] ?? "As regras atuais não indicam situação: nada é presumido.",
    };
  return { registrable: true };
}

export type RegistrationResult =
  | { ok: true; records: AcademicStandingRecord[] }
  | { ok: false; stale: boolean; reasons: string[] };

/**
 * Registra as conferências. `rebuild(studentId)` reconstrói a determinação
 * canônica AGORA; `conferred` guarda a impressão vista pelo usuário.
 */
export function registerConferredStandings(input: {
  store: AcademicStandingStore;
  actor: StandingActor;
  conferred: readonly { studentId: string; fingerprint: string }[];
  rebuild: (studentId: string) => AcademicStandingDetermination | undefined;
  now?: string;
}): RegistrationResult {
  if (input.conferred.length === 0)
    return { ok: false, stale: false, reasons: ["Nenhuma situação conferida para registro."] };
  const fresh: AcademicStandingDetermination[] = [];
  for (const item of input.conferred) {
    const current = input.rebuild(item.studentId);
    if (!current || standingFingerprint(current) !== item.fingerprint)
      return { ok: false, stale: true, reasons: [REGISTRATION_STALE_REASON] };
    const check = standingRegistrability(current, input.store);
    if (!check.registrable) return { ok: false, stale: true, reasons: [check.reason] };
    fresh.push(current);
  }
  const records: AcademicStandingRecord[] = [];
  for (const determination of fresh) {
    const result = input.store.register({
      actor: input.actor,
      determination,
      ...(input.now ? { now: input.now } : {}),
    });
    // Pré-validação garante sucesso; defesa adicional sem registro parcial silencioso.
    if (!result.ok) return { ok: false, stale: false, reasons: result.reasons };
    records.push(result.value);
  }
  return { ok: true, records };
}

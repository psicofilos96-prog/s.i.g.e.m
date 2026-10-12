// L13 Tecnologia — painel de conectividade (0487). Só medições VERIFICADAS (confirmadas por pessoa ≠ quem
// registrou) entram nos números; comparação com o contratado só existe com contrato juntado. Nada é gravado.
export interface Link { id: string; schoolId: string; provider: string; contractedDown: number | null; contractedUp: number | null; validFrom: string; validUntil: string | null }
export interface Measurement { id: string; linkId: string; at: string; downMbps: number | null; upMbps: number | null; latencyMs: number | null; available: boolean | null; personId: string }
export interface Verification { measurementId: string; verdict: "confirmada" | "recusada"; personId: string }

export const CONNECTIVITY_WRITERS = ["register_tech_connectivity_link", "record_tech_connectivity_measurement", "verify_tech_connectivity_measurement"] as const;

export function verifiedOnly(ms: readonly Measurement[], vs: readonly Verification[]) {
  const ok = new Set(vs.filter((v) => v.verdict === "confirmada").map((v) => v.measurementId));
  const byId = new Map(ms.map((m) => [m.id, m]));
  // Defesa em profundidade: autoverificação nunca vale, mesmo se aparecer na leitura.
  return ms.filter((m) => ok.has(m.id) && vs.find((v) => v.measurementId === m.id)!.personId !== byId.get(m.id)!.personId);
}

const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const h = s.length >> 1; return s.length % 2 ? s[h]! : (s[h - 1]! + s[h]!) / 2; };

export function linkPanel(link: Link, ms: readonly Measurement[], vs: readonly Verification[]) {
  const all = ms.filter((m) => m.linkId === link.id);
  const v = verifiedOnly(all, vs);
  const down = median(v.flatMap((m) => (m.downMbps == null ? [] : [m.downMbps])));
  const avail = v.filter((m) => m.available !== null);
  return {
    linkId: link.id, schoolId: link.schoolId, provider: link.provider,
    contract: link.contractedDown == null ? "sem contrato juntado" : "contrato juntado",
    pendingVerification: all.filter((m) => !vs.some((x) => x.measurementId === m.id)).length,
    verifiedCount: v.length,
    medianDownMbps: down,
    medianLatencyMs: median(v.flatMap((m) => (m.latencyMs == null ? [] : [m.latencyMs]))),
    // Fração de medições verificadas com disponibilidade observada — não é SLA do contrato.
    availabilityShare: avail.length ? avail.filter((m) => m.available).length / avail.length : null,
    downVsContract: down != null && link.contractedDown != null ? down / link.contractedDown : null,
    lastVerifiedAt: v.map((m) => m.at).sort().at(-1) ?? null,
  };
}

export const connectivityPanel = (links: readonly Link[], ms: readonly Measurement[], vs: readonly Verification[]) =>
  links.map((l) => linkPanel(l, ms, vs));

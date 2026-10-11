/**
 * Lote 06 (Expansão) — Transporte escolar: núcleo puro sobre `school_transport_facts`.
 * Veículo/condutor ainda dependem de decisão (NTRANSP.3); estas regras só validam o que vier
 * de fonte real. Nunca publica endereço de estudante; coordenada só de fonte válida declarada.
 */

export type DocStatus = "vigente" | "vencido" | "sem-documento";
export function docStatus(validUntil: string | null, today: string): DocStatus {
  if (validUntil == null) return "sem-documento";
  return validUntil >= today ? "vigente" : "vencido";
}

export type Vehicle = Readonly<{ id: string; seats: number | null; accessibleSeats: number | null; docValidUntil: string | null }>;
export type Driver = Readonly<{ id: string; personId: string | null; licenseValidUntil: string | null }>;

/** Viagem só é autorizável com veículo e condutor documentados e capacidade conhecida suficiente. */
export function tripBlockers(v: Vehicle, d: Driver, riders: number, needAccessible: number, today: string): string[] {
  const out: string[] = [];
  if (docStatus(v.docValidUntil, today) !== "vigente") out.push("documento-do-veiculo");
  if (!d.personId) out.push("condutor-sem-pessoa");
  if (docStatus(d.licenseValidUntil, today) !== "vigente") out.push("habilitacao-do-condutor");
  if (v.seats == null) out.push("capacidade-nao-informada");
  else if (riders > v.seats) out.push("lotacao-excedida");
  if (needAccessible > 0 && (v.accessibleSeats ?? 0) < needAccessible) out.push("acessibilidade-insuficiente");
  return out;
}

/** Coordenada só de fonte declarada válida; ponto sem fonte não vai ao mapa. */
export type GeoSource = "cadastro-oficial" | "geocodificacao-verificada";
export function mappable(p: { lat: number | null; lng: number | null; source: GeoSource | null }) {
  return p.source != null && p.lat != null && p.lng != null && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

/** Projeção pública/painel: nunca endereço nem coordenada de estudante, só contagens por ponto. */
export function publicStopView(stop: { id: string; label: string; riders: readonly { studentId: string; address?: string }[] }) {
  return { id: stop.id, label: stop.label, atendidos: stop.riders.length };
}

/** Quilometragem e custo: só com leituras de hodômetro válidas; regressão ⇒ inconsistência, não número. */
export function tripDistance(start: number | null, end: number | null) {
  if (start == null || end == null) return { kind: "nao-apurado" as const };
  if (end < start) return { kind: "inconsistente" as const };
  return { kind: "apurado" as const, km: end - start };
}
export function tripCost(km: number | null, ratePerKm: number | null) {
  return km == null || ratePerKm == null ? null : Math.round(km * ratePerKm * 100) / 100;
}

/** Sugestão de otimização nunca é aplicada: só ordem proposta com motivo, para revisão humana. */
export function suggestStopOrder(stops: readonly { id: string; seq: number; safe: boolean | null }[]) {
  const unsafe = stops.filter((s) => s.safe !== true).map((s) => s.id);
  if (unsafe.length) return { kind: "bloqueada" as const, reason: "ponto-sem-avaliacao-de-seguranca", stops: unsafe };
  return { kind: "sugestao" as const, requiresHumanReview: true, order: [...stops].sort((a, b) => a.seq - b.seq).map((s) => s.id) };
}

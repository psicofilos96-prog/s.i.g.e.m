import { describe, expect, it } from "vitest";
import { openMapCorrection, projectMapStatus, segregationBlocks, type MapEvent, type MapVersionRow } from "./map-domain";

const v1: MapVersionRow & { correctionEventId: string | null } = { id: "v1", version: 1, supersedesId: null, conferenceEventId: "c1", fingerprint: "f", recordedAt: "2026-01-02", correctionEventId: null };
const c1: MapEvent = { id: "c1", kind: "conferencia", fingerprint: "f", recordedAt: "2026-01-01", payload: {}, personId: "maria" };

describe("segregação e correção do Mapa", () => {
  it("mesma pessoa com duas atuações não confere e oficializa", () => {
    expect(segregationBlocks("maria", "maria")).toBe(true);
    expect(segregationBlocks("maria", "joao")).toBe(false);
    expect(segregationBlocks(null, "joao")).toBe(true);
  });
  it("sem abertura formal, nova conferência não vale para correção", () => {
    const c2: MapEvent = { ...c1, id: "c2", recordedAt: "2026-01-03" };
    const s = projectMapStatus(true, [c1, c2], [v1]);
    expect(s.id).toBe("oficializado");
    expect(openMapCorrection([c1, c2], [v1])).toBeNull();
  });
  it("abertura com motivo, depois conferência ⇒ conferido; versão oficial permanece", () => {
    const o: MapEvent = { id: "o1", kind: "abertura-correcao", fingerprint: null, recordedAt: "2026-01-03", payload: { reason: "erro", baseVersionId: "v1" }, personId: "ana" };
    const c2: MapEvent = { ...c1, id: "c2", recordedAt: "2026-01-04" };
    expect(projectMapStatus(true, [c1, o], [v1])).toMatchObject({ id: "oficializado", currentVersionId: "v1", correctionInProgress: true });
    expect(projectMapStatus(true, [c1, o, c2], [v1]).id).toBe("conferido");
  });
  it("abertura consumida por versão corretiva não reabre", () => {
    const o: MapEvent = { id: "o1", kind: "abertura-correcao", fingerprint: null, recordedAt: "2026-01-03", payload: { reason: "erro", baseVersionId: "v1" } };
    const v2 = { ...v1, id: "v2", version: 2, supersedesId: "v1", correctionEventId: "o1" };
    expect(openMapCorrection([o], [v1, v2])).toBeNull();
  });
});

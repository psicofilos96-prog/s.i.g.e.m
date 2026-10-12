import { describe, expect, it } from "vitest";
import { openRequest, applyEvent, stateOf, overdue, addVersion, retention, agenda, CAP_ATTEND, CAP_DELIVER, type Request, type ReqEvent, type DocVersion } from "./requests-documents";

const ev = (seq: number, to: ReqEvent["to"], extra: Partial<ReqEvent> = {}): ReqEvent => ({ seq, key: `k${seq}`, to, by: "ana", at: "t", capabilities: [CAP_ATTEND], ...extra });
const run = (r: Request, es: ReqEvent[]) => es.reduce((acc, e) => { const x = applyEvent(acc, e); if (!x.ok) throw new Error(x.reason); return x.request; }, r);
const H = "a".repeat(64), H2 = "b".repeat(64);

describe("CIECE L17 solicitações, acervo e agenda", () => {
  it("protocolo vem do GED e o fluxo exige classificação, responsável e conferente distinto", () => {
    const r = openRequest([{ type: "requerimento", year: 2026, unit: "CIECE", seq: 4 }], 2026, "CIECE", "escola-A", "matrículas EJA");
    expect(r.protocol).toBe("REQUERIMENTO Nº 005/2026 — CIECE");
    expect(applyEvent(r, ev(1, "classificada"))).toMatchObject({ ok: false, reason: "classificacao-ausente" });
    const r2 = run(r, [ev(1, "classificada", { classification: "estatistica" }), ev(2, "atribuida", { assignee: "eng-1", deadline: { date: "2026-10-20", sourceDoc: "oficio-12" } }), ev(3, "em-elaboracao"), ev(4, "em-conferencia")]);
    expect(applyEvent(r2, ev(5, "entregue", { capabilities: [CAP_DELIVER], deliverableRef: "doc-1" }))).toMatchObject({ reason: "conferente-igual-ao-elaborador" });
    expect(applyEvent(r2, ev(5, "entregue", { by: "bia", deliverableRef: "doc-1" }))).toMatchObject({ reason: `sem-capacidade:${CAP_DELIVER}` });
    const done = run(r2, [ev(5, "entregue", { by: "bia", capabilities: [CAP_DELIVER], deliverableRef: "doc-1" })]);
    expect(stateOf(done)).toBe("entregue");
    expect(applyEvent(done, ev(5, "entregue", { by: "bia" }))).toMatchObject({ ok: true }); // idempotente
    expect(overdue(r2, "2026-10-21")).toBe(true); expect(overdue(done, "2026-10-21")).toBe(false);
  });
  it("prazo só com documento de origem; sem prazo não há atraso", () => {
    const r = openRequest([], 2026, "CIECE", "x", "y");
    expect(applyEvent(r, ev(1, "classificada", { classification: "c", deadline: { date: "2026-10-01", sourceDoc: "" } }))).toMatchObject({ reason: "prazo-sem-documento-de-origem" });
    expect(overdue(r, "2030-01-01")).toBeNull();
  });
  it("acervo versionado por hash, privado, classe imutável; retenção sem decisão retém", () => {
    const v = (version: number, sha256: string, o: Partial<DocVersion> = {}): DocVersion => ({ docId: "d", version, cls: "recibo", path: "ciece/d.pdf", sha256, uploadedBy: "u", at: "t", supersedes: version > 1 ? version - 1 : null, ...o });
    const a = addVersion([], v(1, H)); expect(a.ok).toBe(true); if (!a.ok) return;
    expect(addVersion(a.chain, v(2, H)).ok && (addVersion(a.chain, v(2, H)) as { chain: unknown[] }).chain.length).toBe(1);
    expect(addVersion(a.chain, v(2, H2, { cls: "ata" }))).toMatchObject({ reason: "classe-imutavel" });
    expect(addVersion(a.chain, v(3, H2))).toMatchObject({ reason: "versao-fora-da-cadeia" });
    expect(addVersion([], v(1, H, { path: "https://x/y.pdf" }))).toMatchObject({ reason: "caminho-nao-privado" });
    expect(retention({}, "recibo", "2020-01-01", "2099-01-01")).toBe("reter");
  });
  it("agenda só com data e documento de origem", () => {
    const g = agenda([{ id: "mi", title: "Data de referência", kind: "censo", date: "2026-05-27", sourceDoc: { id: "portaria", sha256: H, excerpt: "..." } }, { id: "sa", title: "Situação do Aluno", kind: "censo", date: "2027-02-01", sourceDoc: null }, { id: "lv", title: "Levantamento", kind: "levantamento", date: null, sourceDoc: { id: "o", sha256: H, excerpt: "" } }]);
    expect(g.dated.map((i) => i.id)).toEqual(["mi"]);
    expect(g.pendingSource).toEqual([{ id: "sa", reason: "sem-documento-de-origem" }, { id: "lv", reason: "sem-data-no-documento" }]);
  });
});

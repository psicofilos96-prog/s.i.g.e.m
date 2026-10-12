import { describe, it, expect } from "vitest";
import { viewRange, buildAgenda, recordDocVersion, runOpReport, OP_REPORTS, type AgendaSourceItem, type OpDocVersion } from "./op-agenda-docs-reports";

const it1: AgendaSourceItem = { kind: "reuniao", sourceRef: "m1", date: "2026-04-07", title: "Planejamento coletivo", schoolId: "s1", visibleTo: "participantes", participants: ["eng-t1"] };
const it2: AgendaSourceItem = { kind: "conselho", sourceRef: "c1", date: "2026-04-11", title: "Conselho 1º bim", schoolId: "s1", visibleTo: "unidade", participants: [] };
const hash = "a".repeat(64);
const doc = (o: Partial<OpDocVersion> = {}): OpDocVersion => ({ logicalId: "d1", version: 1, kind: "diretriz", schoolId: "s1", title: "Diretriz de leitura", fileRef: "op/s1/d1.pdf", sha256: hash,
  authorPersonId: "op1", reason: null, signature: null, idempotencyKey: "k1", ...o });
const ctx = { personNatural: true, personId: "op1", canWriteScope: true };

describe("OP Lote 19 — agenda, documentos e relatórios", () => {
  it("visões dia/semana/mês/período", () => {
    expect(viewRange("semana", "2026-04-08")).toEqual({ from: "2026-04-06", to: "2026-04-12" });
    expect(viewRange("mes", "2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(() => viewRange("periodo", "2026-04-08")).toThrow();
  });
  it("agenda usa calendário oficial lido; sem calendário = não resolvido; visibilidade por participante/unidade", () => {
    const a = buildAgenda({ view: "semana", anchor: "2026-04-08", viewer: { schoolId: "s1", engagementId: "eng-t1", isUnitOp: false },
      days: [{ date: "2026-04-07", effect: "letivo", label: null }, { date: "2026-04-11", effect: "nao-letivo", label: "Sábado" }], items: [it1, it2] });
    expect(a.days.find((d) => d.date === "2026-04-07")!.items).toHaveLength(1);
    expect(a.days.find((d) => d.date === "2026-04-11")!.items).toHaveLength(0);
    const op = buildAgenda({ view: "semana", anchor: "2026-04-08", viewer: { schoolId: "s1", engagementId: "eng-op", isUnitOp: true }, days: null, items: [it1, it2] });
    expect(op.calendarRead).toBe(false);
    expect(op.days.find((d) => d.date === "2026-04-11")).toMatchObject({ effect: "nao-resolvido", warning: expect.stringMatching(/não resolvido/) });
  });
  it("GED versionada: hash, armazenamento privado, motivo, idempotência, assinatura real", () => {
    expect(recordDocVersion(doc(), [], ctx).ok).toBe(true);
    expect(recordDocVersion(doc(), [doc()], ctx)).toMatchObject({ ok: true, replay: true });
    expect(recordDocVersion(doc({ fileRef: "https://x/y.pdf" }), [], ctx).ok).toBe(false);
    expect(recordDocVersion(doc({ sha256: "x" }), [], ctx).ok).toBe(false);
    expect(recordDocVersion(doc({ version: 2, idempotencyKey: "k2" }), [doc()], ctx).ok).toBe(false);
    expect(recordDocVersion(doc({ version: 2, idempotencyKey: "k2", reason: "revisão" }), [doc()], ctx).ok).toBe(true);
    expect(recordDocVersion(doc({ signature: { kind: "qualificada-icp", personId: "op1", icpEvidence: null } }), [], ctx).ok).toBe(false);
    expect(recordDocVersion(doc({ signature: { kind: "simples", personId: "outro", icpEvidence: null } }), [], ctx).ok).toBe(false);
    expect(recordDocVersion(doc(), [], { ...ctx, personNatural: false }).ok).toBe(false);
  });
  it("catálogo cobre os 11 relatórios pedidos em PDF/XLSX", () => {
    expect(OP_REPORTS).toHaveLength(11);
    expect(OP_REPORTS.every((r) => r.formats.includes("pdf") && r.formats.includes("xlsx"))).toBe(true);
  });
  const signer = { kind: "simples" as const, personId: "op1", icpEvidence: null };
  const params = { escola: "s1", de: "2026-04-01", ate: "2026-04-30" };
  it("relatório exige fonte lida e assinatura real; sensível sai por padrão", () => {
    const rows = [{ habilidade: "EF01LP01", sinal: "continuar", estudante: "Ana" }];
    expect(runOpReport({ reportId: "op-recuperacao", params, rows: null, viewer: "unidade", format: "pdf", signer, sourceReadAt: null }).ok).toBe(false);
    expect(runOpReport({ reportId: "op-recuperacao", params, rows, viewer: "unidade", format: "pdf", signer: null, sourceReadAt: "t" }).ok).toBe(false);
    const r = runOpReport({ reportId: "op-recuperacao", params, rows, viewer: "unidade", format: "xlsx", signer, sourceReadAt: "t" });
    expect(r.ok).toBe(true); if (!r.ok) return;
    expect(r.result.columns.map((c) => c.id)).not.toContain("estudante");
    expect(r.meta[0]).toMatch(/Fonte: op-recovery/);
    expect(r.signature).toMatch(/simples/);
  });
  it("central só panorama, sem individual e com supressão aplicada", () => {
    expect(runOpReport({ reportId: "op-recuperacao", params, rows: [], viewer: "central", format: "pdf", signer, sourceReadAt: "t" }).ok).toBe(false);
    expect(runOpReport({ reportId: "op-panorama-rede", params, rows: [{ escola: "s1", estudantes: 3, professores: 12 }], viewer: "central", format: "pdf", signer, sourceReadAt: "t" }).ok).toBe(false);
    expect(runOpReport({ reportId: "op-panorama-rede", params, rows: [{ escola: "s1", estudantes: 230, professores: 12 }], viewer: "central", format: "pdf", signer, sourceReadAt: "t" }).ok).toBe(true);
  });
});

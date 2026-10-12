import { describe, it, expect } from "vitest";
import { recordProjectVersion, projectProjects, reuseProject, projectSchedule, projectTaskDrafts, projectsFor, NETWORK_PROJECT_CAP, type ProjectContent, type RecordProjectInput } from "./op-projects";
import type { OpDesignation } from "./op-designations";

const desig = (role: OpDesignation["role"], schoolIds: OpDesignation["schoolIds"]): OpDesignation => ({ logicalId: role, role, personId: "p1", schoolIds, classIds: null, from: "2026-01-01", to: null, substituteOf: null, history: [] });
const content = (o: Partial<ProjectContent> = {}): ProjectContent => ({ title: "Leitura em família", objectives: ["Ampliar fluência"], audience: "3º ano", schoolIds: ["e1"],
  responsibleEngagementIds: ["eng1"], from: "2026-03-01", to: "2026-06-30",
  activities: [{ id: "a1", title: "Roda de leitura", from: "2026-03-10", to: "2026-03-20", responsibleEngagementId: "eng1" }],
  resources: ["livros"], indicators: [{ id: "i1", label: "Fluência", source: "avaliacao-docente" }], evidences: [], results: [], status: "em-execucao", ...o });
const base = (o: Partial<RecordProjectInput> = {}): RecordProjectInput => ({ personNatural: true, personId: "p1", date: "2026-03-01", scope: "escola", ownerSchoolId: "e1",
  logicalId: "pr1", expectedVersion: 0, content: content(), reason: null, idempotencyKey: "k1", copiedFromLogicalId: null,
  designations: [desig("orientador-da-unidade", ["e1"])], capabilities: [{ id: "registrar-acompanhamento-pedagogico", scope: "escola", schoolId: "e1" }], existing: [], ...o });

describe("OP Lote 14 — projetos pedagógicos", () => {
  it("orientador cria projeto escolar; replay idempotente não duplica", () => {
    const r = recordProjectVersion(base(), "v1", "t"); expect(r.ok).toBe(true);
    if (!r.ok) return;
    const again = recordProjectVersion(base({ existing: [r.version] }), "v2", "t");
    expect(again.ok && again.replay).toBe(true);
  });
  it("fail-closed: executor técnico, sem capacidade, central registrando escola", () => {
    expect(recordProjectVersion(base({ personNatural: false }), "v", "t").ok).toBe(false);
    expect(recordProjectVersion(base({ capabilities: [] }), "v", "t").ok).toBe(false);
    expect(recordProjectVersion(base({ designations: [desig("coordenacao-central-op", "rede")] }), "v", "t").ok).toBe(false);
  });
  it("projeto da rede exige designação central + capacidade de rede, sem escola dona", () => {
    const net = base({ scope: "rede", ownerSchoolId: null, content: content({ schoolIds: ["e1", "e2"] }), designations: [desig("coordenacao-central-op", "rede")] });
    expect(recordProjectVersion(net, "v", "t").ok).toBe(false);
    expect(recordProjectVersion({ ...net, capabilities: [{ id: NETWORK_PROJECT_CAP, scope: "rede", schoolId: null }] }, "v", "t").ok).toBe(true);
  });
  it("nova versão exige motivo e base; evidência não some; encerrado não se edita", () => {
    const v1 = (recordProjectVersion(base(), "v1", "t") as { version: any }).version;
    const withEv = content({ evidences: [{ id: "ev1", ref: "doc://foto", activityId: "a1", recordedBy: "p1" }] });
    expect(recordProjectVersion(base({ existing: [v1], expectedVersion: 1, idempotencyKey: "k2", content: withEv }), "v2", "t").ok).toBe(false);
    const v2 = recordProjectVersion(base({ existing: [v1], expectedVersion: 1, idempotencyKey: "k2", content: withEv, reason: "evidência" }), "v2", "t");
    expect(v2.ok).toBe(true); if (!v2.ok) return;
    expect(recordProjectVersion(base({ existing: [v1, v2.version], expectedVersion: 1, idempotencyKey: "k3", reason: "x" }), "v3", "t").ok).toBe(false);
    expect(recordProjectVersion(base({ existing: [v1, v2.version], expectedVersion: 2, idempotencyKey: "k3", reason: "x" }), "v3", "t").ok).toBe(false); // remove evidência
    const done = recordProjectVersion(base({ existing: [v1, v2.version], expectedVersion: 2, idempotencyKey: "k4", reason: "fim",
      content: content({ ...withEv, status: "concluido", results: [{ indicatorId: "i1", value: "melhora", evidenceIds: ["ev1"], observedOn: "2026-06-30" }] }) }), "v4", "t");
    expect(done.ok).toBe(true); if (!done.ok) return;
    expect(recordProjectVersion(base({ existing: [v1, v2.version, done.version], expectedVersion: 3, idempotencyKey: "k5", reason: "x", content: done.version.content }), "v5", "t").ok).toBe(false);
    expect(projectProjects([v1, v2.version, done.version]).list[0]!.head.version).toBe(3);
  });
  it("resultado sem evidência e termo punitivo são recusados", () => {
    expect(recordProjectVersion(base({ content: content({ results: [{ indicatorId: "i1", value: "ok", evidenceIds: [], observedOn: "2026-04-01" }] }) }), "v", "t").ok).toBe(false);
    expect(recordProjectVersion(base({ content: content({ objectives: ["Evitar reprovação por advertência"] }) }), "v", "t").ok).toBe(false);
  });
  it("reaproveitamento só de concluído, sem datas/responsáveis/evidências/resultados", () => {
    const v = { ...(recordProjectVersion(base(), "v1", "t") as { version: any }).version };
    expect(reuseProject(v, { scope: "escola", ownerSchoolId: "e2" }).ok).toBe(false);
    v.content = { ...v.content, status: "concluido", evidences: [{ id: "x", ref: "r", activityId: null, recordedBy: "p1" }] };
    const r = reuseProject(v, { scope: "escola", ownerSchoolId: "e2" });
    expect(r.ok && r.content.evidences.length === 0 && r.content.from === "" && r.content.schoolIds[0] === "e2" && r.copiedFromLogicalId === "pr1").toBe(true);
  });
  it("cronograma, tarefas na Central (dedupe estável) e visões escola × central", () => {
    const v = (recordProjectVersion(base(), "v1", "t") as { version: any }).version;
    expect(projectSchedule(v.content, "2026-03-15")[0]!.situation).toBe("em-curso");
    const t = projectTaskDrafts(v, "e1"); expect(t[0]!.dedupeKey).toBe("fonte:op-projeto:pr1:a1:e1");
    expect(projectTaskDrafts(v, "e9")).toEqual([]);
    expect(projectsFor({ kind: "central" }, [v])).toEqual({ visible: [], schoolProjectCount: "suprimido" });
    expect(projectsFor({ kind: "escola", schoolId: "e1" }, [v]).visible).toHaveLength(1);
  });
});

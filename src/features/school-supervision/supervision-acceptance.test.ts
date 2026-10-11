/**
 * Lote 12 Supervisão — aceite técnico integrado sobre os núcleos puros (sem banco).
 * Perfis sintéticos: coordenador C, supervisores A/B, apoio P, direção D1 (E1), secretaria S2 (E2).
 * NÃO é E2E autenticado: prova regras, não RLS. RLS/ledger no banco aguardam decisão do coordenador.
 */
import { describe, it, expect } from "vitest";
import { appendAssignment, accessLevel, type AssignmentEvent, type Viewer } from "./supervision-access";
import { visibleSchools, networkRegularity } from "./supervision-regularity";
import { appendNc, project as ncProject, type NcEvent } from "./supervision-nonconformity";
import { appendExp, receipts } from "./supervision-guidance";
import { compute } from "./supervision-records";

const base = { human: true, reason: null, at: "2026-02-01", sharedFromAssignmentId: null };
function assign(): AssignmentEvent[] {
  let log: AssignmentEvent[] = [];
  const add = (e: Omit<AssignmentEvent, "seq">) => { const r = appendAssignment(log, e, log.at(-1)?.seq ?? 0); if (!r.ok) throw new Error(r.code); log = r.value; };
  add({ ...base, kind: "atribuir", assignmentId: "a1", supervisorPrincipalId: "A", schoolId: "E1", from: "2026-02-01", to: "2026-06-30", level: "conferir", byPrincipalId: "C", byRole: "coordenador" });
  add({ ...base, kind: "atribuir", assignmentId: "b1", supervisorPrincipalId: "B", schoolId: "E2", from: "2026-02-01", to: null, level: "conferir", byPrincipalId: "C", byRole: "coordenador" });
  add({ ...base, kind: "compartilhar", assignmentId: "p1", supervisorPrincipalId: "P", schoolId: "E1", from: "2026-03-01", to: "2026-04-30", level: "registrar", byPrincipalId: "A", byRole: "supervisor", reason: "apoio na visita", sharedFromAssignmentId: "a1" });
  return log;
}
const V = (principalId: string, role: Viewer["role"], schoolEngagements: string[] = []): Viewer => ({ principalId, role, schoolEngagements, capabilityOk: true });

describe("aceite: distribuição temporal e acesso cruzado", () => {
  const log = assign();
  it("cada perfil só alcança a própria escola na janela", () => {
    expect(accessLevel(log, V("A", "supervisor"), "E1", "2026-03-10")).toBe("conferir");
    expect(accessLevel(log, V("A", "supervisor"), "E2", "2026-03-10")).toBe("nenhum");
    expect(accessLevel(log, V("A", "supervisor"), "E1", "2026-07-01")).toBe("nenhum");
    expect(accessLevel(log, V("B", "supervisor"), "E1", "2026-03-10")).toBe("nenhum");
    expect(accessLevel(log, V("P", "apoio"), "E1", "2026-03-10")).toBe("registrar");
    expect(accessLevel(log, V("P", "apoio"), "E1", "2026-05-10")).toBe("nenhum");
    expect(accessLevel(log, V("D1", "direcao", ["E1"]), "E2", "2026-03-10")).toBe("nenhum");
    expect(accessLevel(log, V("S2", "secretaria", ["E2"]), "E2", "2026-03-10")).toBe("consultar");
    expect(accessLevel(log, { ...V("C", "coordenador"), capabilityOk: false }, "E1", "2026-03-10")).toBe("nenhum");
  });
  it("auditor de B nunca mostra E1; revogação derruba o compartilhamento", () => {
    const schools = visibleSchools(log, V("B", "supervisor"), ["E1", "E2"], "2026-03-10");
    expect(schools).toEqual(["E2"]);
    const r = networkRegularity({ secretariatRows: [], spans: [], classes: [], results: [], movements: [], calendars: [{ schoolId: "E1", applicableIds: [] }] }, schools);
    expect(r.indications).toHaveLength(0);
    const rev = appendAssignment(log, { ...base, kind: "revogar", assignmentId: "a1", supervisorPrincipalId: "A", schoolId: "E1", from: "2026-03-15", to: null, level: "nenhum", byPrincipalId: "C", byRole: "coordenador", reason: "redistribuição" }, log.at(-1)!.seq);
    if (!rev.ok) throw new Error(rev.code);
    expect(accessLevel(rev.value, V("P", "apoio"), "E1", "2026-03-20")).toBe("nenhum");
    expect(appendAssignment(log, { ...base, kind: "atribuir", assignmentId: "x", supervisorPrincipalId: "B", schoolId: "E1", from: "2026-02-01", to: null, level: "conferir", byPrincipalId: "A", byRole: "supervisor" }, log.at(-1)!.seq)).toEqual({ ok: false, code: "only-coordinator-assigns" });
  });
});

describe("aceite: não conformidade → orientação → resposta → verificação → reabertura", () => {
  it("percurso completo com autorias distintas e sem recibo fictício", () => {
    let nc: NcEvent[] = [];
    const go = (e: Omit<NcEvent, "seq">) => { const r = appendNc(nc, e, nc.length, null); if (!r.ok) throw new Error(r.code); nc = r.value; };
    const b = { caseId: "c1", isHuman: true, at: "2026-03-10", reason: null } as const;
    go({ ...b, kind: "observar", principalId: "P", level: "registrar", side: "supervisao", schoolId: "E1", area: "escrituracao", normRef: "ref documental", evidencePaths: ["supervisao/E1/v1/f.jpg"], priority: null });
    go({ ...b, kind: "analisar", principalId: "A", level: "conferir", side: "supervisao" });
    go({ ...b, kind: "confirmar", principalId: "A", level: "conferir", side: "supervisao" });

    let exp = appendExp([], { expId: "x1", kind: "emitir", principalId: "A", isHuman: true, at: "2026-03-11", templateId: "t", schoolId: "E1", grounding: "ref", dueOn: "2026-03-20", level: "conferir", recipients: [{ accountId: "D1", schoolId: "E1", sector: "direcao" }], attachments: [] },
      0, [{ id: "t", kind: "solicitacao-regularizacao", homologated: false, requiresGrounding: true, requiresDeadline: true }], () => true);
    if (!exp.ok) throw new Error(exp.code);
    expect(receipts(exp.value, "2026-03-12")!.perRecipient[0]!.read).toBeNull();
    const resp = appendExp(exp.value, { expId: "x1", kind: "responder", principalId: "D1", isHuman: true, at: "2026-03-15", text: "livro regularizado" }, 1, [], () => true);
    expect(resp.ok).toBe(true);

    go({ ...b, kind: "iniciar-providencias", principalId: "A", level: "conferir", side: "supervisao" });
    go({ ...b, kind: "solicitar-verificacao", principalId: "P", level: "registrar", side: "supervisao" });
    go({ ...b, kind: "verificar", principalId: "A", level: "conferir", side: "supervisao", verifiedOk: true });
    expect(ncProject(nc).state).toBe("regularizada");
    go({ ...b, kind: "reabrir", principalId: "A", level: "conferir", side: "supervisao", reason: "reincidência" });
    expect(ncProject(nc)).toMatchObject({ state: "em-analise", reopenings: 1 });
    expect(compute("regularizacao", null, 1, "2026-01-01", "2026-06-30")!.state).toBe("nao-informado");
  });
});

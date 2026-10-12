import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { decideFamilyAccess, familyAudit, mustPurgeCache, NEVER_FAMILY_WRITES, FAMILY_INTEGRATIONS, type AuthHead } from "./family-access";
import * as A from "./family-academics";
import * as S from "./family-services";

const head = (o: Partial<AuthHead> = {}): AuthHead => ({ versionId: "v1", studentId: "e1", guardianUserId: "u1", eventKind: "constituicao",
  sections: ["frequencia", "avaliacao"], validFrom: "2026-02-01", validUntil: null, personValidated: true, linkType: "legal", ...o });
const req = { accountId: "u1", studentId: "e1", section: "frequencia" as const, date: "2026-04-01", activeEnrollment: true };

describe("L03 permissões e revogação", () => {
  it("vínculo vigente libera só a seção concedida", () => {
    expect(decideFamilyAccess([head()], req).ok).toBe(true);
    expect(decideFamilyAccess([head()], { ...req, section: "saude" }).ok).toBe(false);
  });
  it("revogada, expirada, futura, pessoa não validada, sem matrícula, outro estudante: mesma resposta", () => {
    const denials = [
      decideFamilyAccess([head({ eventKind: "revogacao" })], req), decideFamilyAccess([head({ validUntil: "2026-03-01" })], req),
      decideFamilyAccess([head({ validFrom: "2026-05-01" })], req), decideFamilyAccess([head({ personValidated: false })], req),
      decideFamilyAccess([head()], { ...req, activeEnrollment: false }), decideFamilyAccess([head()], { ...req, studentId: "e2" }),
      decideFamilyAccess([head(), head({ versionId: "v2" })], req),
    ];
    expect(new Set(denials.map((d) => JSON.stringify(d))).size).toBe(1);
  });
  it("revogação descarta cache", () => expect(mustPurgeCache(true, false)).toBe(true));
  it("alteração herda tipo anterior no banco", () => expect(readFileSync("drizzle/migrations/0382_family_l03_keep_link_type_on_change.sql", "utf8")).toMatch(/t := coalesce\(t, prev\.link_type\)/));
});

describe("L04–L10 informação oficial", () => {
  const c = (id: string) => ({ studentId: id, label: id, school: "sA", className: "5A", sections: [] as const });
  it("L04 múltiplos estudantes exige escolha; um só abre direto", () => {
    expect(A.dashboardCards([c("a"), c("b")], null).needsChoice).toBe(true);
    expect(A.dashboardCards([c("a")], null).current?.studentId).toBe("a");
    expect(A.dashboardCards([c("a")], "x").current?.studentId).toBe("a");
  });
  it("L05 vida escolar não lida ≠ sem registro", () => {
    expect(A.schoolLife(null).state).toBe("nao-lido");
    expect(A.schoolLife([]).state).toBe("sem-registro");
  });
  it("L06 chamada não registrada não vira falta; não publicada some; justificativa não altera frequência", () => {
    const f = A.familyAttendance([{ date: "d1", lessonsPlanned: 4, mark: null, published: true }, { date: "d2", lessonsPlanned: 4, mark: "ausente", published: false }]);
    expect(f.days[0]!.label).toBe("chamada não registrada");
    expect(f.absences).toBeNull();
    expect(f.hidden).toBe(1);
    expect(A.validateJustification({ studentId: "e1", date: "2026-05-01", text: "x", attachmentRef: null }, "2026-04-01")).toContain("Não é possível justificar ausência futura.");
    expect(A.validateJustification({ studentId: "e1", date: "2026-03-01", text: "laudo do médico", attachmentRef: null }, "2026-04-01").length).toBe(1);
    expect(A.justificationEffect().changesAttendance).toBe(false);
  });
  it("L07 só resultado publicado; L08 EI só parecer homologado", () => {
    expect(A.publishedResults([{ component: "LP", period: "1", value: "7", scale: "0-10", publishedAt: null }])).toEqual([]);
    expect(A.eiReports([{ period: "1", text: "t", publishedAt: "x", homologated: false }])).toEqual([]);
    expect(A.isNumericGrade("8,5")).toBe(true);
  });
  it("L09 atividade só da turma e visível; L10 só calendário homologado", () => {
    expect(A.familyActivities([{ title: "t", due: null, visibleToFamily: true, classId: "5B" }], "5A")).toEqual([]);
    expect(A.familyCalendar([{ date: "d", kind: "letivo", homologated: false }]).state).toBe("sem-calendario-homologado");
  });
});

describe("L11–L22 comunicação e serviços", () => {
  it("L11 comunicado segmentado por escola/turma, cancelado some", () => {
    const n = [{ id: "1", audience: { schools: ["sB"], classes: null }, publishedAt: "2026-03-01", cancelled: false },
      { id: "2", audience: { schools: "rede" as const, classes: null }, publishedAt: "2026-03-01", cancelled: true },
      { id: "3", audience: { schools: ["sA"], classes: ["5A"] }, publishedAt: "2026-03-01", cancelled: false }];
    expect(S.noticesFor(n, { school: "sA", classId: "5A", publishedOnOrBefore: "2026-04-01" }).map((x) => x.id)).toEqual(["3"]);
  });
  it("L12 mensagem recusa CPF e vai à caixa institucional", () => {
    expect(S.validateMessage("meu cpf 123.456.789-00")).toContain("Não envie CPF por mensagem.");
    expect(S.messageRecipient("sA").kind).toBe("caixa-institucional");
  });
  it("L13 sem vaga ou passado recusa", () => expect(S.canBook({ id: "s", start: "2026-05-01T10", capacity: 1, booked: 1 }, "2026-04-01")).toBe("Horário sem vaga."));
  it("L14 necessidade alimentar só pelo canal de saúde", () => expect(S.dietaryChannel().requiresSection).toBe("saude"));
  it("L15/L16 só orientação partilhada e nunca clínica", () => {
    expect(S.familyGuidance([{ source: "nei", text: "x", sharedWithFamily: true, clinical: true }, { source: "op", text: "y", sharedWithFamily: false, clinical: false }])).toEqual([]);
  });
  it("L17/L19 protocolo: tipo fechado, chave idempotente, indeferir exige motivo", () => {
    expect(S.validateRequest({ kind: "historico-escolar", studentId: "e1", text: "", idempotencyKey: "short" })).toContain("Chave de envio inválida.");
    expect(S.requestState([{ seq: 1, kind: "aberta", reason: null }, { seq: 2, kind: "indeferida", reason: null }])).toBe("inconsistente");
    expect(S.requestState([{ seq: 1, kind: "aberta", reason: null }, { seq: 2, kind: "atendida", reason: null }])).toBe("atendida");
  });
  it("L18 atualização é pedido validado; campo civil só pela Secretaria", () => {
    expect(S.cadastralUpdate("telefone", "99").ok && S.cadastralUpdate("telefone", "99")).toMatchObject({ appliesImmediately: false });
    expect(S.cadastralUpdate("data-de-nascimento", "x").ok).toBe(false);
  });
  it("L20 biblioteca só publicada para famílias; L21 obrigatória ignora preferência e texto externo é genérico", () => {
    expect(S.familyLibrary([{ title: "t", published: true, audience: "interno" }])).toEqual([]);
    expect(S.shouldNotify({ category: "c", optional: true, enabled: false }, true)).toBe(true);
    expect(S.shouldNotify({ category: "c", optional: true, enabled: false }, false)).toBe(false);
    expect(S.externalSummary()).not.toMatch(/nota|falta|saúde/i);
  });
  it("L22 baixo consumo: páginas de 20 e sem cache offline", () => {
    expect(S.pageOf(Array.from({ length: 45 }, (_, i) => i), 2)).toHaveLength(5);
    expect(S.MOBILE_BUDGET.offlineCache).toBe(false);
  });
});

describe("L23 integração e auditoria", () => {
  it("auditoria descarta nome/CPF/texto livre", () => {
    const a = familyAudit({ action: "leitura", section: "frequencia", name: "Fulano", cpf: "123" });
    expect(Object.keys(a).sort()).toEqual(["action", "section"]);
  });
  it("família nunca escreve fato oficial de setor", () => {
    const writes = Object.values(FAMILY_INTEGRATIONS).flatMap((s) => s.familyWrites as readonly string[]);
    for (const n of NEVER_FAMILY_WRITES) expect(writes.some((w) => w === n)).toBe(false);
  });
});

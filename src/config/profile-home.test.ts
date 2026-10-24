import { describe, expect, it } from "vitest";
import { pathAllowed } from "@/features/authority/nav-capabilities";
import { HOME_ACTIONS, HOME_MAX_PRIMARY, homeActionsFor } from "./profile-home";

describe("Início simples", () => {
  it("no máximo 6 botões principais", () => {
    expect(homeActionsFor(() => true).primary.length).toBe(HOME_MAX_PRIMARY);
  });
  it("sem acesso não aparece nenhum botão", () => {
    const r = homeActionsFor(() => false);
    expect(r.primary).toEqual([]);
    expect(r.more).toEqual([]);
  });
  it("só mostra o que a autoridade libera", () => {
    const r = homeActionsFor((p) => p === "/mapa-estatistico" || p === "/alunos");
    expect(r.primary.map((a) => a.to)).toEqual(["/mapa-estatistico", "/alunos"]);
  });
  it("rótulos sem termos técnicos", () => {
    for (const a of HOME_ACTIONS) expect(a.label).not.toMatch(/homolog|proveni|vers[aã]o/i);
  });
});


describe("atalhos de matrícula e transferência por competência", () => {
  const capability = (capabilityId: string) => ({ capabilityId, engagementId: "e", policyId: "p", policyVersion: 1, schoolId: "escola", classId: null, periodId: null, componentId: null });
  const actions = (capabilities: ReturnType<typeof capability>[]) => {
    const authority = { status: "signed-in" as const, capabilities };
    const home = homeActionsFor((path) => pathAllowed(authority, path));
    return [...home.primary, ...home.more].map((a) => a.label);
  };

  it("professor não recebe atalhos de matrícula ou transferência", () => {
    const labels = actions([capability("registrar-aula"), capability("consultar-estudantes-da-turma")]);
    expect(labels).not.toContain("Matricular");
    expect(labels).not.toContain("Transferir");
    expect(labels).toContain("Chamada");
  });

  it("competência de manutenção mantém os dois atalhos operacionais", () => {
    const labels = actions([capability("manter-matricula-e-enturmacao")]);
    expect(labels).toContain("Matricular");
    expect(labels).toContain("Transferir");
  });

  it("consulta não oferece a criação de matrícula", () => {
    const labels = actions([capability("consultar-matricula-e-movimentacao")]);
    expect(labels).not.toContain("Matricular");
    expect(labels).toContain("Transferir");
  });
});

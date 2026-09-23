import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderOperationalRoutes } from "@/test/router-harness";
import {
  CHANGE_KINDS,
  LIFECYCLE_CAPABILITIES,
  LIFECYCLE_OPERATIONAL_STATES,
  REVIEW_FINDING_CATEGORIES,
  SCHEDULE_LIFECYCLE_STATES,
  changeImpact,
  changeRequests,
  classificationGuidance,
  compareVersions,
  coresponsibilityBlocks,
  effectiveBlocksFor,
  effectiveVersionFor,
  getVersionRecord,
  lifecycleConsistencyIssues,
  lifecycleScenarios,
  networkConflicts,
  reviewFindings,
  versionsForClass,
} from "./schedule-lifecycle";

describe("Horários 10C — modelo do ciclo de vida", () => {
  it("representa os nove estados conceituais da grade", () =>
    expect(SCHEDULE_LIFECYCLE_STATES).toHaveLength(9));
  it("distingue estado da grade e estado da solicitação", () => {
    expect(getVersionRecord("grd-003-v1")?.state).toBe("Revisão devolvida");
    expect(changeRequests.find((item) => item.id === "sol-007")?.state).toBe(
      "Devolvida para elaboração",
    );
  });
  it("identifica a grade publicada por turma, unidade, período, versão, vigência, situação e operação", () => {
    const record = getVersionRecord("grd-001-v2");
    expect(record?.classId).toBe("tur-001");
    expect(record?.unitId).toBeTruthy();
    expect(record?.periodLabel).toBeTruthy();
    expect(record?.version).toBe("Versão 2");
    expect(record?.effectiveFrom).toBe("2026-05-04");
    expect(record?.state).toBe("Publicada");
    expect(record?.operationReference).toBe("OPER-2026-000431");
  });
  it("não confunde elaboração, publicação e início de vigência", () => {
    const record = getVersionRecord("grd-001-v2");
    expect(record?.preparedOn).toBe("2026-04-27");
    expect(record?.publishedOn).toBe("2026-05-04");
    expect(record?.effectiveFrom).not.toBe(record?.preparedOn);
  });
  it("não presume início de vigência no primeiro dia do período letivo", () =>
    expect(getVersionRecord("grd-001-v1")?.effectiveFrom).toBe("2026-02-09"));
  it("preserva a versão anterior ao criar nova versão", () => {
    const versions = versionsForClass("tur-001").map((item) => item.id);
    expect(versions).toEqual(["grd-001-v1", "grd-001-v2", "grd-001-v3"]);
    expect(getVersionRecord("grd-001-v1")?.supersededBy).toBe("grd-001-v2");
    expect(getVersionRecord("grd-001-v1")?.blocks.length).toBeGreaterThan(0);
  });
  it("seleciona a versão efetiva pela data de referência", () => {
    expect(effectiveVersionFor("tur-001", "2026-03-01")?.id).toBe("grd-001-v1");
    expect(effectiveVersionFor("tur-001", "2026-09-23")?.id).toBe("grd-001-v2");
  });
  it("não apresenta versão futura como vigente hoje", () => {
    expect(effectiveVersionFor("tur-001", "2026-09-23")?.id).not.toBe("grd-001-v3");
    expect(effectiveVersionFor("tur-001", "2026-01-01")).toBeUndefined();
  });
  it("aplica retificação conforme a data de efeito sem apagar o retrato publicado", () => {
    const record = getVersionRecord("grd-001-v2");
    expect(record?.blocks.find((item) => item.id === "bl-004")?.end).toBe("10:20");
    expect(effectiveBlocksFor("tur-001", "2026-08-01").find((i) => i.id === "bl-004")?.end).toBe(
      "10:20",
    );
    expect(effectiveBlocksFor("tur-001", "2026-09-23").find((i) => i.id === "bl-004")?.end).toBe(
      "10:30",
    );
    expect(record?.rectifications[0]?.versionId).toBe("grd-001-v2");
  });
  it("mantém a identificação da versão principal na retificação", () => {
    const request = changeRequests.find((item) => item.id === "sol-001");
    expect(request?.requiresNewVersion).toBe(false);
    expect(request?.originVersionId).toBe("grd-001-v2");
    expect(request?.rectificationId).toBe("ret-001");
  });
  it("classifica mudança estrutural como nova versão preservando a anterior", () => {
    const request = changeRequests.find((item) => item.id === "sol-004");
    expect(request?.requiresNewVersion).toBe(true);
    expect(request?.resultingVersionId).toBe("grd-001-v3");
    expect(getVersionRecord("grd-001-v2")?.blocks.length).toBeGreaterThan(0);
  });
  it("não decide automaticamente quando a classificação é indefinida", () => {
    expect(classificationGuidance("Classificação pendente").requiresNewVersion).toBeNull();
    expect(changeRequests.find((item) => item.id === "sol-005")?.requiresNewVersion).toBeNull();
  });
  it("representa as cinco classificações de alteração", () => expect(CHANGE_KINDS).toHaveLength(5));
  it("compara versões semanticamente", () => {
    const diffs = compareVersions("grd-001-v2", "grd-001-v3").map((item) => item.kind);
    expect(diffs).toContain("Bloco adicionado");
    expect(diffs).toContain("Bloco deslocado");
    expect(diffs).toContain("Vigência alterada");
  });
  it("identifica alterações de componente, profissional e remoção de bloco", () => {
    const diffs = compareVersions("grd-001-v1", "grd-001-v2");
    const kinds = diffs.map((item) => item.kind);
    expect(kinds).toContain("Componente ou campo alterado");
    expect(kinds).toContain("Profissional alterado");
    expect(kinds).toContain("Bloco adicionado");
    expect(diffs.every((item) => !item.detail.includes("{"))).toBe(true);
  });
  it("separa as cinco categorias de validação", () =>
    expect(REVIEW_FINDING_CATEGORIES).toHaveLength(5));
  it("não bloqueia automaticamente toda sobreposição", () => {
    const findings = reviewFindings("grd-005-v1");
    expect(findings.some((item) => item.category === "Conflito temporal potencial")).toBe(true);
    expect(
      findings
        .filter((item) => item.category === "Conflito temporal potencial")
        .every((item) => item.detail.includes("não constitui infração automática")),
    ).toBe(true);
  });
  it("mantém item dependente de decisão institucional", () =>
    expect(
      reviewFindings("grd-002-v1").some(
        (item) => item.category === "Item dependente de decisão institucional",
      ),
    ).toBe(true));
  it("considera a mesma Pessoa entre unidades e vínculos", () => {
    const conflicts = networkConflicts("tur-005", getVersionRecord("grd-005-v1")?.blocks ?? []);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts.some((item) => item.unitIds[0] !== item.unitIds[1])).toBe(true);
  });
  it("registra conflito surgido após alteração", () => {
    const impact = changeImpact("sol-002");
    expect(impact?.newConflicts.length).toBeGreaterThan(0);
    expect(impact?.changedBlocks.length).toBe(1);
  });
  it("registra conflito resolvido após alteração", () => {
    const impact = changeImpact("sol-006");
    expect(impact?.resolvedConflicts.length).toBeGreaterThan(0);
  });
  it("não declara ausência de impacto quando faltam informações", () => {
    const impact = changeImpact("sol-005");
    expect(impact?.insufficient).toBe(true);
    expect(impact?.pendencies.join(" ")).toContain("nenhuma ausência de impacto é declarada");
  });
  it("não trata corresponsabilidade como conflito automático", () => {
    const blocks = getVersionRecord("grd-001-v2")?.blocks ?? [];
    const cores = coresponsibilityBlocks(blocks);
    expect(cores.some((item) => item.id === "bl-001")).toBe(true);
    expect(
      networkConflicts("tur-001", blocks).some((item) => item.id === "net-bl-001-bl-001"),
    ).toBe(false);
  });
  it("identifica dados históricos incompletos", () =>
    expect(getVersionRecord("grd-006-v1")?.incompleteFields?.length).toBeGreaterThan(0));
  it("prepara capacidades futuras distintas sem atribuir alçadas", () =>
    expect(LIFECYCLE_CAPABILITIES).toHaveLength(9));
  it("representa os estados operacionais exigidos", () => {
    const ids = LIFECYCLE_OPERATIONAL_STATES.map((item) => item.id);
    for (const id of [
      "loading",
      "empty",
      "error",
      "notFound",
      "permission",
      "insufficient",
      "versionConflict",
      "unavailable",
    ])
      expect(ids).toContain(id);
  });
  it("cobre os cenários A a T", () =>
    expect(lifecycleScenarios.map((item) => item[0]).join("")).toBe("ABCDEFGHIJKLMNOPQRST"));
  it("não contém referências contraditórias", () =>
    expect(lifecycleConsistencyIssues()).toEqual([]));
  it("usa a mesma versão efetiva nas diferentes visões", () => {
    const record = effectiveVersionFor("tur-001", "2026-09-23");
    const blocks = effectiveBlocksFor("tur-001", "2026-09-23");
    expect(record?.id).toBe("grd-001-v2");
    expect(blocks.map((item) => item.id)).toEqual(record?.blocks.map((item) => item.id));
  });
});

describe("Horários 10C — rotas e fluxos", () => {
  it("abre a central de revisões com filtros e grade", async () => {
    renderOperationalRoutes("/horarios/revisoes");
    expect(
      await screen.findByRole("heading", { name: "Central de revisões e alterações" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Central de revisões e alterações de grades" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Unidade")).toBeInTheDocument();
    expect(screen.getByText(/Quem revisa varia/)).toBeInTheDocument();
  });
  it("filtra solicitações por situação", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/horarios/revisoes");
    await screen.findByRole("table", { name: "Central de revisões e alterações de grades" });
    await user.click(screen.getByLabelText("Situação"));
    await user.click(await screen.findByRole("option", { name: "Classificação pendente" }));
    expect(await screen.findByText(/1 de 7 solicitações demonstrativas/)).toBeInTheDocument();
  });
  it("não expõe CPF na central de revisões", async () => {
    renderOperationalRoutes("/horarios/revisoes");
    await screen.findByRole("table", { name: "Central de revisões e alterações de grades" });
    expect(screen.queryByText(/\d{3}\.\d{3}\.\d{3}-\d{2}/)).not.toBeInTheDocument();
  });
  it("abre a revisão da grade com carga, validações e comparação", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-002/revisar");
    expect(await screen.findByText("Identificação da versão proposta")).toBeInTheDocument();
    expect(screen.getByText("Carga planejada")).toBeInTheDocument();
    expect(screen.getByText("Validações e conflitos em rede")).toBeInTheDocument();
    expect(
      screen.getAllByText(/não se presume que o revisor seja sempre a SEMED/i).length,
    ).toBeGreaterThan(0);
  });
  it("registra decisão de devolução para elaboração", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/horarios/turmas/tur-002/revisar");
    await user.click(await screen.findByRole("button", { name: "Devolver para elaboração" }));
    expect(await screen.findByText(/Grade devolvida para elaboração/)).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma aprovação administrativa real/)).toBeInTheDocument();
  });
  it("marca grade como preparada para publicação sem publicar", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/horarios/turmas/tur-002/revisar");
    await user.click(
      await screen.findByRole("button", { name: "Marcar como preparada para publicação" }),
    );
    expect(await screen.findByText(/Publicar é uma operação distinta/)).toBeInTheDocument();
  });
  it("exige confirmação explícita na preparação da publicação", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/horarios/turmas/tur-001/publicar");
    const action = await screen.findByRole("button", {
      name: "Preparar publicação demonstrativa",
    });
    expect(action).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(action);
    expect(await screen.findByText(/Nenhuma grade foi publicada oficialmente/)).toBeInTheDocument();
  });
  it("apresenta vigência proposta com campos distintos", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001/publicar");
    expect(await screen.findByLabelText("Início de vigência")).toBeInTheDocument();
    expect(screen.getByLabelText("Término de vigência (opcional)")).toBeInTheDocument();
    expect(screen.getByText("Histórico relacionado")).toBeInTheDocument();
  });
  it("lista alterações com antes/depois e impacto", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001/alteracoes");
    expect(await screen.findByText(/Alteração de grade publicada · sol-001/)).toBeInTheDocument();
    expect(screen.getByLabelText("Antes e depois — sol-001")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Painel de impacto demonstrativo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Retificação sem nova versão principal").length).toBeGreaterThan(0);
  });
  it("protege a proposta de alteração contra perda de dados", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/horarios/turmas/tur-001/alteracoes/nova");
    await user.type(await screen.findByLabelText("Justificativa"), "Ajuste demonstrativo");
    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect((await screen.findAllByText("Alterações não concluídas")).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Descartar alterações e sair" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(screen.queryByRole("link", { name: "Descartar alterações e sair" })).toBeNull();
  });
  it("indica decisão pendente ao classificar como pendente", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderOperationalRoutes("/horarios/turmas/tur-001/alteracoes/nova");
    const trigger = await screen.findByLabelText("Tipo de mudança");
    let options = screen.queryAllByRole("option");
    for (let attempt = 0; attempt < 5 && options.length === 0; attempt += 1) {
      await user.click(trigger);
      options = screen.queryAllByRole("option");
    }
    await user.click(options.find((item) => item.textContent === "Classificação pendente")!);
    expect(await screen.findByText("Decisão pendente")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Preparar proposta demonstrativa" }));
    expect(
      (await screen.findAllByText(/nenhuma publicação definitiva é simulada/)).length,
    ).toBeGreaterThan(0);
  });
  it("prepara proposta demonstrativa sem alterar a grade de origem", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/horarios/turmas/tur-001/alteracoes/nova");
    await user.click(
      await screen.findByRole("button", { name: "Preparar proposta demonstrativa" }),
    );
    expect(await screen.findByText(/A grade de origem permanece inalterada/)).toBeInTheDocument();
  });
  it("mostra a linha do tempo de versões com acesso a comparação e impressão", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001/versoes");
    expect(
      await screen.findByLabelText("Linha do tempo das versões demonstrativas"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Comparar" }).length).toBe(3);
    expect(screen.getAllByRole("link", { name: "Imprimir" }).length).toBe(3);
    expect(screen.getByText("Efetiva na data de referência")).toBeInTheDocument();
  });
  it("permite alterar a data de referência", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/horarios/turmas/tur-001/versoes");
    const field = await screen.findByLabelText("Data de referência");
    await user.clear(field);
    await user.type(field, "2026-03-01");
    expect(
      await screen.findByText(/Versão 1 \(Substituída\) vigente em 2026-03-01/),
    ).toBeInTheDocument();
  });
  it("mantém a versão histórica em leitura e identifica dados incompletos", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-006/versoes/grd-006-v1");
    expect(await screen.findByText("Somente leitura")).toBeInTheDocument();
    expect(screen.getByText("Dados históricos incompletos")).toBeInTheDocument();
  });
  it("exibe a grade exatamente como representada na versão", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001/versoes/grd-001-v1");
    expect(await screen.findByLabelText("Grade da Versão 1")).toBeInTheDocument();
    expect(screen.getByText("Versão substituída")).toBeInTheDocument();
  });
  it("compara versões semanticamente na tela", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001/versoes/grd-001-v3/comparar");
    expect(await screen.findByLabelText("Diferenças semânticas entre versões")).toBeInTheDocument();
    expect(screen.getAllByText("Bloco adicionado").length).toBeGreaterThan(0);
    expect(screen.getByText(/Nenhuma versão é sobrescrita/)).toBeInTheDocument();
  });
  it("gera documento A4 da grade vigente com identificação institucional", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001/documentos/vigente/atual");
    expect(await screen.findByText("Documento demonstrativo — não oficial")).toBeInTheDocument();
    expect(screen.getByText(/Secretaria Municipal de Educação/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Imprimir" })).toBeInTheDocument();
  });
  it("gera documento A4 da comparação e da proposta", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001/documentos/comparacao/grd-001-v3");
    expect(await screen.findByLabelText("Comparação impressa entre versões")).toBeInTheDocument();
    renderOperationalRoutes("/horarios/turmas/tur-001/documentos/proposta/sol-004");
    expect(await screen.findByLabelText("Antes e depois impresso")).toBeInTheDocument();
  });
  it("trata documento inexistente como não encontrado", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001/documentos/inexistente/zzz");
    expect(await screen.findByText("Documento não encontrado")).toBeInTheDocument();
  });
  it("trata versão inexistente como não encontrada", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001/versoes/grd-006-v1");
    expect(await screen.findByText("Versão não encontrada")).toBeInTheDocument();
  });
  it("indica operação indisponível quando não há grade de origem", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-007/alteracoes/nova");
    expect(await screen.findByText("Operação indisponível")).toBeInTheDocument();
  });
  it("integra o ciclo de vida à consulta da turma", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001");
    expect(await screen.findByRole("link", { name: "Versões" })).toHaveAttribute(
      "href",
      "/horarios/turmas/tur-001/versoes",
    );
    expect(screen.getByRole("link", { name: "Revisar" })).toHaveAttribute(
      "href",
      "/horarios/turmas/tur-001/revisar",
    );
    expect(screen.getByText("Versão efetiva na data de referência")).toBeInTheDocument();
  });
  it("integra a central de revisões à página operacional de horários", async () => {
    renderOperationalRoutes("/horarios");
    expect(await screen.findByRole("link", { name: "Abrir central de revisões" })).toHaveAttribute(
      "href",
      "/horarios/revisoes",
    );
  });
  it("mantém acessibilidade dos painéis de estado e capacidades", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001/versoes");
    expect(await screen.findByLabelText("Estados operacionais demonstrativos")).toBeInTheDocument();
    expect(screen.getByLabelText("Capacidades futuras distintas")).toBeInTheDocument();
  });
});

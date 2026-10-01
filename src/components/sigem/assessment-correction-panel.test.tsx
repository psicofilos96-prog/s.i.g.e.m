/** 6D.3.2.4 — Correção focal de resultado avaliativo. */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AssessmentCorrectionPanel, type AssessmentCorrectionFactSource } from "./assessment-correction-panel";
import type { AssessmentCorrectionPolicy } from "@/features/assessment/assessment-correction";
import {
  createFirstAssessmentEntryVersion,
  createSupersedingAssessmentEntryVersion,
  type AssessmentEntryVersion,
} from "@/features/assessment/assessment-entry-versions";
import { assessmentConfigurations } from "@/features/assessment/assessment-fixtures";
import type { AssessmentConfiguration, EntryValue } from "@/features/assessment/assessment-types";

const quantitative = assessmentConfigurations.find((c) => c.id === "cfg-2026-quantitativa-demo")!;
const conceptual = assessmentConfigurations.find((c) => c.id === "cfg-2026-conceitual-demo")!;
const instrument = { id: "ins-1", instrumentTypeId: "it-atividade", status: "aplicado" as const };
const placement = { enrollmentId: "m", academicLinkId: "v", participationId: "p", allocationId: "a" };

const free: AssessmentCorrectionPolicy = {
  id: "pol-livre", version: 1, label: "Correção antes do fechamento", homologated: true,
  appliesWhenPeriodClosing: "absent", outcome: "admissible", requiredCapabilities: [],
  requirements: [], disclosesNormativeContext: true,
};
const closed: AssessmentCorrectionPolicy = {
  ...free, id: "pol-fech", label: "Correção após fechamento", appliesWhenPeriodClosing: "present",
  requiredCapabilities: ["corrigir-apos-fechamento"],
  requirements: [{ code: "justificativa", label: "Justificativa da correção", provenance: "Exigida pela regra após o fechamento." }],
};

function v1(value: EntryValue): AssessmentEntryVersion {
  return createFirstAssessmentEntryVersion({
    versionId: "v1", instrumentId: instrument.id, studentId: "alu-1", placement, value,
    status: "registrado", recordedByAssignmentId: "atp", now: "2026-09-25T12:00:00.000Z",
  });
}

function store(initial: AssessmentEntryVersion[]) {
  const versions = [...initial];
  const source: AssessmentCorrectionFactSource = {
    readVersions: () => versions,
    append: (v) => { versions.push(v); },
  };
  return { versions, source };
}

function mount(opts: {
  value: EntryValue;
  configuration?: AssessmentConfiguration;
  policies?: AssessmentCorrectionPolicy[];
  closing?: boolean;
  capabilities?: string[];
  allowMissingEntry?: boolean;
}) {
  const s = store([v1(opts.value)]);
  const snapshot = JSON.stringify(s.versions[0]);
  render(
    <AssessmentCorrectionPanel
      studentName="Mariana Alves"
      instrumentLabel="Avaliação bimestral"
      logicalEntryId={s.versions[0]!.logicalEntryId}
      source={s.source}
      missingEntryPolicy={{ requiresReason: true, admissibleReasons: [{ id: "m1", label: "Não realizou a atividade" }], allowsCustomReason: false }}
      {...(opts.allowMissingEntry === undefined ? {} : { allowMissingEntry: opts.allowMissingEntry })}
      context={{
        agent: { agentId: "pro", capabilities: opts.capabilities ?? [] },
        instrument,
        configuration: opts.configuration ?? quantitative,
        policies: opts.policies ?? [free],
        ...(opts.closing ? { periodClosing: { closingId: "fec-1", closingVersion: 1, periodLabel: "1º período" } } : {}),
      }}
      newVersionId={(base) => `v${base.version + 1}`}
      now={() => "2026-09-28T12:00:00.000Z"}
    />,
  );
  return { ...s, snapshot };
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

describe("correção focal (6D.3.2.4)", () => {
  it("sem fonte institucional, a correção não oferece valor não registrado nem motivo demonstrativo", () => {
    const s = mount({ value: { kind: "numerica", value: 7 }, allowMissingEntry: false });
    click("Corrigir resultado");
    expect(screen.queryByRole("button", { name: "Não registrado" })).toBeNull();
    expect(screen.queryByText("Não realizou a atividade")).toBeNull();
    expect(s.versions).toHaveLength(1);
  });
  it("1. numérico 7,0 → 8,5 sem rito adicional", () => {
    const s = mount({ value: { kind: "numerica", value: 7 } });
    click("Corrigir resultado");
    expect(screen.queryByText(/Justificativa/)).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "8,5" } });
    click("Conferir correção");
    expect(screen.getByTestId("antes").textContent).toBe("7");
    expect(screen.getByTestId("depois").textContent).toBe("8,5");
    click("Registrar correção");
    expect(s.versions).toHaveLength(2);
    expect(s.versions[1]!.value).toEqual({ kind: "numerica", value: 8.5 });
    expect(s.versions[1]!.supersedesVersionId).toBe("v1");
    expect(JSON.stringify(s.versions[0])).toBe(s.snapshot);
    expect(screen.getByRole("status").textContent).toMatch(/permanece no histórico/);
  });

  it("2. conceitual usa somente opções homologadas", () => {
    const s = mount({ value: { kind: "conceitual", optionId: "cc-demo-1" }, configuration: conceptual });
    click("Corrigir resultado");
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual([
      "Conceito demonstrativo 1", "Conceito demonstrativo 2",
    ]);
    fireEvent.click(screen.getByRole("radio", { name: "Conceito demonstrativo 2" }));
    click("Conferir correção");
    click("Registrar correção");
    expect(s.versions[1]!.value).toEqual({ kind: "conceitual", optionId: "cc-demo-2" });
  });

  it("3. descritivo preserva v1", () => {
    const s = mount({ value: { kind: "descritiva", text: "Leitura em desenvolvimento" }, configuration: conceptual });
    click("Corrigir resultado");
    click("Registro descritivo");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Leitura fluente" } });
    click("Conferir correção");
    click("Registrar correção");
    expect(s.versions[1]!.value).toEqual({ kind: "descritiva", text: "Leitura fluente" });
    expect(JSON.stringify(s.versions[0])).toBe(s.snapshot);
  });

  it("4. resultado → não registrado exige motivo; e volta a resultado", () => {
    const s = mount({ value: { kind: "numerica", value: 7 } });
    click("Corrigir resultado");
    click("Não registrado");
    expect(screen.getByRole("button", { name: "Conferir correção" })).toHaveProperty("disabled", true);
    click("Não realizou a atividade");
    click("Conferir correção");
    click("Registrar correção");
    expect(s.versions[1]!.value).toEqual({ kind: "nao-registrado", reason: "Não realizou a atividade" });

    click("Corrigir resultado");
    click("Valor");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "8" } });
    click("Conferir correção");
    click("Registrar correção");
    expect(s.versions).toHaveLength(3);
    expect(s.versions[2]!.value).toEqual({ kind: "numerica", value: 8 });
  });

  it("5. fechamento vigente: rito aparece só porque a política o projeta", () => {
    const s = mount({ value: { kind: "numerica", value: 7 }, policies: [free, closed], closing: true, capabilities: ["corrigir-apos-fechamento"] });
    click("Corrigir resultado");
    fireEvent.change(screen.getAllByRole("textbox")[0]!, { target: { value: "8" } });
    expect(screen.getByRole("button", { name: "Conferir correção" })).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText("Justificativa da correção"), { target: { value: "Erro de soma" } });
    click("Conferir correção");
    click("Registrar correção");
    expect(s.versions[1]!.rectification?.justification).toBe("Erro de soma");
    expect(s.versions[1]!.rectification?.policyId).toBe("pol-fech");
  });

  it("5b. sem capacidade: impedido, sem caminho de contorno", () => {
    mount({ value: { kind: "numerica", value: 7 }, policies: [closed], closing: true });
    click("Corrigir resultado");
    expect(screen.getByText("Este resultado não pode ser corrigido aqui.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conferir correção" })).toBeNull();
  });

  it("6. concorrência: v2 externa recusa a correção local e não cria v3", () => {
    const s = mount({ value: { kind: "numerica", value: 7 } });
    click("Corrigir resultado");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "9" } });
    click("Conferir correção");
    s.versions.push(createSupersedingAssessmentEntryVersion({
      base: s.versions[0]!, versionId: "v2-externa", value: { kind: "numerica", value: 8 },
      rectification: { actedAt: "x", agentId: "outro", policyId: "pol-livre", policyVersion: 1, policyLabel: "x", satisfiedRequirements: [], changedAspects: ["resultado-registrado"] },
      now: "2026-09-27T12:00:00.000Z",
    }));
    click("Registrar correção");
    expect(screen.getByRole("alert").textContent).toMatch(/mudou enquanto você fazia a correção/);
    expect(s.versions).toHaveLength(2);
    expect(screen.getByTestId("resultado-vigente").textContent).toBe("8");
  });

  it("invariante: mesmo valor não gera nova versão", () => {
    const s = mount({ value: { kind: "numerica", value: 7 } });
    click("Corrigir resultado");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "7,0" } });
    expect(screen.getByRole("button", { name: "Conferir correção" })).toHaveProperty("disabled", true);
    expect(s.versions).toHaveLength(1);
  });

  it("histórico é derivado da cadeia", () => {
    mount({ value: { kind: "numerica", value: 7 } });
    click("Corrigir resultado");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "8" } });
    click("Conferir correção");
    click("Registrar correção");
    click("Ver histórico deste resultado");
    const items = screen.getByRole("list", { name: "Histórico deste resultado" }).querySelectorAll("li");
    expect(items[0]!.textContent).toMatch(/Versão 2 — vigente/);
    expect(items[1]!.textContent).toMatch(/Versão 1/);
  });
});

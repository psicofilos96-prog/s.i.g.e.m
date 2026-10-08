import { describe, expect, it } from "vitest";
import { fieldProblems, missingByStep } from "./enrollment-wizard-model";
import { createAutosave } from "@/features/autosave/autosave-controller";

const none = { existingStudentId: null, hasCpf: false, inep: null } as never;

describe("NFORM.2 — erro por campo do assistente de matrícula", () => {
  it("cada pendência da etapa tem mensagem específica do campo (mesmas regras)", () => {
    const f = fieldProblems({}, none);
    expect(Object.keys(f).sort()).toEqual(["aluno.nome", "identificacao", "matricula.ano", "matricula.data", "turma"]);
    const m = missingByStep({}, none);
    expect(Object.values(m).flat().length).toBe(Object.keys(f).length);
  });
  it("CPF digitado inválido é apontado; válido não", () => {
    expect(fieldProblems({}, none, "111.111.111-11").cpf).toMatch(/CPF inválido/);
    expect(fieldProblems({}, none, "529.982.247-25").cpf).toBeUndefined();
  });
  it("aluno existente não exige nome nem documento", () => {
    const f = fieldProblems({}, { existingStudentId: "s1", hasCpf: false, inep: null } as never);
    expect(f["aluno.nome"]).toBeUndefined(); expect(f.identificacao).toBeUndefined();
  });
  it("perda e retorno de conexão: nada é tentado offline; ao voltar, salva a última versão", async () => {
    let online = false; const saved: number[] = []; const st: string[] = [];
    const a = createAutosave<number>({ save: async (v) => { saved.push(v); }, isOnline: () => online, debounceMs: 0, onStatus: (s) => st.push(s) });
    a.change(1); a.change(2); await a.flush();
    expect(saved).toEqual([]); expect(st.at(-1)).toBe("sem-conexao"); expect(a.hasUnsaved).toBe(true);
    online = true; a.online(); await new Promise((r) => setTimeout(r, 5)); await a.flush();
    expect(saved).toEqual([2]); expect(a.hasUnsaved).toBe(false);
  });
});

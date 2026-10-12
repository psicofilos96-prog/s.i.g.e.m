import { describe, it, expect } from "vitest";
import { send, agreedStrategies, mediatorPending, type Thread, type Msg, type Party } from "./mediator-communication";

const th: Thread = { id: "T1", studentId: "e1", schoolId: "sA", participants: [{ personId: "m1", party: "mediador" }, { personId: "d1", party: "docente" }, { personId: "n1", party: "nei" }] };
const all: Party[] = ["mediador", "docente", "nei"];
const A = (personId: string) => ({ personId, technical: false, designationActive: true, eligibleRecipients: all });
function go(log: Msg[], who: string, m: Omit<Parameters<typeof send>[2], "expectedSeq" | "at">) {
  const r = send(th, log, { ...m, expectedSeq: Math.max(0, ...log.map((x) => x.seq)), at: "t" }, A(who));
  if (!r.ok) throw new Error(r.reasons.join()); return [...log, r.message];
}

describe("Mediador L12 — comunicação com docente e NEI", () => {
  it("observação → proposta → confirmação do docente → devolutiva = estratégia acordada", () => {
    let log = go([], "m1", { kind: "observacao", to: ["docente"], text: "Na leitura em voz alta saiu da sala 2 vezes" });
    log = go(log, "m1", { kind: "estrategia-proposta", to: ["docente"], text: "Oferecer leitura em dupla" });
    log = go(log, "d1", { kind: "estrategia-confirmada", to: ["mediador"], text: "De acordo, a partir de segunda", refSeq: 2 });
    log = go(log, "m1", { kind: "devolutiva", to: ["docente"], text: "Leu em dupla sem sair da sala", refSeq: 3 });
    expect(agreedStrategies(log, "T1")[0]).toMatchObject({ state: "acordada", confirmedBy: "d1", confirmedByParty: "docente" });
    expect(agreedStrategies(log, "T1")[0]!.feedback).toHaveLength(1);
    expect(log[0]!.channel).toBe("solicitacao-escola");
  });
  it("mediador não confirma estratégia nem decide aula/avaliação/plano especializado", () => {
    const log = go([], "d1", { kind: "estrategia-proposta", to: ["mediador"], text: "Usar prancha" });
    expect(send(th, log, { kind: "estrategia-confirmada", to: ["docente"], text: "ok confirmo", refSeq: 1, expectedSeq: 1, at: "t" }, A("m1")).ok).toBe(false);
    for (const text of ["Alterei o plano da aula de hoje", "Dei nota 8 na atividade", "Defini o PEI do estudante"])
      expect(send(th, log, { kind: "observacao", to: ["docente"], text, expectedSeq: 1, at: "t" }, A("m1")).ok).toBe(false);
  });
  it("NEI vai por protocolo; texto clínico e destinatário inelegível recusados", () => {
    const r = send(th, [], { kind: "esclarecimento", to: ["nei"], text: "Como agir na troca de sala?", expectedSeq: 0, at: "t" }, A("m1"));
    expect(r.ok && r.message.channel).toBe("protocolo-nei");
    expect(send(th, [], { kind: "observacao", to: ["nei"], text: "parece transtorno", expectedSeq: 0, at: "t" }, A("m1")).ok).toBe(false);
    expect(send(th, [], { kind: "observacao", to: ["direcao"], text: "fato observado", expectedSeq: 0, at: "t" }, A("m1")).ok).toBe(false);
    expect(send(th, [], { kind: "observacao", to: ["nei"], text: "fato observado", expectedSeq: 0, at: "t" }, { ...A("m1"), eligibleRecipients: null }).ok).toBe(false);
  });
  it("fail-closed: sem designação, executor técnico, não participante e seq velho", () => {
    const m = { kind: "observacao" as const, to: ["docente" as const], text: "fato observado", expectedSeq: 0, at: "t" };
    expect(send(th, [], m, { ...A("m1"), designationActive: false }).ok).toBe(false);
    expect(send(th, [], m, { personId: null, technical: true, designationActive: true, eligibleRecipients: all }).ok).toBe(false);
    expect(send(th, [], m, A("x9")).ok).toBe(false);
    expect(send(th, [], { ...m, expectedSeq: 4 }, A("m1")).ok).toBe(false);
  });
  it("pendências: esclarecimento sem resposta e orientação sem devolutiva", () => {
    let log = go([], "m1", { kind: "esclarecimento", to: ["nei"], text: "Pode usar fone no recreio?" });
    log = go(log, "n1", { kind: "orientacao", to: ["mediador"], text: "Antecipar a troca de atividade" });
    expect(mediatorPending(log, "T1", "m1")).toEqual({ awaitingAnswer: [1], awaitingFeedback: [2] });
    log = go(log, "n1", { kind: "resposta", to: ["mediador"], text: "Sim, nos intervalos", refSeq: 1 });
    expect(mediatorPending(log, "T1", "m1").awaitingAnswer).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { parseNetworkPendingFollowup } from "./pending-read-contract";

const action = {
  action_id: "action-1", school_id: "school-a", school_name: "Escola Centro",
  inep: "33000001", description: "Organizar a biblioteca", responsible_label: "Direção",
  due_on: "2026-11-06", situation: "em andamento",
  last_update_on: "2026-11-04", created_at: "2026-10-23T14:03:04.123456+00:00",
};
const unopened = {
  ...action, action_id: "action-2", school_id: "school-b",
  school_name: "Escola Serra", inep: null, responsible_label: null, due_on: null,
  situation: "sem atualização", last_update_on: null,
};

describe("contrato do quadro de providências autorizado", () => {
  it("aceita resultados legítimos sem modificar a situação declarada ou inventar prazo", () => {
    expect(parseNetworkPendingFollowup({ pending: [action, unopened] }))
      .toEqual([action, unopened]);
    expect(parseNetworkPendingFollowup({ pending: [] })).toEqual([]);
  });

  it("rejeita resposta ausente, objeto incompleto ou coleção muito extensa", () => {
    for (const value of [null, [], {}, { pending: null }, { pending: {} }]) {
      expect(() => parseNetworkPendingFollowup(value)).toThrow(/formato inesperado/);
    }
    expect(() => parseNetworkPendingFollowup({
      pending: Array.from({ length: 5001 }, () => action),
    })).toThrow(/limite esperado/);
  });

  it("rejeita campos obrigatórios faltantes ou que mascarariam dados como texto artificial", () => {
    for (const row of [
      { ...action, action_id: "" }, { ...action, school_id: " " },
      { ...action, school_name: undefined }, { ...action, description: null },
      { ...action, created_at: null }, { ...action, inep: {} },
      { ...action, responsible_label: 7 },
    ]) {
      expect(() => parseNetworkPendingFollowup({ pending: [row] }))
        .toThrow(/medida incompleta ou inválida/);
    }
  });

  it("rejeita datas inválidas e situações que não são pendências declaradas", () => {
    for (const row of [
      { ...action, due_on: "2026-02-30" },
      { ...action, due_on: "amanhã" },
      { ...action, last_update_on: "2026-13-01" },
      { ...action, situation: "concluída" },
      { ...action, situation: "homologada" },
      { ...action, situation: "sem atualização", last_update_on: "2026-11-04" },
      { ...action, situation: "em andamento", last_update_on: null },
      { ...action, created_at: "ontem" },
      { ...action, created_at: "2026-02-30T14:03:04Z" },
      { ...action, created_at: "2026-11-31T14:03:04+00:00" },
    ]) {
      expect(() => parseNetworkPendingFollowup({ pending: [row] }))
        .toThrow(/medida incompleta ou inválida/);
    }
  });

  it("rejeita um identificador duplicado sem exibir parcialmente a lista", () => {
    expect(() => parseNetworkPendingFollowup({ pending: [action, action] }))
      .toThrow(/medida incompleta ou inválida/);
  });

  it("reconhece todas as situações não concluídas que a RPC pode devolver", () => {
    for (const situation of ["prevista", "em andamento", "não realizada", "suspensa"]) {
      expect(parseNetworkPendingFollowup({
        pending: [{ ...action, situation }],
      })[0]?.situation).toBe(situation);
    }
  });
});

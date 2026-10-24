import { afterEach, describe, expect, it, vi } from "vitest";
import { ListTimeoutError, pageRange, withListTimeout } from "./server-page";
import { ilikeTerm } from "@/features/students/institutional-lists";

afterEach(() => vi.useRealTimers());

describe("PERF.LOADING.2 — listas paginadas no servidor", () => {
  it("1ª página pede só 50 linhas, nunca o conjunto inteiro", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: 49 });
    expect(pageRange(200)).toEqual({ from: 9950, to: 9999 }); // 10k estudantes: página 200 = 50 linhas
  });
  it("página inválida volta para a primeira", () => {
    expect(pageRange(0)).toEqual({ from: 0, to: 49 });
    expect(pageRange(Number.NaN)).toEqual({ from: 0, to: 49 });
  });
  it("leitura rejeitada sai do carregamento com o erro", async () => {
    await expect(withListTimeout(undefined, () => Promise.reject(new Error("falhou")))).rejects.toThrow("falhou");
  });
  it("leitura travada termina em tempo-limite e aborta o sinal", async () => {
    vi.useFakeTimers();
    let seen: AbortSignal | null = null;
    const p = withListTimeout(undefined, (s) => { seen = s; return new Promise(() => {}); }, 1000);
    const assertion = expect(p).rejects.toBeInstanceOf(ListTimeoutError);
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    expect(seen!.aborted).toBe(true);
    vi.useRealTimers();
  });
  it("troca de filtro cancela a leitura anterior (não é tempo-limite)", async () => {
    const ctl = new AbortController();
    const p = withListTimeout(ctl.signal, () => new Promise(() => {}));
    ctl.abort();
    await expect(p).rejects.not.toBeInstanceOf(ListTimeoutError);
  });
  it("busca escapa curingas e exige 2 caracteres", () => {
    expect(ilikeTerm("a")).toBeNull();
    expect(ilikeTerm(" ma%ria_ ")).toBe("%ma ria%");
    expect(ilikeTerm("silva,(x)")).toBe("%silva x%");
  });
});


describe("cancelamento sem leitura pendurada", () => {
  it("um sinal já cancelado rejeita sem iniciar a consulta", async () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    parent.abort();
    const run = vi.fn(() => new Promise<never>(() => {}));
    const failure = vi.fn();
    void withListTimeout(parent.signal, run).catch(failure);
    await vi.advanceTimersByTimeAsync(1);
    expect(failure).toHaveBeenCalledWith(expect.objectContaining({ name: "AbortError" }));
    expect(run).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancelamento síncrono dentro da consulta é observado", async () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    const failure = vi.fn();
    void withListTimeout(parent.signal, () => {
      parent.abort();
      return new Promise<never>(() => {});
    }).catch(failure);
    await vi.advanceTimersByTimeAsync(1);
    expect(failure).toHaveBeenCalledWith(expect.objectContaining({ name: "AbortError" }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancelamento antes do início efetivo evita requisição obsoleta", async () => {
    const parent = new AbortController();
    const run = vi.fn(async () => "resultado antigo");
    const promise = withListTimeout(parent.signal, run);
    parent.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(run).not.toHaveBeenCalled();
  });
});

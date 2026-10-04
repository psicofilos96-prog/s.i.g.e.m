import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children, to }: { children: ReactNode; to?: string }) => <a href={to}>{children}</a> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
import { supabase } from "@/integrations/supabase/client";
import { CalendarAccessPanel } from "./calendar-access-panel";

function db(o: { state?: string | null; designated?: boolean; caps?: string[]; fail?: boolean }) {
  vi.mocked(supabase.from).mockReturnValue({ select: () => ({ maybeSingle: async () => (o.fail ? { data: null, error: { message: "x" } } : { data: o.state === null ? null : { state: o.state }, error: null }) }) } as never);
  vi.mocked(supabase.rpc).mockImplementation((async (f: string) => f === "am_designated_installer" ? { data: !!o.designated, error: null }
    : { data: (o.caps ?? []).map((c) => ({ capability_id: c, school_id: null })), error: null }) as never);
}
const wrap = (n: ReactNode) => <QueryClientProvider client={new QueryClient()}>{n}</QueryClientProvider>;

describe("B4.6.8 painel de acesso do calendário", () => {
  beforeEach(() => { vi.clearAllMocks(); window.localStorage.clear(); });
  it("designada pré-instalação: CTA de instalação e prévia da referência rotulada", async () => {
    db({ state: "nao-instalado", designated: true });
    render(wrap(<CalendarAccessPanel contextKey="u#0" />));
    expect(await screen.findByRole("link", { name: /Revisar e instalar o SIGEM/ })).toHaveAttribute("href", "/administracao");
    fireEvent.click(screen.getByRole("button", { name: /fonte do calendário 2027/ }));
    expect(screen.getByText(/REFERÊNCIA 2027 do sistema \(não é calendário salvo\)/)).toBeTruthy();
    expect(window.localStorage.length).toBe(0);
  });
  it("fonte do navegador é rotulada como não homologada", async () => {
    db({ state: "nao-instalado", designated: true });
    window.localStorage.setItem("sigem.calendarios.v1", "[]");
    render(wrap(<CalendarAccessPanel contextKey="u#0" />));
    fireEvent.click(await screen.findByRole("button", { name: /fonte do calendário 2027/ }));
    expect(screen.getByText(/NÃO homologada/)).toBeTruthy();
    expect(screen.getByText(/Nenhum calendário de 2027/)).toBeTruthy();
  });
  it("conta comum pré-instalação: aguarda, sem CTA nem prévia", async () => {
    db({ state: "nao-instalado", designated: false });
    render(wrap(<CalendarAccessPanel contextKey="u#0" />));
    expect(await screen.findByText(/ainda não foi instalado/)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("instalado sem capacidade: explica, sem gestão", async () => {
    db({ state: "instalado", designated: true });
    render(wrap(<CalendarAccessPanel contextKey="u#0" />));
    expect(await screen.findByText(/não tem capacidade para construir/)).toBeTruthy();
  });
  it("Supervisão autorizada pós-instalação: prévia disponível", async () => {
    db({ state: "instalado", caps: ["construir-calendario-da-rede"] });
    render(wrap(<CalendarAccessPanel contextKey="u#0" />));
    expect(await screen.findByRole("button", { name: /fonte do calendário 2027/ })).toBeTruthy();
  });
  it("erro de leitura falha fechado", async () => {
    db({ fail: true });
    render(wrap(<CalendarAccessPanel contextKey="u#0" />));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Nada foi presumido/);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const state = vi.hoisted(() => ({ session: true as boolean, fail: false as boolean, schools: [] as { id: string }[], ids: [] as unknown[], versions: [] as unknown[] }));
vi.mock("@/features/authority/session-authority", () => ({ useSessionAuthority: () => ({ status: "signed-in", capabilities: [] }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: state.session ? {} : null } }) },
    from: (t: string) => ({
      select: () =>
        Promise.resolve(
          state.fail
            ? { data: null, error: { message: "denied" } }
            : { data: t === "institutional_schools" ? state.schools : t === "institutional_school_identifiers" ? state.ids : state.versions, error: null },
        ),
    }),
  },
}));
import { renderUnitsRoutes } from "@/test/router-harness";

function seed() {
  state.schools = []; state.ids = []; state.versions = [];
  for (let n = 0; n < 55; n++) {
    const inep = n === 0 ? "33096589" : String(33000000 + n);
    const id = `inep-${inep}`;
    const conv = n >= 40;
    state.schools.push({ id });
    state.ids.push({ school_id: id, identifier_kind: "inep", value: inep });
    state.versions.push({
      id: `v-${n}`, school_id: id, version_number: 1, supersedes_version_id: null,
      official_name: n === 0 ? "CIEP 467 HENRIETT AMADO" : `ESCOLA REAL ${String(n).padStart(2, "0")}`,
      address: null, district: null, location_kind: n < 41 ? "urbana" : "rural", active: true, valid_from: "2026-08-31",
      originating_act_ref: null, phone: null, institutional_email: null, own_building: null, hard_access: null, classroom_count: null,
      administrative_dependency: conv ? "Privada" : "Municipal", private_school_category: conv ? "Filantrópica" : null,
      partnership_public_authority: conv ? "Municipal" : null,
    });
  }
}

const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

describe("/unidades lê o cadastro canônico", () => {
  beforeEach(() => { state.session = true; state.fail = false; seed(); });

  it("lista as 55 unidades reais", async () => {
    renderUnitsRoutes("/unidades");
    await screen.findByRole("table", { name: /cadastro institucional/i });
    expect(bodyRows()).toHaveLength(55);
    expect(screen.queryByText(/fictíci|demonstrativ/i)).not.toBeInTheDocument();
  });

  it("busca por INEP e por nome", async () => {
    renderUnitsRoutes("/unidades");
    const q = await screen.findByRole("textbox", { name: "Pesquisar unidades" });
    await userEvent.type(q, "33096589");
    expect(bodyRows()).toHaveLength(1);
    await userEvent.clear(q); await userEvent.type(q, "henriett");
    expect(within(screen.getByRole("table")).getByText("CIEP 467 HENRIETT AMADO")).toBeInTheDocument();
  });

  it("filtra dependência e localização com opções derivadas dos dados", async () => {
    renderUnitsRoutes("/unidades");
    await screen.findByRole("table");
    await userEvent.selectOptions(screen.getByLabelText("Dependência administrativa"), "Privada");
    expect(bodyRows()).toHaveLength(15);
    expect(within(screen.getByRole("table")).getAllByText(/Privada conveniada \(poder público: Municipal\)/)).toHaveLength(15);
    await userEvent.selectOptions(screen.getByLabelText("Dependência administrativa"), "");
    await userEvent.selectOptions(screen.getByLabelText("Localização"), "rural");
    expect(bodyRows()).toHaveLength(14);
  });

  it("erro de consulta não mostra dados substitutos", async () => {
    state.fail = true;
    renderUnitsRoutes("/unidades");
    expect(await screen.findByText("Não foi possível consultar as unidades")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("sem sessão mostra acesso restrito", async () => {
    state.session = false;
    renderUnitsRoutes("/unidades");
    expect(await screen.findByText("Acesso restrito")).toBeInTheDocument();
  });

  it("detalhe resolve inep-33096589 com NULL → não informado", async () => {
    renderUnitsRoutes("/unidades/inep-33096589");
    expect(await screen.findByRole("heading", { level: 1, name: "CIEP 467 HENRIETT AMADO" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /histórico de versões/i })).toBeInTheDocument();
    expect(screen.getAllByText("não informado").length).toBeGreaterThan(5);
  });

  it("identificador inexistente ⇒ não encontrada", async () => {
    renderUnitsRoutes("/unidades/inep-0");
    expect(await screen.findByText("Unidade não encontrada")).toBeInTheDocument();
  });

  it("caminho operacional não importa fixtures nem textos de demonstração", () => {
    for (const f of ["units-list-page.tsx", "unit-detail-page.tsx", "school-registry-source.ts", "../../routes/unidades.index.tsx", "../../routes/unidades.$id.tsx"]) {
      const src = readFileSync(new URL(f, import.meta.url), "utf8");
      expect(src).not.toMatch(/units-data|demonstrationUnits|getDemonstrationUnit|DEMO_|fictíci|demonstrativ/i);
    }
  });
});

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  createIdentityStore,
  memoryIdentityStorage,
  validateLogoBytes,
  type IdentityFile,
} from "./identity-store";
import { InstitutionalLogo } from "./institutional-logo";
import { CalendarDocument } from "@/features/calendar/calendar-document";
import { createCalendarFixtures } from "@/features/calendar/calendar-fixtures";
import { identityStore } from "./identity-store";

const ciece = { profile: "ciece" as const };
const file = (name: string): IdentityFile => ({
  url: `data:image/png;base64,${name}`,
  mimeType: "image/png",
  originalFileName: `${name}.png`,
  size: 1000,
});
const fresh = () => createIdentityStore(memoryIdentityStorage());

function png(colorType: number) {
  const b = new Uint8Array(64);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  b[25] = colorType;
  return b;
}

describe("Identidade institucional", () => {
  it("brasão: cadastro e atualização controlada preservam histórico", () => {
    const s = fresh();
    expect(s.resolve({ kind: "municipal-coat-of-arms" })?.version).toBe(1);
    const r = s.register(ciece, { kind: "municipal-coat-of-arms", file: file("novo") });
    expect(r.ok).toBe(true);
    expect(s.resolve({ kind: "municipal-coat-of-arms" })?.file.url).toContain("novo");
    const h = s.history("municipal-coat-of-arms");
    expect(h).toHaveLength(2);
    expect(h[1]?.status).toBe("substituido");
  });

  it("Secretaria: duas logos com vigências distintas resolvem pela data", () => {
    const s = fresh();
    s.register(ciece, {
      kind: "education-department-logo",
      file: file("A"),
      validFrom: "2025-01-01",
      validUntil: "2028-12-31",
    });
    s.register(ciece, {
      kind: "education-department-logo",
      file: file("B"),
      validFrom: "2029-01-01",
    });
    expect(
      s.resolve({ kind: "education-department-logo", date: "2027-06-01" })?.file.url,
    ).toContain("A");
    expect(
      s.resolve({ kind: "education-department-logo", date: "2030-02-01" })?.file.url,
    ).toContain("B");
    expect(s.history("education-department-logo")).toHaveLength(3);
    expect(s.history("education-department-logo").every((a) => a.status === "ativo")).toBe(true);
  });

  it("rejeita vigência invertida", () => {
    const r = fresh().register(ciece, {
      kind: "education-department-logo",
      file: file("x"),
      validFrom: "2029-01-01",
      validUntil: "2028-01-01",
    });
    expect(r.ok).toBe(false);
  });

  it("escola cadastra a própria logo; escola A não altera escola B; ausência é explícita", () => {
    const s = fresh();
    expect(s.resolve({ kind: "school-logo", ownerId: "B" })).toBeUndefined();
    expect(
      s.register(
        { profile: "escola", unitId: "A" },
        { kind: "school-logo", ownerId: "B", file: file("x") },
      ).ok,
    ).toBe(false);
    expect(
      s.register(
        { profile: "escola", unitId: "B" },
        { kind: "school-logo", ownerId: "B", file: file("b") },
      ).ok,
    ).toBe(true);
    const logo = s.resolve({ kind: "school-logo", ownerId: "B" })!;
    expect(logo.ownerType).toBe("school");
    expect(s.remove({ profile: "escola", unitId: "A" }, logo.id).ok).toBe(false);
    expect(s.remove({ profile: "escola", unitId: "B" }, logo.id).ok).toBe(true);
    expect(s.resolve({ kind: "school-logo", ownerId: "B" })).toBeUndefined();
    expect(s.history("school-logo", "B")).toHaveLength(1);
  });

  it("perfis sem capacidade não alteram ativos", () => {
    const s = fresh();
    for (const profile of ["supervisao", "professor", "familia", "escola"] as const)
      expect(
        s.register({ profile, unitId: "A" }, { kind: "education-department-logo", file: file("x") })
          .ok,
      ).toBe(false);
    expect(
      s.register({ profile: "supervisao" }, { kind: "municipal-coat-of-arms", file: file("x") }).ok,
    ).toBe(false);
  });

  it("valida arquivo: PNG transparente, JPEG, inválido, SVG e tamanho", () => {
    expect(validateLogoBytes({ bytes: png(6), declaredType: "image/png", size: 64 })).toMatchObject(
      { ok: true, hasTransparency: true },
    );
    expect(validateLogoBytes({ bytes: png(2), declaredType: "image/png", size: 64 })).toMatchObject(
      { ok: true, hasTransparency: false },
    );
    expect(
      validateLogoBytes({
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]),
        declaredType: "image/jpeg",
        size: 5,
      }).ok,
    ).toBe(true);
    expect(
      validateLogoBytes({ bytes: new Uint8Array(40), declaredType: "image/png", size: 40 }).ok,
    ).toBe(false);
    expect(
      validateLogoBytes({ bytes: new Uint8Array(40), declaredType: "image/svg+xml", size: 40 }).ok,
    ).toBe(false);
    expect(
      validateLogoBytes({ bytes: new Uint8Array(40), declaredType: "application/pdf", size: 40 })
        .ok,
    ).toBe(false);
    expect(
      validateLogoBytes({ bytes: png(6), declaredType: "image/png", size: 3 * 1024 * 1024 }).ok,
    ).toBe(false);
  });

  it("componente preserva proporção e trata ausência", () => {
    const s = fresh();
    const { container, getByText } = render(
      <>
        <InstitutionalLogo kind="municipal-coat-of-arms" store={s} />
        <InstitutionalLogo
          kind="school-logo"
          ownerId="X"
          store={s}
          missing={<span>Logo da unidade não cadastrada</span>}
        />
      </>,
    );
    const img = container.querySelector("img")!;
    expect(img.style.objectFit).toBe("contain");
    expect(img.getAttribute("width")).toBeNull();
    expect(getByText("Logo da unidade não cadastrada")).toBeTruthy();
  });

  it("consulta histórica resolve a identidade da época", () => {
    const s = fresh();
    s.register(ciece, {
      kind: "education-department-logo",
      file: file("nova"),
      validFrom: "2029-01-01",
    });
    const { container } = render(
      <InstitutionalLogo kind="education-department-logo" date="2027-03-01" store={s} />,
    );
    expect(container.querySelector("img")!.getAttribute("data-identity-id")).toBe("idn-semed-v1");
  });

  it("calendário resolve brasão e logo da Secretaria pelo módulo central e reflete alterações", () => {
    const [regular] = createCalendarFixtures();
    const { container, rerender } = render(<CalendarDocument cal={regular!} />);
    const ids = () =>
      [...container.querySelectorAll("img")].map((i) => i.getAttribute("data-identity-id"));
    expect(ids()).toEqual(["idn-brasao-v1", "idn-semed-v1"]);
    const r = identityStore.register(ciece, {
      kind: "education-department-logo",
      file: file("atual"),
    });
    rerender(<CalendarDocument cal={regular!} />);
    expect(r.ok && ids()[1]).toBe(r.ok ? r.asset.id : "");
  });
});

describe("Logo de setor", () => {
  it("CIECE cadastra setor e logo; outros perfis não; documento resolve pelo setor", () => {
    const s = fresh();
    expect(s.sectors().map((x) => x.acronym)).toContain("CIECE");
    expect(s.addSector({ profile: "escola" }, { acronym: "SUP", name: "Supervisão" }).ok).toBe(
      false,
    );
    const r = s.addSector(ciece, { acronym: "SUP", name: "Supervisão de Ensino" });
    expect(r.ok).toBe(true);
    expect(s.addSector(ciece, { acronym: "sup", name: "x" }).ok).toBe(false);
    expect(
      s.register(
        { profile: "supervisao" },
        { kind: "sector-logo", ownerId: "setor-ciece", file: file("c") },
      ).ok,
    ).toBe(false);
    expect(
      s.register(ciece, { kind: "sector-logo", ownerId: "setor-ciece", file: file("c") }).ok,
    ).toBe(true);
    expect(s.resolve({ kind: "sector-logo", ownerId: "setor-ciece" })?.ownerType).toBe("sector");
    expect(s.resolve({ kind: "sector-logo", ownerId: r.ok ? r.sector.id : "" })).toBeUndefined();
  });
});

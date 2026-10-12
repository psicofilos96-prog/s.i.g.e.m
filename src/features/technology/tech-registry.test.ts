import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TECH_REGISTRY_STAGES, exposesNetworkInfo } from "./tech-registry";

const sql = readFileSync("drizzle/migrations/0502_tech15_registry_network_guard.sql", "utf8");

describe("lote 15 — cadastros técnicos sem informação de rede", () => {
  it("recusa IP, MAC, IPv6, credencial e URL interna", () => {
    for (const t of ["gateway 192.168.0.1", "mac 00:1A:2B:3C:4D:5E", "fe80::1:2:3", "senha: abc", "token=xyz", "https://srv.intranet/app", "https://u:p@host.gov.br"]) expect(exposesNetworkInfo(t), t).toBe(true);
  });
  it("aceita texto técnico comum", () => {
    for (const t of ["Notebook i5 8 GB", "Provedor Fibra Ltda", "https://sistema.itap.gov.br", "versão 2.10.3", "Plano 300 Mbps"]) expect(exposesNetworkInfo(t), t).toBe(false);
  });
  it("cobre os cinco cadastros pedidos", () => {
    expect(TECH_REGISTRY_STAGES.map((s) => s.id)).toEqual(["licencas", "conectividade", "servicos", "backup", "inventario"]);
  });
  it("o banco aplica a guarda nas tabelas com texto livre e não semeia", () => {
    for (const t of ["tech_connectivity_links", "tech_digital_service_versions", "tech_equipment_sheets", "tech_backup_plan_versions", "tech_restore_tests"]) expect(sql).toContain(`ON public.${t} FOR EACH ROW`);
    expect(sql).not.toMatch(/INSERT INTO/i);
  });
});

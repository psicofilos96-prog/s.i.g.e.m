import { describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { ROUTE_GUIDES, guideForPath } from "./route-guides";
import { STATION_HOME } from "@/features/authority/station-navigation";

const files = readdirSync("src/routes");
const routeExists = (p: string) => {
  if (p === "/") return existsSync("src/routes/index.tsx");
  const b = p.slice(1);
  return files.some((f) => f === `${b}.tsx` || f === `${b}.index.tsx` || f.startsWith(`${b}.`));
};

describe("NUX.4.1 orientação por rota", () => {
  it("toda estação tem orientação na página inicial", () => {
    for (const home of Object.values(STATION_HOME)) expect(guideForPath(home), home).not.toBeNull();
  });
  it("toda orientação aponta para uma rota real", () => {
    for (const p of Object.keys(ROUTE_GUIDES)) expect(routeExists(p), p).toBe(true);
  });
  it("subpáginas não herdam a orientação da lista", () => {
    expect(guideForPath("/alunos/abc")).toBeNull();
    expect(guideForPath("/alunos/")).not.toBeNull();
  });
  it("sem identificador técnico nem jargão no texto", () => {
    const text = JSON.stringify(ROUTE_GUIDES);
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(text).not.toMatch(/\b(RLS|RPC|UUID|backend|query|SQL)\b/i);
  });
});

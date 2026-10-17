import { describe, expect, it } from "vitest";
import { classifySchool } from "@/features/statistical-map/declared-inconsistencies";
import { consolidationFingerprint, inCategory, noticeReachesSchool } from "./network-categories";

const urb = classifySchool({ location_kind: "urbana", administrative_dependency: "municipal" });
const rur = classifySchool({ location_kind: "rural", administrative_dependency: "municipal" });
const conv = classifySchool({ location_kind: "rural", administrative_dependency: "privada" });

describe("categorias oficiais da rede", () => {
  it("urbanas, rurais e conveniadas são exclusivas entre si", () => {
    expect([inCategory(urb, "municipal-urbana"), inCategory(urb, "municipal-rural"), inCategory(urb, "conveniada")]).toEqual([true, false, false]);
    expect([inCategory(rur, "municipal-urbana"), inCategory(rur, "municipal-rural"), inCategory(rur, "conveniada")]).toEqual([false, true, false]);
    expect([inCategory(conv, "municipal-urbana"), inCategory(conv, "municipal-rural"), inCategory(conv, "conveniada")]).toEqual([false, false, true]);
  });
  it("escola sem classificação só aparece em 'todas'", () => {
    expect(inCategory(undefined, "conveniada")).toBe(false);
    expect(inCategory(undefined, "todas")).toBe(true);
  });
  it("aviso para conveniadas não chega à escola urbana municipal", () => {
    expect(noticeReachesSchool("conveniada", urb)).toBe(false);
    expect(noticeReachesSchool("todas", urb)).toBe(true);
  });
  it("impressão digital muda quando um total muda", async () => {
    const base = { year: 2027, month: 3, audience: "todas" as const, schoolIds: ["b", "a"] };
    const a = await consolidationFingerprint({ ...base, totals: { alunos: 10 } });
    const b = await consolidationFingerprint({ ...base, schoolIds: ["a", "b"], totals: { alunos: 10 } });
    const c = await consolidationFingerprint({ ...base, totals: { alunos: 11 } });
    expect(a).toBe(b); expect(a).not.toBe(c);
  });
});

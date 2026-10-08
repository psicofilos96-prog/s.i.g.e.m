import { FLOWS, GLOSSARY, SCREEN_MEANINGS, TOPICS, TOURS, type ScreenMeaning, type Flow, type HelpTopic, type Locale, type Text, type Tour } from "./help-content";

export const txt = (x: Text, l: Locale = "pt-BR") => x[l] ?? x["pt-BR"];
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export type Viewer = Readonly<{ capabilities: readonly string[]; administrative: boolean }>;
const visible = (aud: readonly string[] | undefined, v: Viewer) => !aud || aud.some((c) => v.capabilities.includes(c));

export const topicVisible = (t: HelpTopic, v: Viewer) => visible(t.audienceCapabilities, v) && (!t.administrative || v.administrative);
export const flowsFor = (v: Viewer, flows: readonly Flow[] = FLOWS) => flows.filter((f) => visible(f.audienceCapabilities, v));
export const toursFor = (v: Viewer, tours: readonly Tour[] = TOURS) => tours.filter((f) => visible(f.audienceCapabilities, v));

/** Tópicos contextuais: prefixo de rota mais específico primeiro; rota sem conteúdo ⇒ []. */
export function topicsForRoute(path: string, v: Viewer, topics: readonly HelpTopic[] = TOPICS): HelpTopic[] {
  const score = (t: HelpTopic) => Math.max(-1, ...t.routes.filter((r) => path === r || path.startsWith(r === "/" ? "/\u0000" : `${r}/`)).map((r) => r.length));
  return topics.filter((t) => topicVisible(t, v) && score(t) >= 0).sort((a, b) => score(b) - score(a));
}

export type Hit = { kind: "topico" | "glossario"; id: string; title: string; excerpt: string };
/** Busca acentuação-insensível; todas as palavras devem aparecer. */
export function searchHelp(q: string, v: Viewer): Hit[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const has = (s: string) => { const n = norm(s); return words.every((w) => n.includes(w)); };
  return [
    ...TOPICS.filter((t) => topicVisible(t, v) && has(`${txt(t.title)} ${txt(t.summary)} ${txt(t.body)}`))
      .map((t) => ({ kind: "topico" as const, id: t.id, title: txt(t.title), excerpt: txt(t.summary) })),
    ...GLOSSARY.filter((g) => has(`${txt(g.term)} ${txt(g.definition)}`))
      .map((g) => ({ kind: "glossario" as const, id: g.id, title: txt(g.term), excerpt: txt(g.definition) })),
  ];
}

/** Última versão vista por tópico (sem PII) — indica "atualizado". */
export const isUpdated = (t: HelpTopic, seen: Readonly<Record<string, number>>) => (seen[t.id] ?? 0) < t.version;

/** NHELP.1: bloco da tela pelo prefixo de rota mais específico; sem entrada ⇒ null. */
export function meaningForRoute(path: string, list: readonly ScreenMeaning[] = SCREEN_MEANINGS): ScreenMeaning | null {
  let best: ScreenMeaning | null = null; let len = -1;
  for (const m of list) for (const r of m.routes) if ((path === r || path.startsWith(`${r}/`)) && r.length > len) { best = m; len = r.length; }
  return best;
}

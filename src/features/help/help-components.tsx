import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { GLOSSARY } from "./help-content";
import { meaningForRoute, topicsForRoute, txt, type Viewer } from "./help-model";

const ADMIN_CAPS = ["manter-politica-de-capacidades", "consultar-auditoria", "exportar-auditoria"];
export function useHelpViewer(): Viewer {
  const a = useSessionAuthority();
  const caps = a.status === "signed-in" ? a.capabilities.map((c) => c.capabilityId) : [];
  return { capabilities: caps, administrative: caps.some((c) => ADMIN_CAPS.includes(c)) };
}

/** Ajuda pontual de um termo do glossário. */
export function HelpHint({ termId }: { termId: string }) {
  const g = GLOSSARY.find((x) => x.id === termId);
  if (!g) return null;
  return (
    <Popover>
      <PopoverTrigger aria-label={`O que é ${txt(g.term)}?`} className="inline-flex min-h-9 min-w-9 pointer-coarse:min-h-11 pointer-coarse:min-w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
        <CircleHelp className="h-4 w-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-sm"><p className="font-medium">{txt(g.term)}</p><p>{txt(g.definition)}</p></PopoverContent>
    </Popover>
  );
}

/** Ajuda da página atual; não renderiza nada se a rota não tem conteúdo. */
export function ContextHelp() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const topics = topicsForRoute(path, useHelpViewer());
  const [open, setOpen] = useState(false);
  if (!topics.length) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label="Ajuda desta página" className="inline-flex min-h-9 pointer-coarse:min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground">
        <CircleHelp className="h-4 w-4" aria-hidden /> Ajuda
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3 text-sm">
        {topics.map((t) => <div key={t.id}><p className="font-medium">{txt(t.title)}</p><p>{txt(t.summary)}</p></div>)}
        <Link to="/ajuda" className="text-primary underline">Abrir central de ajuda</Link>
      </PopoverContent>
    </Popover>
  );
}

/** NHELP.1: bloco recolhível "O que isso significa?" da tela atual; texto vem só de SCREEN_MEANINGS. */
export function WhatThisMeans({ pathname }: { pathname: string }) {
  const m = meaningForRoute(pathname);
  if (!m) return null;
  return (
    <details className="group rounded-md border border-border bg-muted/40 px-3 py-2 text-sm" data-help-meaning={m.id}>
      <summary className="inline-flex min-h-9 pointer-coarse:min-h-11 cursor-pointer items-center gap-1 font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring">
        <CircleHelp className="h-4 w-4" aria-hidden /> O que isso significa?
      </summary>
      <dl className="mt-2 space-y-2 text-muted-foreground">
        <div><dt className="font-medium text-foreground">O que se faz aqui</dt><dd>{txt(m.action)}</dd></div>
        <div><dt className="font-medium text-foreground">De onde vêm os dados</dt><dd>{txt(m.origin)}</dd></div>
        {m.numbers ? <div><dt className="font-medium text-foreground">De onde vem este número?</dt><dd>{txt(m.numbers)}</dd></div> : null}
      </dl>
      {m.terms?.length ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          {m.terms.map((id) => { const g = GLOSSARY.find((x) => x.id === id); return g ? <span key={id} className="inline-flex items-center gap-1">{txt(g.term)} <HelpHint termId={id} /></span> : null; })}
        </p>
      ) : null}
    </details>
  );
}

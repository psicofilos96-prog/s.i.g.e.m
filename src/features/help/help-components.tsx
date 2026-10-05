import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { GLOSSARY } from "./help-content";
import { topicsForRoute, txt, type Viewer } from "./help-model";

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
      <PopoverTrigger aria-label={`O que é ${txt(g.term)}?`} className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
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
      <PopoverTrigger aria-label="Ajuda desta página" className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground">
        <CircleHelp className="h-4 w-4" aria-hidden /> Ajuda
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3 text-sm">
        {topics.map((t) => <div key={t.id}><p className="font-medium">{txt(t.title)}</p><p>{txt(t.summary)}</p></div>)}
        <a href="/ajuda" className="text-primary underline">Abrir central de ajuda</a>
      </PopoverContent>
    </Popover>
  );
}

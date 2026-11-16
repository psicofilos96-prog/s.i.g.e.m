import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function ContextHint({ text, label = "Saiba mais" }: { text: string; label?: string }) {
  return <TooltipProvider delayDuration={200}><Tooltip>
    <TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground" aria-label={label}><CircleHelp className="size-4" /></Button></TooltipTrigger>
    <TooltipContent className="max-w-72 text-sm">{text}</TooltipContent>
  </Tooltip></TooltipProvider>;
}
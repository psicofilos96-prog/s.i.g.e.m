import type { ReactNode } from "react";
import { FileDown, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type ExportMenuProps = {
  onPdf?: () => void | Promise<void>;
  onExcel?: () => void | Promise<void>;
  onCsv?: () => void | Promise<void>;
  disabled?: boolean;
  label?: string;
  className?: string;
  leadingAction?: ReactNode;
};

/** Menu único de exportação. Callbacks e permissões continuam sob controle da tela consumidora. */
export function ExportMenu({ onPdf, onExcel, onCsv, disabled = false, label = "Exportar", className, leadingAction }: ExportMenuProps) {
  const options = [
    onPdf ? { label: "PDF", icon: FileText, run: onPdf } : null,
    onExcel ? { label: "Excel", icon: FileSpreadsheet, run: onExcel } : null,
    onCsv ? { label: "CSV", icon: FileDown, run: onCsv } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);
  if (!options.length) return leadingAction ? <>{leadingAction}</> : null;
  return <div className={`inline-flex items-center gap-2 ${className ?? ""}`}>
    {leadingAction}
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button type="button" variant="outline" disabled={disabled}><FileDown aria-hidden="true" />{label}<ChevronDown aria-hidden="true" className="size-4 opacity-70" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map(({ label: format, icon: Icon, run }) => <DropdownMenuItem key={format} onSelect={() => { void run(); }}><Icon aria-hidden="true" className="mr-2 size-4" />{format}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}

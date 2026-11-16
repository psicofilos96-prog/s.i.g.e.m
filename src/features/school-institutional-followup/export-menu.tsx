import { ChevronDown, Download, FileText, FileSpreadsheet, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
export type FollowupExportFormat = "pdf" | "docx" | "xlsx" | "csv";
export function FollowupExportMenu({ disabled, onExport }: { disabled?: boolean; onExport: (format: FollowupExportFormat) => void }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="sm" variant="outline" disabled={disabled}>
    <Download className="size-4" /> Exportar <ChevronDown className="size-3.5" />
  </Button></DropdownMenuTrigger><DropdownMenuContent align="end">
    {([["pdf", "PDF", FileText], ["docx", "Word", FileText], ["xlsx", "Excel", FileSpreadsheet], ["csv", "CSV", Table2]] as const).map(([format, label, Icon]) =>
      <DropdownMenuItem key={format} onSelect={() => onExport(format)}><Icon className="mr-2 size-4 text-muted-foreground" />{label}</DropdownMenuItem>)}
  </DropdownMenuContent></DropdownMenu>;
}
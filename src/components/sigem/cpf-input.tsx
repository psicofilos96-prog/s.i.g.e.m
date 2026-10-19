import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cpfDigits, cpfMessage, formatCpf } from "@/lib/cpf";

/** Campo de CPF único do SIGEM: máscara automática, valor em 11 dígitos, aviso só quando faz sentido. */
export function CpfInput({ value, onChange, required, id, disabled, className, "aria-label": ariaLabel }: {
  value: string; onChange: (digits: string) => void; required?: boolean; id?: string; disabled?: boolean; className?: string; "aria-label"?: string;
}) {
  const [touched, setTouched] = useState(false);
  const msg = cpfMessage(value, { required, touched });
  const errId = id ? `${id}-erro` : undefined;
  return (
    <div className="space-y-1">
      <Input id={id} inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" maxLength={14}
        value={formatCpf(value)} disabled={disabled} className={className} aria-label={ariaLabel}
        aria-invalid={msg ? true : undefined} aria-describedby={msg ? errId : undefined}
        onChange={(e) => onChange(cpfDigits(e.target.value))} onBlur={() => setTouched(true)} />
      {msg && <p id={errId} role="alert" className="text-xs text-destructive">{msg}</p>}
    </div>
  );
}

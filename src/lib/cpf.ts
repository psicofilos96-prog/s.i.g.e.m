/**
 * Serviço único de CPF do SIGEM. Validação MATEMÁTICA (dígitos verificadores, módulo 11):
 * não confirma existência, regularidade ou titularidade na Receita Federal.
 * Armazenamento sempre com 11 dígitos sem pontuação (o banco guarda só a impressão HMAC).
 */
export const cpfDigits = (raw: string | null | undefined): string => (raw ?? "").replace(/\D/g, "").slice(0, 11);

export function isValidCpf(raw: string | null | undefined): boolean {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** Máscara progressiva 000.000.000-00. */
export function formatCpf(raw: string | null | undefined): string {
  const d = cpfDigits(raw);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Exibição protegida (LGPD): ***.456.789-** */
export function maskCpfForDisplay(raw: string | null | undefined): string {
  const d = cpfDigits(raw);
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : "";
}

export type CpfStatus = "vazio" | "incompleto" | "invalido" | "valido";
export function cpfStatus(raw: string | null | undefined): CpfStatus {
  const d = cpfDigits(raw);
  if (d.length === 0) return "vazio";
  if (d.length < 11) return "incompleto";
  return isValidCpf(d) ? "valido" : "invalido";
}

/** Mensagem em tempo real: nada enquanto a digitação está incompleta, a não ser que o campo já tenha perdido o foco. */
export function cpfMessage(raw: string, opts: { required?: boolean; touched?: boolean } = {}): string | null {
  const s = cpfStatus(raw);
  if (s === "vazio") return opts.required && opts.touched ? "Informe o CPF." : null;
  if (s === "incompleto") return opts.touched ? "O CPF tem 11 números." : null;
  if (s === "invalido") return "CPF inválido. Confira os números digitados.";
  return null;
}

/** Valor a gravar: null quando vazio (CPF ausente é permitido onde a regra deixa); recusa inválido. */
export function cpfForStorage(raw: string | null | undefined): { ok: true; value: string | null } | { ok: false } {
  const s = cpfStatus(raw);
  if (s === "vazio") return { ok: true, value: null };
  return s === "valido" ? { ok: true, value: cpfDigits(raw) } : { ok: false };
}

/** Erros dos writers do banco relacionados a CPF, em linguagem simples. */
export function cpfServerMessage(code: string): string | null {
  if (/cpf.*(invalid|inval)/i.test(code)) return "CPF inválido. Confira os números digitados.";
  if (/identifier_kind_value_key|identity:conflict|cpf.*(dup|conflict|already)/i.test(code))
    return "Este CPF já está ligado a outra pessoa no SIGEM. Procure a pessoa existente em vez de cadastrar de novo.";
  return null;
}

## Formatação (NFORMAT.1)
- Números/percentuais/plurais só por `format-ptbr.ts` e datas por `academic-date.ts`, porque cópias locais divergiam entre tela e PDF.
- Filtros de lista: opções na URL só via `useListUrlFilters` (`src/lib/list-url-state.ts`); busca livre só na sessão, porque contém nomes de pessoas.
- Telas chamam funções do banco por `callRpc` (`rpc-call.ts`), nunca helper local, porque 17 cópias idênticas divergiriam.
- Lote 11 Expansão (`offline-queue.ts`): fila móvel é núcleo puro sem armazenamento; ato oficial nunca entra offline, chave idempotente impede duplicata, conflito/negado voltam explícitos, logout/perda de sessão descarta tudo, porque aprovação sem revalidação no servidor ou dado de outra conta no aparelho não se desfazem. Persistência local exige revogar a decisão "PWA só manifest".

## CPF
- Validação, máscara e mensagens de CPF só por `src/lib/cpf.ts` (campo `CpfInput`); o banco revalida com `technical_cpf_valid` e guarda só HMAC único por pessoa, porque cópias da regra divergiam e CPF em claro violaria a LGPD. Auditoria só lê (`cpf_integrity_audit`, em /diagnostico).

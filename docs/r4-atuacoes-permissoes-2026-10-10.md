# R4 — Atuações, permissões e validação (2026-10-10)

Situação atual: Registro de lote.

## Auditoria das planilhas de pessoal (agregada, sem PII)
| Fonte | Linhas | Com escola | Com matrícula funcional |
|---|---|---|---|
| servidores-por-escola (ago–set/2026) | 1.797 | 1.797 | 0 |
| funcionarios-semed-por-setor | 219 | 0 (setor) | 219 (218 distintas) |

Pessoas no banco têm só os identificadores `inep-pessoa` (10.820) e `cpf-hmac` (10.779); nenhuma matrícula funcional foi registrada como identificador.
Resultado da prévia: **0 associações inequívocas**. Escolas: 1.797 pendentes por `sem-matricula-funcional`. SEMED: 219 pendentes por `matricula-sem-pessoa`. Nenhuma atuação foi gravada, nenhum login foi criado e nenhum vínculo foi feito por nome.

## Entregue
- `src/features/professionals/engagement-proposals.ts`: chave hash+aba+linha, vínculo só por matrícula funcional + INEP + vigência, prévia de conflitos, resumo de pendências e porta docente (exige função docente, turma e componente).
- 6 testes sintéticos.
- PDF A4 paisagem com bordas de 0,75pt, renderizado a 36/72/144 dpi (≈50%/100%/200%): 21/21 linhas verticais visíveis em todas as resoluções; 3 páginas paginadas. Teste com dados sintéticos.

## Não feito / impedimentos humanos
1. Uma fonte oficial que ligue a matrícula funcional à pessoa (CPF/INEP-pessoa), ou planilha das escolas com matrícula. Só o DP pode fornecer.
2. A autoria humana das atuações: um titular competente precisa aprovar.
3. O E2E com isolamento A/B no banco: o acesso técnico disponível não pode criar identidades nem executar funções. O teste SQL das identidades técnicas segue escrito e ainda não foi executado. Nada foi validado em sessão institucional real.
4. GitHub: o projeto está em `cec0de18` e o remoto main em `a5980748`. A diferença não foi reconciliada e não houve force-push.

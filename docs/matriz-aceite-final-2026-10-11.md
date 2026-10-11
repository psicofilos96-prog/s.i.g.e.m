# Matriz de aceite final — SIGEM 2.0 G

Situação atual: Registro de lote (2026-10-11).

## Sincronização
- HEAD local = HEAD do repositório do Lovable: `7cc80601`. Árvore limpa.
- `a21c747c` e `0305da9c` são ancestrais do HEAD (457 e 478 commits atrás): não há divergência na história do Lovable.
- O GitHub não foi lido diretamente (não há conector GitHub ligado); a sincronização com o GitHub é feita automaticamente pela plataforma. Para confirmar, comparar o HEAD de `main` no GitHub com `7cc80601`.

## Verificações executadas
| Verificação | Resultado |
|---|---|
| Typecheck (`tsgo`) | OK, 0 erros |
| Suíte completa (vitest) | 632 arquivos; 5.606 aprovados, 7 pulados; 1 falha (índice de docs desatualizado) corrigida regenerando `scripts/docs-index.mjs` e reexecutada: OK |
| Migrations | 49 em `supabase/migrations` + 380 em `drizzle/migrations`; a tabela de controle não é visível ao papel de leitura: não apurado |
| `scripts/integration-acceptance-e2e.mjs` | Recusado pelo `harness-gate` (`SIGEM_TEST_HARNESS≠1`, sem `SIGEM_HARNESS_ACK`; exige chave de serviço indisponível no sandbox) |
| Smoke autenticado / A-B / exportações | Não executado: sessão `signed_out`, sem conta sintética |
| Testes SQL com papéis (`supabase/tests/*.sql`) | Só no CI do GitHub |

## Matriz por frente
| Frente | Status |
|---|---|
| Expansão 01–12 (núcleos puros) | implementado sem E2E |
| A Identidade/vínculos | implementado sem E2E; bloqueado por dados (9.811 inícios, 48 multiescola) |
| B NEI | implementado sem E2E; decisão institucional (coordenação, retenção) |
| C SIA/SIPE/Diário/Família | implementado sem E2E (SQL só no CI) |
| D Secretaria/documentos | bloqueado por dados (matrizes, atas, lotações 2026) |
| E Relatórios | implementado sem E2E (6 execuções limpas pendentes) |
| F Alimentação | implementado e testado em unidade (149); E2E SQL só no CI |
| A&A lote 18 | implementado e testado (57/57 autenticado, registro anterior) |

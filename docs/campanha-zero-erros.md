# Campanha zero erros — NZEROERROR.1

Situação atual: Registro de lote (2026-10-09). Não declara PASS — NO_KNOWN_REPRODUCIBLE_TECHNICAL_DEFECTS.

## Executado
- Smoke headless de 119 rotas estáticas sem sessão (console, pageerror, 5xx, texto cru undefined/NaN/[object Object]): 0 5xx, 0 pageerror, 0 texto cru; 8 rotas com 401 no console.
- Suite completa: 4.808 testes; 4 falhas encontradas e corrigidas (abaixo); reexecução dos arquivos afetados: 34/34.

## Defeitos (reproduzir → teste → corrigir → provar)
| # | Defeito | Correção | Prova |
|---|---|---|---|
| 1 | `/transporte-escolar` sem permissão dizia "Não foi possível registrar" numa leitura | erro de leitura passa por `userErrorText` | smoke; `zeroerror-anon.test.ts` |
| 2 | `/integracoes` classificava recusa (42501) como "indisponível"/incidente | `userErrorText` (autorização, expected.forbidden) | idem |
| 3 | Chamada: testes esperavam "Ausente" após rótulo Presente/Falta | testes atualizados | attendance.test.tsx |
| 4 | Central de Documentos: `<th>` sem `scope` (a11y) | `scope="col"` | data-grid-ntable2.test.tsx |

## Achados não corrigidos
- 8 rotas sem sessão disparam leituras que respondem 401 (administracao, central-de-integracoes, estacao-administrativa, infraestrutura, integracoes, revisao-de-anomalias, tarefas, transporte-escolar). Comportamento seguro (banco nega, tela mostra recusa), mas ruído; ideal: portão de sessão antes da leitura.
- Menu lateral mostra estações indevidas (HOMO.REAL.1), telas negam.

## Não executado
Smoke autenticado por perfil, mobile, performance, PDFs de outros módulos, banco com rollback — ambiente sem login; rotas com parâmetro não percorridas.

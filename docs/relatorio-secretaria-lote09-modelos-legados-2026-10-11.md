# Secretaria — Lote complementar 09: modelos legados

**Situação atual:** Registro de lote.

## Fonte e método
- `Secretaria_2026.rar` (uploads) foi **listado** (`unrar lb`): 569 entradas, 499 arquivos. Nenhum arquivo foi extraído, aberto ou executado; nenhum dado pessoal foi importado.
- Classificação só por nome/caminho (`src/features/school-secretariat/legacy-templates.ts`). Nomes de pessoas não aparecem neste relatório.

## Resultado
| Rotina | Modelos candidatos | Registros pessoais (excluídos) | Referências |
|---|---|---|---|
| Atestado de escolaridade | 1 | 4 | 4 |
| Declaração de transferência | 1 | 5 | 1 |
| Declaração de frequência de servidor | 0 | 52 | 6 |
| Autorizações | 0 | 1 | 8 |
| Renovação de matrícula | 0 | 0 | 5 |
| Ficha de matrícula | 0 | 0 | 4 |
| Ofícios | 0 | 0 | 19 |
| Atas | 0 | 1 | 3 |
| Bolsa Família | 0 | 9 | 0 |
| Outros (calendário, carimbo, controle, arquivo morto, aviso, checagem) | 0 | 0 | 14 |
| Não classificado (revisão humana) | 4 | 27 | 330 |

- 20 arquivos em formato antigo (.doc/.xls) marcados com risco de macro; nunca executados.
- 26 grupos de possíveis versões/duplicatas (mesma rotina e nome normalizado) — só candidatos.
- Candidatos a modelo: atestado de escolaridade "limpo", declaração de transferência "Nome do aluno", Modelo de FICAI, Modelo de Livro de Matrícula 2020, Modelo de Termo de Justificativa de Ausência, requerimento de férias.

## Rastreabilidade arquivo → processo → modelo → tela
Em `ROUTINE_TRACE`. Modelo só vira template editável no Studio de documentos (`/central-de-documentos`) por revisão humana, como **rascunho não homologado**; campos apontam apenas cadastros canônicos.

## Lacunas
- Conteúdo dos 6 candidatos não inspecionado; criação dos templates exige revisão humana do layout.
- 330 arquivos não classificados por nome.
- Bolsa Família, renovação de matrícula, arquivo morto: sem leiaute/norma da rede.

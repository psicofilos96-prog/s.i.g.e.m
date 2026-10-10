# Diário — modelos da rede: inventário e matriz

Situação atual: Registro de lote.

Fonte: 90 planilhas enviadas pelo proprietário em 2026-10-10. O inventário completo (arquivo, sha256, abas) fica em Files, `base-2026/inventario-modelos-diario.xlsx`, sem dados de estudantes. Todos os arquivos abriram.

## Famílias de modelo
| Família | Arq. | Folhas do modelo |
|---|---|---|
| Educação Infantil | 14 | CAPA V/H, Diário nº PL ×4 (frequência), FA nº PL ×4 (5 campos de experiência), Faltas, Observações, FA (ficha individual), CARIMBOS, ALUNOS, Para Planilha de Desempenho |
| Fundamental I | 13 | CAPA V/H, PAP nº PL (notas por componente), Diário nº PL (frequência), Folha Final, Boletim, Ficha Individual, Observações, CARIMBOS, ALUNOS |
| EJA I–V | 10 | igual ao Fund. I com 2 PL/semestre + Ata Final e Resultado Final |
| Componente Fund. II / EJA VI–IX | 34 | Freq. nº PL, nº PL (AV1, AV2, instrumentos, participação, recuperação paralela), FINAL, Anexo |
| Livro de Notas | 8 | Dados (encerramento por PL), Folha Final, Boletim, Ficha Individual, Observações, Dependências, Ata Final, CARIMBOS |
| Anexo de observações | 9 | OBS mensal |
| Frequência integral | 2 | frequência por turma/oficineiro |

## Regras extraídas (código: `src/features/diary/network-model-rules.ts`, teste ao lado)
| Regra | Origem |
|---|---|
| Nota do período no Fund. II = MAX(AV1+AV2+Inst+Part; RecParalela+Inst+Part) | Componente!Q12 |
| Nota do período no Fund. I = soma dos instrumentos do PAP | PAP!G9 |
| Média final = ROUND(média dos PL) | FINAL!G8 |
| Aprovação por componente: MAX(média, rec. final) ≥ 50 | FINAL!N8 |
| EJA: todos os componentes ≥ 50 e frequência ≥ 75% | Folha Final!AA5 |
| % frequência = ROUND((AD−faltas)/AD, 2); 100% com falta vira 0,99 | 1º PL!H12 |
| Siglas T/E/MC/F por situação da matrícula | FINAL!G8 |
| EI: avaliação por 5 campos de experiência, sem nota | FA - nº PL |

## Matriz folha → SIGEM (estado)
| Folha legada | SIGEM | Estado |
|---|---|---|
| Frequência (Diário nº PL / Freq.) | chamada `attendance-*` | tela existe; impressão no layout legado pendente |
| Notas do período (PAP / nº PL) | Pauta 2.0 + regras acima | regra pronta; ligação da regra à Pauta pendente |
| Folha Final / FINAL / Ata Final | `bulletin.ts` + regras acima | cálculo pronto; tela e PDF pendentes |
| Boletim | `bulletin.ts` | projeção pronta; tela pendente |
| Ficha Individual | — | ausente |
| FA da EI (campos de experiência) | parecer descritivo EI | parcial |
| Observações / Anexo OBS | registro de aula | parcial |
| Dependências | — | ausente |
| CARIMBOS (assinaturas) | Document Studio | parcial (sem ligação ao diário) |
| CAPA V/H | — | ausente (capa sem conteúdo legível nos arquivos) |

Os nomes de pessoas e as portarias da folha CARIMBOS ficam fora deste documento.

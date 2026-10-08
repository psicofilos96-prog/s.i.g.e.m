# Auditoria final de fechamento técnico — NFINAL.10 (2026-10-08)

## Situação atual
- Classe: **Registro de lote**. Fotografia do HEAD `81dace02` em 2026-10-08; a contagem atual sai de `npm run verify`.
- Nada foi publicado, 2027 não foi configurado, nenhum dado/decisão/template/autoridade foi inventado.

## Pré-condição
- CAL.COUNT.1: `PASS — CALENDAR_SCHOOL_DAY_TOTAL_RECONCILED` (docs/cal-count-1-reconciliacao.md), reconfirmado pela etapa de dados do `verify`.

## Rotina máxima executada
| Etapa | Resultado |
|---|---|
| Índice da documentação | PASS |
| Integridade de migrations (252 drizzle + 49 supabase; congeladas intactas) | PASS |
| Typecheck | PASS |
| Suíte completa | PASS — 4.681 testes |
| Invariantes profundas (SIGEM_DEEP=1) | PASS — 94 |
| Acessibilidade por componente | PASS |
| Segurança SQL / segredos no código | PASS / PASS |
| Diff (somente leitura) | PASS |
| PDFs (motor + auditoria de renderização) | PASS |
| Dados (CAL.COUNT.1, NIMPORT.4, NTEST.4, prontidão) | PASS |
| Build de produção | PASS |
| Smoke de rotas sem login | PASS — 11 rotas sem 5xx |
| Harness institucional (contas efêmeras) | PASS — 69/69, inclui smoke autenticado e axe por estação/viewport (fails=0) |
| Zero resíduo | PASS — 0 usuários Auth, 0 fatos de fixture após cleanup |

## Reclassificação dos 22 requisitos abertos da matriz
| ID | Classe final | Evidência |
|---|---|---|
| SE-02, DO-01 | COMPLETO_TECNICAMENTE | turno/ocupação na lista de enturmação; autosave ligado à tela EI |
| SU-01, OP-01, AV-01, AV-02, AV-03, TR-01, DP-01, RE-01, HO-01, DO-02, UX-01, BU-01 | VALIDACAO_INTERATIVA_PENDENTE | código e tela presentes; falta uso real com login pela pessoa de cada setor |
| NE-03 | TEMPLATE_PENDENTE | sem texto institucional aprovado de PEI/PAEE |
| FA-02, AU-01, OP-02 (Quadro Permanente), OP-03 (estados das filas do SIA) | DEPENDE_DECISAO | regra de saída sozinho; quem exporta auditoria; definição do Quadro Permanente e dos estados de fila não registradas |
| IM-01 | DEPENDE_DADO | leiaute oficial Educacenso de matrícula ausente (adaptador `missing`) |
| AL-01, AD-01 | HOMOLOGACAO | revisão visual pelo setor |

Nenhum gap técnico com decisão já registrada ficou sem implementação; os três itens antes marcados como técnicos (OP-02, OP-03, IM-01) dependem de decisão ou dado inexistentes.

## Pendências transversais
- CONFIGURACAO_OPERACIONAL_PENDENTE: abertura do ano 2027, atribuição de capabilities sem política (NEI, auditoria), restaurar cópia de backup completa.
- HOMOLOGACAO: regras do Mapa (CI-01/02).
- DEPENDE_DADO: formatos Educacenso/GPE/DP; capacidade por turma; mapeamento BNCC↔SAEB.

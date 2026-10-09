# Revisão final pós-fila — 2026-10-09

## Situação atual
- Classe: **Registro de lote**. Fotografia de 2026-10-09 após os lotes NLOADING.2, NFEEDBACK.1, NMAP.UX, NSEC.UX, NAVAL.UX, NDOC.UX, NCIECE.UX, NADM.UX e NOP.UX; a contagem atual sai de `npm run verify`.
- Prevalece sobre a coluna Status de `matriz-completude-produto-sigem.md` e complementa `auditoria-final-nfinal10.md`.
- Nada foi publicado, 2027 não foi aberto, nenhum dado/decisão/template/autoridade foi inventado.

## Pré-condição
- CAL.COUNT.1: `PASS — CALENDAR_SCHOOL_DAY_TOTAL_RECONCILED`, reconfirmado pela etapa de dados do `verify` (198 dias canônicos não forçados a 200).

## Rotina executada (`npm run verify`)
| Etapa | Resultado |
|---|---|
| Índice da documentação | PASS |
| Integridade de migrations (congeladas intactas) | PASS |
| Typecheck | PASS |
| Suíte completa | PASS — 4.727 testes |
| Invariantes profundas | PASS — 97 |
| Acessibilidade por componente | PASS |
| Segurança SQL / segredos | PASS / PASS |
| PDFs | PASS — 13 |
| Dados (CAL.COUNT.1, NIMPORT.4, NTEST.4, prontidão) | PASS — 17 |
| Build de produção / smoke de rotas | PASS / PASS (11 rotas) |
| Harness institucional | NOT RUN — exige contas sintéticas autorizadas |
| Telas por estação e a11y no navegador | NOT RUN — exige login real |

Resultado: **PASS PARCIAL** (não equivale a PASS completo).

## Pendências técnicas reclassificadas nesta revisão
| ID | Antes | Agora | Motivo |
|---|---|---|---|
| DO-01 | PARCIAL (autosave não ligado) | COMPLETO_TECNICAMENTE / validação com login pendente | autosave ligado em `infant-experience-pages.tsx` |
| DO-02 | PARCIAL (sem teste mobile) | COMPLETO_TECNICAMENTE / login pendente | NDOC.UX verificou 390px e 820px sem scroll horizontal |
| AV-03 | PARCIAL | COMPLETO_TECNICAMENTE / login pendente | NAVAL.UX: home "O que precisa ser feito", leitura textual, disclosure |
| OP-01/OP-03 | PARCIAL | PARCIAL / filas com motivo e próxima ação | NOP.UX: abas Revisar/Acompanhar/Decidir/Histórico; fiscalização e filas SIA dependem de decisão (OP-02/OP-03) |

Nenhuma outra pendência técnica definida restou executável sem dado, decisão ou login.

## O que ainda depende de algo externo
**Dados**
- Educacenso, GPE e DP: leiautes reais (IM-01 matrícula Educacenso).
- Capacidade por turma (SE-03); correlações BNCC↔SAEB/AVALIA RJ.
- 25 planilhas/PDFs de referência aguardando orientação.

**Decisões**
- FA-02, AU-01, OP-02, OP-03; peso dos remanejados (CI-03); carência de mediador (CI-04); numeração/assinaturas do Livro de Matrícula (SE-04).
- NRATE.2: confirmação "sim, ad hoc".
- 6D.3.3.2: distinção visual de resultado corrigido × oficial.

**Modelos (templates)**
- NE-03.

**Configuração**
- Abertura do ano 2027 (anos, turmas, grades); capacidades sem política (NEI, auditoria); tipos de arquivo nos buckets (NMIME.1); restauração de backup completo.
- Calendário: totais "indeterminado" e "Tipo sem mapeamento visual: Conselho de Classe Final" na tela real.

**Homologação**
- Mapa 2027 (CI-01/CI-02), AL-01, AD-01.

**Validação humana / com login**
- Harness institucional e smoke autenticado por estação (NROUTE.3, NA11Y.3).
- Contas reais: Secretaria, Avaliação, Professor, CIECE, admin@, Direção/Orientação, supervisao@ (calendário: PDF, salvar/reabrir/imprimir).
- Leitor de tela real (NFEEDBACK.1, NDOC.UX, NOP.UX).
- NLOADING.2: troca rápida de contexto e falha de rede nas ~25 telas restantes com login.
- Login setorial por link mágico foi bloqueado pela plataforma; a prova exige outro método de login.

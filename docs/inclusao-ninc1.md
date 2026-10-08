# NINC.1 — fechamento técnico da Inclusão (gaps N12.5)

## Situação atual (2026-10-08)
- Classe: **Registro de lote**. Regras em `src/features/inclusion/AGENTS.md`; produto em `nei-aee-mediador-produto.md`.

## Feito (sem nova autoridade, sem dado novo)
- **Registro clínico restrito (NE-01, decisão N12.1):** migrations 0243/0244. Tabela append-only `inclusion_clinical_records` (CID como escrito no documento, documento de origem, dimensão só de catálogo homologado `dimensao-clinica-inclusao` — sem valores semeados —, observação, laudo opcional ligado a anexo clínico existente, vigência, correção/encerramento com motivo e base esperada). Sem acesso direto à tabela.
  - Gravação: `record_inclusion_clinical` exige as capabilities já existentes `registrar-apoio-inclusivo` + `consultar-documento-sensivel-inclusao` na escola.
  - Leitura: `inclusion_clinical_records_for` exige finalidade; toda tentativa entra em `inclusion_clinical_access_events`; recusa devolve vazio (0244 corrigiu o RAISE que apagava a trilha da recusa).
  - Tela: seção "Registro clínico restrito" no estudante em `/inclusao`, com histórico de versões.
- **Relatório do estudante (NE-03):** impressão com PEI/PAEE/relatório pedagógico vigentes e clínico apenas se lido com permissão; marcado "não oficial" e sem campos de assinatura inventados.
- **Correção técnica:** ao abrir um estudante, os painéis de mediação, visão da rede e fila de termos apareciam duplicados; removidos da seção do estudante.
- Inventário de privacidade atualizado (novas tabelas e reader).

## Testes
`src/features/inclusion/clinical-model.test.ts`: cabeça/histórico, relatório escapado e sem clínico não autorizado, contrato SQL (nenhuma capability nova, sem GRANT a anon/authenticated na tabela, finalidade obrigatória, trilha antes da recusa, append-only).

## Pendências
- ASSIGNMENT_PENDING: nenhuma política homologada atribui as capabilities de inclusão; sem isso, ninguém grava nem lê.
- DEPENDE_DECISAO: valores do catálogo de dimensões (A/B/C) e quem revisa termos.
- TEMPLATE_INSTITUCIONAL_PENDENTE: PEI/PAEE/relatório NEI oficiais com assinaturas.
- PENDENTE: mediador — carência/substituição em um passo (hoje encerrar + novo vínculo, conforme regra).
- PROVAS_SQL_PENDENTES e INTERACTIVE_BROWSER_VALIDATION_PENDING.

## N8.2.4 (2026-10-08)
- Relatório evolutivo (`evolutionReportHtml`, botão "Imprimir relatório evolutivo" em `/inclusao`): plano, relatório pedagógico e atendimento AEE em ordem de data, como escritos; sem necessidade/categoria, sem clínico, sem medida de progresso; marcado não oficial — FEITO. Relatório do estudante passou a A4 com quebra de texto.
- PDF headless (fixtures, 60 registros longos sem espaço): 60 páginas A4, 0 overflow. Testes: `evolution-n824.test.ts`; suítes de inclusão e privacidade verdes.
- Sem mudança (já fechados): registro clínico com fonte e histórico (0243/0244), AEE (0167–0169), mediação, fila de termos; professor só vê "há mediação vigente". Nenhuma capability nova, nenhuma inferência de condição.
- ASSIGNMENT_PENDING (separado): capabilities de inclusão sem política homologada atribuída. Mantidos: TEMPLATE_INSTITUCIONAL_PENDENTE (PEI/PAEE oficiais), DEPENDE_DECISAO (dimensões A/B/C, carência de mediador), INTERACTIVE_BROWSER_VALIDATION_PENDING.

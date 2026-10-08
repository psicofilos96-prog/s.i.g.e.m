# N8.2.5 — Auditoria final de Inclusão, AEE e Mediador

**Situação atual:** Registro de lote (2026-10-08).

| Área | Situação | Evidência |
|---|---|---|
| Registro clínico restrito | OK — só com finalidade e trilha; recusa = vazio | `clinical-section.tsx`, `inclusion_clinical_records_for` |
| Anexos | OK — banco autoriza antes de tocar o arquivo; armazenamento privado | `inclusion-attachments.functions.ts` |
| Fila de termos | OK. Corrigido: rótulo por `knownLabel` (estado desconhecido = "Situação não reconhecida", nunca vazio/código) | `term-review-panel.tsx` |
| AEE | OK — entidade própria, sem tocar a frequência da turma. Corrigido: tabela da rede com legenda e cabeçalhos de coluna | `aee-sections.tsx` |
| PEI/PAEE | DEPENDE_DECISAO — registro `plano-educacional`; relatório "documento de trabalho, não oficial" até haver modelo institucional | `clinical-model.ts` |
| Relatório evolutivo | OK — só registros pedagógicos em ordem de data, sem CID/laudo nem medida de progresso | PDF de teste `n825-pdfs/` (A4, 2 páginas, 0 menções clínicas) |
| Mediador | OK — lê só durante a vigência, só o que a escola marcou | `inclusion_my_mediated_students` |
| Minimização | OK — exportação por `minimizedExport` sobre o `report-engine`; tabelas no inventário de privacidade | `data-inventory.ts` |
| Integração com Docente | OK — professor vê só "há mediação vigente" das próprias turmas | `teaching-support-notice.tsx` |
| Celular/headless | OK — `/inclusao` e `/meus-diarios` sem rolagem lateral, um título principal | `n825-screenshots/` |

Regressão: `src/features/inclusion/inclusion-n825.test.ts`.

Pendências: ASSIGNMENT_PENDING (capacidades de Inclusão sem política atribuída — autoridade separada, não alterada); INTERACTIVE_BROWSER_VALIDATION_PENDING (login real); DEPENDE_DECISAO (modelo de PEI/PAEE/relatório com assinaturas; quem revisa termos; se a impressão do relatório com dado clínico deve gerar trilha própria além da leitura); REVISAR (coluna "Registro" estreita no relatório evolutivo com textos longos — legível, sem corte).

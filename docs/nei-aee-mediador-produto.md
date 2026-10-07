# NEI / AEE / Mediador — produto

| Requisito | Estado |
|---|---|
| A Home NEI | Existente: visão agregada por escola (só contagens) |
| B Perfil com CID/laudo/A-B-C | DECIDIDO (N12.1): registro clínico restrito próprio; schema/readers/arquivos PENDENTES (exige migration com RLS restrita) |
| C Fila de termos | N8.2: projeção pura `term-review-queue.ts` (pendente/validado/recusado, histórico, sugestão textual nunca confirmada); persistência e tela PENDENTES |
| D AEE | Existente (serviço, agenda, sessões, frequência própria) |
| E Mediador | Parcial: lista em cartões, vigência; troca = encerrar + novo vínculo |
| F Relatório NEI | Depende de B (CID) |
| G Privacidade | Mantida: família/docente sem acesso automático |
| J Testes autenticados | Bloqueado: sessão indisponível |

## N8.2 — PARTIAL (CONTINUE_FROM=N8.2.1)
Só o núcleo da fila de termos. Registro restrito, readers por vínculo, PAEE/PEI, mediador e relatório NEI pendentes.

## N8.2.1 (parcial)
- Fila de termos (0228/0229): `inclusion_term_review_events` append-only; grava só `record_inclusion_term_review_v2` (abre pendente; decide validado/recusado com base esperada; categoria só de `categoria-de-apoio-inclusivo` homologada; validado exige alias ou categoria), lê só `inclusion_term_reviews_at`. Capability de rede `revisar-termos-inclusao` sem política atribuída ⇒ falha fechada. Sugestão automática não grava nada.
- PENDENTE técnico: tela da fila, registro restrito CID/laudo, AEE UI, PEI/PAEE, mediador, relatório NEI.
- DEPENDE_DECISAO: quem recebe `revisar-termos-inclusao` (atribuição de política).

## N8.2.2 (parcial)
- Capability `revisar-termos-inclusao`: nenhuma política homologada atribui capability de inclusão (auditado) ⇒ ASSIGNMENT_PENDING, sem bloquear.
- Tela da fila em /inclusao: adicionar termo, validar (alias) / recusar, histórico; sem permissão mostra ASSIGNMENT_PENDING. Pendentes: CID/laudo restrito, AEE UI, PEI/PAEE, mediador, relatório NEI.

## N8.2.2 (2026-10-07)
- Fila de termos: filtro Pendente/Validado/Recusado/Todos pelo estado vigente e exibição da categoria aprovada. Revisão: capability `revisar-termos-inclusao` sem conta atribuída = ASSIGNMENT_PENDING (tela informa, não bloqueia).
- Pendentes: registro restrito CID/laudo (dimensões A/B/C), AEE completo, PEI/PAEE/Relatório Evolutivo/Diário de Bordo com versões/assinaturas/PDF, mediador (substituição/encerramento/carência), relatório NEI dedicado; testes com execução real no banco bloqueados (acesso só leitura).
- Não passou: INCLUSIVE_EDUCATION_CORE_TECHNICALLY_COMPLETE.

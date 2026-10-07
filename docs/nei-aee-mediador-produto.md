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

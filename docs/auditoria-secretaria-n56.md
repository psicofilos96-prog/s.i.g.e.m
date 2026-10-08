# N5.6 — Auditoria final da estação Secretaria Escolar

**Situação atual:** Registro de lote (2026-10-08).

| Área | Tela | Situação |
|---|---|---|
| Home | `/secretaria` (estação real com login; laboratório sem login) | OK. Corrigido: movimentações e decisões de renovação mostravam o código cru |
| Matrícula guiada | `/matriculas/nova` | OK (rascunho append-only, conclusão por `enrollment_draft_complete`) |
| Turmas | `/turmas` | OK |
| Vagas / Livro | `/secretaria/vagas`, `/secretaria/livro-matricula` | OK. A ordem do Livro não é numeração oficial (DEPENDE_DECISAO) |
| Documentos | `/documentos-escolares` | OK (só `emit_school_document_v3`). TEMPLATE_INSTITUCIONAL_PENDENTE |
| Transferências / remanejamento | `/transferencias`, `/enturmacoes/*` | OK; `nova` e `movimentar` são a mesma tela com foco diferente, não duplicatas |
| Renovação | `/preparacao-ano` | OK |
| Histórico | "Vida escolar" dentro de `/secretaria` | OK. Corrigido: evento desconhecido mostrava o código |
| Pendências | painel da home e `/pendencias` (tramitação) | Domínios distintos, não duplicados |
| Comunicação / Serviços | `/comunicacao-escolar`, `/secretaria/servicos` | OK; Serviços só agrupa telas existentes |

**Correções técnicas (regra NUI.3 já decidida):** `issueLabel`, `lifeKindLabel`, `decisionLabel` e `movementTypeLabel` (`secretariat.ts`) usam `knownLabel`; um código desconhecido aparece como "Situação não reconhecida", e o tipo de movimentação vem do catálogo homologado. Teste: `secretariat-n56.test.ts`.

**Duplicidades:** nenhuma ilegítima. A ação "Enturmar/Remanejar" dentro da home usa os mesmos writers de `/enturmacoes` (REVISAR se a rede quiser uma só entrada).

**Celular / sem login:** todas as telas no celular sem rolagem lateral; fotos em `n56-screenshots/` (Files).

**Pendências:** INTERACTIVE_BROWSER_VALIDATION_PENDING (login da Secretaria); TEMPLATE_INSTITUCIONAL_PENDENTE; DEPENDE_DECISAO (numeração do Livro, fila de vagas, documentos obrigatórios); REVISAR /alunos sem h1.

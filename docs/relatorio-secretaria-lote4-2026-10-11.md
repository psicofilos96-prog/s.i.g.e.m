# Secretaria Escolar — Lote 4/4 (aceite)

Situação atual: Registro de lote (2026-10-11).

## Provado nesta rodada
- Fluxos integrados sobre núcleos puros (`secretariat-flows.test.ts`, 6 testes, identidade sintética, nada persiste): atendimento→documento→entrega; histórico bloqueado sem fechamento/ata; matrícula sem início e multiescola na central de qualidade sem correção; frequência→busca ativa só oficial; livro→fechamento→retificação com hash íntegro; entrega→recibo e anexo segregado por escola.
- Typecheck e suíte completa (ver mensagem do lote).

## Já existente
Central de qualidade dos dados (`/qualidade-dos-dados`, revisão humana append-only), Secretaria (`/secretaria`, filtro por escola), vagas, livro de matrícula, documentos e verificação pública.

## Não provado / pendente
- E2E autenticado escola A/B, responsável e anexos privados (RLS): sem conta sintética no ambiente (`harness-gate` recusa).
- Testes SQL com papéis: só no CI do GitHub.
- Telas novas (fila do atendimento, livros, kits, arquivo, central de impressão e etiquetas): não criadas; dependem de tabelas e decisões institucionais (tipos de atendimento, prazos, taxonomia, kits, modelos de etiqueta).
- Fluxos matrícula→turma→Diário, transferência→histórico e ofício→manutenção no banco: não executados nesta rodada.

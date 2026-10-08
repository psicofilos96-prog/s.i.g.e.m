# Revisão técnica da Infraestrutura

Situação atual: Registro de lote (2026-10-08). Só funções existentes (migration 0105); nenhuma regra de manutenção, condição ou prioridade criada.

## Feito
- Cobertura por escola ganhou exportação CSV/PDF pelo motor de relatórios (`INFRAESTRUTURA_COBERTURA`, catalogado na Central): só contagens e nomes de itens; "sem pendência" sai como "não disponível", zero informado é zero.
- Tabela de cobertura com `th scope="col"`.
- Prova de banco `supabase/tests/infra_review_human_writer.sql` (transação desfeita): ambiente (número), condição (catálogo), acessibilidade (sim/não), histórico preservado, 0/false gravados ≠ ausente, valor fora do catálogo e vazio recusados, alteração direta recusada, conta sem capacidade recusada. Resultado `infra-review-ok`; zero resíduo.
- Teste: `src/features/schools/infra-review.test.ts`.

## Pendências
- DEPENDE_DECISAO: anexos — o modelo guarda só referência textual da fonte; não há anexo de arquivo para infraestrutura.
- DEPENDE_DECISAO: regra de manutenção/avaliação de condição (fora do escopo, não criada).
- INTERACTIVE_BROWSER_VALIDATION_PENDING: tela com dados exige login.

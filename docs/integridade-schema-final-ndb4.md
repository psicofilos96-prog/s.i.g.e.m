# NDB.4 — Verificação final de integridade do schema (2026-10-08)

## Situação atual
Classe: Registro de lote. Complementa `contratos-de-banco-vigentes-ndb3.md` e `seguranca-verificacao-final-nsec4.md`.

## Inventário medido (banco do projeto, após 0249)
321 tabelas · 810 funções · 377 triggers · 588 FKs · 816 índices · 250 migrations no journal · manifesto com 299 arquivos.

| Verificação | Resultado |
|---|---|
| Tabelas sem RLS | 0 |
| Tabelas sem PK | 0 |
| Constraints NOT VALID | 0 |
| Índices inválidos/não prontos | 0 |
| Triggers desabilitados | 0 |
| GRANT de tabela para anon | 0 |
| DEFINER sem `search_path` | 0 |
| DEFINER executável por anon | 4 (aceitas: portal público ×2, verificação de documento, carteirinha) |
| Manifesto de migrations | 299/299, nenhum ausente, removido ou com hash alterado |
| Índices duplicados | 4 pares (ver abaixo) |
| Funções DEPRECATED com EXECUTE para contas | 1 (ver abaixo) |
| FKs sem índice de apoio | 266 |
| Readers `_at` | 120; todos STABLE; DEFINER por desenho já inventariado em NSEC.2 |

## Correções (`0250`, só dívida inequívoca)
- Removidos 2 índices idênticos a outro existente: `meal_inventory_movements_school_day` (= `meal_inventory_school`) e `meal_daily_executions_school_day` (= `meal_daily_executions_school_idx`).
- `install_sigem_reviewed(text×6,uuid,text,boolean)` — DEPRECATED (B1.3), sem chamada no app nem em outra função — perdeu EXECUTE de PUBLIC/anon/authenticated. Função preservada.
- Nenhuma migration congelada editada; nenhum dado tocado; nenhum acesso ampliado.

## Não corrigido (não inequívoco)
- 2 pares `(x, version DESC)` × unique `(x, version)`: redundância provável, mas sem medição de plano; PENDENTE.
- 266 FKs sem índice: sem evidência de hotspot (NPERF.4); indexar em massa teria custo de escrita; PENDENTE com medição.
- 27 funções DEPRECATED restantes já sem EXECUTE para contas; mantidas (etapa interna ou provas SQL).
- 7 tabelas e 2 colunas DEPRECATED comentadas; mantidas por compatibilidade.

## Gates
- Suíte completa 4.619/4.619 · profundas 82/82 · tipos OK · build OK · smoke de rotas OK · segredos 0 · manifesto 300/300 após congelar `0250`.
- Varredura do banco: 4 DEFINER públicas (as aceitas); 430 DEFINER para contas logadas (writers/readers por desenho, NSEC.2); 141 tabelas com RLS e sem política = fechadas, acesso só por função. Nada ampliado.

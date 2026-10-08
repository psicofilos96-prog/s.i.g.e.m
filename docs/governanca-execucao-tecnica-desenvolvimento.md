# Execução técnica de desenvolvimento (migration 0100)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


Decisão do proprietário (2026-10-05): durante o desenvolvimento, cargas e mudanças técnicas autorizadas
pelo proprietário são aplicadas por automação técnica, sem login humano e sem representar pessoa.

## Modelo
- `technical_automation_settings`: append-only; vigente = último registro de `development_automation_enabled`. Sem registro ou `false` ⇒ toda operação técnica recusa (`technical:automation-disabled`).
- `technical_execution_operations`: ledger append-only (kind, executor `automacao-tecnica`, ambiente, fonte/hash, `requested_by = decisao-do-proprietario`, impressão digital SHA-256 do payload, resultado, início/fim). Único por (kind, source_hash) ⇒ retry idempotente; payload diferente com o mesmo hash é recusado. Operação que falha é revertida inteira e não deixa linha.
- `technical_execution_targets`: fatos gravados por cada operação.
- Executor técnico não é `institutional_person` nem atuação. Fatos gravados por automação têm `author_user_id`, `author_person_id`, `authorizing_engagement_id` e política NULL; a proveniência fica no ledger e na justificativa da versão.
- Nenhum acesso para anon, authenticated ou service_role (tabelas e funções). Execução só pelo canal privilegiado de desenvolvimento do agente.
- Não existe função genérica: cada domínio ganha uma operação estreita, validada e idempotente que chama o MESMO núcleo canônico do writer humano (escolas: `school_record_version_core`).

## Operações
| Operação | Validações | Estado |
|---|---|---|
| `technical_import_educacenso_2026_schools` | modo ativo, kind, hash `fd2e288b…`, snapshot 2026-08-31, 55 total, 40 municipal, 15 privada conveniada, 41 urbana, 14 rural, 55 ativas, 55 INEP únicos, school_id `inep-<INEP>`, nenhum código de rede | executada: operação `ea2941be-6093-46ec-85f4-ceaf69b7b001`, 110 alvos |

## Prova da carga (Cloud)
55 escolas, 55 versões v1, 55 INEP, 0 código de rede, 40/15 por dependência, 41/14 por localização, 55 ativas com valid_from 2026-08-31, 0 autoria humana, retry devolveu a mesma operação sem novas linhas. Prova permanente: `supabase/tests/technical_execution_schools.sql` (termina em RAISE, nada persiste).

## Regra para agentes futuros
Falta de sessão humana não bloqueia execução técnica autorizada pelo proprietário. Para cada domínio (frentes A–J), crie operação técnica específica sobre o núcleo canônico. Sessão humana só é necessária para testar experiência/autorização de usuários reais. A UI continua exigindo sessão e capability.

## Desabilitar antes da produção
1. Nova migration inserindo `('development_automation_enabled', false, 'decisao-do-proprietario', '<motivo>')` — todas as operações passam a recusar.
2. Opcional: nova migration com `DROP FUNCTION` das operações técnicas (exige permissão de mudança incompatível); o ledger permanece como história.
3. Conferir que nenhuma role de aplicação recebeu EXECUTE (teste acima).

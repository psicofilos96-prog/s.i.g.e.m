# NSEC.1 — Hardening de segurança (2026-10-07, parcial)

## Verificado nesta rodada
- Funções SECURITY DEFINER sem `search_path` fixo: **0**.
- Tabelas públicas sem RLS: **0**.
- INSERT/UPDATE/DELETE concedido a `anon` em tabela pública: **0**.
- Varredura de segredos (src, docs, supabase, scripts; chaves `sb_secret_`, JWT, `sk_live_`, senha literal): **nenhum achado**.

## Linter — classificação
| Aviso | Qtde | Classificação |
|---|---|---|
| RLS ligada sem política | 136 | ACEITO: padrão do projeto — tabelas de fatos fechadas, lidas só por readers e gravadas só por writers DEFINER. Abrir política seria ampliar acesso. |
| DEFINER executável por anon | 4 | ACEITO: `verify_student_card`, `verify_school_document`, `public_portal_list`, `public_portal_get` são as verificações/portal públicos por decisão; projeção mínima (verificação devolve igual para inexistente e inválido). |
| DEFINER executável por authenticated | 427 | NÃO CLASSIFICADO item a item: os writers revalidam capability/escopo/base esperada dentro do corpo; revisar cada um para revogar os que não são chamados pela tela continua pendente. |

## Não feito
- Revisão função por função dos 427 DEFINER (quais podem ser revogados de authenticated).
- Abuse tests (school_id adulterado, ator adulterado, cabeça obsoleta, export sem capability) executados contra o banco: o acesso disponível não executa funções; existem testes de unidade/SQL por módulo, não re-executados agora.
- Deep 31/31, build, security scan completo.

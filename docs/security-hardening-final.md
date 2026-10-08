# NSEC.1 — Hardening de segurança (2026-10-07, parcial)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


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

## Rodada 2026-10-07
- Armazenamento: 5 áreas de arquivos (inclusao-sensivel, planejamento-docente, avaliacao-docente, alimentacao-evidencias, fotos-estudantes), todas privadas.
- anon: 0 tabelas com qualquer privilégio (regrediu por privilégio padrão; corrigido de novo na 0249, ver `seguranca-verificacao-final-nsec4.md`); 23 funções executáveis: 4 DEFINER públicas aceitas (portal/verificações); 17 são triggers (não chamáveis diretamente); 2 auxiliares de busca INVOKER (sem dado).
- Corrigido (0233): `academic_year_operational_state_at` e `class_composition_at` deixam de ser executáveis por anon (desnecessário; regra inalterada para autenticados).
- Ainda pendente: revisão item a item dos 427 DEFINER de authenticated; testes negativos (exigem executar como pessoa real — bloqueado nesta sessão); deep e build.

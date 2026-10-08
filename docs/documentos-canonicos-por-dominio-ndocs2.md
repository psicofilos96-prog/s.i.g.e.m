# NDOCS.2 — Documentos canônicos por domínio (2026-10-08)

## Situação atual
- Classe: **Canônico**. Lista, por domínio, o documento que prevalece entre as 72 referências vigentes revisadas em NDOCS.2.
- Prevalência: `AGENTS.md` (raiz e por diretório) > `sigem-documentacao-canonica.md` > documento canônico do domínio abaixo > demais referências vigentes > Registro de lote > Histórico. O mapa geral é `mapa-documentacao-vigente.md`.

## Método
Cada documento foi conferido contra o HEAD: rotas citadas × `src/routes`, nomes de função/tabela × migrations (`drizzle/migrations`, `supabase/migrations`, `supabase/tests`) e código, funções marcadas DEPRECATED, `AGENTS.md` e decisões mais novas (N12.1 DP administrativo, NDEMO.2, NSEC.3, NDB.3, NTEST.3). Correções foram feitas no lugar com o original preservado como histórico; cada documento registra sua revisão em "Situação atual".

## Correções feitas
| Documento | Correção |
|---|---|
| `departamento-pessoal-vida-funcional.md` | Título e nota "DP externo" alinhados a N12.1 |
| `matriz-de-acesso-az.md` | "DP é externo" substituído por N12.1 |
| `modulos-apoio-produto.md` | Linha DP inicial marcada como superada |
| `necessidade-professor-calculo-canonico.md`, `importacoes-interoperabilidade.md`, `guias-por-perfil-ba.md` | "planilha do DP externo" → "planilha do DP" |
| `mapa-estatistico-projecao-canonica.md` | Writers do Mapa por sessão (0119/0124); service_role DEPRECATED |
| `portal-familia.md` | Autorização de responsável pela v3 |
| `security-definer-function-inventory.md` | `emit_school_document_v2` sem EXECUTE (0248) |
| `runbook-piloto.md` | `/profissionais` é laboratório sem login (NDEMO.2) |
| `familia-carteirinha-autorizacoes.md`, `nei-aee-mediador-produto.md`, `op-direcao-produto.md` | Estado consolidado das rodadas finais; tabelas iniciais marcadas histórico |
| `avaliacao-desempenho-rede.md`, `supervisao-escolar-produto.md` | Estado N6.2.4 / NTEST.3 acrescentado |

Falsos positivos conferidos: nomes `*_e2e`/`b1_4_*` em `matriz-de-acesso-az.md` são scripts de `supabase/tests`; `/professor` em `ux-sigem-migracao-rotas.md` é citado justamente como rota inexistente; `development_automation_enabled` é chave de dado.

## Canônicos por domínio
| Domínio | Canônico | Complementares vigentes |
|---|---|---|
| Arquitetura e princípios | `sigem-documentacao-canonica.md` | `invariantes-do-sigem.md`, `governanca-execucao-tecnica-desenvolvimento.md` |
| Banco e contratos | `contratos-de-banco-vigentes-ndb3.md` | `security-definer-function-inventory.md`, `database-constraints-indexes-batch-readers.md`, `database-contracts-audit.md` |
| Segurança e privacidade | `privacidade-e-ciclo-de-vida.md` | `seguranca-leitura-ampla-nsec3.md`, `storage-arquivos-privados.md` |
| Acessos e contas | `central-de-acessos.md` | `matriz-de-acesso-az.md`, `sigem-contas-padrao.md` |
| Ambiente, release e verificação | `engenharia-de-release.md` | `ambiente-canonico-sigem.md`, `rotina-de-verificacao.md` |
| Testes | `test-harness-institucional.md` | `matriz-fluxo-teste.md`, `matriz-rastreabilidade.md` |
| Observabilidade e recuperação | `observabilidade-e-incidentes.md` | `observabilidade-erros-recuperacao.md`, `runbook-integridade-e-recuperacao.md`, `prontidao-operacional-recuperacao.md` |
| Operação/piloto | `runbook-piloto.md` | `ano-operacional-2027-e-virada.md` |
| Calendário | `calendario-modelos-externos.md` | — |
| Currículo e referências | `matriz-curricular-catalogos-produto.md` | `referencias-curriculares-bncc-saeb.md`, `repositorio-curricular-bncc-saeb.md`, `nucleo-curricular-academico.md` |
| Secretaria e documentos | `secretaria-escolar-produto-completo.md` | `documentos-escolares-motor.md`, `documentos-impressao-auditoria.md`, `secretaria-documentos-transferencias-renovacao.md`, `secretaria-fluxo-real-pos-diario.md`, `secretaria-vida-escolar.md` |
| Docente e Diário | `docente-diario-produto.md` | `diario-gate-e2e-real.md`, `diario-professor-e2e.md`, `necessidade-professor-calculo-canonico.md` |
| Avaliação (aprendizagem) | `avaliacao-arquitetura.md` | — |
| Avaliação educacional da rede | `avaliacao-desempenho-rede.md` | — |
| OP e Direção | `op-direcao-produto.md` | `orientacao-direcao-gestao.md` |
| Supervisão | `supervisao-escolar-produto.md` | — |
| Inclusão/NEI | `nei-aee-mediador-produto.md` | — |
| Família e carteirinha | `familia-carteirinha-autorizacoes.md` | `portal-familia.md`, `publicacoes-verificacao-publica.md` |
| CIECE e Mapa | `ciece-mapa-censo-gpe-produto.md` | `mapa-estatistico-2027.md`, `mapa-estatistico-projecao-canonica.md`, `ciece-mapa-projecao-rede.md`, `ciece-inventario-fontes-censo.md`, `ciece-operacional.md`, `qualidade-integridade-dados-oficiais.md` |
| Alimentação, transporte, infraestrutura | `modulos-apoio-produto.md` (regras em `src/features/school-meals/AGENTS.md`) | `governanca-infraestrutura-escolar.md` |
| DP administrativo | `departamento-pessoal-vida-funcional.md` | `dp-externo-arquitetura.md` (fronteira histórica) |
| Importações e integrações | `importacoes-interoperabilidade.md` | `api-de-integracao.md` |
| Busca ativa | `busca-ativa-alunos-servidores.md` | — |
| Comunicação | `comunicacao-notificacoes.md` | — |
| Interface e linguagem | `human-interface-language.md` | `design-system-sigem.md`, `ux-sigem-design-system.md`, `ux-sigem-arquitetura-informacao.md`, `ux-sigem-migracao-rotas.md`, `mobile-pwa-acessibilidade-aa.md`, `guias-por-perfil-ba.md` |
| Desempenho e escala | `performance-escala-sigem.md` | — |
| Referências documentais | `governanca-referencias-documentais.md` | — |
| Demonstração | `varredura-demonstracao-contexto-real.md` | `isolamento-demonstracao-ndemo2.md` |
| Situação do produto | `matriz-completude-produto-sigem.md` | — |

## Pendências
- REVISAR: contagens instantâneas (testes, linhas, migrations) continuam como da data de cada registro; a contagem atual sai de `npm run verify`.
- REVISAR: documentos de lote longos (`avaliacao-arquitetura.md`, `human-interface-language.md`, `ux-sigem-migracao-rotas.md`) foram conferidos por nomes/rotas/decisões; frases descritivas não verificáveis por máquina não foram reescritas.

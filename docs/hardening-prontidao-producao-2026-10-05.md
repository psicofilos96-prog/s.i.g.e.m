# Hardening operacional / prontidão de produção — 2026-10-05

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Auditoria no HEAD após 0069. O número do Security Advisor (230 avisos) **não** é contagem de vulnerabilidades: 36 são "RLS sem política" em tabelas que só se acessam por funções controladas (intencional) e 194 são "função SECURITY DEFINER executável", que é o padrão de writers com verificação interna de capacidade.

## Corrigido nesta rodada
| Sev. | Achado | Evidência | Correção |
|---|---|---|---|
| Alto | 53 funções SECURITY DEFINER do schema public executáveis por visitante sem login (herança do `GRANT` padrão a PUBLIC nas migrations antigas). A maioria falha fechada por `auth.uid() IS NULL`, mas expunha superfície desnecessária (ex.: leitores de capacidade, writers). | consulta `has_function_privilege('anon', …)` | `0070_revoke_anon_function_execute`: revoga de PUBLIC/anon, preserva `authenticated` onde existia, troca default privileges. Pós: só `verify_school_document` é executável por anon (exigido pela verificação pública). |

## Verificado sem achado
- service_role: só em `*.functions.ts` dentro de handlers (`accounts.functions.ts`, `statistical-map.functions.ts`), com import dinâmico; nenhum no navegador.
- Segredos versionados: nenhum token/senha/chave; `.env` só tem chaves publicáveis (gerado).
- Nenhuma tabela com dados de aluno/pessoa tem leitura `USING (true)`; as 15 com leitura ampla para autenticados são catálogos/cadastro de unidades/estado de instalação.
- Fixtures com sessão: coberto por `diary-official-no-fixture.test.ts` e rotas novas sem modo lab.
- Append-only/concorrência: domínios 0059–0069 com triggers de imutabilidade e base esperada; journal Drizzle 71 entradas = 71 arquivos.
- CSRF de server functions ativo (`src/start.ts`); erro de servidor devolve página genérica, sem stack.
- `console.log/info` no app: 0. `dangerouslySetInnerHTML`: só no componente de gráfico (CSS gerado, sem entrada do usuário).
- Testes 3000/3000, typecheck, build e `audit-sql-security` OK.

## Gate — exige decisão
1. **Contas da Família vs. leitura ampla de autenticados (Alto, antes de criar contas de responsáveis).** Hoje "autenticado" = servidor da rede. Ao criar contas de responsáveis, elas leriam catálogos, cadastro de unidades (telefone/e-mail institucional), estado de instalação e referências curriculares. Opções: (a) restringir essas 15 políticas a quem tem atuação vigente (`effective_capabilities` não vazio); (b) separar responsáveis em outro mecanismo de acesso; (c) aceitar (dados institucionais não pessoais). **Recomendação: (a)**, antes da primeira conta de responsável.
2. **Rate limiting (Médio).** Não há limitador de requisições nativo. A superfície pública é só `/verificar/<código>` (código não sequencial) e o login. Opções: aceitar; ou limitador próprio no banco por IP para a verificação. Recomendação: aceitar até haver abuso observado.

## Dívida técnica (sem decisão de negócio, não corrigido agora por risco de regressão)
- **Médio — `search_path = public` em ~90 funções DEFINER antigas** (as novas usam `''`). Risco baixo (nenhum papel cria objetos em public), mas o padrão correto é `''` com nomes qualificados; exige reescrever cada função.
- **Médio — paginação.** Nenhuma lista usa `.range()`; leituras retornam até 1000 linhas por padrão do backend. Afeta catálogo de referências, importações, Mapa e Secretaria quando a rede crescer. Fazer paginação por cursor nos readers de lista.
- **Médio — 29 `select("*")`** no navegador; trocar por colunas explícitas ao tocar cada tela.
- **Médio — dependências:** `exceljs` (via brace-expansion/uuid, alto/moderado) e `@tanstack/react-start` (via js-yaml, alto). Nenhum recebe entrada externa no nosso uso (exportação gerada pelo próprio app; YAML só no build). Atualizar quando as versões corrigidas forem publicadas pelos pacotes principais.
- **Baixo — mensagens de erro:** os tradutores de erro caem no texto bruto do banco para códigos não mapeados (sem segredos, mas pode mostrar nome de restrição).
- **Baixo — cabeçalhos HTTP (CSP, X-Frame-Options, HSTS)** não são definidos pelo app; hoje dependem da hospedagem. Definir CSP exige inventário das origens (backend, fontes).
- **Baixo — acessibilidade:** telas novas usam rótulos, `aria-expanded`, `role=status`; não houve auditoria com leitor de tela nem navegação real por teclado.

## Backup e recuperação
O backend gerenciado faz cópias diárias automáticas; não há, neste ambiente, ferramenta para **executar** uma restauração de teste — **não foi executada**. Procedimento: (1) exportar dados em Cloud → Configurações avançadas → Exportar; (2) para restaurar, abrir chamado de suporte indicando data/hora; (3) após restaurar, conferir `drizzle/migrations/meta/_journal.json` contra as migrations aplicadas e rodar `scripts/audit-sql-security.mjs` e a suíte. Recomenda-se um ensaio de restauração em projeto separado antes da produção.

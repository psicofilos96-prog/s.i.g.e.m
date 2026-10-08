# NDEMO.2 — Sessão real nunca recebe demonstração (2026-10-08)

## Situação atual (2026-10-08)
- Classe: **Registro de lote**. Instantâneo do lote; a regra vigente está em `src/features/classes/AGENTS.md` e o teste é a prova.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.

## Método
Varredura de **todas** as 211 rotas de `src/routes` (sem amostra) pelo grafo de imports: módulos de demonstração = 33 arquivos (fixtures, `*-data.ts` com `demonstration*`, laboratório). O calendário 2027 do código é fonte real (decisão do proprietário) e não conta como demonstração. Prova: `src/test/invariants/ndemo2-demo-isolation.test.ts` (falha se rota nova alcançar demonstração sem portão).

| Classe | Rotas |
|---|---|
| Não alcança demonstração | 92 |
| Portão de sessão na própria rota/tela | 59 |
| Portão no layout ancestral | 50 |
| Revisada à mão (alcance não renderizado) | 2 (`/identidade-institucional`, `/relatorios`) |
| Laboratório explícito (`/laboratorio/*`) | 2 |
| Sem portão | **0** (antes: 40) |

## Vazamentos encontrados e corrigidos
Com login, estas telas mostravam alunos, profissionais, atuações, matrizes ou unidades fictícias:
- `/alunos/*` (lista, ficha, novo, editar) — agora vazio honesto + link ao cadastro de estudantes da rede (`/administracao`).
- `/profissionais/*` (24 rotas: vínculos, lotações, funções, atuações) — vazio honesto + link à vida funcional (`/departamento-pessoal`).
- `/atuacoes-pedagogicas/*`, `/vinculos-letivos/novo`, `/regras-de-situacao/*` — vazio honesto + link à tela real existente.
- `/matrizes-curriculares/nova`, `/nova-versao/$id`, `/rascunho/$id`, `/impressao/$id` (editor de demonstração) — vazio honesto + link às matrizes da rede; lista/detalhe/importação já eram institucionais.
- `/identidade-institucional`: a seção de logos por escola listava unidades fictícias; com login mostra aviso.

Mecanismo único: `DemoOnlyRoute` (sobre `ClassRouteGate`): sessão carregando não abre demonstração; com sessão nada da demonstração é renderizado; sem sessão o laboratório continua. Prova: `demo-only-route.test.tsx`.

## Smoke
- Sem login, 104 rotas estáticas abertas no navegador headless: todas respondem 200, sem erro de página.
- Com login: INTERACTIVE_BROWSER_VALIDATION_PENDING (a sandbox não tem conta correspondente ao usuário; não foi escolhida conta alheia).

## Limites (REVISAR)
- "Portão" é detectado estaticamente (uso de `ClassRouteGate`/`useSessionUser`/`isDiaryCloud`/etc. na rota, na tela importada ou no layout); a presença do portão foi provada por teste, não a correção de cada ramo.
- Textos fixos escritos dentro de telas institucionais (não vindos de módulo de demonstração) não são cobertos pelo grafo.
- Telas bloqueadas com login (alunos/profissionais) não têm ainda versão institucional própria: PENDENTE, sem dado inventado.

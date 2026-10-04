# B4.6.6 — Calendário: autorização, writers da norma, homologação funcional e leitores

Migrations aditivas `0032_b4_6_6_calendar_authorized_readers_writers.sql` e `0033_b4_6_6b_composed_day_homologated_only.sql` (0023–0031 intactas).
Teste Cloud: `supabase/tests/b4_6_6_calendar_authorized_operation.sql` → `b466-tests-ok`, rollback total, zero resíduo verificado.

## Decisões do usuário (fonte: mensagem de 2026-10-04)
1. Toda conta autenticada consulta calendários HOMOLOGADOS; rascunho/edição só com capacidade exata de construção.
2. A Supervisão Escolar constrói E homologa a norma de composição.
3. Exigir UM único calendário aplicável; vários bloqueiam. (É a norma que a Supervisão vai gravar; o servidor só implementa a primitiva `exigir-exclusividade`.)
4. O calendário 2027 do navegador (`sigem.calendarios.v1`, a partir de `createCalendarFixtures2027` Regular/EJA) é REAL; não exigir reenvio. A migração preserva personalizações; a referência nunca é inserida como se fosse o salvo.
5. Contas: `supervisao@sigem.itap.gov.br`; padrões `ciece@`, `orientaped.<INEP>@`, `diresc.<INEP>@`, `alimentacao@`, `avalia@`, `sec.<INEP>@` — só registrar o padrão; não criar escolas/contas sem INEP.

## Contrato
- Capacidades novas (só v2 draft, `gestao-pedagogica-da-rede`, rede): `construir-norma-composicao-calendario-da-rede`, `homologar-norma-composicao-calendario-da-rede`. v1=108, v2=121, ambas draft.
- `record_calendar_composition_norm_version` (versão + multiplicidade + regras + vínculos + marcador, forma JSON estrita, base esperada, lock) e `homologate_calendar_composition_norm` (base esperada, ledger com capacidade/pessoa/atuação).
- `homologate_calendar_version` agora grava: snapshot íntegro, aplicabilidade registrada, norma homologada em `effective_from`; revogação exige motivo; decisão repetida recusada.
- Leitores (DEFINER, `search_path=''`, sem anon): `calendar_at`/`calendar_day_at` (assinatura antiga; `homologada` para todos, estado detalhado só para construtor; inexistente = rascunho = `access-denied`), `calendar_days_at` (≤400 dias, UM knownAt, knownAt futuro recusado), `calendar_list_at`, `calendar_day_types_at` (só construção), `calendar_composition_norm_at`.
- `calendar_composed_days_at(alocação, de, até, knownAt)`: autoriza ANTES do detalhe (`consultar-matricula-e-movimentacao` na escola ou leitura da turma); inexistente = não autorizado = `{"contract","state":"access-denied"}`. Contexto do banco (alocação, escola, turma, ano, posição B3.3, eixos da oferta B2.6 quando declarados). Só versões homologadas na data são candidatas; 0 ⇒ `sem-calendario-aplicavel`, >1 ⇒ `exclusividade-violada` (sem dominante); true×false ⇒ `conflito`; null ⇒ `efeito-nao-declarado`. `authorizes:false`.
- Cliente: `src/features/calendar/calendar-composed-days-source.ts` (parser estrito, ainda sem tela).

## Limites
- Nenhuma conta tem poder efetivo: política real continua draft e a instalação (`install_sigem`) ainda não ocorreu; nada foi impersonado.
- `compor-por-dimensao` não é resolvido no servidor (devolve indeterminado).
- `institutional-calendar-source.ts` ainda aceita só `access-denied`; ligar telas é a próxima etapa.
- Nenhum calendário real foi semeado; migração do 2027 do navegador fica para a etapa de UI da Supervisão.

## Próxima etapa
UI da Supervisão: criar/homologar a norma de exclusividade, migrar o 2027 do navegador preservando personalizações, homologar; depois ligar consumidores a `calendar_composed_days_at`.

## B4.6.7a — Correção pós-auditoria (migration 0034)
- Bug confirmado (rollback Cloud, fixture b466 2026-04-22): faixa `true` + atribuição com `school_day_effect` NULL resultava `letivo`; a assertion original refletia o bug.
- 0034 (aditiva; 0033 preservada) conta declarações NULL com `declaration_id` presente: true×false ⇒ `conflito`; NULL declarado restante ⇒ `efeito-nao-declarado`; a linha `nao-declarado` (sem ID) não é declaração.
- Teste b466 atualizado: 04-22 ⇒ `efeito-nao-declarado`; novo caso EJA 11-30 (false + NULL) ⇒ `efeito-nao-declarado` com 2 declarações. Resultado: `b466-tests-ok … mixed-true-null mixed-false-null …`, rollback total, zero resíduo.

## B4.6.7 Fatia 1 — leitura positiva
- `institutional-calendar-readers.ts` (parsers estritos das formas SQL 0032) e `institutional-calendar-pages.tsx` (lista, detalhe com grade do mês e totais por período B2.4).
- Limites: totais por período leem períodos B2.4 pelas tabelas com RLS (última versão registrada até knownAt); edição, importação 2027, consumidores e instalação seguem nas Fatias 2–4. O calendário NÃO está operacional: nada foi semeado e a instalação não ocorreu.

## B4.6.7 Fatia 2 — gestão pela Supervisão (migration 0035)
- Tela: `institutional-calendar-management.tsx`, dentro da lista do calendário, por seção conforme capacidade EXATA da sessão
  (`construir-calendario-da-rede`, `homologar-calendario-da-rede`, `construir-/homologar-norma-composicao-calendario-da-rede`); sem capacidade, nada aparece.
- Tipos de dia: constituição e nova versão com efeito explícito (letivo / não letivo / não declarado), ato e motivo; base esperada = última versão lida.
- Norma: só exclusividade (`exigir-exclusividade`, nenhuma regra de dimensão, vínculo `efeito-dia → school_day_effect` v1); homologar/revogar com base esperada.
- Versão do calendário: ano letivo, organização e períodos B2.4 por nome; recortes de aplicabilidade por escola e/ou valor homologado de catálogo
  (nada associado automaticamente; AEE só se declarado); declarações SÓ diárias (uma por data; descrição vira evento do MESMO tipo); nova versão parte
  da anterior lida em `calendar_days_at` (datas com tipos diferentes ficam sem declaração para decisão humana).
- Importação: `calendar-browser-import.ts` lê `sigem.calendarios.v1` só no clique, nunca grava; mostra personalizações vs. referência; sem registro,
  oferece a REFERÊNCIA 2027 identificada como tal, com declaração obrigatória. Cada tipo da fonte precisa ser mapeado para tipo institucional de efeito
  idêntico (true/false/null). Fim de semana só entra como a declaração que a própria fonte resolveu.
- 0035: `calendar_version_presentation_snapshots` (imutável, um por versão, só antes de qualquer decisão; original bruto + apresentação + digest SHA-256),
  writer `record_calendar_presentation_snapshot` (capacidade de construção) e leitor `calendar_presentation_at` (construtor ou versão homologada).
- Teste Cloud com rollback: `b467b-tests-ok` (acl, capacidade exata, checks, uma vez, imutável, recusa após decisão, leitura por qualquer autenticado
  após homologação, forma da UI true/false/null/sem declaração). Zero resíduo. 1406 testes do app OK.

### Limites concretos
- Versão e snapshot são duas transações: se o snapshot falhar, a tela avisa que a versão ficou sem apresentação (anexar antes de homologar).
- Recortes por alocação/posição curricular individual não estão na tela (writer aceita); ficam para os consumidores (Fatia 3).
- O laboratório de impressão ainda não lê o snapshot institucional; impressão institucional virá depois.
- Nada é operacional até a instalação (Fatia 4): não há pessoa, atuação, ano letivo, escola nem política homologada no banco.

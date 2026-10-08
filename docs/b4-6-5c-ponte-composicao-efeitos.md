# B4.6.5c — Ponte composição → efeitos dos dias (origem verificada, acesso fechado)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Status: **não operacional.** Esta etapa só acrescenta a migration aditiva `0031`, que não altera 0023–0030, e uma ponte pura em TypeScript. Não houve leitor público, writer, capacidade, norma real, seed, aprovação de política nem implantação. `calendar_at` e `calendar_day_at` continuam `access-denied`. As políticas v1=108 e v2=119 continuam draft.

Três decisões continuam pendentes e não foram inferidas: quem consulta, quem tem competência sobre a norma e qual regra de composição ou exclusividade vale.

## Banco (0031)
- **`calendar_composition_norm_effect_bindings`:** liga uma dimensão da versão da norma a uma primitiva de efeito, com versão de contrato. Hoje só existem `school_day_effect` e contrato 1.
  - Há no máximo uma dimensão por primitiva.
  - O vínculo segue as mesmas regras dos outros filhos: entra na mesma transação da versão e antes do marcador de configuração.
  - É imutável (`forbid_mutation`).
  - RLS sem policy, sem privilégio para anon ou authenticated.
  - Sem vínculo, nada é contado. Rótulo, cor, nome ou dia da semana nunca valem como vínculo.
- **`calendar_composition_evidence_at(on, knownAt, allocation)`:** INVOKER, `search_path=''`, sem EXECUTE para clientes. Devolve o contrato `b4.6.5c/1` com um único `on/knownAt`:
  - **Contexto canônico derivado do banco:** head da alocação em `knownAt`, vigência e encerramento (`calendar_allocation_state_at`), escola, turma, ano letivo e posição B3.3 (mais de uma ⇒ ambígua). O cliente não informa escola, alocação nem etapa.
  - **Eixo:** não é derivado (`axis: "nao-derivado"`). Recortes por valor de eixo nunca correspondem, o que é um limite.
  - **Norma:** só o estado, ou a evidência completa quando há `norma-homologada`: versão, configuração, homologação vigente e vínculos conhecidos até `knownAt`.
  - **Candidatos:** agrupados por calendário, versão e resolução, com recortes e janelas. Para `candidato`, vêm as linhas de `calendar_day_declarations`, com homologação, tipo fixado e `school_day_effect`.
  - O marcador `bloqueado:` do resolver antigo é substituído pela avaliação da norma no motor.

## Ponte (`calendar-composition-bridge.ts`)
- **`bridgeComposedDay(evidence, {on, knownAt})`:**
  - Confere o contrato e o snapshot, com precisão de µs e qualquer offset, e exige chaves exatas.
  - Converte as declarações do dia de cada candidato em declarações da dimensão vinculada (`tipo:id`, versão do tipo de dia, valor). `null` nunca vira `false`.
  - Aplica `composeCalendarDeclarations` (B4.6.5b).
- **Saídas possíveis:** `letivo`, `nao-letivo`, `efeito-nao-vinculado`, `composicao-indeterminada` (com o motivo do motor), `contexto-indisponivel`, `snapshot-divergente` ou `evidencia-invalida`.
- **Proveniência:** preserva todos os calendários, versões, recortes, homologações e declarações. Não existe `versionId` único.
- **Bloqueios:** calendário não homologado ou revogado, referência B2.4 inválida e janela ou aplicabilidade não registrada bloqueiam. Nenhum deles é descartado.
- **`countComposedSchoolDays`, `projectComposedPlannedLessons` e `composedCalendarBasis`:** são equivalentes aos de B4.6.3a/f.
  - Dia indeterminado, data duplicada ou contexto misto resultam em `null`, nunca em zero.
  - A base fica congelada.
  - `ratioOverSchoolDays` passou a ser genérico, e o leitor antigo continua igual.
- A saída sempre traz `authorizes: false` e `publishes: false`. O cliente não oficializa nada.

## Provas
- `supabase/tests/b4_6_5c_calendar_composition_evidence.sql` → `b465c-tests-ok`, com rollback total e zero resíduos conferidos. Cobre:
  - ACL e RLS; cliente authenticated negado na função e na tabela;
  - writers reais para turma, alocação, tipos e calendários;
  - contexto derivado do banco;
  - mesma versão com dois recortes resultando num único candidato;
  - eixo que nunca corresponde;
  - vínculo único, de primitiva fechada, fechado após o marcador e imutável;
  - norma sintética homologada;
  - rótulo enganoso que não decide efeito;
  - conflito e `null` preservados;
  - `knownAt` passado sem ler o futuro;
  - contexto anterior ao fato;
  - vigência da alocação;
  - leitores negados.
- Vitest: `calendar-composition-bridge.test.ts` com 14 testes e regressões de calendário, assessment normativo e Diário: 44 arquivos e 611 testes. Typecheck e `git diff --check` passaram.

## Próxima ligação (não feita)
1. Decisões do usuário: leitura, competência sobre a norma e regra de composição.
2. Writer transacional da norma e dos vínculos, por capacidade exata.
3. Leitor de servidor autorizado que chama `calendar_composition_evidence_at` e entrega à ponte. A decisão final e as oficializações ficam no servidor (writers revalidam), nunca no cliente.
4. Trocar os consumidores (`institutional-calendar-days.ts`) para dias compostos sem perder o leitor antigo.
5. Derivar o eixo da oferta e o agrupamento em lote ≤400 dias com um único `knownAt`.
6. Rito de publicação D6.

## Limites
- O eixo não é derivado.
- A evidência é obtida dia a dia; ainda não há lote.
- Só `school_day_effect` tem vínculo. Conselhos continuam por `councilAgenda` com IDs explícitos.
- AEE ou complementar não é regular automaticamente: só vale o que o recorte declara.
- Registros históricos não são reescritos.

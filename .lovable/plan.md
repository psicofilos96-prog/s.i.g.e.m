# Etapa 14.1 — Consolidação das fontes canônicas do CIECE

Objetivo: percorrer **registro oficial gravado → contrato canônico → CIECE** sem passar pela demonstração. Nesta etapa não entram indicadores, painéis nem o Mapa Estatístico. O Diário continua congelado: o trabalho só acrescenta leitura, sem alterar nenhuma função de gravação.

## Decisão registrada: Visitas Recebidas
- A visita passa a ser um registro institucional próprio da escola, um evento por visita. Cada visita guarda data, tipo de visitante e identificação do visitante, com autoria, histórico e correção auditável. O limite antigo de "até 5 datas" não será reproduzido.
- Os tipos de visitante são uma lista inicial configurável, e não uma lista fixa no código.
- O Mapa (Estrutura VI) apenas projeta esses registros, e o CIECE os consome dentro do seu escopo.
- Não será implementada agora. No catálogo, aparece como "fonte canônica futura: Registro Institucional de Visitas".

## 14.1A — Catálogo canônico e fim das três ambiguidades
- Criar o contrato `CanonicalFact`, com tipo do fato, família, sujeito, dimensões declaradas, estado (disponível, ausente, não aplicável ou indeterminado), valor, tempo, proveniência e identificadores externos separados.
- Criar o catálogo com exatamente uma fonte por tipo de fato. As 10 famílias entram no catálogo, e as que ainda não existem aparecem como "fonte futura", entre elas Visitas.
- Resolver as três ambiguidades encontradas na auditoria:
  1. **Situação acadêmica:** a fonte é o registro oficial 12I; a 12L apenas a referencia, e determinações provisórias não chegam ao CIECE.
  2. **Enturmação:** com login, a fonte é o episódio gravado no banco; a enturmação da 13C fica restrita ao laboratório até o Capítulo 13 ser gravado.
  3. **Contagens prontas da 12L e do Conselho:** passam a ser apenas informação de proveniência, e o catálogo as marca como não utilizáveis por indicadores.
- Teste de "uma fonte por fato", que falha se dois adaptadores publicarem o mesmo tipo de fato.

## 14.1B — Leitura real dos encerramentos gravados
- Adaptador de leitura que monta a 12L a partir de `cycle_closing_versions` e dos registros oficiais citados, usando a mesma função de projeção já existente. Nada novo é gravado.
- Adaptadores de leitura para as demais fontes já gravadas: fechamento de frequência, fechamento do período, situação oficial, episódios de enturmação e atuações.
- Com login, a leitura vem só do banco: sem fonte, o resultado é vazio, sem recorrer à demonstração. Sem login, continua o laboratório.

## 14.1C — Equivalência entre o caminho de demonstração e o caminho gravado
- Testes de paridade: os mesmos fatos, lidos da memória e lidos do banco, devem produzir `CanonicalFact` idênticos.
- Auditoria inversa: a partir de um fato, recuperar o registro, a versão e a regra de origem.
- Como teste executado, a leitura real fica PENDENTE até existirem dados institucionais. Isso segue as dependências externas já registradas.

## 14.1D — Preparação das dimensões institucionais faltantes
- Documentar como ausentes, e não resolvidas pelo CIECE: escola no banco (INEP, código de rede, endereço, distrito, localização), turno, data de nascimento e sexo.
- Indicar para cada uma o domínio legítimo de origem: cadastro da unidade, turma e identidade do estudante.
- Nenhuma tabela é criada nesta etapa. A criação do cadastro da escola será proposta como etapa própria, logo após a 14.1.

## Fora de escopo
Motor de indicadores (14.2), autorização e privacidade analítica (14.3), telas (14.4), Mapa Estatístico, Censo e o módulo de Visitas.

## Detalhes técnicos
- Novo módulo `src/features/ciece/`, com os arquivos `canonical-fact-types.ts`, `fact-catalog.ts`, `fact-adapters/*` e `*.test.ts`.
- Os adaptadores reutilizam as funções analíticas existentes (`attendanceAnalyticalFacts`, `standingAnalyticRows`, `projectClassCycle`), sem copiar lógica.
- A leitura do banco usa o cliente com a sessão, respeitando as regras de acesso já existentes. Não há migração.
- A decisão sobre Visitas e a regra "uma fonte por tipo de fato" serão registradas no AGENTS.md e no roadmap.

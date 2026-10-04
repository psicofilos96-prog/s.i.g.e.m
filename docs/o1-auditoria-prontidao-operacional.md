# O1 — Auditoria de prontidão operacional do SIGEM

> Atualização posterior (2026-10-04): a Cloud foi ativada; v3 está homologada,
> com uma pessoa e atuação reais do Administrador Geral. As contagens e o estado
> abaixo são o retrato histórico da auditoria O1, anterior à ativação. Ver o
> snapshot pós-ativação em `docs/b1-4-fechamento-operacional.md`.
> Auditoria externa posterior encontrou 220 findings do Security Advisor
> (28 INFO, 72 WARN anon, 120 WARN authenticated). Desses INFO, 27 são fechados
> intencionalmente; grants destrutivos em cinco tabelas, incluindo TRUNCATE,
> motivaram a migration aditiva `0057`. A Cloud ainda precisa comprovar sua
> aplicação. B2.1/B2.2/B2.4/B2.5.2 cadeia/B2.6/B3.1/B3.3 passaram em rollback;
> a ACL de B2.5.2/B2.5.3 requer repetição após `0057`. A impressão da v3 no
> ato é a de draft; o recálculo pós-homologação difere por incluir o status.

Data: 2026-10-04. Base: HEAD `b451ca73` (posterior ao fim da B4.5 em `92072033`). Somente leitura: nenhuma migration, policy, seed, conta, atuação, catálogo ou dado foi criado.

Frente paralela ao roadmap B4.x; não reescreve a história das etapas.

## 1. Resumo executivo

- A estrutura canônica B1–B4.5 existe no banco, mas **a rede está vazia**: 0 escolas, 0 turmas, 0 estudantes, 0 componentes, 0 matrizes, 0 valores de catálogo.
- O único dado institucional real é: 1 ano letivo, 3 organizações de períodos e 10 períodos (criados pela ativação do calendário 2027), **3 calendários 2027 homologados** (Regular, EJA, EJA Fase I), 1 pessoa-órgão (Supervisão Escolar), 1 atuação e 1 designação de calendário.
- **Correção factual ao enunciado:** o calendário canônico (B4.6.x, migrations 0024–0049) **já está implementado e com dados homologados**. O que falta para o calendário é aplicação operacional (aplicabilidade a escolas/turmas reais), que depende de cadastros.
- O bloqueio dominante **não é técnico**: a política de capacidades v1 (108 regras) e a v2 (121 regras) estão em `draft`, e o SIGEM está `nao-instalado`. Sem política homologada, nenhuma conta, exceto a Supervisão (só para o calendário), tem capacidade de escrita. Por isso nenhum cadastro real pode ser feito pela tela hoje.
- Recomendação: **não continuar B4.x em profundidade**. Primeiro, destravar B1, com a decisão sobre a política e a instalação, e em seguida preparar escolas, anos e turmas.

## 2. Classificação por módulo (A–E)

| Módulo | Classe | Evidência / observação |
|---|---|---|
| B1 Identidade, contas, atuações, política | B | Writers e `effective_capabilities` prontos; v1/v2 `draft`; instalação `nao-instalado`; só a designação de calendário (0043) concede capacidade |
| B2.1 Escolas | B | `register_school_record_version` pronto; 0 escolas; proposta do Censo 2026 em `docs/data/` (não gravada) |
| B2.4 Anos letivos e períodos | A (parcial) | 1 ano, 3 organizações, 10 períodos reais vindos do calendário 2027; ano 2026 não existe |
| B2.5 Turmas / B2.7 turno e oferta | B | Writers e readers prontos; 0 turmas; turno/oferta dependem de catálogo B2.6 (0 valores) |
| B2.6 Catálogos | B | 0 valores; nada pode ser semeado, porque a norma precisa ser configurada |
| B2.2 Estudantes | B | 0 estudantes; `register_student` pronto |
| B2.3 Componentes | B | 0 componentes |
| B3 Matrícula, participação, alocação, encerramentos | B | Writers DEFINER prontos e testados com rollback; 0 linhas |
| B3.3 Posição curricular | B | Depende de eixos/valores homologados (D1 é só proposta); 0 linhas |
| B4.1 Matriz curricular | B | Editor e writer de 11 argumentos prontos; 0 matrizes |
| B4.2 E1–E4 Resolução | B (bloqueado) | Readers prontos; E2/E3/E4 sem writer (competência/R5); 0 linhas |
| B4.3 Jornada / B4.4 Grade | B (bloqueado) | Readers prontos; sem capacidade de escrita; 0 linhas |
| B4.5 Horário profissional | B | Projeção de leitura; nada persistido (esperado) |
| `institutional_class_schedule_slots` | — | Obsoleta, 0 linhas, sem consumidor |
| Calendário B4.6 | A (documento) / B (aplicação) | 3 versões homologadas, 14 tipos de dia, norma homologada; aplicabilidade pendente por falta de escolas/turmas. O `calendar-store`/localStorage sobrevive só como rascunho de navegador |
| Diário, frequência, aulas | C | Com sessão, lê só o banco (vazio ⇒ listas vazias); sem sessão, usa o laboratório com fixtures |
| Avaliação, fechamento, conselho, situação, parecer | C | Writers reais (`register_assessment_results`, `record_period_closing_act`, etc.); 0 registros; o laboratório funciona sem sessão |
| Documentos/impressão escolar | C/D | A folha do calendário é real; os demais documentos de vida escolar dependem de fatos inexistentes |
| Vida Escolar 13D–13F (transferência, continuidade, dossiê) | D/E | Motores TypeScript e fixtures; sem tabelas canônicas próprias além de `student_movement_events` |
| CIECE / Mapa estatístico | C | Tabelas `statistical_map_*` existem (0); o catálogo de fatos lê a fronteira canônica; as telas sem sessão são demonstrativas |
| Censo | E | Só a proposta importada das escolas em JSON; não há exportação canônica |
| Pessoal / lotação / QP | B/D | `professional_functional_links`/`postings` existem (0); telas 9A–9C são fixtures; nenhuma planilha externa considerada |
| Identidade visual | D | `identity-store` em localStorage |
| Orientação, Direção, visitas | C/D | `institutional_visit_records` (0); orientação e decisões são motores em memória |

## 3. Contagens do Cloud (2026-10-04)

| Entidade | n | Entidade | n |
|---|---|---|---|
| escolas / versões / vínculos | 0/0/0 | anos / versões | 1/1 |
| organizações de período / períodos | 3/10 | turmas / versões | 0/0 |
| turno / oferta / turma→organização | 0/0/0 | valores de catálogo | 0 |
| pessoas / vínculos de conta / atuações | 1/1/1 | encerramentos de atuação | 0 |
| designações de calendário | 1 | estudantes / versões | 0/0 |
| matrículas / participações / alocações | 0/0/0 | encerramentos (alocação/inscrição) | 0/0 |
| posições curriculares | 0 | componentes | 0 |
| matrizes / versões / itens / layouts / homologações | 0/0/0/0/0 | E2/E3/E4 | 0/0/0 |
| jornadas / grades / blocos | 0/0/0 | slots obsoletos | 0 |
| vínculos funcionais / lotações | 0/0 | calendários / versões / homologadas | 3/3/3 |
| tipos de dia / norma homologada / vínculos de fonte | 14/1/3 | aulas / frequência | 0/0 |
| instrumentos / resultados / fechamentos | 0/0/0 | pareceres / situações / atas | 0/0/0 |
| mapas / visitas / atos de instalação | 0/0/0 | política v1 / v2 | draft 108 / draft 121 |

Zeros intencionais: E2–E4, jornada, grade (aguardam competência/R5), B4.5 (projeção). Zeros que são lacuna operacional: escolas, turmas, estudantes, componentes e catálogos, porque são a base de tudo e ainda não há ninguém autorizado a gravá-los.

## 4. Prontidão para cadastros reais

| Entidade | Classificação | Bloqueio exato |
|---|---|---|
| Escolas | BLOQUEADO POR DECISÃO INSTITUCIONAL → depois PRONTO APÓS RECONCILIAÇÃO | Falta a capacidade `manter-cadastro-unidade-escolar` (rede), porque a política está em draft ou não há instalação. O JSON do Censo 2026 precisa ser reconciliado (vigência e ato) |
| Ano letivo 2026 + períodos | BLOQUEADO POR DECISÃO INSTITUCIONAL | `manter-anos-e-periodos-letivos` só existe para a Supervisão via designação de calendário; falta o calendário/organização 2026 ou a decisão de que 2026 não será operado |
| Turmas | BLOQUEADO POR DECISÃO + dependência | Política em draft; exigem escola e ano; a escolha turma→organização não tem writer (B2.4 a deixou preparada) |
| Turno / oferta | BLOQUEADO POR DECISÃO INSTITUCIONAL | Catálogo B2.6 vazio; os valores precisam ser homologados |
| Estudantes | BLOQUEADO POR DECISÃO INSTITUCIONAL | `cadastrar-estudante-na-rede` em draft; padrão de identificadores oficiais a decidir |
| Matrícula / participação | BLOQUEADO POR DECISÃO + dependência | Capacidade escolar; escolas, estudantes, ano e oferta inexistentes; definição de rito/requisitos não configurada |
| Enturmação | BLOQUEADO (dependência) | Turmas e participações inexistentes |
| Posição curricular | BLOQUEADO POR DECISÃO INSTITUCIONAL | Eixos etapa e ano/fase não homologados; D1 (22 posições) é só proposta |
| Componentes / matrizes | BLOQUEADO POR DECISÃO INSTITUCIONAL | `manter-componentes-curriculares`/`manter-matrizes-curriculares` em draft |

Nenhuma entidade está hoje **PRONTA PARA IMPORTAÇÃO**. Não há lacuna técnica impeditiva na cadeia escola→alocação; a lacuna técnica real fica a jusante: o writer turma→organização de períodos, os writers E2–E4, jornada e grade, e a aplicabilidade do calendário a contextos reais.

## 5. Mapa do piloto ponta a ponta

```text
escola ─(bloq: política)→ ano/períodos ─(2027 pronto; 2026 ausente)→ turma/turno/oferta
 ─(bloq: política+catálogo; turma→org sem writer)→ estudante ─(bloq: política)→
 matrícula/participação ─(estrutural-vazio)→ alocação ─(estrutural-vazio)→
 posição ─(bloq: eixos D1)→ matriz ─(bloq: política; E2–E4 sem writer)→
 calendário ─(pronto: documento homologado; aplicação pendente)→
 grade/jornada ─(bloq: sem capacidade de escrita)→ Diário ─(estrutural-vazio; demo sem sessão)→
 frequência ─(estrutural-vazio)→ avaliação ─(estrutural-vazio)→
 fechamento ─(estrutural-vazio)→ documentos ─(demo/inexistente, exceto a folha do calendário)
```

**Caminho crítico mínimo** (piloto de 1 escola, 1 turma, N estudantes, frequência e avaliação):
decisão da política (homologar v1 ou v2, ou designações explícitas como a do calendário) → instalação ou atuações reais → catálogo mínimo (turno/oferta) → 1 escola → ano 2027 (já existe) → 1 turma + writer turma→organização → estudantes → matrícula/participação/alocação → componentes + 1 matriz → aplicabilidade do calendário à escola → capacidade de grade (ou o Diário sem aula prevista) → Diário/frequência/avaliação → fechamento.
A posição curricular e E2–E4 **não estão** no caminho mínimo se o piloto usar uma turma de etapa única com associação de matriz decidida, mas precisam de decisão para turmas multietapas.

## 6. Reconciliação com o roadmap

1. Continuar B4.6 antes de importar: **não**. O calendário já está homologado; aprofundá-lo não destrava nada sem escolas e turmas.
2. Preparar escolas, anos e turmas em paralelo: **sim, como preparação de dados** (reconciliar o Censo 2026, a lista de turmas e o catálogo de turno/oferta), sem gravar.
3. Concluir primeiro um bloqueio B1–B3: **sim, é o caminho crítico**. Toda escrita da rede depende de a política (B1) ser homologada ou substituída por designações explícitas decididas pelo usuário.

## 7. Próximas 5 ações (ordem)

1. **Decisão institucional B1:** como as capacidades de cadastro serão concedidas (homologar a v2 revisada, ou designações explícitas por conta como na 0043).
2. **Catálogo mínimo B2.6** (turno, oferta, etapa) definido e homologado pela autoridade competente.
3. **Reconciliar e gravar escolas** a partir da proposta do Censo 2026, com ato e vigência reais.
4. **Writer turma→organização de períodos + cadastro de turmas** do piloto (1 escola), ligando a aplicabilidade do calendário 2027.
5. **Estudantes, matrícula, alocação e componentes/matriz** do piloto; depois a capacidade de grade e o Diário real.

> Dossiê de decisão B1 derivado desta auditoria: `docs/o2-dossie-decisao-b1.md`.

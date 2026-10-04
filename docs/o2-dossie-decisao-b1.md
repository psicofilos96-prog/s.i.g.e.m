# O2 — Dossiê de decisão B1 (destravar operação)

Data: 2026-10-04 · Natureza: auditoria/documentação somente. Nada foi homologado,
instalado, criado ou importado. Fonte: código do repositório (migrations em
`supabase/migrations/` e `drizzle/migrations/`) e leitura read-only do Cloud.
Antecedente: `docs/o1-auditoria-prontidao-operacional.md`.

## 1. Estado atual (Cloud, leitura de 2026-10-04)

| Item | Valor |
|---|---|
| `sigem_installation_state` | `nao-instalado` |
| `sigem_installation_acts` | 0 |
| `sigem_installer_designation` | 1 — `supervisao@sigem.itap.gov.br` |
| Política v1 | `draft`, 108 regras, sem vigência |
| Política v2 | `draft`, 121 regras, `supersedes_version_id` = v1, sem vigência |
| Contas (auth) | 1 (Supervisão) |
| Pessoas institucionais | 1 (Supervisão Escolar, `orgao-institucional`) |
| `user_person_links` | 1 |
| Atuações | 1 — `autoridade-calendario-da-rede` / `rede` (0043) |
| `calendar_authority_designations` | 1 — 5 capacidades (4 do calendário + `manter-anos-e-periodos-letivos`) |
| Escolas / turmas / estudantes | 0 / 0 / 0 |

## 2. Mecanismo B1 real

### 2.1 `install_sigem` (núcleo chamado por `install_sigem_reviewed`)
Pré-condições (todas na mesma transação, com `FOR UPDATE`):
1. `auth.uid()` presente (0042: sem exigência de e-mail confirmado).
2. Estado = `nao-instalado`.
3. E-mail da conta = `sigem_installer_designation.installer_email`.
4. `_act_ref` não vazio; `_engagement_kind_id` não vazio.
5. Política escolhida em `draft` e com ao menos uma regra para o tipo de atuação escolhido.
6. Wrapper `install_sigem_reviewed`: confirmação explícita + impressão digital
   SHA-256 da política (`sigem_policy_fingerprint`, 0038) idêntica à revisada;
   natureza do ator declarada (0040).

Efeitos:
- Reaproveita a pessoa ligada à conta (para a Supervisão: a pessoa-órgão já
  existente) ou cria uma.
- Cria UMA atuação de escopo `rede`, vigente desde `current_date`, do tipo escolhido.
- **Homologa a política escolhida** (status `homologated`, ato, `valid_from`).
- Registra o ato e muda o estado para `instalado`.

Irreversibilidades: estado `instalado` não volta (trigger `guard_installation_state`);
política homologada e suas regras são imutáveis (trigger); o ato é append-only.

### 2.2 Homologação fora da instalação
`homologate_capability_policy(_policy, _act_ref, _valid_from)` exige
`homologar-politica-de-capacidades` em rede, política `draft`, ato e vigência,
e recusa se, na vigência, não restar atuação de rede com as cinco capacidades
administrativas (`policy:would-remove-administration`).
Hoje **ninguém** tem essa capacidade (nenhuma política homologada), portanto o
único caminho possível de homologar qualquer política é a instalação.
Instalação e homologação são atos distintos no código, mas na primeira vez
coincidem: a instalação homologa a política.

### 2.3 Lacuna de integridade relevante para a decisão
`install_sigem` NÃO verifica a invariante administrativa que
`homologate_capability_policy` verifica. Se a instalação usar um tipo de atuação
sem as cinco capacidades administrativas (p.ex. `gestao-pedagogica-da-rede`),
a rede fica sem quem cadastre contas/atuações/políticas, e como a instalação é
irreversível, só uma migration nova resolveria. No v2, apenas
`cadastro-institucional-da-rede` reúne as cinco.

## 3. v1 × v2 (diferença exata)

Removidas: nenhuma. Alteradas (escopo): nenhuma. Adicionadas: 13.

| Tipo de atuação | Capacidade adicionada no v2 | Escopo |
|---|---|---|
| cadastro-institucional-da-rede | cadastrar-estudante-na-rede | rede |
| cadastro-institucional-da-rede | consultar-identidade-cadastral-do-estudante | rede |
| cadastro-institucional-da-rede | manter-anos-e-periodos-letivos | rede |
| cadastro-institucional-da-rede | manter-componentes-curriculares | rede |
| cadastro-institucional-da-rede | manter-identidade-cadastral-do-estudante | rede |
| gestao-pedagogica-da-rede | construir-calendario-da-rede | rede |
| gestao-pedagogica-da-rede | construir-norma-composicao-calendario-da-rede | rede |
| gestao-pedagogica-da-rede | homologar-calendario-da-rede | rede |
| gestao-pedagogica-da-rede | homologar-norma-composicao-calendario-da-rede | rede |
| gestao-pedagogica-da-rede | manter-matrizes-curriculares | rede |
| secretaria-escolar | localizar-estudante-para-matricula | escola |
| secretaria-escolar | manter-cadastro-de-turmas | escola |
| secretaria-escolar | manter-organizacao-de-periodos-da-turma | escola |

Tipos de atuação no v2 (9): cadastro-institucional-da-rede (13),
ciece-auditoria-coordenacao (8), ciece-estatistica (5), direcao-escolar (26),
gestao-pedagogica-da-rede (5), orientacao-pedagogica (13), professor (18),
rh-profissionais-da-rede (2), secretaria-escolar (31). Total 121.
O tipo `autoridade-calendario-da-rede` (0043) não tem regras em v1 nem v2.

Observações de coerência:
- Ampla: `cadastro-institucional-da-rede` concentra contas, atuações, pessoas,
  registrar e homologar política — quem a detém pode conceder a si mesmo
  qualquer atuação. É estrutural do modelo, não erro, mas é o maior risco de excesso.
- Sem writer hoje: jornada (B4.3) e grade (B4.4) não têm capacidade de escrita
  em nenhuma versão; E1 (homologação de matriz), E2, E3, E4 não têm writer.
- `manter-matrizes-curriculares` constrói matriz, mas a homologação da versão
  da matriz (E1) não tem writer — matriz construída não é resolvível.

## 4. Matriz atuação × capacidade (v2, pertinente ao cadastro e piloto)

| Atuação | Capacidades de escrita relevantes | Escopo |
|---|---|---|
| cadastro-institucional-da-rede | escolas, catálogos, anos/períodos, componentes, estudantes (cadastro/identidade), pessoas, contas, atuações, política, norma homologada | rede |
| gestao-pedagogica-da-rede | calendário e norma (construir/homologar), matrizes | rede |
| secretaria-escolar | turmas, turno da turma, oferta da turma, organização de períodos da turma, matrícula e enturmação, movimentação, localizar estudante, identidade do estudante, situação acadêmica, encerramento do ciclo, mapa (preparar/corrigir/conferir), visitas | escola |
| direcao-escolar | homologações de fechamento/frequência/encerramento, reaberturas, autorização de retificação, oficializar mapa; consultas | escola (+turma+período) |
| orientacao-pedagogica | conferências, devoluções de pauta, ocorrência; consultas | escola+turma+período |
| professor | aula, frequência, avaliação, parecer, experiência infantil, entregas e retificações | escola+turma+componente+período |
| ciece-estatistica / ciece-auditoria-coordenacao | consultas analíticas; a coordenação mantém política de divulgação e regra do mapa | rede |
| rh-profissionais-da-rede | registro funcional | rede |

Nenhuma atuação foi inventada; esta é a lista literal da política v2.

## 5. Capacidades mínimas do piloto

| Passo | Capacidade | Atuação v2 | Writer existe? |
|---|---|---|---|
| Escola | manter-cadastro-unidade-escolar | cadastro (rede) | sim |
| Ano/períodos | manter-anos-e-periodos-letivos | cadastro (rede); Supervisão já via 0043 | sim |
| Catálogo turno/oferta | manter-catalogos-institucionais | cadastro (rede) | sim (valores nascem por versão; nenhum semeado) |
| Turma | manter-cadastro-de-turmas (+ turno/oferta da turma) | secretaria (escola) | sim |
| Turma → organização de períodos | manter-organizacao-de-periodos-da-turma | secretaria (escola) | sim (`record_class_period_organization_version`, B2.5.3) |
| Estudante | cadastrar-estudante-na-rede, manter-identidade-cadastral | cadastro (rede) | sim |
| Matrícula/participação/alocação | manter-matricula-e-enturmacao | secretaria (escola) | sim (B3) |
| Componente | manter-componentes-curriculares | cadastro (rede) | sim |
| Matriz (construção) | manter-matrizes-curriculares | gestão pedagógica (rede) | sim |
| Calendário/aplicabilidade | 4 capacidades do calendário | Supervisão via 0043 (ou gestão pedagógica no v2) | sim |
| Posição curricular (B3.3) | capacidade escolar de enturmação | secretaria | sim |
| Homologação da matriz (E1), E2, E3, E4 | — | — | **não** (R5/competência) |
| Jornada (B4.3), grade (B4.4) | — | — | **não** |

Correção à O1: o writer turma → organização de períodos existe
(B2.5.3, `manter-organizacao-de-periodos-da-turma`); a lacuna é de dados e de
atuação, não de código.

## 6. v2 basta para escola → alocação?

Sim, em termos de capacidades e writers: escola, ano/períodos, catálogo, turma,
turno/oferta, organização de períodos, estudante, matrícula, participação e
alocação estão cobertos por `cadastro-institucional-da-rede` + `secretaria-escolar`.
Condições não cobertas pela política (dependem de atos, não de código):
- valores de catálogo (turno, oferta, etapa) precisam ser decididos e versionados;
- atuações `secretaria-escolar` exigem escola já cadastrada (escopo escola);
- contas para as pessoas da Secretaria (só por `createInstitutionalAccount`).
Depois de alocação, falta writer para E1–E4, jornada e grade.

## 7. Homologar v2 agora liberaria escrita prematura?

Homologar v2 sozinho não concede nada a ninguém: capacidade = atuação vigente ×
política homologada, e hoje só existe a atuação do calendário (sem regras).
O que libera escrita é a atuação criada junto (instalação) e as atuações
seguintes. Pontos que dependem de decisão ainda não tomada:
- quem recebe `cadastro-institucional-da-rede` (poder administrativo total);
- se a Supervisão deve receber `gestao-pedagogica-da-rede` (que também dá
  `manter-matrizes-curriculares`, hoje fora da designação);
- regras de Direção/Professor/Orientação ficam homologadas e vigentes desde
  já, prontas para qualquer atuação futura — uma revisão posterior só por v3.
- Nenhuma liberação de E1–E4, jornada ou grade: não há writer.

## 8. Por que hoje só a Supervisão/calendário grava

Combinação de três fatores:
1. Nenhuma política homologada ⇒ a parte da política em `effective_capabilities`
   devolve vazio para qualquer pessoa.
2. Instalação não feita ⇒ não existe o único caminho que homologaria a primeira
   política nem a primeira atuação administrativa.
3. Há uma só conta/pessoa/atuação, e a atuação é do tipo sem regras.
A Supervisão grava apenas porque `effective_capabilities` faz `UNION ALL` com
`calendar_designated_capabilities` (0043), que independe de política e instalação.

## 9. v2 homologada × designações explícitas

| Critério | Homologar v2 (via instalação) | Designações explícitas (padrão 0043) |
|---|---|---|
| Suporte atual | Pronto (`install_sigem_reviewed`) | **Não suportado além do calendário**: CHECK restringe às 5 capacidades e `user_id` é único; ampliar exige migration nova |
| Governança | Norma homologada, imutável, versionada, com ato | Cada designação é ato próprio com origem; sem norma comum |
| Auditoria | Ato de instalação + atuações datadas | Origem textual por designação |
| Escala | Atuações por escola/turma reutilizam regras | Uma designação por conta e capacidade; não escala a 30+ escolas |
| Excesso | Tipo cadastro é amplo; demais tipos recortados por escopo | Recorte fino por conta |
| Revogação | `end_engagement` encerra atuação | Tabela imutável sem vigência final: revogar exige estrutura nova |
| Contas/atuações | Exige atuações reais | Exige contas reais; atuação é técnica |
| capability ≠ cargo | Preservado (regra por tipo de atuação, cargo só rótulo) | Preservado, mas autoridade passa a ser por conta, não por atuação |

Opção C suportada pelo modelo: instalar com v2 usando a conta designada no tipo
`cadastro-institucional-da-rede` (único que satisfaz a invariante
administrativa), mantendo a designação do calendário como está; as demais
atuações (Secretaria por escola, gestão pedagógica) são atos posteriores
pelo `record_engagement`. Variante: o instalador ser outra conta institucional
de cadastro — exigiria trocar a designação do instalador, que só é inserida se
inexistente (0037), ou seja, migration.

## 10. Riscos

1. Instalar com tipo sem as 5 capacidades administrativas trava a rede (2.3).
2. Instalação e homologação irreversíveis; erro em v2 só se corrige por v3.
3. Conta de órgão (Supervisão) recebendo poder administrativo total concentra
   cadastro, política e calendário numa única conta.
4. Homologar v2 torna v1 permanentemente draft (sem efeito, apenas histórico).
5. Expectativa de piloto completo: E1–E4, jornada e grade continuam sem writer.

## 11. Sequência operacional após a decisão

Se A/C (instalar com v2):
1. Revisar as 121 regras na tela de instalação (impressão digital).
2. `install_sigem_reviewed` pela conta designada, tipo
   `cadastro-institucional-da-rede`, natureza `orgao-institucional`, ato real.
3. Catálogos: versionar turno, oferta, etapa.
4. Escolas: gravar a proposta Censo 2026 reconciliada com ato/vigência reais.
5. Contas e atuações `secretaria-escolar` (escopo escola) para pessoas reais.
6. Turmas, turno/oferta e organização de períodos 2027; aplicabilidade do calendário.
7. Estudantes, matrícula, participação, alocação, posição curricular.
8. Componentes e matriz (atuação `gestao-pedagogica-da-rede` ou designação ampliada).
9. Decidir competência R5 para E1–E4 e capacidade de jornada/grade (novas etapas).

Se B (designações): exige antes uma migration que amplie o CHECK, permita mais
de uma capacidade por conta além do calendário e introduza revogação; depois os
mesmos passos 3–8 com cada conta designada.

## 12. Cautelas registradas

- O nome real do arquivo da O1 é `docs/o1-auditoria-prontidao-operacional.md`.
- Piloto que exige posição → matriz mantém B3.3 + E2/E3 (ou E4 quando
  institucionalmente cabível) no caminho crítico. Turma de etapa única não é
  associação implícita: B4.2 não possui matriz dominante nem associação manual
  regular, e a O1 não deve ser lida como autorização desse atalho.

## 13. Pergunta ao usuário

Como as capacidades de cadastro da rede devem ser concedidas?
- **A/C** — Instalar o SIGEM com a política v2, pela conta da Supervisão, no
  tipo "cadastro institucional da rede" (poder administrativo total na rede),
  mantendo o calendário como está; demais pessoas recebem atuações depois.
- **A'** — Instalar com v2, mas por outra conta institucional de cadastro
  (exige trocar a designação do instalador por migration antes).
- **B** — Não instalar; ampliar as designações explícitas por conta
  (exige migration nova com revogação), mantendo a v2 em rascunho.

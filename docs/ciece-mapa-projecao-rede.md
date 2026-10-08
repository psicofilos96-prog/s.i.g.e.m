# CIECE / Mapa Estatístico — projeção canônica da rede

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Código: `src/features/statistical-map/network-projection.ts` (puro), `network-projection.functions.ts`
(servidor, sessão do requisitante), `network-projection-page.tsx`, rota `/mapa-estatistico-rede`.
O Mapa por escola (`/mapa-estatistico`, 14.10–14.13) continua sendo o ponto de conferência e oficialização
versionada (snapshot mensal opcional; a consulta dinâmica da rede nunca depende dele).

## 1. Auditoria dos dados da unidade
| Dado | Situação | Fonte |
|---|---|---|
| Nome | REAL | `institutional_school_record_versions.official_name` |
| INEP | REAL | `institutional_school_identifiers` |
| Endereço | REAL | versão cadastral |
| Distrito | REAL (texto livre, sem catálogo) | versão cadastral |
| Urbana/rural | REAL | `location_kind` da versão cadastral |
| Prédio próprio / difícil acesso / nº de salas | REAL | versão cadastral |
| Telefone / e-mail | REAL | versão cadastral |
| Turnos | REAL por turma | `class_shift_versions` (valores do catálogo homologável) |
| Diretor | CONFIGURAÇÃO PENDENTE | atuação vigente do tipo declarado pela regra `map_competence_rules` (nenhuma regra homologada) |
| Anexo/endereço | REAL | `institutional_school_links` + versão da unidade anexa |
| AEE, transporte, alimentação | FONTE AUSENTE | sem domínio próprio no SIGEM |

Hoje a Cloud não tem escolas cadastradas; nada foi criado para demonstrar.

## 2. Projeção mensal
Por escola, na data de referência (padrão: último dia do mês) e "conhecido até" opcional:
alunos com matrícula vigente, matrículas, participações, alocações, matrículas sem turma, turmas,
matrículas abertas/encerradas no mês, movimentações no mês (e por tipo). Por turma: alocados,
entradas e saídas no mês. Fontes: `cycle_enrollments_at`, `cycle_participations_at`,
`class_allocations_at`, `student_movements_known`, `class_at`.

## 3–5. Reconciliação, ausência, drill-down
Cada medida carrega os identificadores dos registros que a compõem (valor = nº de registros).
Fonte não lida ⇒ "não disponível"; total da rede soma só escolas com dado e informa quantas faltaram.
Drill-down rede → escola → turma → registros, sempre dentro das escolas do alcance de
`consultar-mapa-estatistico` (escola ou rede) e sob as regras de acesso de cada reader.

## 7–8. Exportação e filtros
CSV, XLSX e PDF (impressão) saem da mesma projeção (`exportRows`), com o cabeçalho institucional.
Filtros: ano, mês, data de referência, conhecido até, escola; distrito só aparece se alguma escola tiver distrito.

## 9. Divergências com o Mapa legado
- O legado digitava totais; aqui não há campo de total, só derivação.
- O legado tratava vazio como 0; aqui "não disponível" e 0 são diferentes.
- Contagens por etapa/ano/turno do legado dependem da regra homologada do Mapa (células calculadas pelo
  motor 14.2) e da classificação da oferta das turmas; não foram reproduzidas sem regra.
- AEE, transporte e alimentação não têm fonte.

## Pendências
Regra de competência do Mapa (`map_competence_rules`) homologada, que define a data oficial da fotografia,
as células por etapa e o tipo de atuação da direção; quem recebe `consultar-mapa-estatistico`.

## Evolução — Frente T
A visão da rede rotula a projeção como "dinâmica — não oficial" e informa a cobertura oficial: quantas escolas têm Mapa oficializado na competência. "Não informado" nunca soma como zero. O Mapa não é fonte do CIECE; ambos leem os fatos canônicos.

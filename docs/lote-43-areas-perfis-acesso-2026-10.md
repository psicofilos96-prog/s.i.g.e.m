# Lote 43 — Áreas institucionais, perfis e acesso mínimo

Situação atual: Registro de lote (2026-10-12).

## O que foi feito
- Catálogo versionado `src/features/authority/institutional-profiles.ts` (versão `2026-10-12.1`): 20 áreas, tipos de atuação homologados que as servem, escopos, verbos (visualizar/criar/editar/aprovar/exportar/importar/administrar) e padrões proibidos por área (notas, saúde, RH, identidade do estudante, política).
- Conferência automática contra a política homologada v8 (`docs/data/l43-policy-v8-rules.json`, 271 regras, só leitura): `institutional-profiles.test.ts` (9 testes, inclui negativos).
- Nada foi concedido: o catálogo não cria capability; autorização segue `effective_capabilities` × RLS × writers. Navegação já decide só por `pathAllowed` (capacidade efetiva).

## Inventário (política v8)
| Área | Tipo homologado | Situação |
|---|---|---|
| Administração central | administrador-geral-do-sigem, cadastro-institucional-da-rede | com regras |
| Direção Escolar | direcao-escolar | com regras |
| Secretaria Escolar | secretaria-escolar | com regras (inclui lotação/quadro DA ESCOLA, por decisão da política) |
| Supervisão | gestao-pedagogica-da-rede | com regras |
| Orientação Pedagógica | orientacao-pedagogica | com regras |
| Docente | professor | com regras |
| CIECE | ciece-estatistica, ciece-auditoria-coordenacao | com regras |
| Gestão de Pessoas | rh-profissionais-da-rede | com regras (consultar/manter registro funcional) |
| Mediador, NEI/AEE, Alimentação, Avaliação, Organização da Rede, Documental, Busca Ativa, Operações, Formação, Tecnologia | — | BLOQUEADO: sem tipo na política homologada |
| Família | — | BLOQUEADO: depende de vínculo responsável verificado (0 registrados) |
| Importação técnica | — | Identidade não humana; nunca recebe atuação |

Segregação verificada: TI e importação técnica têm 0 capabilities; registro funcional nominal só para RH, Direção e Admin Geral.

## CI
Causa da falha do L42 (inventário 264×265): `capability-inventory.json` não regenerado após a migration 0508. Corrigido regenerando pelo script (`--check` OK), sem alterar o teste. Confirmação no GitHub/CI: NÃO verificada nesta rodada.

## Bloqueios institucionais
1. Nova versão da política de capacidades com tipos para as 11 áreas bloqueadas — exige decisão e homologação por quem tem competência; não simulado.
2. Ninguém tem atuação vigente nos tipos de setor além de 2 atuações: logins criados no L43 não veem nada até haver atuação.
3. Ver o próprio registro funcional: exige ligação matrícula↔pessoa comprovada (0 ligações).

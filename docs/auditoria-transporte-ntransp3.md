# Auditoria do Transporte escolar — NTRANSP.3

Situação atual: Registro de lote (2026-10-08). Regras existentes preservadas (migration 0237); nenhum critério de elegibilidade, distância ou prioridade criado.

## Provado
- `supabase/tests/ntransp3_transport_e2e.sql` (transação desfeita; capacidade concedida só dentro dela): rota → ponto → vínculo estudante↔ponto com vigência; revogação gera nova versão e preserva histórico; recusas de base alterada, estudante sem matrícula, rota de outra escola, escola alheia e conta sem capacidade; outra escola e conta sem capacidade não leem nada; alteração direta recusada. Resultado: `ntransp3-e2e-ok: chain idor nocap`; zero resíduo conferido.
- Tela: um h1, sem rolagem lateral no celular; seção nomeada pelo título visível (rótulo duplicado removido). Estudante em dois pontos é mostrado como inconsistência, nunca escolhido. Ausência = "não disponível", nunca zero. Export pelo motor de relatórios.

## Pendências
- DEPENDE_DECISAO: veículo, condutor e monitor não existem no modelo (só rota, ponto, vínculo); criar tipo de fato é decisão.
- DEPENDE_DECISAO: projeção para a Família — não há seção `transporte` nas autorizações de responsável.
- Busca global: rotas/pontos não indexados; a busca só indexa entidades fixas (estudante, escola, turma, pessoa, matriz, componente).
- ASSIGNMENT_PENDING: `manter-transporte-escolar`/`consultar-transporte-escolar` sem atribuição na política vigente.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: tela com dados exige login.

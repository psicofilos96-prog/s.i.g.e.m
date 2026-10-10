# Lote G — Qualidade final e backlog residual (2026-10-10)

Situação atual: Registro de lote.

## Evidências desta rodada
- Suíte completa: 544 arquivos, 5.031 testes passaram, 7 ignorados, 0 falhas.
- HEAD do projeto = GitHub main = `88fd536a` (sincronizado, sem force-push).
- Sessão institucional: indisponível (`signed_out`, sem conta escolar/setorial autorizada). Nenhum fluxo foi validado em sessão real; cobertura é unitária, integração sintética e invariantes SQL/RLS por migration.
- Dados oficiais e calendário 2027 não foram alterados.

## Não verificado nesta rodada
- PDFs com zoom variável e quebra de página em dados reais (exige sessão autenticada para gerar com RLS).
- Fluxos ponta a ponta Secretaria→Turma→Docente→Diário→OP→Direção→Estatística e Calendário→Diário→Alimentação em interface autenticada.

## Backlog residual priorizado por bloqueio
1. Bloqueio humano — atuações/lotações reais (só 2 no banco): sem elas Docente, OP, Direção, Mediador, NEI e Alimentação não têm dados operacionais.
2. Bloqueio humano — contas institucionais verificadas por setor para E2E real e isolamento escola A/B.
3. Bloqueio normativo — regras por etapa (EI sem nota, EJA semestral), recuperação, campos editáveis do Mapa e data de corte mensal aguardam homologação.
4. Bloqueio de decisão — inspetores de Alimentação e leitura do CAE.
5. Segurança — infraestrutura escolar legível por qualquer autenticado; restringir por escopo.
6. Dados — 48 estudantes com matrícula em mais de uma escola sem comparação de datas; 49 turmas sem etapa; 6 identidades de mapas não confirmadas.
7. Funcional — boletim/ficha/consolidado, impressão do diário legado, anexos SIPE, correção por variante SIA, dossiê anual, QR/assinaturas por setor, SAEB/devolutivas/planos.
8. QA visual — PDFs com sessão real em zoom 50–200% e A4 paisagem.

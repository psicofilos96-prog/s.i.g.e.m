# Campanha noturna SIGEM — registro de produtização

Registro de continuidade (não normativo). Sem senhas ou segredos.

## Regras gerais (orquestração mestra, 2026-10-07)
- Antes de cada lote: investigar código, schema real, migrations, testes e todo o acervo enviado (SIGEM 1.0/2.0, planilhas, PDFs, conversas). Acervo é referência a reinventar, não a copiar; decisão explícita mais recente do usuário vence. "Já existe" só com fluxo real provado.
- UX: uma ação principal por tela, texto curto e cotidiano, ícone + texto, contexto claro (onde estou / o que fazer / o que acontece depois), passos guiados, feedback imediato, prevenção de erro, revelação progressiva; estética institucional premium; desktop primeiro nos setores, mobile excelente nos fluxos de celular.
- Dados/segurança: sem alterar dado oficial para teste visual, sem demo em sessão real, sem enfraquecer RLS/capabilities, sem pessoa inventada, preservar principais setoriais, 169 contas e isolamento por estação, sem e-mail como autorização.
- Execução: implementar, um lote lógico por vez; DECISÃO PENDENTE registrada sem parar a campanha; após cada lote: testes focais, typecheck, build, diff-check, migrations/segurança; marcos maiores: suíte completa/profunda e perfis reais.

## Modelo de entrada por lote
- Lote:
- Fontes/acervo consultado:
- Estado antes:
- Gaps:
- Alteração:
- Testes:
- Commit:
- Pendências reais:
- Próximo lote:

## Lotes
### N1 — Central de acessos e inventário de logins — PARTIAL
- Fontes: `0080/0081` (admin_account_overview), `0205` BQ.1C (169 principais setoriais: 4 rede + 55×3 escolas), memórias de contas (admin@, supervisao@), docs B1.x.
- Estado antes: central listava pessoas/atuações; contas setoriais invisíveis; reset gerava senha provisória só para contas humanas.
- Alteração: migration `0210` (holder, inventário, autorização e auditoria de reset), seção "Logins do SIGEM", exportação XLSX/CSV, reset individual/lote setorial. Doc `docs/central-de-acessos.md`.
- Testes: 5 focais + invariantes/institutional-admin/privacy (96) verdes; typecheck limpo; diff-check limpo; anônimo recusado pela API.
- Pendência: teste autenticado como Administrador Geral (precisa aprovação do usuário para sessão de teste).
- Próximo: lote N2 (próximo prompt da fila).

CONTINUE_FROM=N3

## Lote N2 — Calendários externos: fidelidade visual — PARTIAL
- Fontes: os dois prompts-guia (`TAREFA_Implemente_um_componente_de_Calendário_pasted.md`, `TAREFA_pasted.md`), `docs/calendario-modelos-externos.md`, imagens `itaperuna-home` e `logo-sigem`.
- Antes: PASS técnico, desenho rejeitado (topo azul chapado, rodapé sem identidade, legenda incompleta, matriz com número+sigla).
- Alteração: folhas Panorâmico/Mosaico redesenhadas conforme os guias; perfil visual ampliado; legenda da mesma tabela das células; auto-fit; editor com os novos controles. Interno e fatos 2027 intocados.
- Testes: calendar-external-n2 + calendário/invariantes/a11y 430/430; build OK; 2 PDFs de 1 página com o 2027 completo.
- Pendência: 6 PDFs no fluxo autenticado da Supervisão (aprovação de sessão indisponível).
- CONTINUE_FROM=N3

## Lote N3 — Redesign global (PARTIAL)
- Fontes: tokens existentes em src/styles.css (navy/azul/teal, Figtree/Outfit), App Shell 2.0, assets reais (foto Itaperuna, brasão, logo SIGEM).
- Feito: login /auth em tela cheia (foto real + brasão, campos grandes, mostrar senha, erro claro, carregando); shell sem "Verificando sua área…" (esqueleto elegante + erro com "Tentar de novo"); página "de outro setor" orientadora.
- Testes: src/components (a11y) verdes. Screenshots: docs/img/n3/.
- Pendente: homes de estação como caixa de trabalho, inventário/redução de páginas, regressão visual autenticada (central, Secretaria, Direção, OP, Admin) — exige sessão aprovada.
- CONTINUE_FROM=N3.2 (homes de estação)

## Lote N4 — CIECE/Mapa/Censo/GPE (PARTIAL)
- Feito: painel do Mapa da rede com andamento, situação por escola, filtro, mês por nome e painel "De onde veio este valor".
- Matriz: docs/ciece-mapa-censo-gpe-produto.md.
- Pendente: seis estruturas como seções, PDF dedicado, home CIECE, GPE (sem leiaute), testes autenticados.
- CONTINUE_FROM=N4.2 (Mapa da escola em seções I–VI)

## Lote N5 — Secretaria Escolar (PARTIAL)
- Feito: home da Secretaria como caixa de trabalho (3 cartões de trabalho, ações rápidas, números recolhidos, escolha automática de escola/ano).
- Checklist: docs/secretaria-escolar-produto-completo.md.
- CONTINUE_FROM=N5.2 (enturmar escolhendo turma da lista; matrícula em etapas)

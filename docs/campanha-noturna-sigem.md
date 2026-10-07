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

CONTINUE_FROM=N2

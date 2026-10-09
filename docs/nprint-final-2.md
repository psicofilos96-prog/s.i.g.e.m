# NPRINT.FINAL.2 — validação dos renderers fora do Document Studio

Situação atual: Registro de lote (2026-10-09).

Gerados 81 documentos sintéticos (0/1/médio/grande, nomes longos, acentos, tabelas longas; "Rascunho institucional", nenhum oficial), impressos em PDF pelo Chromium e rasterizados.
Verificado por documento: número de páginas, papel (A4/A3), estouro horizontal, cabeçalho de tabela repetido, glifos quebrados, acentos, imagens/logos carregadas, ausência de menu/botões do app. Calendário lab também impresso pela rota real (1 página cada, sem AppShell).

Defeitos encontrados e corrigidos:
1. Carteirinha saía em branco na impressão (regra `body:has(.card-print-area) *` vencia por especificidade) — `!important` na área do cartão.
2. Calendário institucional (Interno): nome do mês cortado (faltava `colgroup`) e feriado de nome longo invadia o bloco de períodos (agora quebra linha).
3. Diário — Frequência: nº, P/F e totais quebravam letra a letra; células curtas não quebram, coluna do nome tem largura mínima.

Limites: QR só existe na carteirinha (validado, escaneável); relatórios não têm QR (não há endereço de verificação). Mapa, Livro, Diário e Report Builder têm assinaturas; OP/Inclusão/Mediador não preveem assinatura. Nome muito longo na carteirinha é encurtado em 2 linhas por desenho.

| Documento | Páginas | Papel | Resultado |
|---|---|---|---|
| diario-periodo__zero | 1 | A4 | ok |
| diario-frequencia__zero | 1 | A4 | ok |
| diario-aulas__zero | 1 | A4 | ok |
| diario-planejamento__zero | 1 | A4 | ok |
| diario-avaliacoes__zero | 1 | A4 | ok |
| diario-espelho-final__zero | 1 | A4 | ok |
| diario-sipe-sia__zero | 1 | A4 | ok |
| mapa__zero | 1 | A4 | ok |
| horarios__zero | 1 | A4 | ok |
| livro-matricula__zero | 1 | A4 | ok |
| op-revisao__zero | 1 | A4 | ok |
| inclusao-estudante__zero | 1 | A4 | ok |
| mediador-evolucao__zero | 1 | A4 | ok |
| relatorio-tabela__zero | 1 | A4 | ok |
| relatorio-studio-A4__zero | 2 | A4 | ok |
| relatorio-studio-A3__zero | 2 | A3 | ok |
| diario-periodo__um | 1 | A4 | ok |
| diario-frequencia__um | 1 | A4 | ok |
| diario-aulas__um | 1 | A4 | ok |
| diario-planejamento__um | 1 | A4 | ok |
| diario-avaliacoes__um | 1 | A4 | ok |
| diario-espelho-final__um | 1 | A4 | ok |
| diario-sipe-sia__um | 1 | A4 | ok |
| mapa__um | 1 | A4 | ok |
| horarios__um | 1 | A4 | ok |
| livro-matricula__um | 1 | A4 | ok |
| op-revisao__um | 1 | A4 | ok |
| inclusao-estudante__um | 1 | A4 | ok |
| mediador-evolucao__um | 1 | A4 | ok |
| relatorio-tabela__um | 1 | A4 | ok |
| relatorio-studio-A4__um | 2 | A4 | ok |
| relatorio-studio-A3__um | 2 | A3 | ok |
| diario-periodo__medio | 3 | A4 | ok |
| diario-frequencia__medio | 2 | A4 | ok |
| diario-aulas__medio | 2 | A4 | ok |
| diario-planejamento__medio | 1 | A4 | ok |
| diario-avaliacoes__medio | 2 | A4 | ok |
| diario-espelho-final__medio | 4 | A4 | ok |
| diario-sipe-sia__medio | 1 | A4 | ok |
| mapa__medio | 2 | A4 | ok |
| horarios__medio | 2 | A4 | ok |
| livro-matricula__medio | 1 | A4 | ok |
| op-revisao__medio | 5 | A4 | ok |
| inclusao-estudante__medio | 7 | A4 | ok |
| mediador-evolucao__medio | 7 | A4 | ok |
| relatorio-tabela__medio | 2 | A4 | ok |
| relatorio-studio-A4__medio | 3 | A4 | ok |
| relatorio-studio-A3__medio | 2 | A3 | ok |
| diario-periodo__grande | 5 | A4 | ok |
| diario-frequencia__grande | 2 | A4 | ok |
| diario-aulas__grande | 5 | A4 | ok |
| diario-planejamento__grande | 2 | A4 | ok |
| diario-avaliacoes__grande | 2 | A4 | ok |
| diario-espelho-final__grande | 7 | A4 | ok |
| diario-sipe-sia__grande | 2 | A4 | ok |
| mapa__grande | 17 | A4 | ok |
| horarios__grande | 25 | A4 | ok |
| livro-matricula__grande | 14 | A4 | ok |
| op-revisao__grande | 10 | A4 | ok |
| inclusao-estudante__grande | 14 | A4 | ok |
| mediador-evolucao__grande | 14 | A4 | ok |
| relatorio-tabela__grande | 21 | A4 | ok |
| relatorio-studio-A4__grande | 27 | A4 | ok |
| relatorio-studio-A3__grande | 13 | A3 | ok |
| cal-interno__cal-rede-2027-regular | 1 | A4 | ok |
| cal-panoramico__cal-rede-2027-regular | 1 | A4 | ok |
| cal-mosaico__cal-rede-2027-regular | 1 | A4 | ok |
| cal-interno__cal-rede-2027-eja | 1 | A4 | ok |
| cal-panoramico__cal-rede-2027-eja | 1 | A4 | ok |
| cal-mosaico__cal-rede-2027-eja | 1 | A4 | ok |
| cal-interno__cal-rede-2027-eja-fase-1 | 1 | A4 | ok |
| cal-panoramico__cal-rede-2027-eja-fase-1 | 1 | A4 | ok |
| cal-mosaico__cal-rede-2027-eja-fase-1 | 1 | A4 | ok |
| carteirinha__curto | 1 | A4 | ok |
| carteirinha__longo | 1 | A4 | ok |
| avaliacao-instrumento__zero | 1 | A4 | ok |
| avaliacao-instrumento__um | 1 | A4 | ok |
| avaliacao-instrumento__medio | 5 | A4 | ok |
| avaliacao-instrumento__grande | 31 | A4 | ok |
| avaliacao-heatmap__teste | 1 | A4 | ok |
| avaliacao-evolucao__teste | 1 | A4 | ok |

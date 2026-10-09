# NSECTOR.4 — Matriz de isolamento por setor e escola

## Situação atual
Registro de lote (2026-10-08). Nenhuma permissão alterada; nenhuma divergência tela × banco encontrada.

## Como rodar
- `node scripts/nsector4-isolation.mjs` — contas setoriais reais (ciece, supervisao, alimentacao, avalia; sec/diresc/orientaped de duas escolas). Sessão por link administrativo de uso único: nenhuma senha lida, trocada ou impressa. Inclui a varredura de tela (`scripts/nsector4/browser.py`) e apaga sessões e arquivos-sentinela no fim.
- `bun scripts/nsector4/expectations.ts --menu` — confere os links do menu contra `stationAllowsPath`.
- Admin/estações por capability: `scripts/institutional-harness.mjs` (contas efêmeras).

## Resultado
- Banco: 108/108 — busca global sem aluno sem capability e sem a outra escola; cadastro, turmas e matrículas só da própria escola; filtro/deep link para a outra escola vazio; rede lê unidades sem identidade nominal; 5 buckets privados: sentinela não baixável nem com link assinado.
- Tela: 330/330 deep links (10 contas × 33 rotas) — bloqueio exatamente fora da estação; menus de 10 contas sem link fora da estação. Detalhe em `docs/nsector4/matriz-isolamento.json`.
- Harness institucional (Admin transversal, IDOR entre escolas, a11y): 69/69, 0 resíduos.

## Limite
Download de arquivos reais por estação não provado: os buckets estão vazios; a prova usa sentinela temporário.

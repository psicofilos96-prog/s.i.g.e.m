# Calendário — modelos externos de apresentação (CAL.EXT.1)

## Modelo interno blindado
O documento atual (`InstitutionalPrintSheet` / `InstitutionalCalendarPrint`) passa a ser o **Modelo interno**.
Não teve DOM, CSS, impressão, regras ou contagens alterados. A seleção é feita por fora do renderer
(`PrintVersion` em `institutional-calendar-management.tsx`): com "Interno" (padrão) o caminho é idêntico ao
anterior; o arquivo `institutional-calendar-print.tsx` não importa nada dos externos (teste).

## Uma verdade, três apresentações
Registry `PRESENTATION_TEMPLATES` (`calendar-external-model.ts`): `interno`, `externo-panoramico`, `externo-mosaico`.
Fonte única: `calendar_days_at` → `readCalendarDays` + snapshot `calendar_presentation_at` → `buildPrintModel`.
Os externos recebem o MESMO `PrintModel` e só derivam `ExternalViewModel` (grade mês×dia, semanas D..S,
dia da semana real em UTC, meses com 28/29/30/31 dias). Não chamam o motor do laboratório, não contam dias,
não gravam conteúdo, não têm catálogo próprio; indeterminado é texto "indeterminado", nunca 0.
Tipo sem mapeamento visual aparece na legenda; coexistência (`extraCodes`) aparece como pontos + texto acessível.

## Diferenças
- **Panorâmico**: capa editorial, matriz 12 × 31 com total mensal, legenda/feriados laterais, períodos,
  conselhos e assinaturas no rodapé, faixa de identidade.
- **Mosaico**: capa editorial, 12 cartões 4 × 3 com semana D S T Q Q S S, rodapé com legenda, períodos,
  feriados e conselhos; totais mensais opcionais, total anual sempre visível.

## Personalização (só aparência)
Editor "Personalizar modelo externo" (`calendar-external-panel.tsx`): imagem do topo (foco, véu), imagem do
rodapé, 6 cores, fontes de título/corpo (lista fechada), título/subtítulo/slogan/rodapé, logos (adicionar,
substituir, ocultar, reordenar, tamanho, posição), blocos opcionais, link/QR (só `https`, nunca inventado),
raio/sombra/borda/densidade dentro de limites, cores visuais por símbolo (código/efeito canônicos) e
"Restaurar padrão". `sanitizeProfile` devolve o padrão para qualquer campo inválido.
Sem imagem, a capa usa gradiente azul/branco com ondas abstratas; nenhuma imagem de terceiros é embutida.

## Persistência
Migrations 0201 (aposentada: `calendar_id` uuid, tabela vazia marcada DEPRECATED) e 0202:
- `calendar_external_profile_revisions` — append-only (`forbid_mutation`), por `calendar_id + template_code`,
  revisão, base, digest sha256, conta e atuação que gravou. Sem grants para `anon`/`authenticated`.
- `record_calendar_external_profile` — SECURITY DEFINER, `search_path=''`, exige
  `construir-calendario-da-rede` em escopo de rede (mesma autoridade do calendário), base esperada = cabeça,
  valida modelo, tamanho do perfil (≤ 4 MB) e cada imagem (PNG/JPEG/WEBP em data URL, ≤ 1,5 MB codificada).
- `calendar_external_profile_at(calendar, modelo, on, knownAt)` — construção lê sempre; demais autenticados
  só se alguma versão do calendário estiver homologada na data; sem revisão ⇒ `padrao`.
Gravar perfil não cria versão acadêmica, não toca homologação nem conteúdo. Nenhum bucket público;
`calendar-image-assets.ts` (laboratório) não foi promovido. Não usa localStorage.

## Impressão
Cada externo tem renderer próprio e CSS isolado em `.cx-*`; o portal reaproveita a raiz `.cd-print-root`
(regra de impressão existente) com folha `.cx-a4` 297 × 210 mm. Só um portal é montado por vez (o do modelo
escolhido). O excesso é medido na tela e avisado; nunca há corte nem redução automática.
Medição com ano completo representativo: panorâmico e mosaico ≤ 198 mm de altura útil, PDF de 1 página A4.

## Segurança e provas
- `src/features/calendar/calendar-external.test.tsx` — 14 testes (interno inalterado, mesmos dias/totais,
  null ≠ 0, tipo sem mapa, coexistência, bissexto/1º dia, meses < 31, personalização sem efeito no conteúdo,
  sanitização, contrato, acessibilidade do seletor e das células).
- `scripts/cal-ext-1-acl.ts` — contas Auth reais temporárias (camada 0194): professor recusado; autoridade
  recebe recusas de base obsoleta, modelo, SVG e imagem grande; DML/SELECT direto recusados; nenhum bucket
  público; zero gravação; fixtures removidas.
- `supabase/tests/cal_ext_1_external_profiles.sql` — caminho positivo (revisões 1→2, leitura) em transação
  revertida, para execução pelo owner das funções.
- Limitação de verificação: o caminho positivo de gravação não foi executado no banco real porque a tabela
  é imutável e deixaria resíduo; o sandbox não tem permissão para rodar o SQL revertido.

## Extensão futura
Novo modelo = novo código no registry + renderer consumindo `ExternalViewModel` + código aceito pelo CHECK
do writer (migration aditiva). Nunca acrescentar cálculo ao view-model.

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
`calendar-image-assets.ts` (laboratório) foi removido no NDEAD.1 por não ter uso.

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

## CAL.EXT.1.1 — correções da auditoria independente (2026-10-06)

1. **Conselhos de Classe**: a folha externa NÃO deriva conselhos do catálogo/sigla/nome/`councilRole`. Usa
   `readCouncilConfiguration({versionId,on,knownAt})` (contrato `b4.6.7f/1`) cruzada com as declarações de
   `calendar_days_at` da MESMA versão (`row.versionId` = versão impressa, `row.dayTypeId` ∈ papéis declarados).
   Sem alocação de estudante. Estados explícitos: não lida, acesso negado, malformada, **não configurada**
   ("Conselhos de Classe não configurados para esta versão"), **nenhum declarado** (`declaresNone`), configurada.
   Implementação: `councilsOf` em `calendar-external-model.ts`.
2. **QR real**: `calendar-external-qr.tsx` gera SVG local e determinístico (`qrcode-generator`, MIT, sem rede,
   correção M, zona de silêncio 4). Só URL https validada por `safeQrUrl`; a URL aparece em texto ao lado e no
   `aria-label`. Mesmo SVG na prévia e na impressão.
3. **Identidade herdada**: `defaultProfile(template, presentation)` herda `document.headerLines` (renderizadas
   na capa, bloco opcional `cabecalho`) e as logos de `logosOf(document.layout)` como referências (`ref` = id da
   logo, nunca nome de arquivo), desenhadas pelo mesmo `LogoItem` do interno. O externo pode ocultar, reordenar,
   reposicionar, substituir (imagem própria, "Voltar à herdada") ou adicionar logos — só no perfil externo.
   "Restaurar padrão" = identidade herdada + padrão artístico. Logo herdada não encontrada ou sem imagem
   resolvível aparece como aviso no editor. O snapshot institucional nunca é alterado (teste de isolamento).
4. **Prova positiva do writer**: `supabase/tests/cal_ext_1_external_profiles.sql` — numa transação: UUID
   sintético `00000000-ca1e-4e11-8000-0000000c4e11`, pessoa órgão "TESTE SINTÉTICO CAL.EXT.1.1", vínculo,
   atuação do tipo existente `autoridade-calendario-da-rede` (rede) e designação só com
   `construir-calendario-da-rede` (nenhuma policy/regra/capability nova). Claims só via `set_config(..., true)`.
   Prova: sem sessão/sem capacidade recusados; revisão 1 → leitura → revisão 2 → leitura; autoria = UUID e
   atuação sintéticos; base obsoleta, head nulo, template inválido, SVG, asset aninhado não-imagem e asset
   > limite recusados; UPDATE/DELETE recusados; versões/homologações/dias/snapshots inalterados; nenhum bucket
   público; tabela 0201 vazia e sem grants de app. `ROLLBACK`, e depois bloco que prova zero resíduo.
   Execução: `psql -v ON_ERROR_STOP=1 -f supabase/tests/cal_ext_1_external_profiles.sql` como owner.
   **Executado em 2026-10-06** pela ferramenta SQL privilegiada do Lovable Cloud (bloco completo sem falhas, e
   repetição curta terminada em exceção-marcador `CAL_EXT_11_EXECUTADO rev1=1 rev2=2 leitura=lido rev=2`, que
   reverte tudo). Após: 0 vínculos/pessoas/revisões sintéticas, 1 designação, 2 atuações (reais).
   A conta `sandbox_exec` não executa o writer (esperado).
5. **Migrations**: 0201 e 0202 não reescritas; nenhuma 0203 foi necessária. 0201 continua vazia e sem grants de app.
6. **Assets**: mantido o desenho de data URL dentro do perfil, porque: só PNG/JPEG/WEBP por regex no writer
   (qualquer string `data:` em qualquer profundidade do JSON é validada); ≤ 1.572.864 caracteres por asset;
   perfil ≤ 4 MB; `profile_digest` SHA-256 do perfil inteiro (cobre cada asset embutido) guardado na revisão
   imutável e devolvido pelo leitor; nenhuma tabela/bucket público, leitura só pelo leitor DEFINER autenticado
   (autoridade de construção ou calendário homologado). Sem localStorage.

## CAL.EXT.1.2 — Modelos visíveis no fluxo principal da Supervisão

**Causa raiz (confirmada):** `CalendarSessionBoundary` (`institutional-calendar-routes.tsx`) leva a conta com `construir-calendario-da-rede` às telas originais `CalendarListPage`/`CalendarWorkspacePage`. Os modelos CAL.EXT.1 existiam só em `PrintVersion`, dentro de `InstitutionalCalendarManagement`, que fica fora desse fluxo (painel aberto apenas por `#publicar`). Ou seja, os modelos estavam implementados, mas o caminho normal não chegava até eles.

**Correção:** `CalendarWorkspacePage` agora mostra a seção recolhível **"Apresentação e impressão (Interno · Panorâmico · Mosaico)"** quando o calendário aberto tem vínculo central (`entry.calendarId`, o mesmo vínculo já usado em salvar/homologar, nunca inferido). A seção monta `CalendarPresentationAccess`, que lê a versão institucional (homologada; senão a última) por `readCalendarList`/`readPresentation` e reaproveita **o mesmo** `PrintVersion` → `TemplateSelector` / folha interna / `ExternalPresentationPanel`. Não existe segunda implementação, cópia de datas nem localStorage.
- `PrintVersion` aceita `autoLoad` (carrega as declarações ao abrir; padrão `false`, então a gestão institucional mantém o comportamento) e `canEdit`.
- `ExternalPresentationPanel.canEdit` (padrão `true`) esconde "Personalizar" para contas de consulta; o writer continua revalidado no banco. Nenhuma RLS/capability foi alterada.
- Interno continua o padrão e o renderer interno não foi alterado.

**Caminho:** `/calendario-escolar` → **Abrir** → **Apresentação e impressão** → **Panorâmico** ou **Mosaico** (2 cliques).

**Teste:** `src/features/calendar/calendar-presentation-access.test.tsx` (seletor visível, Interno padrão, Supervisão com Personalizar, consulta sem writer, seção montada na tela aberta por "Abrir").

## BU.CAL.2 — Correção definitiva da prévia/impressão (2026-10-06)

**Causa raiz.** Os snapshots reais de apresentação (`calendar_version_presentation_snapshots`, 7 versões) gravaram `typeMap` como `código → versão do tipo` (ex.: `FERIADO → <uuid>`, mais entradas `period:*`), enquanto `buildPrintModel` lê `versão do tipo → código`. Nenhuma declaração encontrava símbolo: toda a legenda virava "Tipo sem mapeamento visual", células sem cor, feriados vazios (dependem do `kind` do código). Os totais nunca foram afetados (vêm do efeito das declarações).

**Correção (só apresentação).** `calendar-visual-resolver.ts` é o resolvedor visual único: `canonicalTypeMap` normaliza as duas direções por identidade (código existente no catálogo do próprio snapshot ↔ id da versão do tipo; nunca rótulo; entradas que não são tipo ignoradas); `resolveVisual` dá o token (sigla, cor, rótulo, `known`); `catalogCoverage` prova cobertura. O painel externo reconstrói o `PrintModel` com os MESMOS dias/períodos e a apresentação normalizada. Snapshot gravado, conteúdo 2027 e modelo interno não foram alterados. Tipo realmente desconhecido gera alerta na prévia e marcador "!" na célula, nunca "?" silencioso.

**Layouts (conforme descrição do usuário).** Panorâmico = 12 mini-calendários 4×3 + rodapé (legenda, períodos, feriados, conselhos) + assinaturas. Mosaico = matriz Mês × Dia 1–31 com total por mês, lateral (legenda, feriados) e rodapé (períodos, conselhos, assinaturas). Fins de semana sem declaração em cinza.

**Tipos mapeados (catálogo do snapshot):** CC, CF, FL, PF, PP, FDS, CENSO, VAZIO, FERIAS, INICIO, MESTRE, FERIADO, RECESSO, RETORNO, TERMINO, ENCONTRO — 16/16 com token conhecido.

**Impressão.** `@page A4 landscape; margin 0`; `.cx-a4` 297×209 mm com padding 6 mm; `.cx-folha` com geometria física fixa 285×197 mm (tela 285×198) em flex: corpo `flex:1` distribui linhas das tabelas; rodapé/assinaturas `flex:none` e `break-inside: avoid`. Sem `transform: scale`. A prévia mede `scrollHeight − clientHeight` e avisa excesso (nada é reduzido automaticamente).

**Evidências.** Fixture rica (`calendar-external-rich-fixture.ts`: ano 2027 inteiro da referência, typeMap na forma real): Chromium `page.pdf` → Panorâmico 1 página, Mosaico 1 página, overflow 0/0 px; 365 células coloridas, 0 "?", 0 "sem mapeamento"; total 200 dias letivos igual ao modelo bruto; 12 feriados; períodos e conselhos preenchidos. Teste `calendar-external-bucal2.test.tsx` (4) + suíte do calendário 386/386.

## Validação real 2027 (Lote 3)

Fluxo real: conta `supervisao@` (principal institucional, sessão pelo mecanismo seguro de teste) → Calendário escolar → Abrir → Apresentação e impressão → Interno / Panorâmico / Mosaico. Sem fixture como prova final.

| Calendário (id) | Versão homologada | Total letivo (Interno = externos) | Períodos | PDF Panorâmico | PDF Mosaico |
|---|---|---|---|---|---|
| `cal-rede-2027-eja` — EJA / Curso Semestral | v3 | 200 | 4 (52 + 48 + 49 + 51) | 1 página A4 paisagem | 1 página A4 paisagem |
| `cal-rede-2027-eja-fase-1` — EJA Fase I / Anual | v2 | 200 | 3 (67 + 67 + 66) | 1 página | 1 página |
| `cal-rede-2027-regular` — Ensino Regular / Anual | v2 | 200 | 3 (67 + 67 + 66) | 1 página | 1 página |

Todos os PDFs: 841.92 × 594.96 pt (297 × 210 mm). Inspeção visual das 6 páginas renderizadas: 365 dias, cores/siglas do catálogo, legenda, feriados (14), períodos, conselhos (configuração da versão), assinaturas, brasões/logos herdados como imagem, faixa de marca; sem "?", sem "Tipo sem mapeamento", sem texto sobreposto. Interno continua padrão; "Personalizar modelo externo" só aparece para a Supervisão.

Defeitos encontrados no uso real e causa-raiz (correções gerais, nenhuma por calendário):
1. Interno e externos mostravam "?" e "Tipos sem símbolo vinculado" — o modelo de impressão comum lia o vínculo tipo↔símbolo só numa direção; os snapshots reais gravam a outra. `buildPrintModel` agora usa `canonicalTypeMap` (identidade pelo catálogo do snapshot). Fatos dos dias não mudam.
2. PDF saía com 2 páginas — a folha da tela de edição também era impressa. A folha externa escolhida marca `cx-print-ativo` e é a única impressa.
3. "Períodos letivos" vazio — contas de setor não liam ano/organização/períodos (políticas exigiam pessoa) e a leitura usava a data de hoje (antes do início de 2027). Migrations 0208/0209 (leitura para principal institucional, mesma amplitude da leitura humana vinculada) e leitura na vigência da própria versão.
4. Subtítulo encostava nas ondas da capa; sigla longa ("MESTRE") invadia a célula vizinha; chip "CF T" da legenda estourava. CSS geral `.cx-*`.

Testes: `calendar-external-bucal2.test.tsx` (paridade dia a dia Interno × externo), suíte do calendário, prova em navegador real (`/tmp`, fora do repositório).

## N2 — Fidelidade visual às duas especificações-guia (2026-10-07)

**Fontes lidas na íntegra:** `TAREFA_Implemente_um_componente_de_Calendário_pasted.md` (Panorâmico, 12 cartões 4×3) e `TAREFA_pasted.md` (Mosaico, matriz Mês × Dia 1–31). Imagens do acervo usadas: `itaperuna-home` (foto real da cidade com o Cristo, já do projeto) como imagem padrão do topo e `logo-sigem` no rodapé. Nenhuma imagem ou logo foi inventada; o desenho da cidade no rodapé do Mosaico é traço genérico e pode ser ocultado.

**O que mudou (só apresentação; dados continuam vindo de `PrintModel`):**
- Folha em grade de 4 faixas proporcionais do perfil (`bands`, soma travada em 100%): Panorâmico 17/59/15/9, Mosaico 17/59/16/8.
- Topo claro com foto institucional se dissolvendo em degradê, brasão + "PREFEITURA MUNICIPAL DE / ITAPERUNA / SECRETARIA … EDUCAÇÃO", linha vertical, título condensado com ano maior em azul vibrante, subtítulo espaçado e (Panorâmico) slogan manuscrito com pincelada.
- Panorâmico: cartões com barra azul-marinho, nome à esquerda e número "01…12" à direita, linha D S T Q Q S S com domingo em vermelho, 6 semanas fixas; faixa com 3 caixas (Legenda 2 colunas · Períodos com número grande · Feriados 2 colunas com data vermelha); rodapé com frase, 3 pilares, QR (só com URL https) e logo SIGEM. Conselhos e assinaturas viram opcionais (o guia prevê 3 caixas).
- Mosaico: fundo claro de céu, matriz com "Mês / Dia", 1–31, "Total de dias letivos", dias inexistentes em cinza-escuro, só a sigla dentro da célula, faixa contínua de férias/recesso (≥ 3 dias seguidos do mesmo tipo), linha de totais por coluna (só quando todos os dias da coluna estão determinados; senão "—") e total anual; lateral com Legenda (sigla na mesma cor da célula) e Feriados; inferior com cartões de Períodos, Conselhos e Assinaturas; rodapé com traço da cidade, slogan e onda.
- Legenda gerada da mesma tabela das células (`externalLegendCodes`): todo código pintado aparece, inclusive Férias e Sábado/Domingo, que antes faltavam.
- Auto-fit controlado (`autoFitSheet`): reduz a fonte só dos blocos de texto longo até o mínimo do perfil.
- Perfil ganhou: foco X/Y, zoom e opacidade da foto, fundo da folha (Mosaico), cores destaque/azul-claro/feriado/texto, fonte manuscrita, tamanhos de título/subtítulo, escala dos textos, mínimo do auto-fit, espaço entre blocos, alturas das faixas, frase do rodapé, pilares, texto do QR, texto da faixa de férias e novas opções de mostrar/ocultar. Perfis já salvos continuam válidos (campo ausente volta ao padrão).

**Antes / depois** (`docs/img/calendario-n2/`): `antes-panoramico.jpg` → `depois-panoramico.jpg`; `antes-mosaico.jpg` → `depois-mosaico.jpg`.

**Inspeção visual (Chromium, PDF A4 paisagem 841.92 × 594.96 pt, 1 página cada, sobra 0 mm):**

| Item | Panorâmico | Mosaico |
|---|---|---|
| Equilíbrio e respiro | ok | ok (conselhos em uma coluna para não deixar caixa vazia) |
| Alinhamento | ok | ok |
| Legibilidade / tamanho mínimo | dias 6,3 pt; legenda ≥ 5 pt | siglas 5,6 pt; "MESTRE" reduzida para caber |
| Quebras feias | nenhuma | nenhuma |
| Espaço morto | nenhum relevante | nenhum relevante |
| Aparência de HTML cru | não | não |
| Logos sem distorção | ok (`object-fit: contain`) | ok |
| Legenda coerente | todos os códigos pintados | idem, com sigla |
| Título × imagem | sem colisão | sem colisão |

Defeitos achados e corrigidos durante a inspeção: feriados e conselhos saíam numa linha só; últimos itens da legenda cortados (amostras agora crescem com a fonte); slogan branco ilegível sobre a foto; texto da linha de totais cortado; "MESTRE" cortado.

**Testes:** `calendar-external-n2.test.tsx` (faixas = 100%, total das colunas = 200 do motor, 12×31 células, legenda coerente, 6 semanas fixas, 3 caixas, perfil inválido não quebra); suíte do calendário + invariantes + acessibilidade 430/430.

**Pendente (PARTIAL):** a repetição do fluxo real como `supervisao@` nos 3 calendários homologados não pôde ser feita nesta rodada — a sessão de teste dessa conta precisa de aprovação, indisponível agora. A prova usou o ano 2027 completo da fonte do projeto (mesma forma dos snapshots reais). Para fechar: entrar como Supervisão → Calendário escolar → Abrir → Apresentação e impressão → Panorâmico/Mosaico → Imprimir/PDF nos 3 calendários (6 PDFs).

## CAL.EXT.2.1 — Editor fechado e validação dos 3 calendários 2027

Novos campos do perfil visual (todos sanitizados por `sanitizeProfile`, sem migration — o perfil vive no snapshot de apresentação existente):
- `blockOrder`: ordem de Legenda, Períodos, Feriados, Conselhos e Assinaturas; botões subir/descer acessíveis por teclado; ocultos permanecem na ordem; "Restaurar padrão" volta ao default; a mesma ordem é usada na prévia e no PDF.
- `typeScale`: tamanho por bloco (texto dos períodos, números de dias letivos, legenda, feriados, conselhos, assinaturas, rodapé), faixa 70%–140%, valor exibido, repor individual e "Repor todos"; título e subtítulo têm controles próprios em pt. O atalho global "tamanho dos blocos" continua.
- `periods` (colunas 1–4/auto, linha/grade/empilhado, alinhamento, densidade), `coverFit` (cobrir/conter/manual) e `infoWidths`.
- Regra automática de colunas em grade: uma linha até 4 períodos; 3 colunas a partir de 5.
- Se algum bloco não couber (conteúdo excede a caixa, cartão de período cortado ou bloco escapando da faixa), o editor avisa e desabilita Salvar e Imprimir — nada é cortado em silêncio.

Resultados dos 6 PDFs reais (EJA, EJA Fase I, Ensino Regular × Panorâmico, Mosaico), renderização headless com fixture efêmera autorizada:
- pageCount = 1 em todos; A4 paisagem (841,92 × 594,96 pt); overflow X/Y = 0; 0 elementos fora da folha; 0 imagens quebradas; fonte mínima ≥ 4 pt; total anual 200 dias letivos.
- Defeito encontrado e corrigido: no Panorâmico, a grade 2×2/2+1 cortava o número do último período ("66", "49/51") e invadia o rodapé; agora os períodos ficam em uma linha (3 ou 4 colunas) e o detector passou a medir cartões cortados.
- Permissões (scripts/cal-ext-1-acl.ts): 11/11 PASS.
- Pendente: INTERACTIVE_BROWSER_VALIDATION_PENDING (sessão real da Supervisão requer aprovação). Modelo Interno e conteúdo 2027 não alterados.

## CAL.EXT.2.2 — Fechamento técnico (2026-10-07)

- Controle que faltava: o fundo da folha do Mosaico tinha só "imagem" e "remover". Agora tem posição horizontal/vertical, zoom (100–250%), opacidade e "Resetar posição do fundo" (`pageFocusX/Y`, `pageZoom`, `pageOpacity`, sanitizados; perfis antigos recebem o padrão). Mesmo estilo na prévia e no PDF.
- Persistência: `calendar-external-ext22.test.ts` — posição/zoom/opacidade da capa e do fundo, fonte, tamanhos de título/subtítulo, escala geral e por bloco voltam iguais após gravar/reler em JSON; valores fora da faixa são limitados; fonte fora da lista volta ao padrão.
- 6 PDFs (Ensino Regular, EJA Curso Semestral, EJA Fase I × Panorâmico/Mosaico) gerados headless (Chromium) sobre o ano 2027 da fonte do projeto, com o perfil padrão: pageCount = 1 em todos, A4 paisagem 841,92 × 595,92 pt, 0 elementos fora da folha, 0 caixas com conteúdo cortado, overflow X/Y = 0, 0 imagens quebradas, fonte mínima 4 pt (Mosaico) / 5,2 pt (Panorâmico), total anual 200 dias letivos nos três. Inspeção visual sem sobreposição.
- Modelo Interno e dados 2027 não alterados.
- INTERACTIVE_BROWSER_VALIDATION_PENDING (separado): repetir com a conta supervisao@ logada, salvando um perfil e reabrindo.

## CAL.EXT.3 — Modelos 4 e 5 (layout livre)
- `externo-fotografico` (Matriz com fundo fotográfico) e `externo-quadro` (Quadro anual): mesmos dados do calendário interno (`PrintModel` → `ExternalViewModel`); só aparência.
- Layout em `profile.free` (`calendar-external-free.ts`): blocos x/y/largura/altura em mm, visível, travado, camada; tipografia por bloco (fonte, pt, título, entrelinha, espaço interno, negrito, alinhamento, colunas, orientação dos períodos); tabela "ajustar ao bloco" ou células manuais; fotos topo/rodapé e véu.
- Editor (`calendar-external-free-editor.tsx`): arrastar/redimensionar na prévia, setas 1 mm / Shift 5 mm, encaixe na grade, desfazer/refazer, exportar/importar JSON (`sigem-calendario-layout/1`), restaurar padrão. Sobreposição sem permissão ou tabela maior que o bloco geram aviso e bloqueiam a impressão; nada é cortado.
- Banco: migration 0240 só amplia os códigos aceitos; mesma permissão (`construir-calendario-da-rede`) e mesmo histórico de revisões.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: conferir com supervisao@ logada, salvar, reabrir e gerar PDF.

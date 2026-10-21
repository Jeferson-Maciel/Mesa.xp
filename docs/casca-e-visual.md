# Casca, build de arquivo único e sistema visual

Parte da documentação da Mesa XP. O que vale sempre — dado de cliente, push, "nada é
adivinhado", as regras do robô, a verificação — e o mapa dos outros documentos estão no
[`CLAUDE.md`](../CLAUDE.md).

## A casca

```
index.html            a casca: topo com as abas e uma seção por aba (a marcação do Ordens é estática)
src/main.js           liga tema, abas e o início de cada ferramenta
src/shell/abas.js     rota por hash e atalhos Alt+1 em diante, na ordem de ABAS
src/ui/               o que as abas dividem na tela: tema, avisos, escape de HTML, tokens e componentes
src/comum/            o que dois módulos dividem fora da tela: dias úteis, horários de mercado, o Outlook,
                      a Fila do dia (regras e IndexedDB), os serviços (a ponte do robô) e o "Anotar"
src/dados/            a conexão única com o Supabase, a configuração e os erros dos repositórios
src/modulos/ordens/       Assistente de Ordens
src/modulos/fila/         Fila do dia: o pedido depois que o e-mail sai (no navegador)
src/modulos/fundos/       Prateleira de fundos: o secundário numa tabela, e o que mudou
src/modulos/rendafixa/    RendaFixa Pro
src/modulos/calendario/   Calendário de presença
src/modulos/operacional/  base de conhecimento (a cópia do Slab)
src/modulos/anotacoes/    anotações de cada um, com lembretes (no navegador)
src/vendor/           SheetJS 0.20.1 vendorizado, com a licença
supabase/schema.sql   o banco do Calendário
supabase/operacional.sql  o banco do Operacional (gerado: npm run sql:operacional)
docs/                 formatos de saída do Ordens, o roadmap e o contexto da última sessão
scripts/              atualizar tickers e fundos (Ordens), gerar goldens (Renda Fixa), verificar no navegador
```

- **Rota por hash**: `#ordens`, `#fila`, `#fundos`, `#rendafixa`, `#calendario`, `#operacional`, `#anotacoes`; hash vazio ou
  desconhecido abre o Ordens. A aba é o primeiro trecho do hash, e o resto é do módulo:
  `#operacional/post/<slug>` abre o post na aba Operacional. Hash e não caminho porque o mesmo arquivo roda no site (Vercel) e aberto do disco (`file://`).
- **Alt+1, Alt+2…**, na ordem da barra (`ABAS`), troca a aba na hora, sem esperar o `hashchange` —
  senão a tecla seguinte vai para a aba anterior. Ctrl+Alt fica de fora: é assim que o AltGr chega no
  Windows. Um teste lê o `index.html` e confere que a barra segue `ABAS` e que o `title` de cada aba
  diz o Alt certo; o `verificar` calcula os atalhos de `ABAS` (`altDe`), e não os escreve à mão.
- **A barra compacta** (21/10/2026, com a Fila): sete abas com nome não cabem numa linha abaixo de
  ~1280px. Daí para baixo só a aba ativa mostra o nome, e as outras ficam no ícone — o nome segue no
  leitor de tela e no `title`. A pílula desliza e muda de largura junto, e o topo continua com uma
  linha só acima de 720px (o painel do Ordens gruda a 59px; o `verificar` confere a 1000px). No
  celular as abas descem para a segunda linha, do mesmo jeito: a ativa com o nome, as outras no ícone.
- **Os horários do mercado no topo** (`shell/relogio.js`, 21/10/2026): o que fecha primeiro entre os
  abertos, com quanto falta — ponto verde aberto, âmbar a meia hora ou menos —, e, no clique, os
  quatro do dia: o pregão da B3 (leilão às 16h55), o Estoque clientes (14h), o secundário da XP
  (16h30) e o Tesouro (9h30 às 18h). Os horários moram em `comum/horarios.js`, o mesmo de onde a
  Fila do dia tira os prazos. No celular, só quanto falta.
- **A busca da Mesa (Ctrl+K)** (`shell/busca.js`, com a régua em `comum/busca.js`): de qualquer aba,
  ou pela lupa do topo. Cada módulo registra a sua fonte — as abas, os modelos e passos do
  Operacional (a base do Slab que vem no arquivo), as anotações, os cartões da Fila e o histórico do
  Ordens (que reabre o pedido) —, e a janela mostra o que todas acham, agrupado. Todas as palavras
  têm de aparecer; no título vale mais. Nada sai do navegador.
- **Início preguiçoso**: o Ordens inicia com a página, como sempre; as outras só na primeira
  vez que a aba abre. O código já está no arquivo (não há `import()` dinâmico) — o que espera é a
  inicialização, e é nela que Calendário e Operacional conectam ao banco. A exceção é o vigia dos
  lembretes das Anotações, que começa com a página (ver Anotações), e o contador da Fila do dia.
- **Cada módulo sabe se está à vista pelo `hidden` da própria seção.** Os atalhos de teclado e o
  arrastar-e-soltar de um módulo só valem com a aba dele aberta: Ctrl+Enter na aba Renda Fixa não
  analisa o Ordens, e "m" na aba Ordens não troca o mercado do Renda Fixa. Ao trocar de aba, um
  foco deixado numa seção escondida é solto.
- **Uma ferramenta que falha ao iniciar não derruba as outras**: o erro aparece no lugar dela.
- IDs: o Ordens usa os seus de sempre (`entrada`, `solicitacoes`…); os outros módulos não usam
  `id`, só `data-rf`, `data-cal`, `data-op` e `data-an` consultados dentro da própria seção.

Um módulo exporta `iniciarX(secao)` e não conhece os outros. O que dois módulos usam mora em
`src/ui/`; o que um usa só fica nele.

## O build: um arquivo só

`npm run build` gera **um único** `dist/index.html`, com JS, CSS e ícone dentro. É ele que vai
para o site (Vercel, pelo `vercel.json`) e é ele que os colegas
abrem com dois cliques, sem servidor. Aberto do disco
(`file://`), o navegador bloqueia `<script type="module" src>` e lê `/assets/...` como a raiz do
drive — a tela aparece e nada funciona. Por isso:

- o plugin `arquivoUnico` do `vite.config.js` embute tudo e **falha o build** se sobrar arquivo;
- `vite.config.test.js` confere que a marcação não aponta para arquivo nenhum, que não sobrou
  `import()` dinâmico e que a casca e as cinco ferramentas estão embutidas;
- proibido: recurso externo (Google Fonts, CDN), `import()` dinâmico, `fetch` de arquivo local e
  service worker.

**Ordens, Renda Fixa e Anotações funcionam offline**, abertos do disco. **Calendário e Operacional
exigem rede**: sem conexão mostram o erro na tela, e as outras abas seguem funcionando.

**Dependências de runtime:** uma só, `@supabase/supabase-js`, empacotada no build e usada por
Calendário e Operacional, por uma conexão única (`src/dados/banco.js`): o primeiro que abre cria o
cliente, o segundo reaproveita — um cliente por módulo abriria duas conexões do Realtime. O SheetJS não é dependência npm (ver Renda Fixa). Vite e Vitest são ferramentas de
desenvolvimento. A Vercel roda Node 22 (`engines` do `package.json`): supabase-js e Vitest 5 exigem Node 22+.
A SnapDOM também é vendorizada, e só entra no script do robô (ver "SnapDOM vendorizada" em [`secundario.md`](secundario.md)).

`dist/index.html` fica em torno de 1,9 MB: o SheetJS e o script do robô, com a SnapDOM dentro.

## Sistema visual

O visual é um só — "joias sobre grafite" —: as abas usam os mesmos tokens e componentes, e cada
uma tem a sua cor.

- `src/ui/base.css` — tokens dos dois temas, a cor de cada aba, os ícones (SVG em máscara), as
  janelas (`<dialog>`), a revelação do tema, os avisos de tela, as animações comuns e o movimento
  reduzido.
- `src/ui/componentes.css` — painel, segmentado, selos, botões (`.copy-btn` secundário e
  `.btn-primario`), alerta, estado vazio e esqueleto de carregamento. Um componente
  só entra aqui quando dois módulos o usam.
- `src/shell/casca.css` — o topo. Tem **59px** de altura: o painel de entrada do Ordens e a barra
  lateral do Operacional grudam logo abaixo dele, e as abas ficam em 34px para não crescê-lo.
- `src/modulos/*/…css` — o que é de cada módulo.
- `src/ui/janela.js` (a janela que cresce de onde foi chamada) e `src/ui/cena.js` (a entrada que só
  roda quando a vista muda) — o JS do movimento.

`src/ui/base.css` é construído sobre tokens (`--fundo`, `--superficie`, `--texto`, `--marca`, …)
redefinidos por `:root[data-tema='claro']` e `:root[data-tema='escuro']`. **Escreva sempre pelo
token, nunca por um valor literal** — um `#fff` cravado no CSS quebra um dos dois modos, e só se
descobre quando alguém troca de tema no meio do expediente.

A ferramenta fica aberta o dia inteiro, e isso governa a paleta:

- **Sem extremos.** Nada de preto puro no fundo do modo escuro, nem branco puro no texto; nada de
  preto puro no texto do modo claro. Os extremos cansam a vista porque forçam a pupila a se
  readaptar a cada troca de foco entre a tela e a sala.
- **Corpo de texto entre 7:1 e 8:1**, títulos por volta de 12:1, texto secundário nunca abaixo de
  4.5:1. Ao mexer nas cores, meça de novo — é fácil derrubar o secundário abaixo do mínimo.
- **Saturação baixa no escuro.** Cor saturada sobre fundo escuro vibra na retina. Os tons do modo
  escuro são suavizados, não os do claro reaproveitados.
- **Uma cor por aba — a pedra dela.** Safira no Ordens, kunzita na Fila do dia, peridoto na Prateleira
  de fundos, água-marinha no Renda Fixa, ametista no Calendário, turmalina no Operacional, prata nas
  Anotações (Argentum; neutra de propósito, para o amarelo e o vermelho dos lembretes falarem); o ouro
  é a marca (o selo XP). As duas de 21/10/2026, medidas: a kunzita (289°) mora no único vão limpo do
  círculo, entre a ametista (252°) e a turmalina (327°), e é da Fila, onde o âmbar e o vermelho dos
  prazos têm de falar sozinhos; o peridoto (73°) é o ponto mais longe do âmbar (36°) e do verde (151°)
  que sobrou. As quatro passam de 6:1 sobre o cartão e de 7:1 com o texto sobre elas, nos dois temas. A pedra fica em `--acento`
  (com `--acento-fundo`, `--acento-borda`, `--acento-sombra` e `--foco` derivados no mesmo
  elemento) e aparece na aba ativa, na ação principal (`.btn-primario`), no foco, no traço dos
  títulos de painel e no brilho do fundo. É ela que tira a tela do monocromático sem virar enfeite:
  diz em que ferramenta se está. Escreva pela `--acento`, não pela pedra: o componente pega a cor
  da aba em que está.
- **Cor que informa não decora.** Verde é compra, alta e presencial; vermelho é venda, queda,
  erro e bloqueio; âmbar é atenção (horário indisponível, aviso de conexão, texto pendente).
  Nenhuma pedra usa esses três matizes, para não competir com eles.
- **Paletas categóricas.** Onde a cor separa categorias, ela reaproveita as pedras: no Renda Fixa,
  pré em safira, pós em água-marinha, IPCA+ em ametista e isentos em ouro (`--cor`); no
  Operacional, cada tópico um tom pela posição dele (`--tom`); no Ordens, as classes de ativo
  (`--classe-*`). A cor de cada colaborador é dado do banco e vai só no avatar com as iniciais.
- **Todo par de cor é medido.** Texto colorido sobre fundo tingido (o "Compra" escolhido, os
  selos, o "hoje") passa de 4.5:1 nos dois temas; os tingimentos são baixos (10–16%) por isso.

### Movimento

Movimento tem motivo: orientar (de onde veio, para onde foi), confirmar (copiado, salvo) e dar
vida ao que é ao vivo. Curto — 120 a 320 ms na interface, até ~900 ms numa entrada de cena —, nas
curvas de `base.css` (`--curva`, `--curva-saida`, `--curva-mola`). `prefers-reduced-motion:
reduce` desliga tudo, inclusive a revelação do tema.

- **Troca de aba:** a pílula da aba ativa desliza até a nova e troca de cor (`abas.js` mede e grava
  `--ind-x/--ind-w`); o brilho do fundo cruza para a cor nova (`--acento-ambiente`, registrada com
  `@property` para poder transitar); os painéis da aba sobem em sequência (`--cena`).
- **Troca de tema:** o tema novo se abre em círculo a partir do botão (View Transitions, em
  `tema.js`). Sem suporte, troca na hora.
- **Janelas** crescem de onde foram chamadas — a célula do dia, o botão — e o véu desfoca o fundo
  (`src/ui/janela.js`; entrada e saída por `@starting-style`).
- **Avisos** entram com uma leve mola, mostram quanto tempo ainda ficam e saem deslizando.
- **Confirmação no próprio botão:** copiado, o botão fica verde com o visto (`.copiado`).
- **Dados que chegam:** a curva do Renda Fixa se desenha, as barras do funil e dos presenciais
  crescem, os selos estalam, as linhas entram uma a uma.
- **O único laço** é o ponto "ao vivo", lento e pequeno.

**Entrada só quando a vista muda.** Calendário e Operacional redesenham a tela a cada atualização
ao vivo, e o Ordens a cada clique no cartão. Se a entrada rodasse a cada redesenho, a tela piscaria
o dia inteiro. Por isso as animações de entrada ficam presas a uma classe posta só quando a vista
muda: `em-cena` (`src/ui/cena.js`, chave = semana, mês, post, página) no Calendário e no
Operacional, e `entrando` (`encenar` no `index.js` do Ordens) numa análise nova. Animação nova de
entrada vai atrás dessas classes, nunca solta no elemento que é redesenhado.

**Ícones** são SVG de traço em máscara (`--i-*` em `base.css`), pintados por `currentColor` ou pelo
token, e vão em pseudo-elementos. Nos botões isso não é detalhe: o texto deles é conferido
(`"Copiar mensagem"`, `"Copiada"`, `"Copiado"`), e um `<svg>` dentro mudaria o `textContent`.

Duas decisões do preview que vale manter:

- **Controle segmentado no lugar de `<select>`** quando a escolha precisa ser conferida de
  relance. Num `select` fechado só a opção atual aparece, e conferir uma cesta de dez ativos
  exigiria abrir linha por linha — justamente o que o preview existe para evitar.
- **O resumo da cesta soma financeiro e nunca quantidade.** A soma em reais é a exposição total e
  significa alguma coisa; 100 PETR4 mais 50 VALE3 não são 150 de nada, e esse número no topo do
  cartão convidaria a conferir a ordem contra um total sem sentido. Quando o total em reais não
  cobre a cesta inteira, ele se anuncia como parcial ("de 2 ordens").

O modo claro é **ardósia em cinco níveis de cinza** (`--fundo-sutil` < `--fundo` <
`--superficie-afundada` < `--superficie` < `--superficie-alta`), cada um com papel fixo: a página
afunda (~73% de luminância), o cartão sobe sobre ela (~84%), o campo afunda de novo dentro do
cartão (~78%), e só o que flutua chega perto do branco (~90%) — **nunca branco puro**. Branco o dia
inteiro dói a vista: a primeira versão do claro tinha cartão a 97% e janela a 100%, e a mesa pediu
"mais cinza". Com as superfícies mais escuras, texto, pedras, verde, vermelho, âmbar e classes de
ativo escureceram junto, para cada par continuar acima de 4.5:1 — inclusive sobre o cinza mais fundo
(`--fundo-sutil`) e sobre o próprio fundo tingido.

No claro, **o topo continua grafite**: o seletor do escuro também vale para `:root[data-tema='claro']
.casca-topo`, que ganha os tokens do escuro e, por isso, declara de novo a própria `--acento` (a
pedra clara, não a escura da página). Os **cabeçalhos de tabela** usam `--cabecalho`, o cinza de
`--fundo-sutil` tingido 9% com a pedra da aba: azulado no Ordens, lilás no Calendário.

**A paleta mudou três vezes em 30/09/2026, a pedido da mesa.** Primeiro o escuro, quase preto,
virou um grafite azulado médio, e o claro deixou o neutro morno por uma porcelana levemente fria —
"cara de CRM financeiro, para usar por horas sem cansar". Depois a mesa achou tudo monocromático e
pediu mais cor e movimento, sem perder a seriedade: vieram as pedras por aba, as categorias
coloridas e o sistema de movimento acima. Por fim o claro, ainda quase branco, virou a ardósia
cinza com topo grafite descrita acima. As faixas de contraste continuaram as mesmas (corpo
~8,3:1 no cartão, título ~12,5:1, secundário acima de 5:1), medidas por WCAG. As cores saturadas e
o texto quase branco que outro agente tinha aplicado continuam de fora (branch
`antigravity/operacional`).

O tema vive em `document.documentElement.dataset.tema`, aplicado por um script inline no `<head>`
antes da primeira pintura — sem isso a tela pisca no tema errado a cada carregamento. O padrão é
**escuro**, gravado por navegador no `localStorage`; a preferência do sistema fica de fora de
propósito, porque a mesma pessoa pode ter o Windows no claro e ainda assim querer esta ferramenta
no escuro. Ao mexer no padrão, mexa nos **dois** lugares: `src/ui/tema.js` e o script inline.

### CSS escopado

O CSS do Ordens tinha seletores de elemento sem escopo (`header`, `table`, `thead th`, `tbody td`,
`textarea`). Na fusão eles ficaram presos a `:where(#modulo-ordens)`, que não muda a
especificidade — o Ordens foi conferido pixel a pixel contra o original. As classes do Ordens
continuam globais (`.panel`, `.history-item`…), então os módulos novos não reutilizam classe
específica do Ordens: usam as de `src/ui/componentes.css` ou as próprias.

**Todo seletor do Renda Fixa começa por `.rf`, do Calendário por `.cal` e do Operacional por `.op`.**
`src/ui/escopo-css.test.js` lê os três arquivos e recusa seletor fora da raiz, e recusa seletor de
elemento solto no CSS do Ordens.

O reset global zera `margin` de tudo, e é a margem automática que centraliza o `<dialog>` aberto com
`showModal()`: `base.css` devolve `margin: auto` ao `dialog`.

Ao mudar o CSS de um módulo, confira todas as abas: um seletor que escapa só aparece na aba vizinha.

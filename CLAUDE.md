# Mesa XP

As ferramentas da mesa num link só, para os colegas de back office de um escritório credenciado à
XP usarem o dia inteiro:

- **Ordens** — o Assistente de Ordens: transforma a solicitação colada do grupo nos 4 formatos do
  back office (e-mail, e-mail em tabela, Lote Simples e Lote TWAP).
- **Renda Fixa** — o RendaFixa Pro: lê a planilha de renda fixa exportada pela XP e monta o texto
  de WhatsApp com a maior taxa por prazo e categoria.
- **Calendário** — o calendário semanal de presença da equipe, gravado no Supabase.
- **Operacional** — a base de conhecimento da mesa (a cópia do Slab): modelos de e-mail, disparos,
  passo a passo e regras, compartilhada e editável, no Supabase.
- **Anotações** — o bloco de notas de cada um, com prints, links, etiquetas e lembretes que ficam
  amarelos até o dia e vermelhos quando chega a hora, com alerta na tela. Fica no navegador.

Nasceu da fusão de três repositórios — `Ordens.XP` (a base), `RendaFixaDisparo` e
`Calendario.Mesa` — sem funcionalidade nova; o Operacional e as Anotações vieram depois, a pedido da mesa. Sugestões
vão para [`docs/ROADMAP.md`](docs/ROADMAP.md), não para o código.

**Onde paramos** — o que funciona, o que foi testado no Hub de verdade, o que está no ar e o
que falta — está em [`docs/CONTEXTO.md`](docs/CONTEXTO.md). Leia antes de começar e atualize no
fim da sessão. O [`AGENTS.md`](AGENTS.md) resume este arquivo para outros agentes; este continua
sendo a fonte.

É uma ferramenta de expediente, aberta o dia todo: alinhada, objetiva e sem enfeite. Isso vale para
a tela e para o código.

## A casca

```
index.html            a casca: topo com as abas e as cinco seções (a marcação do Ordens é estática)
src/main.js           liga tema, abas e o início de cada ferramenta
src/shell/abas.js     rota por hash e atalhos Alt+1 a Alt+5
src/ui/               o que as abas dividem: tema, avisos de tela, escape de HTML, tokens e componentes
src/dados/            a conexão única com o Supabase, a configuração e os erros dos repositórios
src/modulos/ordens/       Assistente de Ordens
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

- **Rota por hash**: `#ordens`, `#rendafixa`, `#calendario`, `#operacional`, `#anotacoes`; hash vazio ou
  desconhecido abre o Ordens. A aba é o primeiro trecho do hash, e o resto é do módulo:
  `#operacional/post/<slug>` abre o post na aba Operacional. Hash e não caminho porque o mesmo arquivo roda no site (Vercel) e aberto do disco (`file://`).
- **Alt+1 a Alt+5** troca a aba na hora, sem esperar o `hashchange` — senão a tecla seguinte vai para a
  aba anterior. Ctrl+Alt fica de fora: é assim que o AltGr chega no Windows.
- **Início preguiçoso**: o Ordens inicia com a página, como sempre; as outras quatro só na primeira
  vez que a aba abre. O código já está no arquivo (não há `import()` dinâmico) — o que espera é a
  inicialização, e é nela que Calendário e Operacional conectam ao banco. A exceção é o vigia dos
  lembretes das Anotações, que começa com a página (ver Anotações).
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
para o site (Vercel, pelo `vercel.json`, ou Netlify, pelo `netlify.toml`) e é ele que os colegas
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
desenvolvimento. O Netlify roda Node 22 (`netlify.toml`): supabase-js e Vitest 5 exigem Node 22+.

`dist/index.html` fica em torno de 1,4 MB, quase todo do SheetJS.

## Sistema visual

O visual é um só — "joias sobre grafite" —: as abas usam os mesmos tokens e componentes, e cada
uma tem a sua cor.

- `src/ui/base.css` — tokens dos dois temas, a cor de cada aba, os ícones (SVG em máscara), as
  janelas (`<dialog>`), a revelação do tema, os avisos de tela, as animações comuns e o movimento
  reduzido.
- `src/ui/componentes.css` — painel, segmentado, selos, botões (`.copy-btn` secundário e
  `.btn-primario`), alerta, estado vazio, status ao vivo e esqueleto de carregamento. Um componente
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
- **Uma cor por aba — a pedra dela.** Safira no Ordens, água-marinha no Renda Fixa, ametista no
  Calendário, turmalina no Operacional, prata nas Anotações (Argentum; neutra de propósito, para o
  amarelo e o vermelho dos lembretes falarem); o ouro é a marca (o selo XP). A pedra fica em `--acento`
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

---

## Ordens

Transforma solicitações de clientes em texto livre nos 4 formatos de saída padronizados do back
office: **Ordem por E-mail**, **Auditoria por E-mail**, **Lote Simples (TSV)** e **Lote TWAP
(TSV)**. O usuário cola a solicitação como recebeu (texto, print transcrito, tabela de posições) e
copia a saída pronta. Código em `src/modulos/ordens/`.

### A regra que domina todas as outras

**Nada é adivinhado.** O sistema só emite o que foi informado. Quando falta dado crítico, ou quando
há ambiguidade, a saída é **bloqueada** e o que falta é exibido — jamais preenchido por inferência,
arredondamento ou "melhor esforço". Um número errado numa ordem de renda variável é dinheiro real
do cliente; uma saída ausente é só um clique a mais.

Ao mexer em parser, validators ou formatters, o teste mental é sempre: *este valor veio do texto do
usuário, ou eu o inventei?*

### Vocabulário do domínio

Use estes termos no código, nos testes e nas conversas — eles são os mesmos que o usuário usa.

- **Conta** — código numérico da conta XP (5 a 8 dígitos). É o único valor aceito na coluna/campo
  `Cliente`. Nome digitado nunca entra na saída (`80000005 - Fulana` → `80000005`); o nome da
  ficha do Hub entra só na saudação do e-mail (ver "O cliente e o assessor").
- **Quantidade** — número inteiro de ativos. Sem separador de milhar, sem `R$`.
- **Financeiro** — valor em reais a ser executado. Sempre formatado `R$ X.XXX,XX`. Chega com `R$`,
  mas também sem ele, e estas formas contam como financeiro (decidido com o operador): centavos
  (`3.000,00`, quando é o único número da linha), `3.000 reais`, `valor 3.000`, `3 mil`, `20k`.
  `3 mil cotas` é quantidade. Número sem nada (`3.000`) continua quantidade.
- **Quantidade e Financeiro são mutuamente exclusivos** numa mesma ordem: uma ordem é *por
  quantidade* ou *por financeiro*, nunca as duas. Confundi-los é o erro mais caro do sistema.
- **Ordem** — uma linha de execução: conta + ativo + operação + (quantidade | financeiro) + preço.
- **Solicitação** — o texto colado pelo usuário, que gera uma ou várias ordens.
- **Cesta** — várias ordens na mesma solicitação, compartilhando conta e operação, cada ativo com
  seu próprio valor. Gera uma linha por ativo.
- **Preço** — o preço informado, preservado **exatamente** como digitado (sem arredondar, sem
  reformatar). Ausente ⇒ literalmente `A mercado`.
- **Operação** — `Compra` ou `Venda` no preview e no e-mail; `C` ou `V` nos TSVs. O grupo também
  escreve `aplicação` e `aporte` para compra, `resgate` e `saída` para venda — decisão do operador.
  Um cabeçalho (`Venda:`) vale para as linhas de baixo até o próximo; a operação escrita na
  própria linha vale mais que ele.
- **Cesta mista** — cesta com ordem por financeiro e ordem por quantidade lida de número solto
  (`BTLG11 3.000,00` / `XPML11 3.000`). Quase sempre são centavos esquecidos. Bloqueia com dois
  botões: **Tudo em R$** (mesmo número, só troca o tipo) e confirmar. `100 cotas`, escrito assim, não
  dispara: é mistura de propósito.
- **Bloqueio** — alerta que impede a geração da saída, quase sempre com um botão de confirmar.
  Distinto de um **aviso**, que só acompanha a saída sem segurá-la.
- **Descarte** — linha que não pôde virar ordem e sai listada com o motivo, para o operador
  tratar à mão. Nunca some calada.

### Fora de escopo

O escritório já trata estes casos à mão, e automatizá-los exigiria justamente a adivinhação que o
projeto existe para evitar. O sistema os reconhece e os **descarta com o motivo à vista**:

- **Ordem sem quantidade nem financeiro** — `V - HGCR11 (Total)`, onde "Total" é a única indicação
  de tamanho. Não há número a preservar, então não há ordem a gerar.
- **Push** — é canal do Hub da XP, alheio ao fluxo de e-mail e lote.
- **Observações entre parênteses** coladas ao valor ("R$ 34.800(não ultrapassar esse valor)"): o
  valor é lido, a observação não é reproduzida.

### Fundos cetipados

Fundos fechados e feeder não têm ticker: chegam escritos por extenso, do jeito que o assessor
digitou. `validate/fundosXP.js` guarda a prateleira de distribuição da XP e `validate/fundo.js`
faz a busca por nome.

Eles usam o **mesmo modelo de e-mail das ações**. Lote, TWAP e a tabela da auditoria ficam
bloqueados: a coluna `Ativo` identifica o papel por código, e — de todo modo — esses fundos não são
executados em bolsa. O operador reconfirmou a tabela em 28/09, já com a coluna `Financeiro` pronta:
fundo fica só no e-mail em texto. Por isso "via email" num pedido com fundo não marca a tabela.

Um nome erra de um jeito que um ticker não erra: **por uma palavra**. `XP Habitat Renda Imobiliária
Feeder` e `XP Habitat Renda Imobiliária II Feeder` são fundos diferentes separados por um numeral.
Por isso os bloqueios `fundo-ambiguo` e `fundo-parcial` **não são confirmáveis**: confirmar não
decide qual dos três XP Habitat o cliente pediu. A saída é o operador clicar num dos candidatos
oferecidos no preview — sem esses botões o bloqueio seria um beco sem saída.

A prateleira não tem fonte pública para baixar. A CVM publica o cadastro de todos os fundos do
Brasil, mas ninguém publica o que a XP distribui, e não dá para inferir pelo administrador nem
pelo gestor. `npm run fundos:update -- arquivo.json` regenera o módulo com o arquivo do favorito
do Hub (ver "Fundos no secundário"); a listagem copiada do portal, num `.txt`, também serve — a
página inteira, inclusive, que o menu e os "Destaques" do topo são pulados. Em 06/10/2026 a lista
passou a 150 fundos, 32 com ticker. Guardamos só nome, ticker e aplicação mínima: preço e
disponibilidade mudam todo dia, e guardá-los seria carregar dado vencido dentro de um sistema cuja
regra é não inventar dado.

**O ticker de um fundo da prateleira, escrito sozinho, é o fundo** (decisão da mesa em
06/10/2026): `VGPR11 R$ 10.000,00` é compra pela boleta do secundário, como se tivesse vindo o
nome. `fundoPeloTicker` só aceita a igualdade com o ticker, e o ativo fica como foi escrito —
`Ativo: VGPR11;` no e-mail, o nome por extenso na dica da linha. Nenhum dos 32 tickers está na
lista da B3 do sistema, mas eles são negociados em bolsa: no lote, no TWAP e na tabela, o bloqueio
de fundo escrito pelo ticker é **confirmável**, porque o código cabe na coluna `Ativo`. Erro de
digitação num deles (`VGRP11`) sugere o ticker do fundo.

A **aplicação mínima é em reais** (`aplicacaoMinima`). O Hub rotula a coluna "Qtd. mínima", mas a
exportação a chama `minimalInitialInvestment`, e o operador confirmou em 05/10: no XP Private
Equity II ela é 25.000 com PU de R$ 1.072 — em cotas seriam R$ 26 milhões. O aviso compara reais
com reais: o total da boleta, ou o pedido em R$; ordem por cotas sem planilha não é comparada.

### Fundos no secundário

A compra de fundo cetipado passa pela boleta do secundário da XP. Código em
`core/secundario/`: `estoque.js` lê os fundos, `boleta.js` faz as contas, `secundario.js` liga as
duas à ordem. Decidido com o operador em 05/10/2026, e revisto em 06/10 com a API da prateleira:

- **A fonte é a captura do favorito do Hub** (`mercado-secundario-DD-MM-AAAA-HHhMM.json`). O
  operador arrasta o botão **📥 Fundos → Mesa** do painel para a barra de favoritos e o clica na
  Prateleira do Mercado Secundário. Ele escuta o `fetch` do app, clica em Atualizar e baixa a
  resposta de `.../investment-funds-secondary` inteira, com `capturadaEm`. Não é robô: quem clica é
  o operador, e o favorito **não lê token nem cabeçalho, não chama a API por conta própria e não
  manda nada para fora** — a API recusa chamada sem a chave do app (401), e é assim que deve
  ficar. Fica burro de propósito (`platform/favorito-hub.js`): favorito arrastado não se atualiza,
  então toda a leitura mora em `estoque.js`, que muda com o build. O endereço `javascript:` é
  montado em `platform/favoritoDoHub.js` e posto no botão por código — a marcação estática não
  aponta para nada (`vite.config.test.js`). O texto do botão vira o nome do favorito, e o Chrome
  não dá ícone a favorito `javascript:`: o 📥 do nome é o ícone dele na barra. É a exceção à regra
  dos ícones em máscara SVG.
- **A exportação "Todos os fundos" (.xlsx) continua aceita** — é um recorte da mesma resposta,
  com os mesmos nomes de campo —, mas sem `treasuryMinimumPurchaseDiscount` e `percentageComission`. Os
  números vêm como texto pt-BR e o PU com duas casas, nos dois; os fundos ficam no `localStorage`
  com a hora da captura (ou a data do arquivo), e o aviso `secundario-planilha-antiga` diz quando
  não são do dia — o deságio muda ao longo do próprio dia (XPHF11: 5,75% numa exportação, 5,50% na
  boleta horas depois).
- **A barra da boleta divide o deságio.** `secondaryPurchaseDiscount` é o **deságio máximo** da
  boleta: com o ROA zerado, vai todo para o cliente. `treasuryMinimumPurchaseDiscount` é o
  **deságio mínimo** do cliente, o que sobra para ele com a barra no fim. O **ROA máximo** é a
  diferença. Conferido em quatro boletas: Riza (2,50 / 1,50 / ROA 1%), XPHF11 (5,50 / 5,00 / 0,5%),
  CPHF11 (6,75 / 6,25 / 0,5%) e IMOV11 (8,75 / 8,25 / 0,5%).
- **`treasuryMinimumBuyCost` não é o ROA**, apesar de bater no IMOV11 (0,50). No Riza ele vem 0,00
  com a barra indo até 1% na boleta; em fundos de deságio zero (MARE11, TGRI11) vem 0,50 sem barra
  nenhuma; em 58 dos 150 fundos de 06/10 ele diverge do deságio menos o mínimo. Em 06/10 de manhã o
  sistema chegou a ler o deságio da prateleira como o do cliente e esse campo como o ROA, por um
  "8,25" anotado de uma captura que era o deságio mínimo: daria cotas a mais, acima do pedido. A
  captura real das 12:09 desfez o engano no mesmo dia, antes de qualquer uso.
- **Fundo sem corretagem é outro tipo de boleta, ainda não conferido.** Na captura de 06/10, 44
  fundos vêm com `percentageComission` 0,00: os XP CDI Private (deságio zero) e 15 FIPs e fundos
  fechados com deságio de 5% a 15% e mínimo 0,00, em que a conta daria ROA de 15%. Por isso a
  captura só dá o teto de fundo com corretagem — ou sem deságio a dividir, quando o teto é zero —,
  e o pedido em R$ num fundo sem corretagem segura com `secundario-sem-corretagem` (confirmável):
  se a boleta cobrar 1,5% nele, as cotas passam do pedido. Uma boleta de cada tipo, conferida,
  tira as duas travas.
- **A conta da boleta**, conferida em três boletas reais (Riza Renda Imobiliária, XPHF11 e CPHF11,
  em `boleta.test.js`, com os números da própria boleta): desconto do cliente = deságio máximo −
  ROA; posição = cotas × PU × (1 − desconto); corretagem = % da posição (`percentageComission`, ou
  1,5% sem ela); total = posição + corretagem; remuneração = posição × (corretagem + ROA).
  Arredonda-se só na exibição — o total do CPHF11 só bate assim. Deságio negativo é ágio: o cliente
  paga acima do PU.
- **O robô do Hub** (06/10/2026, a pedido da mesa: os notebooks são pessoais, sem conta de
  desenvolvedor do Chrome). Um script do Tampermonkey, `platform/robo-hub.user.js`, roda em duas
  abas do mesmo Chrome — a da Mesa e a do Hub na Prateleira — e elas conversam pelo armazenamento
  dele. **Ao analisar um pedido com compra de fundo**, se a cotação tem mais de 2 minutos, a Mesa
  pede uma nova: o robô clica em Atualizar na aba do Hub, guarda a resposta que o próprio Hub
  recebe e a devolve à Mesa, que recalcula as cotas (1 a 2 segundos). Se a Prateleira acabou de
  pedir a lista sozinha — ela pede ao abrir —, o robô espera essa e não clica (1.2.0). Toda captura
  vale, inclusive a de quem atualiza a Prateleira à mão. Regras do robô:
  - trabalha só numa **aba dele**, que ele mesmo abre, lembrada no `window.name` (título "🤖
    Robô"). A aba em que a pessoa trabalha nunca muda de página; se a pessoa passar a usar a aba do
    robô noutra página, ele desiste dela e a Mesa abre outra;
  - **nada de parâmetro no endereço do Hub.** Qualquer um (`?mesaxp=robo`, `?teste=1`) trava o
    módulo do Mercado Secundário: a página fica em branco, só com o cabeçalho, até com F5, e a
    boleta nunca faz o pre-check. Foi o que derrubou o piloto da 1.1.0 e da 1.1.1, que marcavam a
    aba assim (conferido no Hub em 06/10: com o parâmetro, ~3.900 elementos e sem botão Atualizar;
    sem ele, ~17.300 e com o botão, mesmo escondida). Desde a 1.1.2 a Mesa deixa um bilhete
    (`abaPedida`) antes de abrir a aba, e a primeira aba do Hub que nasce em segundo plano nos 30 s
    seguintes fica com ele; a aba antiga com a marca recarrega limpa. O Hub falso do `verificar`
    trava com parâmetro no endereço, para isso não voltar;
  - **a aba dele abre junto com a Mesa** (1.2.0), em segundo plano, se não houver uma viva: abrir o
    Hub do zero leva uns 7 s, que assim não caem na primeira colagem — e a Prateleira dela já traz a
    cotação. Se a última aba aberta nunca deu sinal (Hub deslogado), a Mesa recarregada espera 10
    minutos antes de abrir outra;
  - a aba do robô avisa que pegou o pedido (`atendendo`); sem o aviso em 3 s — aba fechada, posta
    para dormir pelo Chrome —, a Mesa abre outra em segundo plano. Uma aba viva avisa em menos de
    1 s; ocupada desenhando a Prateleira, levou até 3 s, e por isso não é menos. Se a última que
    abriu nunca deu sinal (Hub deslogado), espera um minuto antes de abrir mais uma;
  - uma tarefa por vez, numa fila;
  - **a aba do robô age como à vista** (1.1.1). O Chrome não desenha aba em segundo plano: diz que
    ela está escondida e não roda os quadros de desenho (`requestAnimationFrame`), e a boleta pode
    depender disso — no piloto, a falta do pre-check foi atribuída a isso antes de se achar o
    parâmetro no endereço, então não se sabe se esta parte é necessária; ela fica por segurança, e
    a Prateleira monta inteira com ela. Só na aba do robô e antes de o Hub carregar,
    `document.visibilityState`/`hidden` respondem "à vista", o `visibilitychange` não chega ao
    Hub, e cada quadro pedido com a aba escondida roda num relógio comum (o Chrome os segura em um
    por segundo: a boleta anda e a máquina não gasta). O `verificar` imita a aba escondida e tem a
    prova de controle: numa aba do Hub comum, a boleta falsa não carrega;
  - a falha diz o motivo no aviso (`sem-boleta`: a boleta não carregou — a conta é de um cliente
    seu?), e o e-mail segue certo, pela conta arredondada. Robô de outra versão não é chamado para o
    preço exato: o painel já pede a cópia nova;
  - **mede onde vão os segundos** (1.1.3). A aba do robô anota cada passo e cada chamada da API de
    fundos do Hub com a hora (`registro` no Tampermonkey, os 300 últimos; número longo, como a
    conta num caminho, vira `<n>`), e a Mesa anota os dela. Ao fim de uma rodada — da colagem ao
    último preço exato —, a Mesa pede o registro ao robô e o botão **Copiar tempos** entrega uma
    linha do tempo só, com o resumo no topo (`ui/tempos.js`). Nada do cliente entra. O registro
    fica na aba e é gravado de uma vez, no fim de cada tarefa e antes de cada entrega à Mesa (1.2.0).
    A primeira medição no Hub de verdade (06/10, 6 fundos inéditos, 76,5 s) mostrou que o Hub responde
    rápido e que o tempo ia em trocar de tela na aba escondida: **voltar à Prateleira entre uma
    boleta e outra** levava 3,4 a 4 s de desenho, mais 2 a 3 s da lista que ela baixa de novo, e a
    boleta seguinte disputava a aba com essa lista. Foi isso que a 1.2.0 tirou (ver o preço exato);
  - não lê senha, token nem cabeçalho, não chama a API por conta própria (um teste confere o
    texto do script) e não manda nada para fora do Chrome;
  - fica burro: a leitura mora em `estoque.js`, e a Mesa só conversa com ele por `postMessage`
    (`platform/roboHub.js`: 30 s para a cotação, e até 40 s sem notícia nos preços exatos);
  - a Mesa o reconhece publicada em `https://mesa-xp.vercel.app` (desde a 1.3.2), aberta do disco
    em `…/mesa-xp/dist/index.html` e em `localhost`; outro endereço entra no `@match` e em
    `MESAS_NO_AR`, com a `@version` subindo.
  A instalação é colar o script no Tampermonkey: o botão **Copiar robô** do painel o copia, e some
  quando a versão instalada é a que a Mesa espera.
- **O preço exato da cota** (robô 1.1.0, 06/10/2026). A prateleira manda o PU arredondado em duas
  casas ("8,34"), e a conta conservadora perde umas cotas por isso (VGPR11, R$ 40.000: 5.080 em vez
  de 5.085). O preço que a boleta usa vem no `pre-check` dela (`fund.quotaValue`: 8,337589), e o
  pre-check só sai com um cliente escolhido. O robô abre a boleta pela rota do próprio Hub,
  `#/secundario/comprar/<fundo>/<conta>` — que já carrega o cliente, sem digitar nem clicar nada —,
  lê do pre-check **só** `id`, `quotaValue` e `quotaDate` do fundo. A conta usada é a do
  próprio pedido, e não fica guardada. A Mesa guarda o preço com a hora da leitura
  (`ordens_secundario_cotas`), e ele vale (`precoExatoValido`): pelo mesmo dia de cota
  (`quotaDate`, que a prateleira também traz); enquanto arredondar para o PU que a Prateleira manda
  agora; e por **no máximo 10 minutos**, como a cotação. Até 07/10 valia o dia inteiro, mas **o PU
  muda ao longo do dia** (o operador, em 07/10), e um preço exato velho, sem a margem do
  arredondamento, podia dar cotas acima do pedido. Fora da validade, a conta volta à conservadora e
  o robô busca de novo na próxima colagem. Toda boleta que a pessoa abre no Hub também deixa o preço
  do fundo guardado, com a hora dela. Com ele, a conta é a da boleta, centavo por centavo (conferida contra a boleta
  real do VGPR11 em `secundario.test.js`), e os valores do cartão saem sem o "≈". Só pedido em R$
  busca o preço; sem ele, segue a conta conservadora, que nunca passa do pedido. Desde a 1.2.0:
  - **só onde o preço muda as cotas** (`precoExatoMuda`). O de verdade está a menos de meia casa
    do arredondado; se as duas pontas dão as mesmas cotas, nos dois cenários do e-mail (o ROA pode
    ser trocado na hora de copiar), a boleta é dispensada. Na ordem real de 6 fundos de 06/10, 3
    não precisavam; PU alto (R$ 99) quase nunca precisa;
  - **os fundos de uma vez** (`pedirCotas`): o robô vai de uma boleta **direto para a próxima** e
    volta à Prateleira uma vez só, no fim; cada preço segue para a Mesa assim que o pre-check chega
    (`cotas` no Tampermonkey, regravado a cada boleta, com `fim` na última). No Hub de verdade a
    troca direta dispara o pre-check: no piloto de 06/10, 6 fundos inéditos saíram em 9,7 s (eram
    76,5 s na 1.1.3), de 0,9 a 1,9 s por fundo — 3,8 s no único em que o próprio Hub demorou a
    responder. Se a troca direta não disparar o pre-check em 8 s, a aba passa pela
    Prateleira entre as boletas dali em diante, esperando o Hub ver a troca de tela: duas mudanças
    de endereço no mesmo instante ele veria como uma só. Saindo de uma boleta que não carregou, a
    troca direta não é posta à prova;
  - a Mesa espera até 40 s sem notícia do robô antes de dar os que faltam como sem resposta.
- **A cotação vale 10 minutos** para o e-mail de um pedido em R$ (`LIMITE_DA_COTACAO_MIN`): o
  deságio muda ao longo do dia, e as cotas de uma cotação velha podem passar do valor pedido.
  Passou disso, `secundario-cotacao-velha` segura o e-mail (confirmável), com o conserto
  **Atualizar cotações**. A conta e os bloqueios são refeitos na hora de copiar, porque a página
  fica aberta o dia todo.
- **Dois cenários, escolhidos na hora de copiar** (pedido do operador em 06/10). O cartão mostra
  o **ROA máximo** (o padrão) e o **ROA zerado** numa tabelinha, uma linha cada, com as colunas
  alinhadas — desconto do cliente, cotas, quanto ele paga e quanto fica para o escritório —, para
  comparar de relance; numa largura estreita (`@container`), cada número leva o nome da coluna em
  cima. O e-mail de um pedido em R$ ganha dois botões,
  **Copiar · ROA máximo** e **Copiar · ROA zerado**. A escolha vale para a solicitação inteira
  (`solicitacao.semRoa`), refaz a área antes de copiar e deixa à vista o texto copiado, com o
  cenário marcado "no e-mail". Pedido por cotas tem um botão só: o ROA não muda o e-mail. Isso
  substituiu o "Sem ROA" por ordem de 05/10.
- **O Secundário no painel da solicitação** são duas linhas de estado, **Cotação** e **Robô**, cada
  uma com um ponto de cor: verde pronto (o verde do "ao vivo"), âmbar pedindo atenção (cotação com
  mais de 10 minutos, robô de outra versão), a cor da aba enquanto busca e apagado quando não há.
  O carregamento à mão — **Carregar fundos** e o favorito 📥 — fica recolhido em "Sem o robô",
  aberto sozinho quando o robô não está instalado.
- **A tabela do cartão cabe inteira, até o Preço, de 1280px para cima** (revisão de 06/10; antes
  ela media 820px num espaço de 782px num notebook de 1366px, e o Preço ficava atrás de uma rolagem
  lateral). Para isso: a coluna da solicitação vai de 360 a 460px (`clamp(360px, 29vw, 460px)`),
  a folga entre as colunas da tabela é menor, o campo do ativo cresce até 16 letras (o nome longo
  de fundo rola dentro dele, e por extenso fica no bloco Secundário e na dica da linha), e o selo
  (AÇÃO, FUNDO) desce para baixo do ativo só quando falta espaço. Ao mexer em coluna ou campo da
  tabela, meça de novo em 1280 e 1366px.
- **O teto vem da captura** e vale mais que qualquer anotação, por ser o daquela hora; no cartão
  aparece como texto ("ROA até 0,50% do Hub"). Com a planilha, que não traz o mínimo, ele é
  **anotado por fundo** no cartão, pelo fim da barra na boleta, e guardado com o deságio do dia
  (`secundario-teto-antigo` avisa quando o deságio mudou). Sem teto, `secundario-sem-teto` segura o
  ROA máximo sem confirmação e oferece **Usar ROA zerado**, que não precisa dele. A regra "teto por
  classe" (FOF 2%, FII 2,5%) que apareceu numa conversa com outra IA é inventada — não a use.
- **Pedido em R$ vira cotas**: a maior quantidade cujo total, com corretagem e ROA, cabe no valor
  pedido — calculada com o PU **mais alto** que o arredondamento da planilha permite (PU + meia
  unidade da última casa). No CPHF11, R$ 16.000 dariam 1.804 cotas pelo PU da planilha, que no Hub
  custam R$ 16.000,00; a conta dá 1.803. Com PU muito baixo a margem pesa (R$ 0,25 ± 0,005 é 2%).
- É a **exceção à invariante 2**, pedida pelo operador: o e-mail de fundo leva a quantidade. Ela não
  adivinha — sai da captura (ou da planilha e do teto anotado) — e fica à vista no cartão antes da
  saída. Sem os fundos carregados, ou com o fundo fora deles, o bloqueio é confirmável e o e-mail
  sai em R$, como antes.
- **Fora da captura:** o incentivo do *Estoque Clientes* (0,50% em cetipados, 0,25% no Portfolio
  Renda+, segundo o aviso da boleta) não vem na resposta, e o peer to peer não é tratado.
- Só vale para **compra de fundo da prateleira**, reconhecido pelo nome ou pelo ticker
  (`VGPR11`, `XPHF11`); venda não passa pela boleta.

### O cliente e o assessor (robô 1.3.0)

Pedido do operador em 07/10/2026: o Abrir no Outlook já vai **para o cliente**, com o **assessor
responsável em cópia** e o **nome do cliente na saudação**. Código em `core/cliente/`,
`ui/cliente.js` e `platform/assessores.js`.

- **O cliente vem da ficha do Hub, pelo robô.** A busca do topo do Hub leva à Posição Consolidada,
  `/new/posicao-consolidada/#/<conta em base64>`, e a tela pede `.../customers/<conta>/customer-info`
  por **XHR**, em texto. Descoberto no Hub de verdade em 07/10, lendo só os nomes dos campos: a
  resposta é `{ output: { … } }`, e dentro de `output` vêm `name` (MAIÚSCULAS, sem acento), `email`
  (MAIÚSCULAS), `advisorCode` (`A51847`), `advisorName` e `xpAccount`. Vem também CPF, telefone e
  patrimônio, que **nunca saem do Hub**. A 1.3.0 procurava os campos na raiz da resposta (tinham sido
  vistos nas propriedades da tela, não na resposta) e falhou no primeiro teste no Hub; a 1.3.1 lê
  `output` e, se a ficha vier num formato que ele não conhece, avisa "o robô precisa ser
  atualizado" em vez de recarregar à toa. O formato da resposta foi conferido abrindo a ficha num
  `iframe` com o observador instalado antes do app carregar, sem chamar a API.
- **Sair da ficha leva ao Dashboard**: `#/` sozinho recarrega o Hub na página inicial. O robô só
  troca de uma ficha para outra.
- **Uma segunda aba do robô, a de clientes** (título "🤖 Clientes"). A Posição Consolidada é outro
  módulo do Hub: ir e voltar da Prateleira recarregaria a página inteira a cada cliente e tiraria a
  Prateleira de prontidão para a cotação. Na aba de clientes, trocar de cliente é trocar o fim do
  endereço. Cada papel tem o nome de janela (`mesa-xp-robo`, `mesa-xp-clientes`), o bilhete
  (`abaPedida`, `abaPedidaClientes`) e a marca de atendimento (`atendendo`, `atendendoClientes`)
  dele; a aba pega o bilhete do papel do módulo em que nasce. A aba de clientes abre na primeira
  busca, já na ficha pedida.
- **Recarregar, uma vez por pedido**, quando a ficha pedida já está na tela (ir para o mesmo
  endereço não faz o Hub pedi-la de novo) e quando a troca de endereço não trouxe a ficha em 10 s.
  Não se sabe ainda se o Hub de verdade pede a ficha ao trocar só o fim do endereço; o `verificar`
  cobre os dois casos.
- **Minimização.** O robô lê só `name`, `email`, `advisorCode`, `advisorName`, e só se `xpAccount`
  bater com a conta do endereço da chamada; o gancho no XHR só existe na aba de clientes. O pedido
  (`pedidoCliente`, com a conta) sai do Tampermonkey no fim da busca, e o resultado (`cliente`) assim
  que a Mesa o recebe. Na Mesa, o cliente fica **só na memória da página** (`estado.clientes`):
  nada vai para o `localStorage`, o histórico ou arquivo. O `verificar` confere que nem a conta, nem
  o nome, nem o e-mail, nem o CPF ficam no armazenamento do robô. O endereço do Outlook leva o
  e-mail e o nome do cliente, e por isso fica no histórico do navegador de quem abriu.
- **O assessor vem da planilha dos assessores**, carregada à mão (Carregar assessores, ou arrastar
  o arquivo): a aba Contatos baixada do Google, em `.xlsx` (todas as abas; vale a primeira com Nome,
  Email e código, a Contatos antes) ou `.csv` (lido como UTF-8). Fica no `localStorage`
  (`ordens_assessores`); não é dado de cliente, mas **nunca vai para o repositório**, que é público.
  Ela tem dois códigos ("Código" e "Código em uso"), um segundo "Nome" à direita, e-mails "-" e
  linhas que não são pessoas: só fica linha com e-mail válido.
- **Achar o assessor nunca é palpite:** pelo código (`advisorCode` em qualquer das duas colunas);
  sem ele na planilha, pelo nome escrito igual, sem acento e maiúscula (o cartão marca "achado pelo
  nome"). Dois e-mails para o mesmo assessor: vale o único entre os ativos (Status); sem isso, fica
  sem cópia. O que falta aparece em âmbar no cartão e no aviso do Outlook.
- **O nome na saudação** (`nomeProprio`): cada palavra com a inicial maiúscula, partículas (da, de,
  dos, e…) minúsculas no meio, numeral romano inteiro. O acento que o Hub não mandou não é posto.
  Vale para os dois e-mails e para o Copiar — o que se vê é o que vai. É a exceção à regra de nome
  nunca entrar na saída: o nome digitado no pedido continua fora; o da ficha do Hub entra na
  saudação, e só nela.
- **A linha do cliente no cartão**, logo abaixo da conta, é também conferência: um dígito trocado
  na conta mostra outro nome. O cliente é refeito a cada render pela conta do campo — **o nome de
  um cliente nunca fica no e-mail de outra conta**: enquanto a conta é editada, a saudação volta a
  "Cliente", e o robô busca a conta nova ao sair do campo. Uma conta por vez, numa fila; a que já
  veio na página não é pedida de novo.

### A entrada real

O operador cola **direto do grupo de WhatsApp** onde as ordens chegam, com o carimbo
`[13:46, 21/09/2026] Nome:` na frente e as confirmações da mesa no meio. `limparEntrada` descarta
tudo isso antes que qualquer parser veja o texto.

O descarte do carimbo é o mais importante de todos: ele contém um horário, e um horário lido dali
viraria `Hora Inicial` de uma ordem TWAP — um dado inventado dentro de uma ordem real. Há um teste
só para isso, e ele deve continuar passando.

Normalmente vem uma conta por bloco, mas duas ou mais são possíveis: a linha com o número da conta
abre uma nova solicitação, e misturar a conta de um cliente com o ativo de outro é o pior erro que
o sistema poderia cometer.

A linha da conta traz às vezes o pedido junto (`7000002 - compra via email`): o que vem depois do
número é lido como contexto, mas só com palavra inteira — o `V` de `Carlos V. Silva` não é venda.
Linha com ticker ou unidade depois do número (`10000 - PETR4`, `50000 reais cada`) não é conta.
Numeração de lista, marcadores e negrito do WhatsApp são tirados na limpeza; o tachado (`~`) não,
porque riscar costuma ser cancelar.

O valor às vezes vem **na linha de baixo** do ativo (`Riza Malls` / `R$ 16.000,00`), sobretudo em
fundo cetipado, cujo nome já ocupa a linha. `casarValores` liga cada valor sozinho ao ativo logo
acima, se ele não trouxe valor próprio. Um valor sem ativo logo acima **cancela o casamento do
bloco inteiro** e tudo vai para os descartes: é o sinal de que o valor pode vir *acima* do nome, e
casar de cima para baixo daria a cada fundo o valor do vizinho — erro que conferência nenhuma pega.

### Invariantes

Cada uma vale um teste. Violá-las é um bug de negócio, não de estilo.

1. `Cliente` é sempre a conta numérica.
2. Quantidade nunca vira financeiro, financeiro nunca vira quantidade. Exceção única: compra de
   fundo no secundário, convertida pela planilha do dia (ver "Fundos no secundário").
3. `Compra` → `C`, `Venda` → `V`.
4. Preço informado é preservado literalmente; ausente é `A mercado`.
5. Ticker suspeito de erro de digitação gera **aviso pedindo confirmação** — a correção automática
   é proibida.
6. Ativo repetido na mesma solicitação **bloqueia** pedindo confirmação; somar automaticamente é
   proibido.
7. Linha sem quantidade nem financeiro não vira ordem: é descartada com o motivo à vista, nunca
   completada por inferência.
8. Conta ausente, operação ausente e ticker suspeito **bloqueiam** a geração.
9. A ordem de digitação dos ativos é preservada na saída.
10. Financeiro sai como `R$ X.XXX,XX` (pt-BR).
11. `Preço Would`, `Hora Inicial` e `Hora Final` só saem preenchidos com informação explícita.

Quase todo bloqueio traz um botão de confirmar-e-gerar. Um bloqueio sem saída faria o operador
contornar o sistema no meio do expediente, que é exatamente o risco que ele existe para evitar. As
exceções são os bloqueios que confirmar não resolve:

- **conta ausente** — sem conta não existe ordem para confirmar;
- **fundo ambíguo ou parcial** — confirmar não escolhe o fundo; a saída são os candidatos no
  preview;
- **ordem que não cabe no formato** — financeiro no Lote Simples, fundo cetipado no lote, no TWAP
  ou na auditoria. Não há o que atestar: a coluna não existe, e confirmar escrevia `null` em
  `Qtd. Total`. A saída é outro formato, marcado a um clique. A exceção é o fundo escrito pelo
  ticker: o código cabe na coluna, e confirmar é dizer que a ordem é em bolsa.

A comporta (`gerar`, em `ui/saidas.js`) só aceita confirmação de bloqueio confirmável — ela não
depende de o botão estar escondido.

A **Auditoria por E-mail** — na tela, **E-mail em tabela**, que é como o operador a chama — é o
e-mail da ordem com uma tabela das ordens no corpo, copiada em HTML e em texto com TAB, os dois
de uma vez. A tabela é o Lote Simples **sem `Estratégia` e `Cliente`** (pedido do operador em
30/09: "Simples" é coisa da planilha, e a conta já está na frase de abertura) — o Lote Simples em
TSV continua com as duas. Desde 28/09 a coluna de valor **acompanha a cesta**: só quantidade,
`Qtd. Total`; só reais, `Financeiro` no lugar dela; mista, **duas tabelas** — a de financeiro
primeiro, a de quantidade depois, duas linhas em branco entre elas. Isso reverteu uma decisão
anterior de manter a tabela sem financeiro — o operador mudou de ideia com um pedido real na mão.
O Lote Simples em TSV, colado na planilha da XP, continua sem financeiro. "Tabela igual Excel", para o operador, é **grade
simples**: borda fina em todas as células e nada mais — sem cor, sem negrito, sem fonte declarada.
Ele cola no Outlook na web, que dá ao que chega sem fonte a fonte da mensagem; a primeira versão
declarava Aptos e pintava o cabeçalho de cinza, e foi recusada por destoar do resto do e-mail.

**Abrir no Outlook** (07/10/2026, pedido do operador) fica ao lado do Copiar nos dois e-mails e abre
um e-mail novo no Outlook na web, com o assunto **Confirmação de ordem** (`platform/outlook.js`) e,
com o robô e a planilha dos assessores, o cliente no Para e o assessor em cópia (ver "O cliente e o
assessor"). É o endereço de compor do Outlook na web, não um `mailto:` solto: este abriria o programa
de e-mail padrão do Windows, e o operador usa o Outlook na web. Conferido no Outlook da mesa em 07/10:

- **O `cc` solto no endereço é ignorado** — Para, assunto e texto entram, a cópia não. Com o cliente,
  tudo vai num `mailto:` inteiro dentro do `to` (`compose?to=mailto%3A…%3Fcc%3D…`), como o Chrome e
  o Edge entregam os links de e-mail ao Outlook na web; aí a cópia entra. Sem o e-mail do cliente,
  vai o endereço simples, só com assunto e texto.
- As quebras de linha (`\r\n`) chegam.
- **Abre numa janela só do e-mail** (`popup`, 980×860, no meio da Mesa), uma por clique, como o
  "abrir em nova janela" do Outlook. A página não consegue usar a aba do Outlook que a pessoa já tem
  aberta: o navegador só deixa reaproveitar uma janela aberta pela própria página.

O texto vai no endereço e a área de transferência não é tocada, porque ela pode estar guardando algo
que a pessoa vai colar. A tabela não vai no endereço, que só leva texto puro: o E-mail em tabela abre
sem o corpo e vai copiado, para colar. O mesmo vale para o texto acima de 7.000 caracteres
codificados. Abrir conta no histórico como copiar.

Os textos e cabeçalhos exatos das 4 saídas estão em [`docs/FORMATOS-DE-SAIDA.md`](docs/FORMATOS-DE-SAIDA.md).
Leia esse arquivo antes de alterar qualquer formatter ou template — ele é a fonte da verdade dos
literais, e um caractere fora do lugar quebra a colagem no Excel ou o padrão do e-mail.

### Arquitetura

O fluxo é um pipeline de uma direção, e cada etapa é uma função pura testável isoladamente:

```
texto colado → limparEntrada → parseSolicitacoes → Solicitacao[] → validar → Diagnostico[]
                                                         ↓                        ↓
                                                  preview editável ──→ formatadores → texto
```

- `src/modulos/ordens/core/` — o pipeline. Sem DOM, sem `localStorage`, sem `window`. É aqui que vivem os testes.
  - `texto/limparEntrada.js` — tira o carimbo do WhatsApp e o ruído da mesa
  - `parse/parseSolicitacoes.js` — quebra por conta e monta as ordens; `parse/valores.js` decide
    quantidade × financeiro
  - `validate/ticker.js` — reconhece o ticker contra `validate/tickersB3.js` e levanta suspeita
  - `validate/validar.js` — produz bloqueios e avisos
  - `secundario/` — a planilha do secundário, as contas da boleta e a conversão de R$ em cotas;
    a tela grava o resultado em `ordem.secundario` antes de validar e formatar
  - `format/formatadores.js` — escreve o e-mail e os dois TSVs
- `src/modulos/ordens/ui/` — render e edição. `preview.js` monta o cartão e aplica as edições; `saidas.js` decide
  entre mostrar a saída ou o bloqueio.
  - `cliente/` — o nome para a saudação, a planilha dos assessores e o assessor de cada cliente
- `src/modulos/ordens/platform/` — adaptadores de browser (clipboard, Outlook, histórico, os fundos do
  secundário e os tetos de ROA, o favorito do Hub, o robô do Hub e a ponte com ele), isolados para
  o core não depender deles.
- `src/modulos/ordens/index.js` — só estado de tela, eventos e render. Nenhum julgamento de negócio mora aqui.

`validate/tickersB3.js` é **gerado** (`npm run tickers:update`), com os 2.695 tickers do mercado à
vista da B3 por classe. Ele existe para uma coisa só: `KCNR11` é um ticker perfeitamente bem
formado, e nenhuma regra de formato revela que ele é `KNCR11` digitado errado. Só a comparação
contra a lista revela.

**A fonte é o Cadastro de Instrumentos da própria B3** (`InstrumentsConsolidated`, público, em
arquivos.b3.com.br), desde 07/10/2026. Antes era a HG Brasil, com 1.624 tickers: faltavam centenas
de BDRs (só um de final 39, os BDRs de ETF) e os ETFs e fundos novos. Em pedidos reais, `BURA39` e
`BIAU39` saíam como desconhecidos, e `RARA11` — um ETF — era **bloqueado** como erro de digitação de
`RURA11`. Do cadastro entram só o mercado à vista e os finais de papel negociado: ação 3 a 8 e unit
11 (classe Ação: `KLBN11` é ação, não FII), BDR 31 a 35 e 39, ETF e fundo 11. Direitos, recibos e as
outras séries de fundo (12, 15…) ficam de fora: `ticker.js` os reconhece como espécie irmã do 11.
A B3 põe FII, Fiagro, FI-Infra e FIP na mesma categoria; a classe sai do nome do fundo, por uma
regra no gerador. Os 32 tickers da prateleira (cetipados) continuam fora: não são do mercado à
vista.

**O preview é a comporta.** Nenhuma saída é gerada direto do parser: o parser propõe, o usuário
confere e corrige campo a campo no preview, e só então os formatters rodam sobre os dados
confirmados. Os formatters recebem dados já validados e não fazem inferência alguma.

O botão **+** do cartão acrescenta uma linha em branco — nem a operação da cesta ela herda. Por
isso a validação cobre o que o parser nunca produz: ativo vazio e ordem sem valor bloqueiam sem
confirmação, e nome que não é ticker nem fundo da prateleira bloqueia com confirmação. O tipo
escolhido no controle Qtd/R$ fica em `ordem.tipo`, porque numa linha vazia não há valor de onde
deduzi-lo.

`index.js` é o antigo `src/main.js` do Ordens, inteiro, dentro de `iniciarOrdens(secao)`. Na fusão
mudaram só três coisas: o tema e os avisos de tela vêm de `src/ui/`, e os atalhos (Ctrl+Enter,
Alt+H, Esc) só valem com a aba à vista. O botão Histórico mora no topo e só aparece na aba Ordens
(`data-so-na-aba="ordens"`).

---

## Renda Fixa

Página que lê no navegador a planilha de renda fixa exportada pela XP e gera um texto para WhatsApp
com a maior taxa por prazo e categoria. Código em `src/modulos/rendafixa/`. As regras de negócio
(filtros, janela de prazo, categorias, prazos exibidos, CDI+ × % do CDI) e o mapeamento das colunas
da XP estão no [README](README.md#renda-fixa-como-o-motor-funciona); leia antes de mexer no motor e
atualize o README junto.

### Regras

- **O texto de `montarTexto` é o produto**: o assessor cola direto no WhatsApp do cliente.
  Asteriscos, `-> `, o travessão `–` nos isentos, `a.a.` e `% CDI` são formato visível ao cliente.
  Altere só quando pedido e mostre o antes/depois.
- **Toda regra de negócio fica em `motor.js`** (funções puras, sem DOM). `index.js` só apresenta.
- **A planilha nunca sai do navegador.** Esse sigilo é a promessa do produto; um teste confere que
  nenhum arquivo do módulo faz chamada de rede.
- Texto vindo da planilha ou do histórico que vai para `innerHTML` passa por `esc` (ou
  `mensagemEmHTML`, para o negrito do WhatsApp).
- Registros antigos do histórico (`rendafixa_history`, até 20) não têm `modo`, `arquivo` nem
  `itens`. Leia esses campos com reserva.

### Mapa

- `motor.js` — portado do RendaFixaDisparo sem mudar uma regra: o corpo é o mesmo, só o
  `module.exports` virou `export`. `processRows(rows, secundario, hoje)` devolve
  `{ totais, descartes, bloqueados, colunas, secoes }`; `montarTexto(resultado)` gera a mensagem, ou
  `''` sem oportunidade.
- `planilha.js` — `lerPlanilha(dados, XLSX)`: primeira aba, datas como `Date`, linhas como matriz.
- `historico.js` — histórico e variações do dia (▲/▼ contra a última análise salva antes de hoje, no
  mesmo mercado).
- `render.js` — o HTML, em funções puras. `index.js` — estado, eventos, atalhos.

### Armadilhas

- O mapeamento de colunas é por trecho do cabeçalho normalizado. Na planilha da XP, *tipo* cai em
  **Ticker** (a última coluna que combina vence) e *taxa* cai em **Tax.Mín** (só aqui vence a
  primeira). Ao mudar uma palavra-chave, confira as 34 colunas da XP.
- Em `normalizeTipoLocal`, os nomes por extenso vêm antes das siglas porque "LCD" contém "lc".
  Tickers do secundário (`26I1LCD8XR3`) não identificam o tipo, e a coluna Instrumento resolve.
- O mesmo número de taxa muda de sentido conforme o indexador: pré = % a.a., CDI = % do CDI, CDI+ e
  IPCA = spread.
- A única diferença entre linha primária e secundária é a coluna "Data de Emissão" estar preenchida.
- O prazo é calculado contra `hoje`, que por padrão é `new Date()`. Para comparar saídas, passe uma
  data fixa.
- Datas são detectadas com `ehData` (e não `instanceof Date`) para funcionar com objetos vindos de
  outro realm.
- A regex de `removeAccents` usa os escapes `̀-ͯ` como texto; um teste confere que não
  viraram caracteres invisíveis.
- Sem Tax.Mín nem Tax.Máx, o motor lê como taxa a primeira célula da linha com "%" — que pode ser o
  ROA. É comportamento do original, registrado no golden da planilha sintética e no roadmap.

### SheetJS vendorizado

`src/vendor/xlsx.full.min.js` é o SheetJS **0.20.1** do CDN oficial, byte a byte (um teste confere
o sha256), com `LICENSE-sheetjs.txt`. **Não use o pacote `xlsx` do npm**: parou na 0.18.5, com
vulnerabilidades conhecidas; um teste recusa `xlsx` no `package.json`. O `package.json` com
`"type": "commonjs"` dentro de `src/vendor/` é o que deixa o Node (nos testes) carregar o arquivo
UMD; o build o importa pelo `import XLSX from`.

### Goldens e fixtures

O porte do motor é protegido por **golden files**.
`npm run golden:rendafixa -- <pasta do RendaFixaDisparo>` (`scripts/gerar-golden-rendafixa.mjs`)
roda o motor ORIGINAL do RendaFixaDisparo (`processRows` + `montarTexto`), com o SheetJS original e
a leitura do app original, na data fixa 23/09/2026 12:00 (fuso de Brasília), nos dois mercados, e
grava em
`golden/` o texto e o `processRows` inteiro. `motor.golden.test.js` exige do motor novo o mesmo
texto, caractere por caractere, e o mesmo resultado.

- **As exportações reais da XP ficam em `src/modulos/rendafixa/fixtures/*.xlsx` e nunca vão para o
  git** — o repositório é público. Estão no `.gitignore`. Sem elas, os goldens delas são pulados.
- Nome curto: `produtos-renda-fixa-emissao-bancaria (2).xlsx` entra como `xp-2.xlsx`, e o golden
  sai `xp-2.primario.json`. Com o nome da XP, o caminho do golden passava de 260 caracteres numa
  pasta funda e o Git no Windows não conseguia fazer o checkout.
- `fixtures/sintetica.js` é uma planilha inventada, com as 34 colunas da XP e uma linha por regra do
  motor. O golden dela roda sempre, inclusive no repositório público.
- Os goldens das exportações reais estão versionados: são texto derivado (taxas e nomes de produto
  da prateleira da XP, o mesmo tipo de dado do exemplo do README original).
- Uma exportação nova em `fixtures/` sem golden reprova o teste: rode o gerador.
- Depois que o motor mudar **de propósito**, os goldens passam a ser editados à mão, com o
  antes/depois à vista na revisão — rodar o gerador de novo compararia com o motor antigo.
- Os testes rodam no fuso `America/Sao_Paulo` (`vite.config.js`): a XP entrega o vencimento à
  meia-noite local, e em UTC o prazo mudaria.

### Tela

Mesmo fluxo do original — planilha → mercado → funil → cartões ou mensagem → copiar e salvar — no
visual do Ordens. Saíram a aurora, o vidro, a contagem animada, o holofote, a ondinha, o voo até o
histórico e a espera artificial da leitura. Ficaram o funil (com os motivos de descarte e as
colunas usadas), as variações do dia, a prévia da mensagem com o negrito, o histórico e os atalhos
(A, M, V, C, S, T, ?).

---

## Calendário

Planilha semanal de presença da equipe, gravada no Supabase e sincronizada em tempo real entre quem
está com a página aberta. Código em `src/modulos/calendario/`.

### Repositório e adaptadores

Tudo que a tela lê e grava passa pelo repositório (`repositorio.js`, com o contrato documentado).
Dois adaptadores equivalentes cumprem o mesmo contrato:

- `adaptadores/supabase.js` — o banco da mesa. Recebe o cliente pronto (`src/dados/banco.js`).
- `adaptadores/local.js` — `localStorage`, chave **`presenca_app_data`**, no formato do app
  original. Ligado quando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão **as duas vazias**.

`repositorio.test.js` roda a mesma bateria contra os dois, com um Supabase falso
(`testes/supabase-falso.js`) que imita o schema: chave única, `check` de horário, chave estrangeira
e `on delete cascade`. Método novo ou alterado entra nos dois adaptadores e na bateria. Mudança de
schema: atualize `supabase/schema.sql` junto com o adaptador e o fake.

O domínio fala português (`colaborador`, `registro`, `indisponiveis`); o banco e o formato local
continuam com os nomes do original: `supabase/schema.sql` é o do app original, e os dados de um
banco do Calendário antigo passam para o novo tabela por tabela, sem conversão.

### Regras

- **Datas são sempre a chave local `YYYY-MM-DD`**, gerada por `chaveDoDia` (`datas.js`). Nunca
  `toISOString()`: ele converte para UTC e, às 21h de Brasília, o registro de quarta cai na quinta.
  Um teste varre o módulo e recusa `toISOString`.
- **Todo texto vindo do banco ou do usuário passa por `esc`**, e a cor do colaborador, que vai para
  um `style`, por `corSegura` (só hex). Qualquer pessoa com a chave anon escreve no banco: nome,
  observação e motivo são entrada não confiável.
- **Salvar o dia insere os horários novos ANTES de apagar os antigos**, e apaga pelos ids lidos
  antes da inserção. Uma queda no meio deixa os antigos (falha ao inserir) ou antigos e novos
  juntos (falha ao apagar) — nunca o dia sem horário, como no original, que apagava primeiro. E o
  horário que outra pessoa gravou no meio tempo não é apagado.
- **Consultas em lotes**: `in()` com no máximo 100 ids — a lista vai na URL.
- **Sem fallback silencioso para o modo local.** Erro de rede aparece na tela, com "Tentar de novo",
  e fica lá até dar certo; a janela do dia não fecha quando o salvamento falha. Só uma das duas
  variáveis vazia é erro de configuração, na tela — não modo local. Armazenamento local cheio também
  vira erro (o original só avisava no console).
- O motivo do horário indisponível pode ser de saúde: a matriz da semana mostra o horário, não o
  motivo. O motivo aparece na janela do dia e no histórico, como no original.
- Remover um colaborador apaga os registros dele pelo `on delete cascade` do banco (no modo local,
  o adaptador faz a mesma coisa).

### Conexão

`src/dados/config.js` resolve URL e chave de `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, lidas no
build; sem elas vale o projeto da mesa (`rtvtgulivtkpfprcfpie`). `src/dados/banco.js` cria o
cliente do `@supabase/supabase-js` sem sessão de login (o app não tem login, e o hash da URL é a
rota das abas) e com 15 s por requisição. O Realtime escuta as três tabelas e recarrega a visão com
300 ms de espera (um salvamento gera vários eventos).

O status no topo sai de dois fatos juntos, a última carga e o Realtime, e não do último evento que
chegou: "carregando…", "sem conexão" (nunca carregou), "ao vivo", "sem atualização ao vivo"
(carregou, mas o Realtime caiu), "conectado" ou "modo local". O Realtime costuma ficar pronto antes
da primeira carga terminar; quando cada evento escrevia o status por cima do outro, a tela ficava em
"conectado" com o Realtime funcionando.

**"Ao vivo" só depois do aviso do banco.** O canal responde `SUBSCRIBED` quando o servidor do
Realtime aceita a inscrição, mas o banco só começa a repassar mudanças uns 150 ms depois, quando
chega a mensagem de sistema `postgres_changes` com status `ok`. Uma gravação feita nesse intervalo
não gera evento nenhum. `src/dados/realtime.js` espera por esse aviso (é o mesmo para Calendário e
Operacional), e a tela recarrega ao recebê-lo, para pegar o que mudou antes. Achado no primeiro
teste contra o banco real: a outra aba perdia o primeiro colaborador criado.

**Depois de salvar, a tela usa o que foi salvo sem esperar a releitura.** Um salvamento dispara
eventos do Realtime no meio do caminho, e a carga que eles pedem pode ler o dia (ou o post) pela
metade — o dia já gravado, os horários ainda não. Por isso `salvarDia` põe o registro salvo no
estado antes de recarregar, e o Operacional faz o mesmo com o post salvo ou excluído. Sem isso, a
janela do dia reaberta logo depois de salvar vinha sem os horários.

**O projeto mudou em 30/09/2026.** O antigo (`ekughbuuvjoojgfgbqbz`, o do Calendário na Vercel)
não resolvia no DNS desde 29/09 e não está na conta Supabase da mesa; os registros de presença dele
não vieram, e a mesa decidiu não migrá-los: o Calendário começa do zero. O projeto
`rtvtgulivtkpfprcfpie` recebeu `supabase/schema.sql` e `supabase/operacional.sql`.

### Tela

Matriz colaborador × dia útil, com o total de presenciais por dia no rodapé e o dia de hoje
destacado; clique na célula abre a janela do dia (`<dialog>` nativo: presencial, observação,
horários indisponíveis). Histórico do mês agrupado por semana, com filtro por colaborador. No
celular a matriz rola dentro do quadro, com a coluna dos nomes parada.

### Pendência de segurança — fase 2

**A RLS atual do Supabase libera leitura e escrita de tudo para a chave anon**, e a chave anon está
no código de um repositório público (e no build). Os dados do Calendário têm nomes de colegas e
motivos de ausência, que podem ser de saúde; os do Operacional, os procedimentos internos da mesa.
Qualquer pessoa com o link — ou com o repositório — lê e altera tudo; no Calendário, também apaga.
(O Operacional já nasceu sem DELETE para a anon e com o histórico fora do alcance dela, mas segue
aberto para leitura e edição.)

Não foi corrigido nesta versão, de propósito: a fusão não muda comportamento. A correção, na fase 2:

1. Supabase Auth (login dos colegas da mesa), que também dá autor a cada post e a cada versão;
2. políticas RLS fechadas — só usuário autenticado, e só da equipe, lê e escreve — nas tabelas do
   Calendário e do Operacional;
3. repositório privado;
4. rever o que é gravado no motivo (evitar dado de saúde em texto livre).

Até lá, trate o link como interno.

---

## Operacional

A base de conhecimento da mesa — o Slab dentro da Mesa XP: modelos de e-mail de confirmação, textos
de disparo, passo a passo dos sistemas, padrões de fixing e regras de execução. Código em
`src/modulos/operacional/`. Entrou em 30/09/2026, a pedido da mesa, depois de uma primeira tentativa
de outro agente (guardada na branch `antigravity/operacional`, não revisada).

### O conteúdo

`conteudo.js` é a cópia do Slab da equipe (lá "Gregori's Team"; na barra lateral, a pedido da mesa,
**Operacional Mesa**): a raiz **Mesa de Operações
Argentum** e cinco tópicos (Padrões de Email, Disparos, Passo a Passo, Padrões de Fixing, Execução
de Ordens), com os 34 posts na ordem do Slab. É a **semente**: o banco nasce dela
(`supabase/operacional.sql`) e o modo local também. Depois de semeado, o banco é a fonte — o que a
mesa edita pela tela não volta para o arquivo.

- **O texto é o do Slab, como foi colado**, erros de digitação incluídos ("cncelar"): é o que vai
  para o e-mail do cliente. Só foram normalizados espaço no fim da linha e linha feita só de espaço
  invisível (NBSP). `conteudo.test.js` prende a estrutura, a ordem e os posts sem texto.
- **15 posts vieram só com o título** (Confirmação resgate fundos, Confirmação aplicação Fundos, os
  12 de Padrões de Fixing e Ações e Fundos Listados). Ficam vazios e marcados "texto pendente";
  **não se inventa texto para eles** — a mesa cola o do Slab pela tela.
- O texto é mostrado como está, sem interpretar: os asteriscos do WhatsApp aparecem como
  asteriscos, porque é assim que o texto vai ser copiado. "Copiar texto" copia o conteúdo exato.

### Repositório e o banco

Mesmo padrão do Calendário: `repositorio.js` documenta o contrato, e dois adaptadores equivalentes
o cumprem — `adaptadores/supabase.js` (tabelas `operacional_topicos` e `operacional_posts`) e
`adaptadores/local.js` (`localStorage`, chave `mesa_operacional`). `repositorio.test.js` roda a
mesma bateria contra os dois, com um Supabase falso que imita o SQL.

Como o app não tem login e qualquer um com o link edita, duas regras protegem o conteúdo:

- **Excluir é esconder.** O post ganha `excluido_em` e some da tela, mas continua no banco. A chave
  anon **não tem política de DELETE** em tabela nenhuma do Operacional.
- **Ninguém salva por cima de quem salvou antes.** Cada post tem `versao`; o UPDATE só casa com a
  versão que foi aberta e sobe um número. Se outra pessoa salvou no meio, sai `ErroDeConflito`, nada
  é sobrescrito e o texto de quem foi recusado continua no editor.

No banco, um gatilho `security definer` guarda **cada versão de cada post** em
`operacional_revisoes`, uma tabela sem política nenhuma: a chave anon não lê nem apaga o histórico,
e um texto estragado ou excluído se recupera pelo painel do Supabase. Outro gatilho carimba
`atualizado_em`.

`supabase/operacional.sql` é **gerado** (`npm run sql:operacional`) por `sql.js` a partir da
semente — não edite à mão; `sql.test.js` recusa o arquivo se ele divergir. Ele cria tabelas,
gatilhos, RLS, Realtime e a semente, e pode rodar de novo: nada duplica e nenhuma edição da mesa é
desfeita. Foi validado num Postgres de verdade (PGlite): roda duas vezes, semeia 6 tópicos e 34
posts, o gatilho guarda o histórico, a trava de versão recusa a segunda gravação e o banco recusa
título vazio, slug repetido e apagar tópico com posts.

No banco da mesa (`rtvtgulivtkpfprcfpie`) ele já rodou, em 30/09/2026. Num projeto novo: SQL Editor
do Supabase → colar `supabase/operacional.sql` → executar.

### Tela

No desenho do Slab, no visual da Mesa XP:

- **Barra lateral**: a equipe, a busca (título e texto, sem ligar para acento) e a árvore de
  tópicos com a contagem de posts; "+ Novo tópico" abre um `<dialog>` e cria debaixo da raiz.
- **Raiz = início da aba** (`#operacional`): título, descrição e os posts agrupados por tópico, com a
  trilha "Mesa de Operações Argentum › tópico", como o Slab mostra.
- **Tópico** (`#operacional/topico/<slug>`) e **post** (`#operacional/post/<slug>`): cada um tem link
  próprio para mandar a um colega. O slug não muda quando o título muda.
- **Post aberto**: trilha, título grande, "Copiar texto", "Editar", "Excluir" (com confirmação).
- **Editor**: título, tópico e texto; Ctrl+Enter salva, Esc cancela; sair com alteração pede
  confirmação. Uma atualização ao vivo **não redesenha o editor** (o que está sendo digitado não
  some); se o post mudou no banco, o editor avisa.

Fora desta versão, e registrados no roadmap: anexos (foto, áudio, vídeo), rascunhos, favoritos,
"mais populares", restaurar versão pela tela e excluir tópico.

A base exige rede, como o Calendário: sem conexão o erro aparece na tela, e nada cai calado no
modo local.

## Anotações

O bloco de notas de cada um, com lembretes. Código em `src/modulos/anotacoes/`. Entrou em
30/09/2026, a pedido da mesa: o operador anotava no Bloco de Notas do Windows ("estorno do dia 25"),
prometia ajudar alguém e esquecia, e depois ia atrás dos prints e dos textos.

Desenho tirado das ferramentas que já fazem isso: etiquetas, fixar e lembrete com hora do Google
Keep; o print colado direto na nota, com data e hora no nome, do Sticky Notes; o vermelho do que
venceu, do Todoist.

### Onde ficam: no navegador de cada um

**As anotações ficam no IndexedDB do navegador, não no Supabase.** É o que faz "cada um ter o seu"
sem login: o banco da mesa ainda libera leitura para quem tem a chave anon, que é pública, e uma
anotação com o print de um estorno ou a conta de um cliente não pode ficar legível para qualquer um
com o link. Consequências, todas explicadas na tela:

- ninguém mais vê; também não acompanha a pessoa para outro computador. O **backup** (Exportar /
  Importar, `backup.js`) leva — um .json com as anotações e os prints em base64; importar junta,
  sem duplicar, e não troca uma anotação por uma versão mais velha dela;
- a versão do site (Vercel) e a aberta do disco (`file://`) são endereços diferentes para o navegador,
  cada uma com as suas anotações;
- quem limpa os dados do navegador perde as anotações. No site (HTTPS) a primeira gravação pede
  `navigator.storage.persist()`, que protege os dados da limpeza automática por falta de espaço.

Quando a Mesa XP tiver login (fase 2), um adaptador do Supabase com política por usuário cumpre o
mesmo contrato (`repositorio.js`) e as anotações passam a acompanhar a pessoa.

### Os lembretes

Um lembrete é `{ data: 'YYYY-MM-DD', hora: 'HH:MM' | null }`, no fuso local — nunca `toISOString()`
(`lembretes.js`, mesma regra do Calendário). O estado da anotação sai dele:

- **pendente** — o dia ainda não chegou: **amarelo**;
- **hoje** — é hoje, antes da hora marcada: amarelo mais forte;
- **vencida** — chegou o dia (lembrete sem hora vence à meia-noite: o dia inteiro já é "o dia") ou
  a hora: **vermelho**;
- **resolvida** — sai do caminho (filtro "Resolvidas"), com ou sem lembrete.

Os atalhos (Daqui 1 hora, Hoje às 17:00, Amanhã às 09:00, Em 2 dias, Segunda às 09:00) marcam o
lembrete e, depois que ele vence, viram "Adiar".

### O vigia (`vigia.js`)

A aba Anotações inicia na primeira visita, como as outras; **o vigia dos lembretes começa com a
página** (main.js), porque quem passa o dia no Ordens também tem de ser avisado. Ele:

- põe o contador na aba Anotações (âmbar com os de hoje, vermelho com os vencidos) e "(n)" no título
  da página, que aparece na aba do navegador;
- mostra o **alerta na tela** quando um lembrete vence, em qualquer aba (Abrir, +1 hora, Amanhã 9h,
  Resolvido, ×), com um som curto que se desliga na barra da aba;
- dispara o **alerta do Windows** (Notification) se a pessoa ligou. O navegador só pergunta a
  partir de um clique, e pode recusar numa página aberta do disco: o alerta na tela vale sempre.

Um alerta visto ou fechado não volta (`lembrete.avisado`); a anotação continua vermelha até ser
resolvida ou adiada, e o lembrete novo avisa de novo. Aba do navegador escondida há mais de 5
minutos: o Chrome só roda timers uma vez por minuto, e o alerta pode chegar até um minuto depois.
Ao voltar para a aba, o vigia confere na hora. Com o navegador fechado não há alerta — seria
preciso um service worker, que o arquivo único não permite.

Vigia e aba conversam por `eventos.js`: quem grava avisa, com a origem; os outros releem. Entre abas
do navegador, BroadcastChannel.

### A tela

Lista à esquerda (entrada rápida, busca, visões Lista e Planejado, filtros por estado com contagem,
etiquetas), anotação aberta à direita — e, sem nenhuma aberta, uma **anotação nova pronta para
escrever**. No celular, uma de cada vez. Rotas: `#anotacoes` (a que estava aberta),
`#anotacoes/nova`, `#anotacoes/nota/<id>`. N abre uma nova, / busca.

**Salvar é explícito** (pedido da mesa em 30/09: "não dá para saber quando salvou"; e o que o NN/g
mostra que as pessoas esperam — nada mudou até Salvar):

- o editor trabalha num **rascunho** (`estado.aberta`); nada vai para o IndexedDB até Salvar;
- o **selo de gravação** diz sempre em que pé está: Nova anotação · Alterações não salvas
  (âmbar, com Descartar) · Salvando… · Salvo às 14:32 (verde) · Não salvou;
- **Salvar** grava e abre uma anotação nova (a folha salva sai de cena, a nova entra, e a salva
  acende na lista); **Ctrl+S** salva e continua; **Ctrl+Enter** salva e começa outra;
- sair de uma anotação com alteração pergunta antes; fechar a página também (`beforeunload`);
- enquanto não é salvo, o rascunho fica no `localStorage` (`mesa_anotacoes_rascunho`): se a página
  fechar no meio, a anotação oferece **Recuperar** na volta (texto, etiquetas e lembrete — os
  anexos novos, não);
- ao salvar, vale o que a pessoa mudou desde que abriu; o que ela não mexeu vem do que está gravado
  agora (`mesclarAoSalvar`) — o alerta pode ter adiado o lembrete enquanto ela editava o texto;
- anexos colados ou arrastados entram no rascunho (selo "novo") e vão para o banco ao salvar.

O resto, tirado das ferramentas que a mesa já conhece:

- **Entrada rápida** (Todoist): "ligar pro cliente amanhã 10h #retorno" + Enter vira anotação com
  lembrete e etiqueta; a data lida aparece num selo antes, com × para ignorar (`dataNatural.js`, e
  as regras de cautela dele: "do dia 25" não é lembrete, "segunda via" não é segunda-feira).
- **Modelos** (Evernote, Notion): Estorno, Pendência de cliente, Ajudar um colega, Retornar ligação
  — título, campos e checklist prontos (`modelos.js`); só o de retorno sugere prazo.
- **Checklist** (Keep, Apple Notes): linhas `[ ]`/`[x]` no texto viram caixinhas com barra de
  progresso; o cartão mostra "1/3". Fica como texto: vai no backup e no "Copiar texto".
- **Planejado** (Microsoft To Do): a lista agrupada em Vencidas, Hoje, Amanhã, Próximos 7 dias,
  Mais adiante e Sem lembrete.
- **Bolinha de resolver** no cartão (Todoist) e **Desfazer** no aviso depois de resolver ou excluir
  (Gmail, Keep).
- **Lixeira de 30 dias** (Apple Notes): excluir é mandar para a lixeira (`excluidaEm`); de lá,
  Restaurar ou Apagar de vez; passados 30 dias, apaga sozinha ao abrir a aba.
- **Busca com o termo marcado** no cartão, sem ligar para acento; **Copiar texto** no editor.
- **Ctrl+V com uma imagem** anexa o print (nome "print AAAA-MM-DD HHhMM.png", como o Sticky Notes);
  o arquivo fica como Blob no IndexedDB, até 15 MB cada. No visor, "Copiar imagem" põe o print de
  volta na área de transferência (convertido para PNG, o único tipo que ela aceita).
- **Links** http(s) do texto viram botões que abrem em outra aba; `javascript:` e afins, nunca.
- Toda escrita passa por uma **fila**: duas gravações da mesma anotação nunca se cruzam.
- Tudo que é texto passa por `esc`: anotação é texto livre, às vezes colado de um e-mail.

### Mapa

`lembretes.js`, `notas.js`, `dataNatural.js` e `modelos.js` (funções puras: estado, rótulo,
atalhos, etiquetas, links, checklist, agenda, lixeira, rascunho, data na frase, modelos) ·
`repositorio.js` (contrato e validação) · `adaptadores/indexeddb.js` e `adaptadores/memoria.js` ·
`backup.js` · `eventos.js` · `banco.js` (um repositório para a página) · `vigia.js` · `render.js`
(HTML puro) · `index.js` (rascunho, estado, eventos) · `anotacoes.css`.

---

## Testes

`npm test` (Vitest, ambiente node, fuso `America/Sao_Paulo`). São 948 testes; com as exportações
reais da XP fora de `fixtures/`, 18 goldens delas são pulados.

- Ordens: o core é testado direto; da UI, só o render (preview, saídas e o bloco do secundário).
  O favorito do Hub roda, pelo `javascript:` decodificado, numa página do Hub de mentira (`node:vm`).
  A ponte com o robô do Hub é testada com uma janela de mentira; o robô mesmo, no `verificar`.
  Os 449 testes do Ordens original continuam aqui.
- Renda Fixa: goldens contra o motor original, histórico, render (escape), SheetJS vendorizado.
- Calendário: contrato do repositório nos dois adaptadores, datas, configuração, render (escape).
- Dados: a configuração do banco e o Realtime, que só diz "ao vivo" depois do aviso do banco.
- Operacional: a semente contra o Slab, o contrato do repositório nos dois adaptadores (inclusive o
  conflito de versão), render (escape, busca) e o SQL gerado em dia com a semente.
- Anotações: estado e rótulo dos lembretes com data fixa, atalhos, etiquetas, links, ordem e
  filtros; o contrato do repositório no IndexedDB (fake-indexeddb) e em memória, com anexos e o
  backup de ida e volta; render (escape, só link http(s)).
- Casca: rotas e atalhos das abas, CSS escopado, build de arquivo único.

Trabalhe **test-first**: escreva o caso de negócio como teste em `*.test.js` ao lado do módulo,
veja-o falhar, então implemente. Cada invariante acima merece um caso próprio, e os que mais
quebram são quantidade × financeiro, TWAP por quantidade × TWAP por financeiro, e conta com nome
colado junto.

Quando o operador trouxer um pedido real do grupo, **transforme-o em teste antes de mexer no
código**. Os casos de `parseSolicitacoes.test.js` que citam contas reais vieram assim, e são os que
mais valem: eles descrevem como as ordens chegam de verdade, não como imaginamos que cheguem.

O mesmo vale para Renda Fixa, Calendário e Operacional: uma planilha da XP que o motor lê errado vira fixture e
golden antes da correção; um jeito de a mesa usar o Calendário que quebra vira caso da bateria do
repositório.

## Verificação

Não declare pronto sem:

1. `npm test` e `npm run build` passando.
2. `npm run verificar` (`scripts/verificar-navegador.mjs`; na primeira vez,
   `npx playwright install chromium`). Abre `dist/index.html` via `file://` e confere as cinco
   abas, os dois temas, a largura de ~360px sem rolagem horizontal, o console, o CSS que vaza entre
   abas, o robô do Hub (o script de verdade, com o Tampermonkey simulado e um Hub falso), o texto
   do Renda Fixa colado e comparado com o golden, o Calendário em modo local (nome com
   `<img onerror>` como texto) e o Operacional em modo local (copiar e colar igual ao Slab, editar,
   criar, excluir, buscar e o conflito de duas abas) e as Anotações com o relógio controlado (o
   lembrete amarelo, a hora chegando com a pessoa no Ordens — alerta, contador, título —, o print,
   recarregar sem perder nada e o backup). Não grava no banco.
3. Mudança no Calendário ou no Operacional que toca o banco: `npm run verificar:supabase`. **Grava
   no banco da mesa**: rode fora do expediente.
   - `scripts/verificar-supabase.mjs` (Calendário) — leitura, gravação, a janela reaberta logo
     depois de salvar, exclusão em cascata, o Realtime entre duas abas e as quedas de rede, num
     colaborador de teste apagado no fim.
   - `scripts/verificar-supabase-operacional.mjs` — leitura, criação, edição, o conflito de versão
     entre duas abas, a queda no salvamento, a exclusão que só esconde, e o que o banco garante
     sozinho (a anon não apaga nem lê o histórico; o gatilho guarda cada versão), num post de teste.
     A anon não apaga, então o post de teste só some de verdade com `SUPABASE_ACCESS_TOKEN` no
     ambiente (token pessoal do Supabase, nunca gravado em arquivo); sem ele o script o deixa
     escondido e imprime o SQL da limpeza, e o histórico não é conferido.

   Os dois passaram contra o banco real em 30/09/2026, repetidos até não falhar mais (o Calendário
   seis vezes seguidas, o Operacional cinco). Na primeira rodada do dia, o evento de post novo levou
   15 s para chegar à outra aba; nas seguintes, menos de 1 s. Parece a partida a frio do Realtime do
   Supabase, não do app — vale observar.

## Convenções

- JS puro com módulos ES, sem framework.
- Português nos nomes de domínio (`quantidade`, `financeiro`, `conta`, `colaborador`), inglês nos
  termos técnicos (`parse`, `format`, `validate`).
- Textos de interface, avisos e comentários em português.
- TSV usa TAB real (`\t`) e `\n`; nunca espaços alinhados nem markdown.
- Dados de exemplo e presets usam contas fictícias (`1234567`) e nunca dado de cliente real.
- Tudo em LF (`.gitattributes`): os goldens e os TSVs comparam texto com `\n`.

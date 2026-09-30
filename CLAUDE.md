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

Nasceu da fusão de três repositórios — `Ordens.XP` (a base), `RendaFixaDisparo` e
`Calendario.Mesa` — sem funcionalidade nova; o Operacional veio depois, a pedido da mesa. Sugestões
vão para [`docs/ROADMAP.md`](docs/ROADMAP.md), não para o código.

É uma ferramenta de expediente, aberta o dia todo: alinhada, objetiva e sem enfeite. Isso vale para
a tela e para o código.

## A casca

```
index.html            a casca: topo com as abas e as quatro seções (a marcação do Ordens é estática)
src/main.js           liga tema, abas e o início de cada ferramenta
src/shell/abas.js     rota por hash e atalhos Alt+1/2/3/4
src/ui/               o que as abas dividem: tema, avisos de tela, escape de HTML, tokens e componentes
src/dados/            a conexão única com o Supabase, a configuração e os erros dos repositórios
src/modulos/ordens/       Assistente de Ordens
src/modulos/rendafixa/    RendaFixa Pro
src/modulos/calendario/   Calendário de presença
src/modulos/operacional/  base de conhecimento (a cópia do Slab)
src/vendor/           SheetJS 0.20.1 vendorizado, com a licença
supabase/schema.sql   o banco do Calendário
supabase/operacional.sql  o banco do Operacional (gerado: npm run sql:operacional)
docs/                 formatos de saída do Ordens e o roadmap
scripts/              atualizar tickers e fundos (Ordens), gerar goldens (Renda Fixa), verificar no navegador
```

- **Rota por hash**: `#ordens`, `#rendafixa`, `#calendario`, `#operacional`; hash vazio ou
  desconhecido abre o Ordens. A aba é o primeiro trecho do hash, e o resto é do módulo:
  `#operacional/post/<slug>` abre o post na aba Operacional. Hash e não caminho porque o mesmo arquivo roda no Netlify e aberto do disco (`file://`).
- **Alt+1/2/3/4** troca a aba na hora, sem esperar o `hashchange` — senão a tecla seguinte vai para a
  aba anterior. Ctrl+Alt fica de fora: é assim que o AltGr chega no Windows.
- **Início preguiçoso**: o Ordens inicia com a página, como sempre; as outras três só na primeira
  vez que a aba abre. O código já está no arquivo (não há `import()` dinâmico) — o que espera é a
  inicialização, e é nela que Calendário e Operacional conectam ao banco.
- **Cada módulo sabe se está à vista pelo `hidden` da própria seção.** Os atalhos de teclado e o
  arrastar-e-soltar de um módulo só valem com a aba dele aberta: Ctrl+Enter na aba Renda Fixa não
  analisa o Ordens, e "m" na aba Ordens não troca o mercado do Renda Fixa. Ao trocar de aba, um
  foco deixado numa seção escondida é solto.
- **Uma ferramenta que falha ao iniciar não derruba as outras**: o erro aparece no lugar dela.
- IDs: o Ordens usa os seus de sempre (`entrada`, `solicitacoes`…); Renda Fixa e Calendário não
  usam `id`, só `data-rf="…"` e `data-cal="…"` consultados dentro da própria seção.

Um módulo exporta `iniciarX(secao)` e não conhece os outros. O que dois módulos usam mora em
`src/ui/`; o que um usa só fica nele.

## O build: um arquivo só

`npm run build` gera **um único** `dist/index.html`, com JS, CSS e ícone dentro. É ele que vai
para o Netlify e é ele que os colegas abrem com dois cliques, sem servidor. Aberto do disco
(`file://`), o navegador bloqueia `<script type="module" src>` e lê `/assets/...` como a raiz do
drive — a tela aparece e nada funciona. Por isso:

- o plugin `arquivoUnico` do `vite.config.js` embute tudo e **falha o build** se sobrar arquivo;
- `vite.config.test.js` confere que a marcação não aponta para arquivo nenhum, que não sobrou
  `import()` dinâmico e que a casca e as quatro ferramentas estão embutidas;
- proibido: recurso externo (Google Fonts, CDN), `import()` dinâmico, `fetch` de arquivo local e
  service worker.

**Ordens e Renda Fixa funcionam offline**, abertos do disco. **Calendário e Operacional exigem
rede**: sem conexão mostram o erro na tela, e as outras abas seguem funcionando.

**Dependências de runtime:** uma só, `@supabase/supabase-js`, empacotada no build e usada por
Calendário e Operacional, por uma conexão única (`src/dados/banco.js`): o primeiro que abre cria o
cliente, o segundo reaproveita — um cliente por módulo abriria duas conexões do Realtime. O SheetJS não é dependência npm (ver Renda Fixa). Vite e Vitest são ferramentas de
desenvolvimento. O Netlify roda Node 22 (`netlify.toml`): supabase-js e Vitest 5 exigem Node 22+.

`dist/index.html` fica em torno de 1,3 MB, quase todo do SheetJS.

## Sistema visual

A base visual é a do Ordens, e o visual final é um só: as abas usam os mesmos tokens e
componentes.

- `src/ui/base.css` — tokens de cor dos dois temas, reset, avisos de tela, movimento reduzido.
- `src/ui/componentes.css` — painel, segmentado, selo (`.badge`), botão de copiar, alerta, estado
  vazio, botão de fechar. Um componente só entra aqui quando dois módulos o usam.
- `src/shell/casca.css` — o topo. Tem **59px** de altura: o painel de entrada do Ordens gruda logo
  abaixo dele, e as abas ficam em 34px para não crescê-lo.
- `src/modulos/*/…css` — o que é de cada módulo.

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
- **Cor carrega significado.** Verde é compra, vermelho é venda, âmbar é atenção, e o âmbar da
  marca aparece em poucos lugares. Cor que decora tira força da cor que informa.
- Nas abas da fusão, o mesmo código: verde é taxa que subiu e dia presencial; vermelho, taxa que
  caiu e erro; âmbar, horário indisponível, bloqueado e aviso de conexão. O âmbar da marca fica na
  ação principal de cada aba e na aba ativa. A cor de cada colaborador é dado do banco e vai só no
  pontinho ao lado do nome.

Movimento é curto (120–260 ms) e sempre com motivo: orientar de onde algo veio, confirmar um
clique. Nada pisca nem chama atenção duas vezes para a mesma coisa, e
`prefers-reduced-motion: reduce` desliga tudo.

Duas decisões do preview que vale manter:

- **Controle segmentado no lugar de `<select>`** quando a escolha precisa ser conferida de
  relance. Num `select` fechado só a opção atual aparece, e conferir uma cesta de dez ativos
  exigiria abrir linha por linha — justamente o que o preview existe para evitar.
- **O resumo da cesta soma financeiro e nunca quantidade.** A soma em reais é a exposição total e
  significa alguma coisa; 100 PETR4 mais 50 VALE3 não são 150 de nada, e esse número no topo do
  cartão convidaria a conferir a ordem contra um total sem sentido. Quando o total em reais não
  cobre a cesta inteira, ele se anuncia como parcial ("de 2 ordens").

O modo claro é uma **porcelana neutra em quatro níveis** (`--fundo-sutil` < `--fundo` <
`--superficie-afundada` < `--superficie` < `--superficie-alta`), cada um com papel fixo: a página
afunda, o cartão sobe sobre ela, o campo afunda de novo dentro do cartão, e o branco puro fica
reservado ao que flutua. Cartão branco puro sobre fundo quase branco não cria hierarquia nenhuma —
a tela vira uma chapa só.

**A paleta mudou em 30/09/2026, a pedido da mesa:** o escuro, quase preto, era escuro demais. Ele
virou um grafite azulado médio, e o claro deixou o neutro morno por uma porcelana levemente fria —
"cara de CRM financeiro, para usar por horas sem cansar". As faixas de contraste continuaram as
mesmas (corpo ~8:1 no cartão, título entre 11 e 13:1, secundário acima de 5:1), medidas por WCAG. As
cores saturadas, os degradês e o texto quase branco que outro agente tinha aplicado ficaram de
fora: estão na branch `antigravity/operacional`, se um dia fizerem falta.

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
  `Cliente`. Nome de pessoa nunca entra na saída, mesmo quando digitado (`80000005 - Fulana`
  → `80000005`).
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
pelo gestor. A lista vem copiada do portal e `npm run fundos:update -- arquivo.txt` regenera o
módulo. Guardamos só nome, ticker e quantidade mínima: preço e disponibilidade mudam todo dia, e
guardá-los seria carregar dado vencido dentro de um sistema cuja regra é não inventar dado.

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
2. Quantidade nunca vira financeiro, financeiro nunca vira quantidade.
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
  `Qtd. Total`. A saída é outro formato, marcado a um clique.

A comporta (`gerar`, em `ui/saidas.js`) só aceita confirmação de bloqueio confirmável — ela não
depende de o botão estar escondido.

A **Auditoria por E-mail** — na tela, **E-mail em tabela**, que é como o operador a chama — é o
e-mail da ordem com a tabela do Lote Simples no corpo, copiada em HTML e em texto com TAB, os dois
de uma vez. Desde 28/09 a coluna de valor **acompanha a cesta**: só quantidade, `Qtd. Total`, igual
ao Lote Simples; só reais, `Financeiro` no lugar dela; mista, **duas tabelas** — a de financeiro
primeiro, a de quantidade depois, duas linhas em branco entre elas. Isso reverteu uma decisão
anterior de manter a tabela sem financeiro — o operador mudou de ideia com um pedido real na mão.
O Lote Simples em TSV, colado na planilha da XP, continua sem financeiro. "Tabela igual Excel", para o operador, é **grade
simples**: borda fina em todas as células e nada mais — sem cor, sem negrito, sem fonte declarada.
Ele cola no Outlook na web, que dá ao que chega sem fonte a fonte da mensagem; a primeira versão
declarava Aptos e pintava o cabeçalho de cinza, e foi recusada por destoar do resto do e-mail.

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
  - `format/formatadores.js` — escreve o e-mail e os dois TSVs
- `src/modulos/ordens/ui/` — render e edição. `preview.js` monta o cartão e aplica as edições; `saidas.js` decide
  entre mostrar a saída ou o bloqueio.
- `src/modulos/ordens/platform/` — adaptadores de browser (clipboard, histórico), isolados para o core não
  depender deles.
- `src/modulos/ordens/index.js` — só estado de tela, eventos e render. Nenhum julgamento de negócio mora aqui.

`validate/tickersB3.js` é **gerado**, com 1.624 tickers da B3 por classe. Ele existe para uma
coisa só: `KCNR11` é um ticker perfeitamente bem formado, e nenhuma regra de formato revela que
ele é `KNCR11` digitado errado. Só a comparação contra a lista revela.

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
continuam com os nomes do original, porque os dois apps dividem o mesmo banco enquanto a mesa migra.

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
build; sem elas vale o projeto atual (`ekughbuuvjoojgfgbqbz`). `src/dados/banco.js` cria o cliente do
`@supabase/supabase-js` sem sessão de login (o app não tem login, e o hash da URL é a rota das
abas) e com 15 s por requisição. O Realtime escuta as três tabelas e recarrega a visão com 300 ms
de espera (um salvamento gera vários eventos); o status aparece no topo: "ao vivo", "sem
atualização ao vivo", "sem conexão" ou "modo local".

Em 29/09/2026 o projeto Supabase não resolvia no DNS (provavelmente pausado por inatividade no plano
gratuito), e o teste contra o banco real não foi feito. Retome o projeto no painel do Supabase antes
de distribuir o link.

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

`conteudo.js` é a cópia do Slab da equipe ("Gregori's Team"): a raiz **Mesa de Operações
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

Para ligar no banco da mesa: SQL Editor do Supabase → colar `supabase/operacional.sql` → executar.

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

---

## Testes

`npm test` (Vitest, ambiente node, fuso `America/Sao_Paulo`). São 650 testes; com as exportações
reais da XP fora de `fixtures/`, 18 goldens delas são pulados.

- Ordens: o core é testado direto; a UI não é. Os 449 testes do Ordens original continuam aqui.
- Renda Fixa: goldens contra o motor original, histórico, render (escape), SheetJS vendorizado.
- Calendário: contrato do repositório nos dois adaptadores, datas, configuração, render (escape).
- Operacional: a semente contra o Slab, o contrato do repositório nos dois adaptadores (inclusive o
  conflito de versão), render (escape, busca) e o SQL gerado em dia com a semente.
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
   `npx playwright install chromium`). Abre `dist/index.html` via `file://` e confere as quatro
   abas, os dois temas, a largura de ~360px sem rolagem horizontal, o console, o CSS que vaza entre
   abas, o texto do Renda Fixa colado e comparado com o golden, o Calendário em modo local (nome com
   `<img onerror>` como texto) e o Operacional em modo local (copiar e colar igual ao Slab, editar,
   criar, excluir, buscar e o conflito de duas abas). Não grava no banco.
3. Mudança no Calendário que toca o banco: `npm run verificar:supabase`
   (`scripts/verificar-supabase.mjs`) — leitura, gravação, exclusão em cascata, o Realtime entre
   duas abas e as quedas de rede, num colaborador de teste apagado no fim. **Grava no banco da
   mesa**: rode fora do expediente. Ainda não rodou contra o banco (ver o roadmap).

## Convenções

- JS puro com módulos ES, sem framework.
- Português nos nomes de domínio (`quantidade`, `financeiro`, `conta`, `colaborador`), inglês nos
  termos técnicos (`parse`, `format`, `validate`).
- Textos de interface, avisos e comentários em português.
- TSV usa TAB real (`\t`) e `\n`; nunca espaços alinhados nem markdown.
- Dados de exemplo e presets usam contas fictícias (`1234567`) e nunca dado de cliente real.
- Tudo em LF (`.gitattributes`): os goldens e os TSVs comparam texto com `\n`.

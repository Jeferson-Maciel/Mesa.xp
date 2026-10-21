# Fundos no secundário: cotação, robô, venda, Estoque clientes e o print

Parte da documentação da Mesa XP. O que vale sempre — dado de cliente, push, "nada é
adivinhado", as regras do robô, a verificação — e o mapa dos outros documentos estão no
[`CLAUDE.md`](../CLAUDE.md).

## Fundos no secundário

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
    para dormir pelo Chrome —, a Mesa abre outra em segundo plano. Desde a 1.7.0, só se o pedido ainda
    estiver esperando: até a 1.6.0, um pedido atendido em menos de 3 s, seguido de outro, abria uma aba
    à toa (a marca já era a do outro), e numa colagem com várias contas as abas 🤖 se acumulavam. Uma aba viva avisa em menos de
    1 s; ocupada desenhando a Prateleira, levou até 3 s, e por isso não é menos. Se a última que
    abriu nunca deu sinal (Hub deslogado), espera um minuto antes de abrir mais uma;
  - uma tarefa por vez, numa fila. Desde a 1.7.1, uma tarefa segura a fila por no máximo 3 minutos,
    e a foto do print tem 30 s: uma foto que não terminava (aba escondida há muito tempo, com os
    relógios segurados pelo Chrome) prendia a fila da aba, e nem a cotação andava mais;
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
  lê do pre-check `id`, `quotaValue` e `quotaDate` do fundo e, desde a 1.4.0, os estoques dele
  (`fund.stock`: as travas e os números de cada modalidade, só número e verdadeiro/falso) e, só na
  boleta de **venda** (`#/secundario/vender/<fundo>/<conta>`), a posição do cliente naquele fundo
  (`quotaQuantity`, `quotaQuantityAvailable`, `quotaQuantityOnSale` — o saldo, o preço médio e o
  resto da posição não saem do Hub). A posição passa pelo Tampermonkey e é apagada assim que a Mesa
  a recebe; o `verificar` confere. Da boleta que a pessoa abre, só o preço. A conta usada é a do
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
  Renda+, segundo o aviso da boleta) não vem na resposta.
- O que está acima vale para a **compra de fundo da prateleira pelo Estoque XP**, reconhecido pelo
  nome ou pelo ticker (`VGPR11`, `XPHF11`). A compra pelo Estoque clientes e a venda estão logo
  abaixo.

## Venda de fundo e Estoque clientes

Decidido com o operador em 20/10/2026, com um pedido real que misturava bolsa, fundos comprados e
fundos vendidos, e o e-mail de auditoria de venda que o cliente aprovou na mão. Código em
`core/secundario/{boletaDoHub,venda,secundario}.js` e `core/format/grupos.js`.

- **As duas modalidades do secundário**, vistas no Hub de verdade em 20/10 (compra do IMOV11 e venda
  de um FIP): **Estoque XP** (`treasury`, a operação é contra a posição da própria XP) e **Estoque
  clientes** (`peerToPeer`, uma *intenção de ordem* que a Mesa de Fundos casa por ordem de chegada;
  o que não casar até as 14:00 é cancelado, e o preço pode variar até 2%, com um "preço limite de
  aceite"). A boleta de compra (`#/secundario/comprar/<fundo>/<conta>`) e a de venda
  (`#/secundario/vender/<fundo>/<conta>`) chamam o mesmo `order-secondary/pre-check`, que traz em
  `fund.stock` as duas modalidades, cada uma com `buy` e `sell` (deságio, corretagem, PU, cotas
  disponíveis na compra) e as travas `canOperateBuyTreasury`, `canOperateBuyPeerToPeer`,
  `canOperateSellTreasury`, `canOperateSellPeerToPeer`. **As travas mudam por fundo e por dia**: no
  IMOV11 de 20/10 a XP não comprava, e o Estoque clientes não tinha cotas para vender. A captura da
  Prateleira também traz o Estoque clientes (`canBuyPeerToPeer`, `peerToPeerBuyDiscount` — o deságio
  do Estoque XP mais 0,15 —, `peerToPeerBuyCommissionFee`, `stockOfPeerToPeerQuotas`).
- **"Estoque cliente" no pedido** (`(Estoque cliente)`, "estoque clientes", "P2P") compra ou vende no
  Estoque clientes; sem nada escrito, vale o **Estoque XP**. "O que for possível" compra o que houver
  no estoque, até o valor.
- **Compra pelo Estoque clientes:** o deságio e a corretagem dele, **sem ROA** (não há barra) e
  **sempre no pior preço** — o PU mais alto do arredondamento e mais os 2% que o preço pode subir —,
  para as cotas nunca passarem do valor pedido. Vale a boleta lida pelo robô há até 10 minutos; sem
  ela, o estoque da Prateleira, com um bloqueio confirmável e o conserto **Cotar na boleta**.
  Estoque fechado ou vazio bloqueia com **Comprar no Estoque XP**; estoque menor que o pedido, com
  **Comprar o que houver (N)** e **Comprar no Estoque XP**. Um aviso lembra que é intenção, cancelada
  às 14:00 se não casar. Um cenário só, e um botão de copiar só.
- **Venda:** a quantidade do "Total" é a **disponível** da posição do cliente, com todas as casas; a
  escrita é conferida contra ela (acima dela bloqueia, com **Vender o total**); sem a posição lida,
  a escrita se confirma, e o total não sai (digite a quantidade). A modalidade pedida fechada no dia
  bloqueia e oferece a outra (**Vender no Estoque clientes** / **Vender no Estoque XP**): a decisão é
  do operador, porque o preço muda e o Estoque clientes pode não executar. Venda em R$ não é tratada.
  Cotas já à venda viram aviso. **Com todas à venda** — no Hub de verdade, uma venda em aberto põe a
  posição inteira à venda, e o disponível fica zero; a boleta não faz conta com zero —, a venda do
  total bloqueia sem confirmar (`venda-sem-disponivel`); até 20/10 o e-mail saía com 0 cotas. A conta do valor (`contaDaVenda`) é a do painel "Visualizar mais
  detalhes da operação" da boleta, conferida centavo por centavo (posição = cotas × PU; deságio = %
  da posição; o cliente recebe a posição com deságio, menos a corretagem).
- **A cotação de venda vale um dia útil** (`src/comum/diasUteis.js`, com a Páscoa calculada e os dias
  sem pregão de 24/12 e 31/12): até o mesmo horário do próximo dia útil. O print dela também.
- **O print da cotação** (robô 1.5.0, decidido com o operador em 20/10: "o máximo automatizado"). É
  o painel do fim da **etapa 1** da boleta de venda — a caixa "Valor total da operação" e
  "Visualizar mais detalhes da operação" aberto —, o mesmo que vai nos e-mails de auditoria aprovados.
  Ele só existe com a quantidade preenchida, e por isso, **só para o print**, o robô:
  - preenche a quantidade: clica em "Total de cotas" na venda do total, ou põe a quantidade do pedido
    no campo (máscara de 8 casas, os dígitos entram pela direita: 590 cotas são `59000000000`);
  - abre "Visualizar mais detalhes da operação";
  - confere que a quantidade do painel é a esperada (a pedida, ou a posição disponível) — sem isso,
    não há print (`quantidade-diferente`);
  - tira o print do painel, recortado da caixa do total ao último valor do detalhe, com a SnapDOM;
  - apaga o campo e volta à Prateleira.
  Os cliques ficam numa lista fechada (`CLIQUES_PERMITIDOS`, conferida por teste): **nunca Próximo**,
  nem a caixa de notificação ao cliente. A Mesa tira os prints que faltam na hora de copiar ou de abrir
  no Outlook o e-mail de venda ("atualizado em tempo real", pedido do operador), ou no botão **Tirar
  prints** da venda; cada um vale um dia útil, preso à conta, ao fundo e à quantidade — se a posição
  mudar, o print velho não serve —, e fica **só na memória da página**. A miniatura aparece na venda.
  Sem o robô, o e-mail sai sem o print, com um aviso para colá-lo abaixo de "Condições:"; sem o robô
  da versão certa, o motivo aparece em vermelho na hora de copiar ou abrir no Outlook. O print que
  falha deixa o motivo no cartão, ao lado da venda, e o aviso do Outlook diz que ele faltou. Os passos
  do print foram repetidos à mão numa boleta de venda de verdade em 20/10 (o campo, o "Total de cotas",
  que preenche o **disponível**, a conta, o detalhe, a quantidade do painel e o recorte): todos
  funcionam. A foto (a SnapDOM) não pôde ser testada lá.
- **O corpo no Outlook** (robô 1.5.0, @match no Outlook na web): a janela abre no clique, com o texto
  — senão o navegador a bloqueia como pop-up —, e o robô, **só no compor que a Mesa acabou de abrir**
  (`/deeplink/compose`, pedido de menos de 2 minutos, corpo começando pelo texto que a Mesa mandou),
  troca o corpo pelo HTML como se fosse colado: os prints abaixo de "Condições:" na venda, a tabela em
  grade no E-mail em tabela. A Mesa reserva o e-mail antes de abrir e manda o HTML depois, com o mesmo
  id (`reservarOutlook`); se o print falhar, cancela, e o corpo de texto fica. **Nunca envia** nem
  clica em nada. Sem resposta, a Mesa avisa para usar o Copiar e colar com Ctrl+V.
- **A posição do cliente fica só na memória da página** (`estado.boletas`), como o cliente; nunca no
  `localStorage`, no histórico ou no repositório.
- **Os grupos de e-mail.** Cada conta sai em até cinco e-mails, um por grupo, cada um numa seção do
  cartão com o que é dele: **Bolsa** (ações, FIIs listados, ETFs, BDRs; compra e venda juntas, no
  modelo de sempre), **Fundos · Compra** (o modelo de sempre, com as cotas) e **Fundos · Venda** (o
  modelo da auditoria de venda, em `docs/FORMATOS-DE-SAIDA.md`). O quarto e o quinto são o
  **Tesouro · Aplicação** e o **Tesouro · Resgate** (ver "Tesouro Direto" em [`tesouro.md`](tesouro.md)), cada um com o assunto dele. O E-mail em tabela, o Lote Simples e o TWAP são só de bolsa — com os fundos escritos pelo ticker,
  que seguem com o bloqueio confirmável de sempre. Um grupo é a própria solicitação com só as ordens
  dele (`recorte`): o validador e os formatadores não mudaram de contrato. A confirmação de um
  bloqueio vale para o grupo em que foi dada (`grupo:codigo`).

## SnapDOM vendorizada (o print do robô)

`src/vendor/snapdom.js` é a SnapDOM **3.2.0** do npm (`@zumer/snapdom`, MIT, o build IIFE), byte a
byte — o pacote bateu com o shasum do registro, e um teste confere o sha256 —, com
`LICENSE-snapdom.txt`. Ela tira o print da boleta, que é feita de web components (Soma) com shadow
DOM: o html-to-image não copia shadow DOM, a SnapDOM copia. **Não vai para a Mesa**: entra só no
script do robô, no marcador `/*@@SNAPDOM@@*/`, quando `roboHub.js` monta o "Copiar robô"
(`scriptDoRobo`), e só é carregada na aba do robô, no primeiro print. Os testes de segurança do robô
(sem token, senha, cabeçalho, `fetch` nem API do Hub) leem o código dele sem a biblioteca
(`fonteDoRobo`), e outro confere que o script copiado é o robô com a biblioteca no marcador, e nada
mais. Injetar a biblioteca do CDN no Hub pelo Claude in Chrome foi bloqueado pelo modo automático do
Claude Code, com razão: no robô ela vai embutida, sem buscar nada fora.

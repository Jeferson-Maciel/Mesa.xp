# Ordens

Parte da documentação da Mesa XP. O que vale sempre — dado de cliente, push, "nada é
adivinhado", as regras do robô, a verificação — e o mapa dos outros documentos estão no
[`CLAUDE.md`](../CLAUDE.md).

Transforma solicitações de clientes em texto livre nos 4 formatos de saída padronizados do back
office: **Ordem por E-mail**, **Auditoria por E-mail**, **Lote Simples (TSV)** e **Lote TWAP
(TSV)**. O usuário cola a solicitação como recebeu (texto, print transcrito, tabela de posições) e
copia a saída pronta. Código em `src/modulos/ordens/`.

## A regra que domina todas as outras

**Nada é adivinhado.** O sistema só emite o que foi informado. Quando falta dado crítico, ou quando
há ambiguidade, a saída é **bloqueada** e o que falta é exibido — jamais preenchido por inferência,
arredondamento ou "melhor esforço". Um número errado numa ordem de renda variável é dinheiro real
do cliente; uma saída ausente é só um clique a mais.

Ao mexer em parser, validators ou formatters, o teste mental é sempre: *este valor veio do texto do
usuário, ou eu o inventei?*

## Vocabulário do domínio

Use estes termos no código, nos testes e nas conversas — eles são os mesmos que o usuário usa.

- **Conta** — código numérico da conta XP (5 a 8 dígitos). É o único valor aceito na coluna/campo
  `Cliente`. Nome digitado nunca entra na saída (`80000005 - Fulana` → `80000005`); o nome da
  ficha do Hub entra só na saudação do e-mail (ver "O cliente e o assessor").
- **Quantidade** — número inteiro de ativos. Sem separador de milhar, sem `R$`. Na venda de fundo do
  secundário a cota é fracionada, com até 8 casas (`123,45678910`, como o campo da boleta do Hub);
  ver "Venda de fundo e Estoque clientes" em [`secundario.md`](secundario.md).
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

## Fora de escopo

O escritório já trata estes casos à mão, e automatizá-los exigiria justamente a adivinhação que o
projeto existe para evitar. O sistema os reconhece e os **descarta com o motivo à vista**:

- **Ordem sem quantidade nem financeiro** — `V - HGCR11 (Total)`, onde "Total" é a única indicação
  de tamanho. Não há número a preservar, então não há ordem a gerar. A exceção, desde 20/10/2026, é
  a **venda do total de fundo do secundário**: a quantidade é a posição disponível do cliente, que o
  robô lê na boleta de venda do Hub (ver "Venda de fundo e Estoque clientes" em [`secundario.md`](secundario.md)). Papel de bolsa
  continua descartado, com o motivo. O resgate do total no Tesouro Direto também vira ordem: o valor
  é o disponível da posição do cliente, lida pelo robô (ver "Tesouro Direto" em [`tesouro.md`](tesouro.md)).
- **Push** — é canal do Hub da XP, alheio ao fluxo de e-mail e lote.
- **Observações entre parênteses** coladas ao valor ("R$ 34.800(não ultrapassar esse valor)"): o
  valor é lido, a observação não é reproduzida.

## Fundos cetipados

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
do Hub (ver "Fundos no secundário" em [`secundario.md`](secundario.md)); a listagem copiada do portal, num `.txt`, também serve — a
página inteira, inclusive, que o menu e os "Destaques" do topo são pulados. Em 06/10/2026 a lista
passou a 150 fundos, 32 com ticker. Guardamos só nome, ticker e aplicação mínima: preço e
disponibilidade mudam todo dia, e guardá-los seria carregar dado vencido dentro de um sistema cuja
regra é não inventar dado.

**A prateleira do dia entra no catálogo** (21/10/2026, `juntarPrateleira`): a captura do robô ou do
favorito, ou a planilha, soma os fundos dela à lista gerada. Fundo novo na prateleira é reconhecido
pelo nome sem esperar o `fundos:update`; antes, a lista gerada envelhecia calada, e todo fundo lançado
depois dela virava "nome que não é fundo da prateleira". **Somar, e não trocar**: o fundo que saiu da
prateleira continua na lista (o pedido pode ser de venda), e um nome que cabe em dois continua sem
escolha automática — se o "XP Habitat … Feeder" saísse da prateleira e só o "II" ficasse, a
prateleira sozinha escolheria o "II" calada.

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

## O cliente e o assessor (robô 1.3.0)

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
- **O nome na saudação** (`nomeDoHub`): **como o Hub o manda, em maiúsculas**, só sem os espaços a
  mais (decidido com o operador em 20/10/2026, pelo e-mail de auditoria que o cliente aprovou; de
  07/10 a 20/10 a Mesa o reescrevia com as iniciais maiúsculas). O acento que o Hub não mandou não é
  posto. Vale para todos os e-mails e para o Copiar — o que se vê é o que vai. É a exceção à regra de
  nome nunca entrar na saída: o nome digitado no pedido continua fora; o da ficha do Hub entra na
  saudação, e só nela.
- **A linha do cliente no cartão**, logo abaixo da conta, é também conferência: um dígito trocado
  na conta mostra outro nome. O cliente é refeito a cada render pela conta do campo — **o nome de
  um cliente nunca fica no e-mail de outra conta**: enquanto a conta é editada, a saudação volta a
  "Cliente", e o robô busca a conta nova ao sair do campo. Uma conta por vez, numa fila; a que já
  veio na página não é pedida de novo.

## A entrada real

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

**A conta do pedido seguinte colada no fim da linha.** Num pedido real de 20/10/2026, a quebra de
linha se perdeu na colagem: "LFT - R$ 81.708,17   <conta>" juntou a ordem de um cliente com a conta
do pedido de outro (o operador confirmou que o número era a conta). Lido assim, o que vinha abaixo
("Comprar 2k / Tesouro Selic 2031") ficava na conta do primeiro, e o bloqueio de número solto, se
confirmado como ruído, mandava o pedido de um cliente na conta de outro. Por isso um número de 5 a 8
dígitos no fim da linha, que sobrou depois de lidos o ativo e o valor, vira o bloqueio
`conta-no-fim-da-linha`, **sem confirmar**, com dois botões: **Separar: <conta> é outra conta** — a
quebra de linha volta ao texto colado (`core/texto/separarConta.js`) e o pedido é lido de novo — e
**Não é conta: ignorar**. A separação não é automática: a conta é o dado mais caro do sistema.

O valor às vezes vem **na linha de baixo** do ativo (`Riza Malls` / `R$ 16.000,00`), sobretudo em
fundo cetipado, cujo nome já ocupa a linha. `casarValores` liga cada valor sozinho ao ativo logo
acima, se ele não trouxe valor próprio. Um valor sem ativo logo acima **cancela o casamento do
bloco inteiro** e tudo vai para os descartes: é o sinal de que o valor pode vir *acima* do nome, e
casar de cima para baixo daria a cada fundo o valor do vizinho — erro que conferência nenhuma pega.

## Invariantes

Cada uma vale um teste. Violá-las é um bug de negócio, não de estilo.

1. `Cliente` é sempre a conta numérica.
2. Quantidade nunca vira financeiro, financeiro nunca vira quantidade. Exceção única: compra de
   fundo no secundário, convertida pela planilha do dia (ver "Fundos no secundário" em [`secundario.md`](secundario.md)). A venda do
   total de fundo do secundário não converte nada: a quantidade é a posição lida na boleta. O resgate
   do total no Tesouro também não: o valor é o disponível, em reais, lido na posição.
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
um e-mail novo no Outlook na web, com o assunto **Confirmação de ordem** (`src/comum/outlook.js`) e,
com o robô e a planilha dos assessores, o cliente no Para e o assessor em cópia (ver "O cliente e o
assessor"). É o endereço de compor do Outlook na web, não um `mailto:` solto: este abriria o programa
de e-mail padrão do Windows, e o operador usa o Outlook na web. Conferido no Outlook da mesa em 07/10:

- **O `cc` solto no endereço é ignorado** — Para, assunto e texto entram, a cópia não. Com o cliente,
  tudo vai num `mailto:` inteiro dentro do `to` (`compose?to=mailto%3A…%3Fcc%3D…`), como o Chrome e
  o Edge entregam os links de e-mail ao Outlook na web; aí a cópia entra. Sem o e-mail do cliente,
  vai o endereço simples, só com assunto e texto.
- As quebras de linha (`\r\n`) chegam.
- **O endereço é `outlook.cloud.microsoft`**, o novo do Microsoft 365. A Microsoft está mudando as
  contas de `outlook.office.com` para ele aos poucos; na conta que já mudou, o endereço antigo
  redireciona e perde o pedido de compor — abre a caixa de entrada vazia (um colega, em 07/10). O
  novo funcionou nas duas contas (a que já mudou e a que não). Não é coisa do navegador.
- **Abre numa janela só do e-mail** (`popup`, 980×860, no meio da Mesa), uma por clique, como o
  "abrir em nova janela" do Outlook. A página não consegue usar a aba do Outlook que a pessoa já tem
  aberta: o navegador só deixa reaproveitar uma janela aberta pela própria página.

O texto vai no endereço e a área de transferência não é tocada, porque ela pode estar guardando algo
que a pessoa vai colar. O endereço só leva texto puro, e a tabela não vai nele em grade: o E-mail em
tabela vai com o texto dele, o mesmo do Copiar, com TAB entre as colunas (decidido com o operador em
09/10/2026, sabendo que as colunas chegam desalinhadas). Até então ele abria sem o corpo e ia
copiado para colar com Ctrl+V, e o operador achava que o e-mail chegava vazio. Em grade, só pelo
Copiar. O texto acima de 7.000 caracteres codificados abre sem o corpo e vai copiado — a tabela em
grade, inclusive. Abrir conta no histórico como copiar.

Os textos e cabeçalhos exatos das 4 saídas estão em [`docs/FORMATOS-DE-SAIDA.md`](FORMATOS-DE-SAIDA.md).
Leia esse arquivo antes de alterar qualquer formatter ou template — ele é a fonte da verdade dos
literais, e um caractere fora do lugar quebra a colagem no Excel ou o padrão do e-mail.

## Arquitetura

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

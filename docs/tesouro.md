# Tesouro Direto

Parte da documentação da Mesa XP. O que vale sempre — dado de cliente, push, "nada é
adivinhado", as regras do robô, a verificação — e o mapa dos outros documentos estão no
[`CLAUDE.md`](../CLAUDE.md).

## Tesouro Direto (robôs 1.6.0 e 1.7.0)

Decidido com o operador em 20/10/2026, com os dois modelos de e-mail dele (aplicação e resgate), um
pedido real e as páginas do Tesouro vistas no Hub de verdade. Código em `core/tesouro/tesouro.js`,
`ui/tesouro.js` e os grupos de e-mail `tesouro` e `tesouro-resgate`.

- **O pedido.** O assessor escreve "Tesouro Selic 2031", "LFT", "Selic 2031 - 2k", "Pré 2029",
  "LTN 2032", "IPCA+ 2045 juros semestrais", "NTN-B 2045", "Renda+ 2065", "Educa+ 2030", "Tesouro
  Direto Selic"; o valor às vezes vem na linha de cima ("Comprar 2k" / "Tesouro Selic 2031"). É de
  Tesouro a linha que diz "Tesouro", um código (LFT, LTN, NTN-B, NTN-B1, NTN-F) ou um tipo com o ano —
  **se não for um fundo da prateleira**: há fundos com "Prefixado", "Pré" e "Renda+" no nome. O ano e o
  nome do título saem da linha antes de ler o valor (`semOTitulo`), senão o 2031 vira quantidade.
- **O valor na linha de cima** só casa com o ativo de baixo quando é o único jeito de ler o bloco: todo
  valor solto tem um ativo sem valor logo abaixo, e nenhum tem um logo acima (`casarValores`). Se as
  duas leituras são possíveis, nada casa, como sempre.
- **A lista do Hub** (`/new/renda-fixa/#/produtos/tesouro-direto`) só aparece com um cliente escolhido
  na página, e o cliente não vai no endereço — fica guardado nela. Vem de
  `rede-treasury/v1/customers/<conta>/available-assets` (`data.items[]`: `codeBonds`,
  `descTypeBond`, `nickname`, `expirateDate`, `profitability` já como o Hub mostra — "SELIC + 0,0992
  %" —, `buyValue`, `minimumInvestmentValue`). Uma conta não habilitada responde com erro ("já existe
  outra conta XP Inc atrelada ao CPF"). **A taxa muda ao longo do dia** (o Prefixado 2029 foi de
  12,58% a 12,63% em minutos): o robô a lê ao colar e de novo na hora de gerar, se tiver mais de 2
  minutos; passados 10, o e-mail segura com "Atualizar a taxa" (confirmável).
- **Na Fila do dia** (21/10/2026), o e-mail do Tesouro entra como os outros; cada título mostra o
  título do Hub, o valor aprovado, o vencimento e a taxa do e-mail, e o botão **Tesouro do cliente**
  (ou **Posição no Tesouro**, no resgate) faz o robô (1.10.0) abrir o Tesouro Direto numa aba à vista,
  já com o cliente da conta escolhido. Detalhe em `docs/fila.md`.
- **O robô** tem uma aba só dele no Renda Fixa ("🤖 Tesouro"). Se o Hub não mandar a lista da conta
  pedida ao entrar na tela, ele **digita a conta no "Pesquisar cliente" e clica só no resultado "Conta
  XP: <conta>"** (liberado pelo operador, T5); em Posições, clica também na aba "Tesouro Direto". Nada
  mais. Entrega só os dados dos títulos, que são públicos, ou o erro do Hub.
- **Como o Hub de verdade se comporta** (testado em 20/10/2026 com o Claude in Chrome, só leitura,
  repetindo os passos do robô), e por isso a 1.7.0 refez a leitura da 1.6.0, que nunca tinha rodado no
  Hub de verdade:
  - **o Hub pede a lista, e a posição, de um cliente uma vez só por carga da página.** Ir e voltar de
    tela, escolher o mesmo cliente de novo, "Atualizar" ou "Limpar valor" e escolher de novo: nada o
    faz pedir outra vez. Na 1.6.0, a segunda leitura da taxa ("na hora", depois de 2 minutos)
    esperaria 25 s e falharia. **A 1.7.0 recarrega a aba** quando aquela carga da página já leu a conta
    pedida (`lidasNaPagina`), e a página nova retoma o pedido (`recarregouTesouro`), sem a Mesa abrir
    outra aba;
  - o cliente escolhido vale para Produtos e Posições, e **continua escolhido depois de recarregar**: a
    página nova pede de novo, sozinha, a lista dele;
  - **o resultado da busca ignora o clique que chega cedo demais** (1,3 s depois de aparecer, o clique
    não fez nada; 1,5 s depois, escolheu): o robô espera 1,5 s e clica de novo enquanto a lista de
    resultados não fecha, até 3 vezes. O campo e o resultado (`SOMA-CAPTION-V4` dentro de
    `SOMA-MENU-ITEM`) foram achados do jeito que o robô procura;
  - **Posições abre na aba Renda Fixa** e desfaz a troca de rota feita na carga; a posição do Tesouro é
    pedida no clique da aba "Tesouro Direto" (`SOMA-TAB`), por XHR.
- **O título**: o do tipo e do ano pedidos; sem o ano, o único daquele tipo na lista, com aviso
  (decisão do operador, T4); com mais de um, o operador escolhe num botão por candidato; nenhum,
  bloqueia.
- **A aplicação vai por valor em R$** — o modelo pede "Valor a ser aplicado" e avisa que o PU e o
  valor final dependem da cotação —, e não é convertida em títulos. Por quantidade bloqueia; abaixo
  da aplicação mínima (1% do PU) bloqueia; fora do horário (dia útil, 9h30–18h) avisa.
- **O resgate** (robô 1.7.0) tem e-mail próprio, no modelo do operador ("Confirmação resgate Tesouro
  Direto": título, vencimento e "Valor a ser resgatado", sem taxa, e o fecho "atte,"), num quinto
  grupo, **Tesouro · Resgate**, separado da aplicação. O título e o vencimento vêm da **posição do
  cliente**, em Posições → Posição por cliente → Tesouro Direto (`#/posicoes/cliente/tesouro-direto`),
  de `rede-treasury/v1/customers/<conta>/positions` — uma lista solta, com `bondName`, `codeBonds`,
  `expirateDate`, `quantityBalance`, `blockedQuantity`, `sellPrice` e `grossValue` (o "Valor
  Disponível" da boleta de resgate). O robô traz só esses sete campos: o preço médio, o investido, o
  líquido e o imposto não saem do Hub.
- **O resgate vai por valor em R$, ou pelo total** ("resgate total", "resgatar tudo do Tesouro Selic
  2031", o botão Total), que é o valor disponível: a parte livre da posição (o saldo menos o
  bloqueado) a mercado. Por quantidade de títulos bloqueia; acima do disponível bloqueia, com
  **Resgatar o total**; abaixo de 0,01 título bloqueia; um título que o cliente não tem bloqueia. A
  posição é lida ao colar e de novo na hora de gerar, se tiver mais de 2 minutos (o valor a mercado
  muda com o PU); passados 10, segura com "Atualizar a posição" (confirmável). Sem a posição, o valor
  escrito se confirma e o e-mail sai com o vencimento em branco; o total, não.
- **"Tudo" é total só com o que diz de quê** ("tudo do", "tudo da") **ou com o verbo** ("vender
  tudo", "resgatar tudo"): sozinho, "Tudo via email" num cabeçalho venderia a posição de quem não
  pediu.
- A boleta de resgate (`#/posicoes/cliente/tesouro-direto/<codeBonds>`) avisa que o resgate "não
  poderá ser cancelado após seu envio". O robô **não a abre**.
- **Sem o robô**, a lista não vem: o bloqueio se confirma, e o e-mail sai com a taxa e o vencimento em
  branco, para preencher no Outlook — nada é inventado, e o operador não fica sem saída.
- A lista e a posição ficam só na memória da página (`estado.tesouro`, `estado.posicoesTesouro`),
  por conta, e saem do Tampermonkey assim que a Mesa as recebe.

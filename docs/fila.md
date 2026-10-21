# Fila do dia

Parte da documentação da Mesa XP. O que vale sempre — dado de cliente, push, "nada é
adivinhado", as regras do robô, a verificação — e o mapa dos outros documentos estão no
[`CLAUDE.md`](../CLAUDE.md).

A aba **Fila** (Alt+2, a pedra kunzita) é o caminho de cada pedido **depois que o e-mail sai**: o
cliente responde, aprova, a mesa executa. Pedida pelo usuário em 21/10/2026, junto com a ligação
com o Outlook ("quando o cliente responder ter um aviso no sistema e já vir formatado com as
informações que queremos para executar").

```
src/comum/fila/regras.js       as regras, puras: o cartão, os estados, os prazos, o repetido, a ficha, o resumo
src/comum/fila/repositorio.js  o IndexedDB (banco mesa_fila, loja pedidos, índice dia) e o em memória
src/comum/fila/eventos.js      "a Fila mudou", na página e entre abas do navegador (BroadcastChannel)
src/comum/horarios.js          os horários de mercado: o pregão, o Estoque clientes, o secundário, o Tesouro
src/comum/anotarDeFora.js      o "Anotar" que leva às Anotações com o pedido escrito
src/modulos/fila/              a aba: o quadro, a ficha de execução, o resumo do dia
```

As regras moram em `src/comum/` porque dois módulos as usam: o Ordens grava o cartão e confere o
pedido repetido; a aba Fila mostra e muda o estado.

## O cartão

- **Nasce quando um e-mail do Ordens sai** — copiado ou aberto no Outlook —, porque é o que de fato
  vai para o cliente. Colar e analisar não cria nada. Só os e-mails (o e-mail por grupo e o E-mail em
  tabela); os lotes são do back office.
- Guarda a conta, o cliente e o assessor (quando o robô os trouxe), o grupo do e-mail, as ordens como
  o e-mail as pediu, o texto do e-mail, o histórico dos estados e os prazos.
- **O mesmo pedido copiado de novo**, ainda à espera do cliente, atualiza o cartão (o e-mail refeito
  ou reenviado). O que já foi aprovado, executado ou cancelado é outro pedido.
- **Fica só neste navegador**, no IndexedDB, por 90 dias (o resto sai ao abrir a aba): tem o nome, o
  e-mail e a conta do cliente, e o banco da mesa ainda é aberto a quem tiver o link (a fase 2 de
  segurança). Sem IndexedDB (janela anônima), o erro aparece na aba; nada vai para outro lugar.

## Os estados

As colunas: **Aguardando o cliente** → **O cliente respondeu** → **Aprovado: executar** →
**Executado**. Cancelado sai do quadro (fica embaixo, com "Reabrir"). Os botões de cada cartão
andam uma casa; arrastar um cartão para outra coluna também muda o estado.

**Quem diz que o cliente aprovou é o operador.** "Ok, mas só metade" não é aprovação, e nada aqui é
adivinhado: a resposta do cliente (que o robô vê no Outlook) só passa o cartão para "O cliente
respondeu", com a prévia à vista.

## Os prazos

Vêm do que o pedido é, pelos horários de `src/comum/horarios.js` (conferidos em 21/10/2026):

| Pedido | Prazo |
| --- | --- |
| Bolsa | o leilão de encerramento da B3, 16h55 |
| Fundos, compra pelo Estoque clientes | a intenção casa até as 14h |
| Fundos, venda | a validade da cotação (o print, um dia útil) |
| Fundos | o secundário da XP opera até as 16h30 |
| Tesouro | até as 18h |

Depois da hora, o prazo é o do próximo dia útil. O prazo a uma hora ou menos fica **âmbar**; o que
passou, **vermelho**. O cartão com prazo perto, ou com a resposta do cliente, **pede atenção**: o
contador da aba Fila mostra quantos, em qualquer aba (como o das Anotações).

## O pedido repetido e a conta nova (no Ordens)

- **Repetido de hoje**: a ordem com a mesma conta, o mesmo ativo e a mesma operação de um pedido de
  hoje que não foi cancelado bloqueia, com o confirmar à vista — o grupo é corrido, e o mesmo pedido
  colado duas vezes é um erro fácil. Confirmar libera, e o e-mail vira **outro** cartão (não junta
  com o de antes). Os cartões que nasceram da mesma solicitação não contam: copiar duas vezes não
  bloqueia.
- **Conta nova**: a conta que nunca passou pela Fila nem pelo histórico deste navegador ganha um
  aviso para conferir o número. Só depois que o navegador conhece 15 contas: antes disso toda conta
  seria "nova", e o aviso que aparece sempre é o aviso que ninguém lê.

O `index.js` do Ordens anota `ordem.repetidoHoje` e `solicitacao.contaNova`; o validador os lê
(`repetido-hoje`, bloqueio confirmável; `conta-nova`, aviso).

## A ficha de execução, a boleta e o resumo

- **A ficha** (no aprovado): a conta e o cliente, o que fazer com cada ativo (comprar, vender, aplicar,
  resgatar; as cotas, o valor ou "o total da posição"; Estoque XP ou clientes; o preço na bolsa) e o
  prazo que vale. Sai do que o e-mail aprovado pediu: nada é refeito nem recalculado.
- **A boleta do Hub**: o link pela rota do próprio Hub, com a conta no caminho como o Hub a escreve —
  nunca num parâmetro. Só para o fundo do secundário (com o id do fundo) e o Tesouro; a bolsa não tem.
- **O resumo do dia** (copiado): quantos em cada estado e o que ficou pendente, conta a conta.
- **Anotar**: abre uma anotação nova com o pedido escrito. O pedido passa pela memória da página
  (`anotarDeFora.js`), nunca pelo endereço, que iria para o histórico do navegador com a conta.

## As respostas no Outlook (robô 1.8.0)

A pergunta do usuário em 21/10/2026: "linkar o Outlook para quando o cliente responder ter um aviso no
sistema". Sem login nem API da Microsoft (o Graph pediria registrar um app no Azure da XP): o robô lê
a **lista** da caixa de entrada do Outlook na web, numa aba que a pessoa deixa aberta no mesmo Chrome.
O que ele lê e não lê está nas regras do robô, em [`secundario.md`](secundario.md).

```
src/comum/fila/respostas.js    o que é resposta a pedido, e o cartão de cada resposta (puro, testado)
src/modulos/fila/vigiaOutlook.js  o vigia, do lado da Mesa: pede ao robô, casa, grava, avisa
```

- **Quando olha**: o vigia começa com a página. A cada minuto, e a cada mudança na Fila, se há cartão
  aguardando o cliente ou respondido (de hoje, ou aberto dos últimos 7 dias), pede ao robô que olhe a
  caixa de entrada pelos próximos 3 minutos. O robô olha quando a lista muda (no máximo a cada 2 s) e
  manda tudo de novo a cada minuto.
- **O e-mail do cliente casa sozinho.** A resposta do endereço do cliente de um cartão (o e-mail que o
  robô trouxe da ficha do Hub) vai para ele, e o cartão passa para "O cliente respondeu", com a prévia
  e um aviso na tela ("Ver na Fila"). Com mais de um cartão do mesmo cliente vale o que ainda espera a
  resposta, e depois o do mesmo assunto (o resgate do Tesouro não é o e-mail da bolsa).
- **O resto fica "a conferir"**, no alto da Fila: a resposta ambígua (dois cartões esperando, com o
  mesmo assunto), a achada só pelo nome (o cliente respondeu de outro endereço: todas as partes do
  nome de quem respondeu, duas ou mais, estão no nome do cliente) e a que não casou com nada. Cada uma
  com um botão por cartão candidato e "Não é de pedido" (que a esconde até o fim do dia; o id fica no
  `localStorage`, e é um resumo, sem nome).
- **A conversa com mensagem nova** (o cliente escreve de novo, "só metade") troca a prévia do cartão.
- **A resposta não aprova nada.** Quem lê "de acordo" e clica em "Aprovou" é o operador.
- **No alto da Fila**, o selo do Outlook: verde "vendo as respostas", com a hora da última olhada;
  âmbar "abra a caixa de entrada" (nenhuma lista vista há 2,5 minutos) ou "atualize o robô"; neutro
  "nada esperando resposta" ou "sem o robô".
- **Os cartões abertos de outros dias** aparecem na Fila de hoje, com a data em âmbar: o e-mail das
  17h tem resposta na manhã seguinte.

**O que o Outlook de verdade pode mudar**: a lista do Outlook na web foi lida pelo que ele expõe aos
leitores de tela — a lista (`role="listbox"`), cada mensagem uma opção (`role="option"`), o e-mail
no `title` do remetente, a hora nas de hoje. Só o Outlook de mentira do `verificar` foi testado; o
de verdade está em "A testar" no [`CONTEXTO.md`](CONTEXTO.md). Se o selo ficar em "abra a caixa de
entrada" com ela aberta, é a lista que mudou de forma.

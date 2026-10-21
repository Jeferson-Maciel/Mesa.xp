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

## O que vem a seguir

A resposta do cliente no Outlook, pelo robô (a leitura só da lista da caixa de entrada: remetente,
assunto, prévia e hora), está em [`ROADMAP.md`](ROADMAP.md) até sair.

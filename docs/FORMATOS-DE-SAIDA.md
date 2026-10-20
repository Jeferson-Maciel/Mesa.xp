# Formatos de saída

Fonte da verdade dos literais das 4 saídas. Os formatters em `src/modulos/ordens/core/format/` devem
reproduzir exatamente o que está aqui — pontuação, ponto-e-vírgula, acento, ordem das colunas.

Os cabeçalhos TSV estão escritos como **string literal JavaScript** para que o separador seja
inequívoco: `\t` é um caractere TAB real, `\n` uma quebra de linha. Nada de espaços de alinhamento.

---

## 1. Ordem por E-mail

```
Prezado(a) Cliente,

Conforme conversado, gostaria de realizar a[s] ordem[ns] abaixo na conta XP [CONTA]:

Ativo: [TICKER];
Quantidade: [QUANTIDADE];
Preço: [PREÇO]
Operação: [Compra|Venda]

Observações importantes: Toda solicitação lançada no sistema antes do leilão de encerramento sofrerá tentativa de processamento no mesmo dia. Toda solicitação lançada após o leilão de encerramento sofrerá tentativa de processamento no próximo dia útil.

Aguardo confirmação para realizar a[s] ordem[ns].

Att,
```

- **Saudação com o nome do cliente** (decidido com o operador em 07/10/2026): quando o robô trouxe
  o cliente da ficha do Hub, a primeira linha é `Prezado(a) [NOME COMPLETO],`, **em maiúsculas,
  como o Hub manda** (`Prezado(a) ANA PAULA DA SILVA,` — decidido em 20/10/2026, pelo e-mail de
  auditoria aprovado; até ali a Mesa o reescrevia como `Ana Paula da Silva`). Sem o cliente,
  `Prezado(a) Cliente,`. Vale para todos os e-mails. O nome digitado no pedido nunca entra.
- **Um e-mail por grupo** (20/10/2026): numa conta com bolsa e fundos, o formato 1 sai em até três
  e-mails — **Bolsa** e **Fundos · Compra** neste modelo, cada um só com as ordens dele, e
  **Fundos · Venda** no modelo da seção 1b.
- **Pluralização**: com um ativo, `a ordem abaixo` / `realizar a ordem.`; com dois ou mais,
  `as ordens abaixo` / `realizar as ordens.`
- **Bloco do ativo**: os quatro campos ficam em linhas consecutivas, **sem linha em branco entre
  eles**. Entre um ativo e o próximo há uma linha em branco.
- **Quantidade ou Valor, nunca os dois**: numa ordem por financeiro, a segunda linha é
  `Valor: R$ [VALOR];` em lugar de `Quantidade: [QUANTIDADE];`.
- `Preço` e `Operação` não levam ponto-e-vírgula; `Ativo` e `Quantidade`/`Valor` levam.
- **Fundo cetipado comprado no secundário** (decidido com o operador em 05/10/2026): o pedido em R$
  vira cotas pelos fundos do dia, e o bloco leva `Quantidade: [COTAS];` no lugar de `Valor:` —
  inteiro, sem separador de milhar, como na bolsa. Sem os fundos carregados, ou com o fundo fora
  deles, o operador confirma e o bloco sai com `Valor: R$ X.XXX,XX;`, como antes.
- As cotas dependem do ROA adicional, e o e-mail de um pedido em R$ tem **dois botões de copiar**
  (06/10/2026): **Copiar · ROA máximo** e **Copiar · ROA zerado**. O texto é o mesmo; muda só o
  número de `Quantidade:` de cada fundo.

  ```
  Ativo: Riza Terrax Vintage FIAgro RL;
  Quantidade: 162;
  Preço: A mercado
  Operação: Compra
  ```

## 1b. Auditoria de venda de fundo do secundário (o e-mail "Fundos · Venda")

O modelo que o operador trouxe em 20/10/2026 e que o cliente aprova; o Abrir no Outlook usa o mesmo
assunto, **Confirmação de ordem**.

```
Prezado(a) [NOME],
Conforme conversado, gostaria de realizar a[s] ordem[ns] abaixo na conta XP [CONTA], conforme condições abaixo:

Ativo: [ATIVO];
Quantidade: [QUANTIDADE];
Operação: Venda;

Condições:
[PRINT DA COTAÇÃO]

Ativo: [ATIVO];
…
Condições:
[PRINT DA COTAÇÃO]

atte,
```

- **Sem linha em branco** entre a saudação e a abertura; **sem** `Preço`, sem as observações do
  leilão e sem "Aguardo confirmação". `Operação: Venda;` **com** ponto-e-vírgula. O fecho é `atte,`.
- **Plural** como nos outros e-mails: `a ordem abaixo` com um fundo, `as ordens abaixo` com dois ou
  mais.
- **Um bloco por fundo**, na ordem digitada, cada um seguido de `Condições:` e do print da cotação
  dele. No texto (o Copiar e o Abrir no Outlook) a linha depois de `Condições:` fica vazia; o print
  entra no HTML, logo abaixo de `Condições:`: `<img>` com o PNG que o robô tirou do painel "Visualizar
  mais detalhes da operação" da boleta de venda (robô 1.5.0). É esse HTML que o Copiar leva e que o
  robô põe no Outlook.
- **A quantidade**: inteira sem separador de milhar (`5125`); fracionada com as 8 casas do campo de
  quantidade da boleta (`123,45678910`). Na venda do total, é a posição disponível do cliente que o
  robô leu na boleta de venda do Hub.

  ```
  Ativo: Riza Malls Feeder FII RL;
  Quantidade: 123,45678910;
  Operação: Venda;

  Condições:
  ```

## 1c. Aplicação no Tesouro Direto (o e-mail "Tesouro Direto")

O modelo que o operador trouxe em 20/10/2026. O Abrir no Outlook usa o assunto dele:

```
Confirmação aplicação Tesouro Direto
```

```
Prezado(a) [NOME],

Conforme conversado, gostaria de realizar a[s] ordem[ns] para a aplicação no Tesouro Direto abaixo na conta XP [CONTA]:


Título: [NOME DO TÍTULO NO HUB];
Taxa: [TAXA COMO O HUB MOSTRA];
Vencimento: [DD/MM/AAAA];
Valor a ser aplicado: R$ [VALOR]


Observação importante: O valor financeiro total da aplicação e o PU de compra dependem da cotação atual do mercado.

Aguardo confirmação para realizar a[s] ordem[ns].

Att,
```

- **Duas linhas em branco** antes e depois dos títulos, como no modelo colado; os espaços que o modelo
  tinha no fim de algumas linhas não entram.
- **Um bloco por título**, na ordem digitada, separados por uma linha em branco. Plural como os outros.
- `Título`, `Taxa` e `Vencimento` levam ponto-e-vírgula; `Valor a ser aplicado` não.
- O título, a taxa e o vencimento são os da lista do Hub, lida pelo robô: `Título: Tesouro Selic 2031;`,
  `Taxa: SELIC + 0,0992 %;`, `Vencimento: 01/03/2031;`. Sem a lista (sem o robô), confirmado o bloqueio,
  `Taxa: ;` e `Vencimento: ;` ficam em branco, para preencher no Outlook.

## 1d. Resgate no Tesouro Direto (o e-mail "Tesouro · Resgate")

O modelo que o operador trouxe em 20/10/2026 (o mesmo do post "Confirmação resgate Tesouro Direto" do
Operacional). O Abrir no Outlook usa o assunto dele:

```
Confirmação resgate Tesouro Direto
```

```
Prezado(a) [NOME],

Conforme conversado, gostaria de realizar a ordem para o resgate no Tesouro Direto abaixo na conta XP [CONTA]:

Título: [NOME DO TÍTULO NA POSIÇÃO];
Vencimento: [DD/MM/AAAA];
Valor a ser resgatado: R$ [VALOR]

Observação importante: O valor financeiro total do resgate e o PU de venda dependem da cotação atual do mercado.

Aguardo confirmação para realizar o resgate.

atte,
```

- Diferente da aplicação: **sem taxa**, **uma** linha em branco antes e depois dos títulos, e o fecho
  **`atte,`** em minúsculas, como no modelo. Os espaços que o modelo tinha no fim de algumas linhas
  não entram.
- **Um bloco por título**, na ordem digitada, separados por uma linha em branco. No plural: "as ordens
  para os resgates" e "Aguardo confirmação para realizar os resgates.".
- O título e o vencimento são os da posição do cliente, lida pelo robô; o valor é o pedido, ou, no
  total, o valor disponível. Sem a posição (sem o robô), confirmado o bloqueio, o título é o do pedido
  e `Vencimento: ;` fica em branco.

## 2. Auditoria por E-mail (na tela, "E-mail em tabela")

O e-mail do formato 1, com a mesma abertura e o mesmo fecho, mas com uma **tabela das ordens** no
lugar dos blocos de ativo. Na tela ele se chama **E-mail em tabela**, que é como o operador o chama;
no código continua `auditoria`. "Via email" no pedido marca este e o formato 1 — salvo quando a
cesta tem fundo cetipado, que não entra na tabela; aí marca só o formato 1. "Auditar" marca só este.

```
Prezado(a) Cliente,

Conforme conversado, gostaria de realizar a[s] ordem[ns] abaixo na conta XP [CONTA]:

Ativo	C/V	Preço	Qtd. Total
[TICKER]	[C|V]	[PREÇO]	[QUANTIDADE]


Observações importantes: Toda solicitação lançada no sistema antes do leilão de encerramento sofrerá tentativa de processamento no mesmo dia. Toda solicitação lançada após o leilão de encerramento sofrerá tentativa de processamento no próximo dia útil.

Aguardo confirmação para realizar a[s] ordem[ns].

Att,
```

- **A tabela é o Lote Simples sem `Estratégia` e sem `Cliente`** (pedido do operador em 30/09):
  o e-mail vai para o cliente, "Simples" é coisa da planilha da XP, e a conta já está na frase de
  abertura. `Ativo`, `C/V` e `Preço` seguem as regras da seção 3, uma linha por ativo na ordem
  digitada. **O Lote Simples em TSV (seção 3) continua com as duas colunas**: a planilha precisa
  delas. (Até 29/09 a tabela do e-mail era o Lote Simples célula por célula.)
- **A coluna de valor acompanha a cesta** (decidido com o operador em 28/09):

  | cesta | tabelas |
  | --- | --- |
  | só quantidade | uma, terminando em `Qtd. Total` |
  | só financeiro | uma, terminando em `Financeiro` |
  | mista | **duas**: a de financeiro primeiro, depois a de quantidade, com duas linhas em branco entre elas e sem título |

  Na cesta mista, cada tabela leva só os seus ativos, na ordem digitada. (No começo a cesta mista
  saía numa tabela só, com as duas colunas e uma delas vazia em cada linha; o operador pediu as
  duas tabelas.)

  O pedido real de 28/09, cesta toda em reais:

  ```
  Ativo	C/V	Preço	Financeiro
  BTLG11	C	A mercado	R$ 3.000,00
  XPML11	C	A mercado	R$ 3.000,00
  ```

  `Financeiro` sai como `R$ X.XXX,XX`, igual ao TWAP. Coluna inteira vazia não aparece: no e-mail
  do cliente ela pareceria erro.
- **Duas linhas em branco depois de cada tabela**: o TSV termina em quebra de linha. Está assim no
  exemplo que o operador trouxe. No HTML, entre duas tabelas vai `<br><br>`.
- **Copiada em tabela e em texto, juntos.** O HTML leva a tabela em **grade simples**, como
  "Todas as bordas" no Excel: linha fina preta em todas as células, cabeçalho em texto normal,
  **sem cor de fundo, sem negrito e sem fonte declarada**. O operador cola no Outlook na web, que
  dá à tabela a fonte da própria mensagem. O texto, igual ao bloco acima, com TAB entre as
  colunas, é o que cola onde HTML não entra.
- **Sem fundo cetipado.** A coluna `Ativo` é de código, e fundo cetipado não tem. Bloqueia, **sem**
  botão de confirmar, e o caminho é a Ordem por e-mail.

### Abrir no Outlook (os formatos 1 e 2)

Ao lado do Copiar, os dois e-mails têm **Abrir no Outlook** (pedido do operador em 07/10/2026): um
e-mail novo no Outlook na web (`outlook.cloud.microsoft/mail/deeplink/compose`), numa janela só dele, com
o assunto

```
Confirmação de ordem
```

- **Para e Cc** (07/10/2026, robô 1.3.x): o e-mail do cliente, da ficha do Hub, vai no Para; o do
  assessor responsável, achado na planilha dos assessores pelo código, em cópia. O Outlook na web
  ignora o `cc` solto no endereço (conferido no Outlook da mesa), por isso, com o cliente, tudo vai
  num `mailto:` dentro do `to`:

  ```
  compose?to=mailto%3A<cliente>%3Fcc%3D<assessor>%26subject%3D<assunto>%26body%3D<texto>
  ```

  O texto fica codificado duas vezes. Sem o e-mail do cliente, vai `compose?subject=…&body=…`, sem
  cópia. O que não houver fica de fora, e o aviso diz o quê.
- **Formato 1:** o corpo é o texto acima, o mesmo do Copiar, com as quebras de linha em `\r\n`.
  A área de transferência não é tocada. Com o fundo do secundário, vai o cenário à vista (o último
  ROA escolhido).
- **Formato 2** (09/10/2026, decidido com o operador): o endereço só leva texto puro, e a tabela
  não vai em grade. O corpo é o texto do Copiar, com TAB entre as colunas e as quebras de linha em
  `\r\n`; as colunas chegam desalinhadas. A área de transferência não é tocada. Em grade, só pelo
  Copiar. (Até 09/10 o e-mail abria só com o assunto, e a tabela ia copiada para colar.)
- **Texto que não cabe no endereço** (mais de 7.000 caracteres, já codificado; dez ativos dão uns
  2.900 com o cliente e o assessor): abre sem o corpo, e o texto vai copiado — no formato 2, com a
  tabela em grade.

## 3. Lote Simples (TSV)

Cabeçalho:

```js
"Estratégia\tCliente\tAtivo\tC/V\tPreço\tQtd. Total\n"
```

Uma linha por ativo, na ordem em que foram digitados.

| Coluna | Conteúdo |
| --- | --- |
| `Estratégia` | literalmente `Simples` |
| `Cliente` | a conta numérica |
| `Ativo` | o ticker como informado (em maiúsculas) |
| `C/V` | `C` ou `V` |
| `Preço` | o preço informado, ou `A mercado` |
| `Qtd. Total` | inteiro, sem separador de milhar, sem `R$` |

O Lote Simples **não tem coluna de financeiro**: uma ordem por financeiro não cabe neste formato,
porque a planilha da XP não tem a coluna. A tabela do e-mail (formato 2) ganha `Financeiro`; este
TSV, não.

## 4. Lote TWAP (TSV)

Cabeçalho:

```js
"Estratégia\tCliente\tAtivo\tC/V\tQtd. Total\tFinanceiro\tPreço\tPreço Would\tHora Inicial\tHora Final\n"
```

`Estratégia` é literalmente `TWAP`. As duas formas de preencher:

| | ordem por **quantidade** | ordem por **financeiro** |
| --- | --- | --- |
| `Qtd. Total` | o inteiro | vazio |
| `Financeiro` | vazio | `R$ X.XXX,XX` |
| `Preço` | o preço informado, ou `A mercado` | `A mercado`, salvo preço informado |

`Preço Would`, `Hora Inicial` e `Hora Final` saem vazios, salvo informação explícita do usuário.

Uma cesta gera uma linha por ativo, cada uma com seu próprio valor ou quantidade.

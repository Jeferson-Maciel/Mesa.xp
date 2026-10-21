# Prateleira de fundos

Parte da documentação da Mesa XP. O que vale sempre — dado de cliente, push, "nada é
adivinhado", as regras do robô, a verificação — e o mapa dos outros documentos estão no
[`CLAUDE.md`](../CLAUDE.md).

A aba **Fundos** (Alt+3, a pedra peridoto), pedida pelo usuário em 21/10/2026: os fundos do
secundário como o Hub os mostra na Prateleira, numa tabela que ordena e filtra, e o que mudou desde
o último dia visto.

```
src/modulos/fundos/regras.js   as linhas, o filtro, a ordem, a foto do dia e o que mudou (puro, testado)
src/modulos/fundos/render.js   a tabela e o "o que mudou"
src/modulos/fundos/index.js    a aba, e a foto de cada captura (com a página)
```

## De onde vêm os fundos

A captura é **a mesma que o Ordens usa** para converter R$ em cotas (o robô na Prateleira do Hub, ou
os fundos carregados à mão — ver [`secundario.md`](secundario.md)). O Ordens a guarda e a oferece pelo
serviço `prateleira` (`src/comum/servicos.js`): `atual()`, `aoMudar(fn)` e `atualizar()` (que pede uma
captura nova ao robô). A aba não importa o Ordens.

## A tabela

- As colunas: o fundo (ticker e nome), o **deságio** (com uma barrinha proporcional ao maior da tela),
  o **ROA máximo** (o deságio menos o deságio mínimo do cliente, o fim da barra de ROA adicional na
  boleta; só com os dois), a aplicação mínima, o PU, o Estoque XP (em cotas; "sem estoque" apagado) e
  o Estoque clientes (o deságio e as cotas, ou "fechado").
- Ordena pelo cabeçalho (o deságio, do maior, de início); o que não tem o valor vai sempre para o fim.
- Filtra pelo nome ou ticker (sem acento), "Com estoque XP" e "Estoque clientes aberto".
- A busca da Mesa (Ctrl+K) acha os fundos e abre a aba já filtrada.

## O que mudou

A cada captura do Hub — com a aba aberta ou não —, a foto do dia (o deságio, o ROA máximo e o
estoque de cada fundo) fica no `localStorage` (`mesa_prateleira_fotos`), as dos últimos 10 dias. É
dado de mercado, sem cliente. A aba compara a captura com a foto do último dia anterior e mostra os
fundos que **entraram** e **saíram**, o **deságio** e o **ROA máximo** que mudaram (de → para), e o
**Estoque XP** que zerou ou voltou. Sem foto anterior, diz que a primeira é a de agora.

## O que falta

O disparo **"Tabela de Cetipados"** (o modelo do Operacional, com os fundos agrupados por "ROA.E." e
por "Deságio Venda") espera a regra do ROA.E. — em [`ROADMAP.md`](ROADMAP.md).

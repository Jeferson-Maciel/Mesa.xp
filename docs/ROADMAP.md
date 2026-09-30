# Roadmap

Defeitos conhecidos, sugestões e próximos passos. **Nada aqui está implementado**: a Mesa XP nasceu
de uma fusão que, de propósito, não acrescentou funcionalidade. O que apareceu durante a fusão veio
para cá em vez de entrar no código.

## Mesa XP — levantado na fusão (29/09/2026)

### Antes de distribuir o link

1. ~~**Os registros de presença do Calendário antigo não vieram.**~~ Decidido em 30/09/2026: o
   Calendário começa do zero no projeto `rtvtgulivtkpfprcfpie`, e os dados do projeto antigo
   (`ekughbuuvjoojgfgbqbz`, fora do ar e fora da conta da mesa) não serão migrados. A equipe cadastra
   os colaboradores de novo.
2. **O projeto novo é do plano gratuito, que pausa depois de alguns dias sem uso.** Usado todo dia
   pela mesa, não deve pausar; num recesso, pode. Se a mesa depende disso, avaliar um plano que não
   pause. (O teste contra o banco real, pendente na fusão, foi feito em 30/09/2026:
   `npm run verificar:supabase`, Calendário e Operacional.)
3. **Segurança do Calendário — fase 2** (ver [`CLAUDE.md`](../CLAUDE.md#pendência-de-segurança--fase-2)):
   hoje a chave anon, pública, lê e escreve tudo, e os dados têm nomes e motivos de ausência.
   Supabase Auth, políticas RLS fechadas para a equipe e repositório privado.
4. **Aposentar os três links antigos** (Ordens no Netlify, RendaFixa Pro, Calendário na Vercel)
   depois que a mesa migrar. O Calendário antigo já não funciona (item 1) e não divide mais o banco
   com o novo.

### Renda Fixa

- **Sem Tax.Mín nem Tax.Máx, o motor usa o ROA como taxa.** Quando as duas colunas de taxa estão
  vazias, o motor procura a primeira célula da linha com "%" — e na planilha da XP essa é a
  "ROA E. Aprox.". Um título sem taxa entraria com o ROA na disputa. Achado ao montar a planilha
  sintética; o golden dela registra o comportamento atual (linha `CDB SO ROA`). Corrigir exige
  decidir com o assessor e atualizar os goldens à mão.
- Limitações herdadas do RendaFixa Pro:
  - lê só a primeira aba da planilha;
  - as regras (PU máximo, prazos exibidos, janela de arredondamento, lista de bancos) estão fixas em
    `motor.js`;
  - o título da seção de isentos continua "LCAs/LCIs ISENTA DE IR" mesmo quando o vencedor é uma LCD;
  - as variações dependem de salvar as análises: sem uma análise salva antes de hoje, elas não
    aparecem;
  - o histórico fica só no navegador em que foi salvo.
- **Tamanho do arquivo.** O SheetJS completo é a maior parte do `dist/index.html` (~1,3 MB). Vale
  medir se o build `xlsx.mini.min.js` da mesma versão lê a exportação da XP (.xlsx) e os .xls/.csv
  que a tela aceita; se ler, o arquivo cai para perto da metade.

### Calendário

- **O erro de rede demora ~12 s para aparecer**: o supabase-js tenta de novo antes de desistir. Nesse
  tempo o status diz "carregando…". Um "tentando conectar…" com contagem, ou menos tentativas,
  deixaria claro que a rede caiu.
- **O aviso de horário inválido aparece atrás do fundo escurecido da janela do dia.** Melhor mostrar
  a validação dentro da própria janela, como já acontece com o erro ao salvar.
- A matriz mostra o horário indisponível mas não o motivo, para não expor dado de saúde na tela
  aberta. Se a mesa sentir falta, um ícone com o motivo no `title` é o meio-termo — decidir junto
  com a fase 2.

### Casca e visual

- O ícone da aba do navegador é o logo padrão do Vite, herdado do Ordens. Trocar por um da Mesa XP.
- Atalhos visíveis: as abas mostram Alt+1/2/3 no `title` e o Renda Fixa tem a lista no "?", mas os
  do Ordens (Ctrl+Enter, Alt+H) continuam só no `title` dos botões. Uma lista única, por aba, ajudaria
  (F20 abaixo).
- Os avisos de tela se acumulam sem limite quando muitos saem juntos.

### Engenharia

- `npm run verificar` precisa do Chromium do Playwright instalado à parte
  (`npx playwright install chromium`). Um CI (GitHub Actions) com `npm test`, `npm run build` e a
  verificação no navegador pegaria regressão de fiação antes do deploy — os testes do core não
  veem a tela.
- As exportações reais da XP ficam fora do git; num CI, os goldens delas seriam pulados. Se o
  repositório virar privado (fase 2), dá para versioná-las.

---

## Operacional — o que ficou de fora (30/09/2026)

A aba entrou com o que a mesa usa no dia a dia do Slab: tópicos, posts, busca, copiar, criar, editar
e excluir, compartilhado e ao vivo. O resto ficou para depois, de propósito:

1. **Colar o texto dos 15 posts pendentes.** Vieram do Slab só com o título: os 12 de Padrões de
   Fixing, Confirmação resgate fundos, Confirmação aplicação Fundos e Ações e Fundos Listados. Dá
   para colar pela própria tela (Editar); não se inventa texto para eles.
2. ~~**Ligar no banco da mesa.**~~ Feito em 30/09/2026: `supabase/operacional.sql` rodou no
   projeto `rtvtgulivtkpfprcfpie`, e `npm run verificar:supabase` confere o Operacional contra ele
   (leitura, criação, edição, a trava de versão entre duas abas, a exclusão que só esconde e o
   histórico).
3. **Anexos (foto, áudio, vídeo).** A primeira tentativa (branch `antigravity/operacional`) os
   gravava no navegador em base64, o que estoura o armazenamento com poucos arquivos e não chega aos
   colegas. O caminho certo é o Storage do Supabase, num bucket privado com URL assinada — e isso
   depende de login (fase 2): sem ele, a chave anon, pública, poderia subir qualquer arquivo. Até
   lá, links vão no próprio texto do post.
4. **Restaurar uma versão pela tela.** O banco guarda todas (`operacional_revisoes`), mas hoje a
   recuperação é pelo painel do Supabase. Uma lista de versões com "restaurar" no post aberto seria
   o próximo passo — com login, mostrando também quem editou.
5. **Recursos do Slab que não vieram:** rascunhos, favoritos, "mais populares", Content Map, grupos,
   "Join topic", o banner do tópico e excluir ou renomear tópico. Valem entrar se a mesa sentir
   falta no uso.
6. **Autor e data por edição.** Sem login não há quem; o post mostra só quando foi atualizado.

---

## Ordens — levantamento anterior à fusão

O que segue é o roadmap do Assistente de Ordens, de 22/09 a 28/09/2026, mantido como estava. Os
caminhos citados (`src/core/`, `src/main.js`…) hoje ficam em `src/modulos/ordens/`, e o item F17
(git) está resolvido.

### O que falta

Levantamento feito em 22/09/2026, sondando o sistema com entradas que os testes ainda não cobriam.
Os defeitos abaixo foram **reproduzidos**, não deduzidos: cada um traz a entrada e a saída real.

### Os quatro defeitos, em ordem de risco

> **Situação em 22/09, fim do dia:** os defeitos 1, 2 e 4 foram corrigidos — ver "A correção"
> logo abaixo. O defeito 3 (tabela de posições) continua aberto e espera decisão do operador.


Os quatro são a mesma falha de fundo, e vale nomeá-la antes de listar: **o sistema descarta ou
adivinha em silêncio nos pontos onde a própria carta dele manda parar e perguntar.** A invariante 8
diz que dado crítico faltando bloqueia a geração. O que estes casos mostram é pior que dado
faltando — é dado que o sistema **viu, jogou fora, e substituiu por um padrão**. Uma saída ausente
custa um clique; uma saída plausível e errada custa a ordem.

#### 1. Preço sem a palavra "preço" é descartado, e a ordem sai a mercado

```
Entrada:  PETR4 100 a 39,50
Saída:    Simples  1234567  PETR4  C  A mercado  100
```

Só a palavra literal `preço` faz um preço registrar. Testei as formas correntes de escrever um
limite e **todas** caem fora:

| Entrada | Preço lido |
| --- | --- |
| `PETR4 100 a 39,50` | — |
| `PETR4 100 @ 39,50` | — |
| `PETR4 100 limite 39,50` | — |
| `PETR4 100 por 39,50` | — |
| `PETR4 - 100 - 39,50` | — |
| `PETR4 100 preço 39,50` | `39,50` |

Uma ordem limite vira ordem a mercado, sem aviso nenhum. É o defeito mais caro do sistema hoje.

**Correção:** `lerPreco` passa a reconhecer as outras formas, e — mais importante — qualquer número
sobrando na linha depois de extraída a quantidade vira **bloqueio de ambiguidade**, não silêncio.

#### 2. Quantidade com preço em reais: a quantidade some

```
Entrada:  PETR4 100 R$ 39,50
Lido:     quantidade = nenhuma, financeiro = R$ 39,50
```

A ordem de 100 ações a R$ 39,50 (cerca de R$ 3.950) vira uma ordem de R$ 39,50. O `R$` na linha faz
`lerValor` classificar tudo como financeiro e o `100` é perdido.

No Lote Simples isso esbarra no bloqueio de financeiro por acaso, não por mérito. **No Lote TWAP
passa direto e gera a linha errada.**

**Correção:** quantidade e preço na mesma linha precisam ser reconhecidos como dois números com
papéis diferentes, e a ambiguidade entre "R$ é o valor da ordem" e "R$ é o preço unitário" precisa
bloquear em vez de escolher.

#### 3. Tabela de posições colada lê a coluna errada

```
Entrada:  Ativo   Qtd. Teórica   Qtd. Atual
          PETR4   200            100
Lido:     PETR4 qtd=200     ← a teórica, não a atual
Bloqueios: nenhum
```

E a posição zerada entra junto:

```
Entrada:  VALE3   150   0
Lido:     VALE3 qtd=150     ← deveria ficar de fora
Bloqueios: nenhum
```

A venda total por tabela de posições nunca foi construída, mas o parser **não se abstém** dela: ele
lê a primeira coluna numérica e produz uma ordem plausível com o número errado, dobrada, incluindo
papéis que o cliente não tem mais. Não fazer seria seguro; fazer errado não é.

**Correção:** ou implementar de verdade (detectar o cabeçalho `Qtd. Atual`, usar essa coluna,
excluir `≤ 0` com aviso), ou detectar a tabela e recusá-la explicitamente. As duas são aceitáveis;
o estado atual não é.

#### 4. Dois números soltos na linha: escolhe o primeiro

```
Entrada:  PETR4 100 200
Lido:     qtd = 100
Bloqueios: nenhum
```

Ambiguidade resolvida por posição. Deve bloquear.

---

### Lacunas funcionais

Nenhuma destas é defeito — são coisas que o sistema não faz e que o uso diário vai cobrar.

- **Não dá para acrescentar uma ordem no preview**, só remover. Se o parser perde um ativo, o
  caminho é editar o texto e reanalisar, o que joga fora as correções já feitas nas outras linhas.
- **Reabrir do histórico descarta as correções manuais.** O histórico guarda o texto original e o
  passa pelo pipeline de novo — o que é certo para refletir as regras atuais, mas significa que
  tudo o que você corrigiu à mão naquele preview se perde. Guardar as correções ao lado do texto
  resolveria.
- **Horário de TWAP exige dois horários.** "A partir das 10h" não é lido. É proposital (um horário
  solto é ambíguo demais), mas se esse formato aparecer no grupo, vira lacuna.
- **`Preço Would` nunca é preenchido**, porque nenhum exemplo mostrou como ele é informado.
- **Formato do horário na planilha (`HH:MM`) continua sendo palpite meu.** Se ela espera
  `10:00:00`, é uma linha — mas ninguém confirmou.
- **Linhas de conversa viram descarte.** "Bom dia!" e "Obrigado" aparecem na lista de "não viraram
  ordem", diluindo uma lista que deveria conter só coisa que merece atenção.
- **Conta escrita depois das ordens** deixa as ordens órfãs numa solicitação sem conta. Bloqueia,
  então não é perigoso, mas obriga a reescrever.

### Lacunas de engenharia

205 testes cobrem o núcleo com densidade boa. O que está descoberto:

| Módulo | Linhas | Testes |
| --- | --- | --- |
| `src/main.js` | 344 | nenhum |
| `src/ui/saidas.js` | 102 | indiretos, via `preview.test.js` |
| `src/platform/historico.js` | 80 | nenhum |
| `src/platform/clipboard.js` | 44 | nenhum |

`main.js` é o maior arquivo do projeto e o único sem rede de proteção. Foi ali que os dois defeitos
de interface desta semana apareceram — a detecção de formato global e o estouro da grade — e os
dois só foram pegos porque abri o navegador e olhei. `historico.js` mexe em dados do operador sem
um teste sequer.

Não há lint nem formatador configurado, e o projeto não está em **git** — o que significa que não
existe histórico, nem desfazer, nem como saber o que mudou entre duas versões.

### Funcionalidades

Agrupadas pelo que cada uma compra. Custo é estimativa grosseira de esforço, não de tempo de
relógio.

#### Segurança — o sistema pegando erro que hoje passa

| | Funcionalidade | Custo |
| --- | --- | --- |
| F1 | **Nome do cliente visível no preview, nunca na saída.** Hoje `80000005 - Fulana` guarda só o código e joga o nome fora no parse. A regra é certa para a saída, mas tira de você a única pista humana de que é o cliente certo — um dígito trocado na conta produz uma ordem perfeitamente válida para a pessoa errada. Mostrar o nome ao lado do campo, como etiqueta que nunca entra no e-mail nem no TSV, é conferência de graça. | baixo |
| F2 | **Conta conferida contra o histórico.** O sistema já viu todas as contas que você usou. Conta que nunca apareceu antes pede confirmação — a mesma lógica da lista da B3, aplicada ao campo mais crítico de todos. | médio |
| F3 | **Aviso de repetição no dia.** Mesma conta e mesmo ativo já processados hoje disparam alerta de possível envio duplicado. O grupo é corrido e a mesma ordem passar duas vezes é um erro plausível. | baixo |
| F4 | **Conferência do que sobrou.** Depois de gerar, mostrar o texto colado com as partes que viraram ordem marcadas; o que ficar sem marcação é o que o sistema ignorou. É a defesa geral contra a classe de defeito da primeira seção — não depende de prever cada jeito de escrever. | médio |
| F5 | **Modo conferência.** Colar a ordem já enviada junto da solicitação original e receber as divergências. É o caso de uso "auditoria" levado a sério, em vez de só um e-mail com texto diferente. | alto |

#### Tempo — menos passos por ordem

| | Funcionalidade | Custo |
| --- | --- | --- |
| F6 | **Operação em massa.** Um clique põe a cesta inteira em Venda. "Vender tudo" com dez FIIs hoje são dez cliques. | baixo |
| F7 | **Acrescentar linha no preview.** Feito em 28/09: botão + no cartão, linha em branco. | feito |
| F8 | **Desfazer.** `Ctrl+Z` depois de remover uma linha por engano. | baixo |
| F9 | **Baixar o lote como arquivo,** além de copiar. Evita o Ctrl+V e não corre risco de a área de transferência ser sobrescrita no meio do caminho. | baixo |
| F10 | **Abrir o e-mail já preenchido** por `mailto:`. Ressalva real: `mailto:` tem limite de tamanho e perde formatação, então serve para ordens curtas e o botão de copiar continua sendo o caminho principal. | baixo |
| F11 | **Copiar tudo** quando o bloco tem várias contas. | baixo |

#### Ajuste ao fluxo real do grupo

| | Funcionalidade | Custo |
| --- | --- | --- |
| F12 | **Fila do dia.** Colar o despejo da conversa e trabalhar solicitação por solicitação, marcando cada uma como resolvida. Hoje as várias contas aparecem todas de uma vez, sem noção de progresso. | médio |
| F13 | **Estado por solicitação:** pendente / enviado mesa / confirmado. O grupo já responde "Enviado mesa." — o sistema espelharia o que vocês fazem, em vez de ignorar. | médio |
| F14 | **Resumo do dia.** O que foi processado, por conta, com totais. Serve de conferência de fim de expediente. | médio |

#### Entrada

| | Funcionalidade | Custo |
| --- | --- | --- |
| F15 | **Print / imagem.** O pedido original dizia "por texto, print ou lista" e hoje só o texto é atendido. Dá para fazer OCR no navegador, mas **não recomendo fazer direto**: OCR troca dígito, e um `8` lido como `3` num número de conta é exatamente o desastre que este sistema existe para evitar. Se entrar, que entre como sugestão que **obriga** conferência campo a campo, nunca preenchendo sozinho. | alto |
| F16 | **Cestas favoritas.** Modelos para as combinações que se repetem. Só vale depois de alguns dias de uso mostrarem quais se repetem. | médio |
| F23 | **Reconhecimento de fundo cetipado pelo nome.** Construído — ver abaixo. Falta só decidir se entra no fluxo de geração. | feito |

#### F23 — fundos cetipados pelo nome

`src/core/validate/fundosXP.js` guarda os 146 fundos da prateleira de distribuição da XP (32 deles
também negociados em bolsa), e `fundo.js` faz a busca por nome. A prateleira **não é dado público**
— a CVM publica todos os 90 mil fundos do Brasil, mas ninguém publica o que a XP distribui, e não
dá para inferir pelo administrador ou pelo gestor. A lista veio da listagem do portal, e o
`npm run fundos:update -- arquivo.txt` regenera o módulo a partir de uma nova cópia.

Guardamos só nome, ticker e quantidade mínima. Preço unitário, quantidade disponível, deságio e
rentabilidade mudam todo dia: embuti-los seria carregar dado vencido dentro de um sistema cuja
regra é não inventar dado.

A busca devolve quatro situações, e a razão de ser dela está nas duas do meio:

| | |
| --- | --- |
| `exato` | um único fundo cabe no texto |
| `ambiguo` | cabe em vários — devolve todos, não escolhe |
| `parcial` | nenhum cabe inteiro, mas há parecidos o bastante para confirmar |
| `nenhum` | não há a que se agarrar |

Um nome erra de um jeito que um ticker não erra: por uma palavra. `XP Habitat Renda Imobiliária
Feeder` e `XP Habitat Renda Imobiliária II Feeder` são fundos diferentes separados por um numeral.
Por isso a busca nunca elege um fundo havendo mais de um candidato.

**Falta decidir:** os fundos sem ticker estão fora de escopo porque o escritório os faz à mão. Esta
peça torna o caminho do **e-mail** viável para eles, com confirmação obrigatória no nome ambíguo. O
**lote continua impossível** — a coluna `Ativo` do TSV precisa de um código, e esses fundos não têm.
Mudar o escopo é decisão do operador; a capacidade está pronta e testada de qualquer forma.

#### Plataforma

| | Funcionalidade | Custo |
| --- | --- | --- |
| F17 | **Git.** Fundação de todo o resto: hoje um erro de edição não tem volta. | baixo |
| F18 | **Teste de fumaça da interface.** Meia dúzia de casos no `main.js` pegariam os erros de fiação que hoje dependem de alguém abrir o navegador. | médio |
| F19 | **Instalável e offline (PWA).** Três arquivos, e a ferramenta abre como aplicativo e funciona sem rede. | baixo |
| F20 | **Atalhos visíveis.** `Ctrl+Enter` e `Alt+H` existem e ninguém descobre sozinho. | baixo |
| F21 | **Segmentados como `radiogroup`.** Hoje cada linha gasta seis paradas de tabulação; seriam duas. | baixo |
| F22 | **Push**, se e quando voltar ao escopo. | — |

### Ordem sugerida

**Git (F17) primeiro.** Depois os defeitos 1, 2 e 4, que são risco de dinheiro e vivem em duas
funções pequenas (`lerPreco` e `lerValor`), com teste antes. Em seguida o defeito 3, decidindo com
o operador entre implementar a tabela de posições ou recusá-la explicitamente.

Feito isso, a leva que dá mais retorno por esforço: **F1, F6, F7, F8 e F3** — todas de custo baixo,
duas comprando segurança e três comprando tempo em coisas que se repetem dezenas de vezes por dia.

**F4 (conferência do que sobrou)** vem logo atrás e é a de maior valor estrutural: é a única que
protege contra a classe inteira de defeito da primeira seção sem depender de prever cada formato
de escrita. Vale o custo médio.

O resto — fila do dia, estado por solicitação, resumo, cestas favoritas — vale **esperar alguns
dias de uso real**. A ordem entre elas muda conforme o que incomodar de verdade, e decidir agora
seria escolher no escuro.

---

### Corrigido em 22/09 — alarme falso em série nos fundos listados

Um pedido real de auditoria com sete FIIs listados (`JGPT11`, `VICA11`, `VGIE11`, `IMOV11`,
`XPHF11`, `PIER11`, `PAAG11`) saía com **quatro bloqueios de "ticker suspeito" e três avisos de
"fora da lista"** — sete alarmes falsos em sete linhas. Nenhum dos sete estava errado.

A causa: a lista da B3 embutida envelhece, e fundos listados recentemente não aparecem nela. A
prateleira da XP tem os sete, mas os tickers dela não estavam ligados ao reconhecimento.

`analisarTicker` passou a consultar as duas fontes, e o ticker traz o nome do fundo junto (o
preview mostra ao pousar o mouse). O motivo de isto valer correção imediata, e não fila: **alarme
falso em série é pior que alarme nenhum**, porque treina o operador a passar por cima do aviso — e
aí o aviso verdadeiro, o `KCNR11` no lugar do `KNCR11`, passa junto.

---

### A correção dos defeitos 1, 2 e 4

O remendo óbvio seria ensinar `lerPreco` as palavras que faltavam. Seria remendo mesmo: o próximo
jeito de escrever preço cairia no mesmo buraco calado. A correção tem duas camadas, e a que
resolve é a segunda.

**Camada 1 — reconhecer as formas correntes.** `a 39,50`, `@ 39,50`, `limite 39,50`, `por 39,50`,
`a R$ 39,50`, além do `preço 39,50` que já funcionava. O `a`/`por` solto exige centavos de
propósito: `a 100` continua não virando preço, porque pode ser quantidade, e adivinhar ali seria
repetir o erro numa forma nova.

**Camada 2 — contabilidade da linha.** `lerValor` e `lerPreco` passaram a devolver, junto do
valor, **o trecho de texto que consumiram**. Com isso o parser subtrai da linha o ativo, o preço e
o valor, e olha o que restou: número que sobrou é número que ninguém explicou. Ele vira o bloqueio
`numero-nao-explicado`, confirmável, porque só o operador sabe se aquilo era preço, quantidade ou
ruído.

A ordem também mudou: **o preço é lido antes do valor**. Em `PETR4 100 a R$ 39,50` o `R$` é preço
unitário, e lido primeiro ele não é confundido com o valor financeiro da ordem.

O resultado nos casos que falhavam:

| Entrada | Antes | Agora |
| --- | --- | --- |
| `PETR4 100 a 39,50` | A mercado, calado | `39,50 · 100` |
| `PETR4 100 @ 39,50` | A mercado, calado | `39,50 · 100` |
| `PETR4 100 limite 39,50` | A mercado, calado | `39,50 · 100` |
| `PETR4 100 por 39,50` | A mercado, calado | `39,50 · 100` |
| `PETR4 - 100 - 39,50` | A mercado, calado | bloqueia |
| `PETR4 100 R$ 39,50` | ordem de R$ 39,50 | bloqueia |
| `PETR4 100 200` | usa 100, calado | bloqueia |
| `PETR4 100` | A mercado | A mercado |

A camada 2 é o que vale guardar: ela não depende de prever como alguém vai escrever. Qualquer
número que o sistema não souber explicar para de sumir.

---

### Corrigido em 28/09 — financeiro sem R$ e a variedade dos pedidos

Um pedido real (`7000002 - compra via email` e seis FIIs com `3.000,00`, `5.000,00`...) saía com
as seis ordens sem operação e lidas como **cotas**. Sondando 45 variações de como as ordens
chegam, dez saíam erradas sem alerta nenhum. As principais:

| Entrada | Antes | Agora |
| --- | --- | --- |
| `BTLG11 3.000,00` | 3000 cotas | R$ 3.000,00 |
| `BTLG11 3 mil` | 3 cotas | R$ 3.000,00 |
| `BTLG11 R$ 3 mil` | R$ 3,00 | R$ 3.000,00 |
| `BTLG11 3.000 reais` / `valor 3.000` | 3000 cotas | R$ 3.000,00 |
| `Venda:` / `XPML11` / `Compra:` / `BTLG11` | as duas como compra | venda e compra |
| `10000 - PETR4` | virava a conta 10000 | 10000 PETR4 |
| `7000002 - compra via email` | "compra" jogado fora | compra, e marca os dois e-mails |

Entraram também: o e-mail em tabela com a coluna `Financeiro`, a cesta mista com o botão
**Tudo em R$**, as palavras `aplicação`/`aporte`/`resgate`/`saída`, a lista numerada e o negrito
do WhatsApp, e o descarte da linha com dois ativos ou com conta e ordem juntas.

**Continua em aberto:** `PETR4F` (fracionário) vai para os descartes, porque o formato de ticker
não aceita o `F`. E `PETR4 39,50` sozinho vira uma ordem de R$ 39,50 — foi a decisão do operador
(centavos são financeiro), mas pode ter sido um preço sem quantidade, e o preview é quem pega.

#### Mesmo dia — valor na linha de baixo

Um pedido real de sete fundos cetipados trazia o nome numa linha e `R$ 16.000,00` na de baixo. Os
sete nomes batiam exatos com a prateleira, e mesmo assim nenhum virava ordem: o nome ia para os
descartes sem valor, e a linha do valor era **pulada em silêncio**. Agora o valor sozinho numa
linha é casado com o ativo logo acima (vale para ticker também). Se algum valor ficar sem ativo
logo acima, nada no bloco é casado — o valor pode ter vindo acima do nome, e casar de cima para
baixo daria a cada fundo o valor do vizinho.

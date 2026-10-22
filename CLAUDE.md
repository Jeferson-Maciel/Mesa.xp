# Mesa XP

As ferramentas da mesa num link só, para os colegas de back office de um escritório credenciado à
XP usarem o dia inteiro:

- **Ordens** — o Assistente de Ordens: transforma a solicitação colada do grupo nos e-mails e lotes
  do back office (e-mail por grupo — bolsa, fundos comprados, fundos vendidos, Tesouro aplicação e
  resgate —, e-mail em tabela, Lote Simples e Lote TWAP), com o robô do Hub trazendo a cotação, o
  cliente, a posição e o print.
- **Fila do dia** — o pedido depois que o e-mail sai, numa caixa limpa: à vista, Aprovação e
  execução (o que o cliente respondeu, com as quantidades aprovadas, o lote da bolsa ou a ficha, e a
  boleta do Hub, que o robô abre); Enviados e Executados em pastas. Fica no navegador.
- **Fundos** — a Prateleira do secundário numa tabela que ordena e filtra (deságio, ROA máximo,
  mínimo, estoques), e o que mudou desde o último dia.
- **Renda Fixa** — o RendaFixa Pro: lê a planilha de renda fixa exportada pela XP e monta o texto
  de WhatsApp com a maior taxa por prazo e categoria. Todas as regras e a mensagem são configuráveis
  na própria tela, uma configuração por mercado, guardada no navegador.
- **Calendário** — o calendário semanal de presença da equipe, gravado no Supabase.
- **Operacional** — a base de conhecimento da mesa (a cópia do Slab): modelos de e-mail, disparos,
  passo a passo e regras, compartilhada e editável, no Supabase.
- **Anotações** — o bloco de notas de cada um, com prints, links, etiquetas e lembretes que ficam
  amarelos até o dia e vermelhos quando chega a hora, com alerta na tela. Fica no navegador.

É uma ferramenta de expediente, aberta o dia todo: alinhada, objetiva e sem enfeite. Isso vale para
a tela e para o código. No ar em **https://mesa-xp.vercel.app** (Vercel, ligada à `main` do GitHub
`Jeferson-Maciel/Mesa.xp`, público por decisão do usuário); também abre do disco, em
`dist/index.html`.

## Como trabalhar aqui

- **No começo da sessão, leia [`docs/CONTEXTO.md`](docs/CONTEXTO.md)**: onde paramos, o que foi
  testado no Hub de verdade, o que está no ar e o que falta. Atualize-o no fim.
- **Antes de mexer num módulo, leia o documento dele** (o mapa abaixo). As regras detalhadas, as
  decisões do operador e o porquê de cada uma moram lá. Este arquivo guarda só o que vale sempre;
  ao mudar uma regra, atualize o documento do módulo, que é a fonte.
- **Antes de mexer num formatter, leia [`docs/FORMATOS-DE-SAIDA.md`](docs/FORMATOS-DE-SAIDA.md)**: os
  literais das saídas, caractere por caractere.
- **Pedido real do operador vira teste antes do código**, com as contas trocadas por fictícias.
- Sugestão e ideia vão para [`docs/ROADMAP.md`](docs/ROADMAP.md), não para o código.
- **Os combinados com o usuário (21/10/2026)**, que valem em qualquer sessão, local ou na nuvem:
  - **Uma sessão de perguntas (grilling) antes de cada fase** do roadmap: perguntas numeradas, uma
    rodada por vez, cada uma com a recomendação; só depois de ele responder, construir. Fato que dá
    para achar no código não vira pergunta.
  - **Commit e push a cada passo verificado** (`npm test`, `npm run build`, `npm run verificar`),
    com o diff conferido contra dado de cliente: o usuário continua o trabalho de outro lugar (o
    Claude na nuvem) se os créditos acabarem. Deixe o `docs/CONTEXTO.md` em dia a cada push.
  - **Por fases**, primeiro o que é principal ou de valor alto; as fases e o que ele decidiu não
    fazer estão no `docs/ROADMAP.md`.
- O [`AGENTS.md`](AGENTS.md) resume isto para outros agentes; este arquivo e os documentos são a
  fonte.

## Mapa da documentação

| Assunto | Onde |
| --- | --- |
| Onde paramos, o que testar no Hub e no Outlook de verdade | [`docs/CONTEXTO.md`](docs/CONTEXTO.md) |
| A casca (abas, rotas, início preguiçoso), o build de arquivo único, o sistema visual, o movimento e o CSS escopado | [`docs/casca-e-visual.md`](docs/casca-e-visual.md) |
| Ordens: a regra, o vocabulário, fundos cetipados pelo nome, o cliente e o assessor, a entrada real, as invariantes, o E-mail em tabela, o Abrir no Outlook, a arquitetura e a lista da B3 | [`docs/ordens.md`](docs/ordens.md) |
| Os literais das saídas (e-mails, tabela, lotes) | [`docs/FORMATOS-DE-SAIDA.md`](docs/FORMATOS-DE-SAIDA.md) |
| Fundos no secundário: a cotação, o preço exato, **as regras do robô do Hub**, a venda, o Estoque clientes, os grupos de e-mail e o print (SnapDOM) | [`docs/secundario.md`](docs/secundario.md) |
| Tesouro Direto: a aplicação, o resgate e o que o Hub de verdade faz | [`docs/tesouro.md`](docs/tesouro.md) |
| Fila do dia: o cartão, os estados, os prazos, o pedido repetido e a conta nova, e as respostas no Outlook | [`docs/fila.md`](docs/fila.md) |
| Prateleira de fundos: a tabela e o que mudou | [`docs/fundos.md`](docs/fundos.md) |
| Renda Fixa | [`docs/rendafixa.md`](docs/rendafixa.md) |
| Calendário | [`docs/calendario.md`](docs/calendario.md) |
| Operacional | [`docs/operacional.md`](docs/operacional.md) |
| Anotações | [`docs/anotacoes.md`](docs/anotacoes.md) |
| O que está em aberto | [`docs/ROADMAP.md`](docs/ROADMAP.md) |

## O que vale sempre

### Dado de cliente e o repositório público

- **O repositório é público.** Nunca versionar dado de cliente: conta, nome, e-mail, CPF, posição,
  saldo, ordem, print, planilha real, captura do Hub. Testes e exemplos usam contas fictícias
  (`1234567`, `7654321`). Antes de cada commit, confira o diff procurando o que o usuário colou na
  conversa.
- As exportações reais da XP ficam em `src/modulos/rendafixa/fixtures/`, fora do git.
- Na Mesa, o cliente e a posição dele ficam **só na memória da página**: nunca no `localStorage`, no
  histórico ou em arquivo. No robô, saem do Tampermonkey assim que a Mesa os recebe.
- **A exceção, decidida com o usuário em 21/10/2026: a Fila do dia.** O cartão de cada e-mail que saiu
  (a conta, o nome e o e-mail do cliente, o texto do e-mail) fica no IndexedDB deste navegador por 90
  dias — é o que a faz sobreviver a recarregar. Nada vai para servidor nenhum (`docs/fila.md`).

### Push é deploy

- Cada envio para a `main` publica na Vercel em cerca de um minuto. **Push, e SQL no banco da mesa,
  só com o OK do usuário.** Desde 21/10/2026 ele autorizou publicar cada fase do `docs/ROADMAP.md`
  quando os testes, o build e o verificador passam (mudança de robô que obrigue a reinstalar: avisar
  antes).
- **Os testes barram a publicação** (21/10/2026): a Vercel roda `npm test && npm run build`
  (`vercel.json`) e não publica se um teste falhar. O GitHub roda testes, build e o verificador a cada
  envio (`.github/workflows/verificar.yml`) e avisa o dono por e-mail quando falha: é o alarme.
- A exceção, autorizada pelo usuário em 21/10/2026: o workflow semanal
  (`.github/workflows/atualizar-tickers.yml`) refaz a lista de tickers da B3, roda os testes e grava
  sozinho quando algum ticker mudou.

### Ordens: nada é adivinhado

O sistema só emite o que foi informado. Quando falta dado crítico, ou há ambiguidade, a saída é
**bloqueada** e o que falta é exibido — jamais preenchido por inferência, arredondamento ou "melhor
esforço". Um número errado numa ordem é dinheiro real do cliente; uma saída ausente é só um clique a
mais. O teste mental, ao mexer em parser, validador ou formatter: *este valor veio do texto do
usuário, ou eu o inventei?*

- **Bloqueio** segura a saída e quase sempre tem um botão de confirmar; **aviso** só acompanha. Os
  bloqueios que confirmar não resolve (conta ausente, fundo ambíguo, ordem que não cabe no formato, a
  conta de outro pedido colada na linha, a venda sem cotas disponíveis…) têm o conserto à vista, um
  botão por saída possível: nunca um beco sem saída.
- As invariantes (cada uma vale um teste; detalhe em [`docs/ordens.md`](docs/ordens.md)):
  1. `Cliente` é sempre a conta numérica.
  2. Quantidade nunca vira financeiro e vice-versa — exceto a compra de fundo no secundário,
     convertida pela cotação do dia.
  3. `Compra` → `C`, `Venda` → `V`.
  4. Preço informado é preservado literalmente; ausente é `A mercado`.
  5. Ticker suspeito de erro de digitação gera aviso pedindo confirmação; corrigir sozinho é proibido.
  6. Ativo repetido bloqueia pedindo confirmação; somar é proibido.
  7. Linha sem quantidade nem financeiro não vira ordem: é descartada com o motivo à vista.
  8. Conta ausente, operação ausente e ticker suspeito bloqueiam.
  9. A ordem de digitação dos ativos é preservada.
  10. Financeiro sai como `R$ X.XXX,XX`.
  11. `Preço Would`, `Hora Inicial` e `Hora Final` só saem com informação explícita.

### O robô do Hub

Um script do Tampermonkey (`src/modulos/ordens/platform/robo-hub.user.js`), em abas do Hub só dele
(🤖). As regras de segurança não mudam (detalhe em [`docs/secundario.md`](docs/secundario.md)):

- **não lê senha, token, cabeçalho, `localStorage` nem `sessionStorage`, e não chama a API do Hub
  por conta própria**: lê só a resposta que o próprio Hub recebe. Um teste confere o texto do script;
- **nunca põe parâmetro no endereço do Hub**: qualquer um trava o módulo;
- **só clica no que está numa lista fechada** (`clicarSo`, mais dois rótulos fixos que a tarefa
  passa: a aba "Tesouro Direto" e o resultado "Conta XP: <a conta do pedido>"): nunca Próximo, Enviar,
  Confirmar ou Vender; e **nunca envia e-mail** — no Outlook, só troca o corpo do e-mail que a Mesa abriu e, na
  caixa de entrada (1.8.0), só lê a lista de mensagens: dos e-mails de hoje com "Confirmação" no
  assunto **ou que citam "conta XP <n>"** (1.11.0, decidido com o usuário em 21/10/2026: a resposta do
  cliente pode vir sem o assunto — o que vale é o cliente responder), o remetente, o e-mail, o assunto,
  a prévia, a hora e a conta citada. Não clica, não abre e-mail e só olha enquanto a Mesa tem pedido
  esperando o cliente;
- **a aba que ele abre para a pessoa é dela** (1.10.0, o botão Boleta da Fila): à vista, ele só a leva
  até a boleta do fundo ou ao Tesouro do cliente, e a larga — não preenche a boleta (só a busca de
  cliente, com a conta do pedido), não clica em Próximo;
- **o print da venda sai numa aba do Hub à vista** (1.12.0), que a Mesa abre e fecha a cada pedido:
  numa aba escondida, o Chrome segura os relógios do JavaScript em um despertar por minuto (o
  estrangulamento intensivo, 10 s depois de a página carregar escondida), e o print, feito de esperas
  curtas, não terminava. Trabalho que vive de relógio não vai para a aba escondida;
- uma tarefa por vez, numa fila, e tudo com prazo: nada que trave numa aba prende os pedidos seguintes;
- mudou o robô, sobe a `@version` **e** a constante `VERSAO`. Desde a 1.13.0, cada máquina se
  atualiza sozinha pelo site (`robo-hub.user.js`, com `@updateURL`), e a Mesa aceita o robô a partir
  da `VERSAO_MINIMA_DO_ROBO` (`roboHub.js`), oferecendo a mais nova em "Atualizar robô". **Se a Mesa
  passar a depender de algo que só o robô novo faz, suba também a `VERSAO_MINIMA_DO_ROBO`** — senão o
  robô antigo seguiria valendo sem saber fazer.

O Hub de verdade se comporta de jeitos que o Hub falso do `verificar` só imita depois de alguém ver
(o Tesouro, por exemplo, pede a lista uma vez por carga da página). **Repita os passos do robô à mão
no Hub de verdade, só lendo, antes de dar um fluxo por certo**, e ponha o que viu no Hub falso. Pelo
Claude in Chrome: nada de Próximo, nada de enviar, e nada de injetar código de fora (o modo
automático bloqueia, com razão; não contorne).

### O build de arquivo único

`npm run build` gera **um único** `dist/index.html`, com JS, CSS e ícone dentro: é o que vai para o
site e o que os colegas abrem com dois cliques, do disco. **Proibido**: recurso externo (fonte, CDN),
`import()` dinâmico, `fetch` de arquivo local e service worker. O `vite.config.test.js` confere.
A única outra saída é o **robô do Tampermonkey** (`dist/robo-hub.user.js`, completo, com a SnapDOM),
que o site publica para cada máquina instalar e se atualizar; a página não o carrega (decidido com o
usuário em 21/10/2026).
Biblioteca pesada que só serve sob demanda entra **como texto** e vira código no primeiro uso, como o
SheetJS (`src/vendor/sheetjs.js`, 21/10/2026): eram 41% do JS, compilados e executados a cada carga.

### O código

- JS puro com módulos ES, sem framework. Um módulo exporta `iniciarX(secao)` e não conhece os
  outros; o que dois usam mora em `src/ui/` (a tela) ou em `src/comum/` (regras e dados: a Fila, os
  horários, o Outlook; a ponte do robô passa por `comum/servicos.js`).
- Texto vindo de fora (planilha, banco, usuário, Hub) vai para `innerHTML` só por `esc`.
- Datas pela chave local `AAAA-MM-DD` (`chaveDoDia`), **nunca `toISOString()`**: às 21h de Brasília,
  o dia viraria o seguinte.
- O visual é por token (`--fundo`, `--texto`, `--acento`…), **nunca valor literal**: um `#fff`
  quebra um dos dois temas. Cada aba tem a cor dela em `--acento`. Contrastes medidos (detalhe em
  [`docs/casca-e-visual.md`](docs/casca-e-visual.md)).
- Todo seletor da Fila começa por `.fl`, da Prateleira de fundos por `.fu`, do Renda Fixa por `.rf`, do Calendário por `.cal`, do
  Operacional por `.op` e das Anotações por `.an`; um teste recusa o que escapa.

## Pendência de segurança — fase 2

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

## Testes

`npm test` (Vitest, ambiente node, fuso `America/Sao_Paulo`). São 1.364 testes; com as exportações
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
   `npx playwright install chromium`). Abre `dist/index.html` via `file://` e confere as
   abas, os dois temas, as larguras de 1000px e ~360px sem rolagem horizontal, a Fila do dia (do e-mail
   copiado ao executado), o console, o CSS que vaza entre
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

# Contexto — onde paramos

**Última atualização: 07/10/2026, tarde.** Este arquivo é o estado do sistema para quem retoma o
trabalho, pessoa ou agente: o que está funcionando, o que foi testado e onde, e o que falta. As
regras de negócio e de código estão no [`CLAUDE.md`](../CLAUDE.md), que é a fonte da verdade; o
[`AGENTS.md`](../AGENTS.md) é o resumo delas para outros agentes. Atualize este arquivo no fim de
cada sessão.

## Resumo

- A Mesa XP tem 5 abas: Ordens, Renda Fixa, Calendário, Operacional e Anotações. O build é um
  arquivo só (`dist/index.html`), que roda no Netlify e aberto do disco.
- O código está no GitHub, em [`Jeferson-Maciel/Mesa.xp`](https://github.com/Jeferson-Maciel/Mesa.xp)
  (`origin`, branch `main`), criado pelo usuário em 07/10/2026. **O repositório é público por
  decisão do usuário ("por enquanto")**, avisado de que isso expõe os textos do Operacional, o robô
  do Hub e a chave anon com o banco aberto; a recomendação de torná-lo privado continua de pé. O trabalho de 05 a 07/10 — o
  secundário, o robô do Hub, a medição de tempos, o **Abrir no Outlook** e o **cliente e o assessor
  no e-mail** (robô 1.3.1) — entrou num commit só, em 07/10. A branch `antigravity/operacional`, de
  outro agente, não foi revisada e fica só na cópia local.
- A Mesa está no ar em **https://mesa-xp.vercel.app** (07/10), ligada ao GitHub: **cada envio para a
  `main` publica sozinho**, em cerca de um minuto. Por isso push é deploy, e os dois só com o OK do
  usuário (SQL no banco também). O robô a reconhece desde a 1.3.2. O Netlify antigo, com a versão
  anterior a 05/10, ficou para trás; o endereço dele nunca foi registrado aqui.
- A última verificação passou inteira (07/10, tarde): 948 testes (`npm test`), o build e 178
  conferências no navegador (`npm run verificar`). As duas conferências das Anotações que dependem
  do relógio ("N abre uma anotação nova…" e "depois de recarregar…") falharam de novo em rodadas de
  07/10 e passaram na seguinte. Já são três vezes: vale olhar.

## O cliente e o assessor no e-mail (07/10, robô 1.3.0 → 1.3.1)

**Primeiro teste no Hub de verdade (07/10, tarde): a 1.3.0 falhou** com "o Hub não mostrou esse
cliente", embora a aba 🤖 Clientes tivesse aberto a ficha certa. A causa: a resposta de
`customer-info` é `{ output: { name, email, advisorCode, … } }`, e a 1.3.0 procurava os campos na
raiz — eles tinham sido vistos nas propriedades da tela, não na resposta. A **1.3.1** lê `output`,
e o Hub falso do `verificar` agora responde nesse formato. Falta o usuário instalar a 1.3.1 e
testar de novo.

A pedido do usuário: o **Abrir no Outlook** já vai para o e-mail do cliente, com o assessor
responsável em cópia e o nome completo do cliente na saudação. Regras no `CLAUDE.md`, "O cliente e
o assessor (robô 1.3.0)". Decisões do usuário: trazer nome e e-mail do Hub **sem guardar**; a
planilha dos assessores **carregada à mão** na Mesa; a saudação com o **nome completo**.

- **Descoberto no Hub de verdade (07/10, com o usuário):** a busca do topo leva à Posição
  Consolidada, `/new/posicao-consolidada/#/<conta em base64>`, e a tela pede `customer-info` por
  XHR, com `name`, `email`, `advisorCode`, `advisorName` e `xpAccount`. Foram lidos só os nomes dos
  campos e o formato (maiúsculas, código `A…`), nunca os valores; a conta usada foi a que o próprio
  usuário digitou na busca.
- **A planilha dos assessores** (Google, "Contatos"): Nome (B), Email (C), Código (G) e Código em
  uso (H), com "Sem código", e-mails "-", linhas que não são pessoas e um segundo Nome (K). A
  exportação direta foi recusada (a planilha é só leitura para o usuário): ele baixa e carrega.
- **A testar no Hub de verdade com a 1.3.1** (o `verificar` usa um Hub falso):
  1. instalar a 1.3.1 (Copiar robô → Tampermonkey) e **fechar as abas 🤖 antigas** (Robô e
     Clientes);
  2. colar um pedido real e ver se a aba "🤖 Clientes" abre e o nome chega;
  3. corrigir a conta para outro cliente e ver se a troca vem sem recarregar a aba (não se sabe se
     o Hub pede a ficha ao trocar só o fim do endereço; se não pedir, o robô recarrega, uns segundos
     a mais);
  4. carregar a planilha e conferir o Cc.
- Arquivos novos: `core/cliente/{assessores,cliente}.js` (+ teste), `ui/cliente.js` (+ teste),
  `platform/assessores.js`. Alterados: `robo-hub.user.js` (1.3.1), `roboHub.js` (`pedirCliente`),
  `platform/outlook.js` (`to`, `cc`), `core/format/formatadores.js` (saudação), `ui/preview.js`,
  `index.js`, `ordens.css`, `index.html` (linha "Assessores" do painel) e o `verificar`.

## Abrir no Outlook (07/10)

A pedido do usuário: ao lado do Copiar dos dois e-mails do Ordens, **Abrir no Outlook** abre um
e-mail novo no Outlook na web, com o assunto **Confirmação de ordem**. Regras no `CLAUDE.md`, logo
antes do link para os formatos de saída; o literal está em `docs/FORMATOS-DE-SAIDA.md`.

- É o endereço de compor do Outlook na web (`outlook.cloud.microsoft/mail/deeplink/compose`), não um
  `mailto:` solto: o `CLAUDE.md` registra que o operador cola no Outlook na web.
- A Ordem por e-mail vai inteira no endereço, e a área de transferência não é tocada. O E-mail em
  tabela abre sem o corpo e vai copiado, porque o endereço só leva texto puro.
- **Testado no Outlook da mesa (07/10, tarde, com a autorização do usuário)**, com dois e-mails de
  teste para endereços `@example.com`, fechados sem enviar:
  - o formato antigo (`to=…&cc=…&subject=…&body=…`) preenche Para, assunto e texto, **mas não a
    cópia** — era o "o assessor não vai em cópia" que o usuário viu;
  - o `mailto:` inteiro dentro do `to` preenche tudo, a cópia inclusive. É o que a Mesa usa desde
    então;
  - as quebras de linha chegam.

  Falta saber se o Outlook guardou algum desses dois como rascunho ("teste Mesa A" e "teste Mesa
  B"); o usuário foi avisado para apagar. Falta também medir o limite real de tamanho: os 7.000
  caracteres foram escolhidos sem medir, e dez ativos dão ~2.900.
- **Endereço `outlook.cloud.microsoft`** (07/10, fim da tarde): a conta de um colega já foi migrada
  pela Microsoft para o endereço novo do Microsoft 365, e o `outlook.office.com` dele redirecionava
  para a caixa de entrada, sem o e-mail (no Firefox e nos dois formatos de link). O endereço novo
  foi testado na conta do usuário (Para, Cc, assunto e texto entram); falta a confirmação do colega.
- **Abre numa janela só do e-mail** (escolha do usuário em 07/10), uma por clique. Reaproveitar a
  aba do Outlook que a pessoa já tem aberta não é possível a partir da página.
- Arquivos: `platform/outlook.js` (+ teste), `ui/saidas.js`, `index.js`, `ordens.css`, o ícone
  `--i-envelope` em `src/ui/base.css` e uma seção no `verificar`.

## Estado por aba

| Aba | Estado |
| --- | --- |
| **Ordens** | Em uso. A compra de fundo no secundário, os botões de ROA, o favorito 📥 e o robô do Hub são de 05–06/10; o Abrir no Outlook e o cliente e o assessor no e-mail, de 07/10. |
| **Renda Fixa** | Estável desde a fusão (29/09), protegida por goldens contra o motor original. |
| **Calendário** | No Supabase `rtvtgulivtkpfprcfpie`. Começou do zero em 30/09, por decisão da mesa: o projeto antigo não resolvia mais. |
| **Operacional** | No mesmo Supabase. 15 posts vieram do Slab só com título: a mesa cola o texto pela tela, e **ninguém inventa** esses textos. |
| **Anotações** | No IndexedDB de cada navegador. Não vão para o banco porque costumam ter dado de cliente, e sem login a chave anon é pública. |

A pendência de segurança continua: sem login, a chave anon lê e escreve no Calendário e no
Operacional. A correção está no `CLAUDE.md`, "Pendência de segurança — fase 2".

## O que foi feito em 05 e 06/10 (Ordens: fundos no secundário)

1. **Compra de fundo pela boleta do secundário** (05/10). O pedido em R$ vira cotas pela conta da
   boleta (`core/secundario/boleta.js`), conferida contra boletas reais. É a exceção à invariante 2:
   o e-mail de fundo leva a quantidade.
2. **A API da Prateleira** (06/10). O usuário descobriu `/v3/investment-funds-secondary`, e o
   favorito **📥 Fundos → Mesa** baixa a resposta inteira num `.json`. A leitura dos campos foi
   conferida na captura real das 12:09 e em quatro boletas:
   - `secondaryPurchaseDiscount` é o deságio máximo;
   - `treasuryMinimumPurchaseDiscount` é o deságio mínimo do cliente;
   - **ROA máximo = deságio máximo − deságio mínimo**;
   - `percentageComission` é a corretagem;
   - `treasuryMinimumBuyCost` **não** é o ROA.

   Na manhã de 06/10 o sistema chegou a ler esses campos errado, a partir de um contexto colado de
   outra IA. A captura real desfez o engano antes de qualquer uso.
3. **Dois cenários no cartão e no e-mail:** os botões **Copiar · ROA máximo** e **Copiar · ROA
   zerado**, com a escolha valendo para a solicitação inteira.
4. **150 fundos na lista** (32 com ticker). O ticker de um fundo da prateleira, escrito sozinho
   (`VGPR11`), é o fundo.
5. **O robô do Hub**, um script do Tampermonkey, foi da 1.0 à 1.2.0 no mesmo dia:

   | Versão | O que mudou |
   | --- | --- |
   | 1.0 | Ao colar, o robô clica em Atualizar na aba do Hub e devolve a cotação à Mesa. |
   | 1.1.0 | Preço exato da cota: abre a boleta pela rota `#/secundario/comprar/<fundo>/<conta>` e lê `quotaValue` do pre-check. |
   | 1.1.1 | A aba do robô "age como à vista". Foi diagnóstico errado; ficou por segurança. |
   | 1.1.2 | **A causa real:** qualquer parâmetro no endereço do Hub trava o Mercado Secundário. A aba passa a abrir sem parâmetro, reconhecida por um bilhete. |
   | 1.1.3 | Medição de tempos e o botão **Copiar tempos**. |
   | 1.2.0 | Boletas uma atrás da outra, cada preço entregue na hora, boleta só quando o preço exato muda as cotas, Atualizar só se a lista não veio sozinha, aba do robô aberta junto com a Mesa. |

## Como o robô está funcionando hoje (medido no Hub de verdade, 06/10)

**Ao colar um pedido com compra de fundo:**
1. Se a lista da Prateleira tem mais de 2 minutos, a Mesa pede uma nova: o robô clica em Atualizar
   na aba 🤖.
2. Para cada fundo pedido em R$ cujo preço exato ainda não está guardado no dia, **e só se esse
   preço puder mudar as cotas**, o robô abre as boletas uma atrás da outra e devolve o preço de cada
   uma.

**Tempos medidos:**

| O quê | Tempo |
| --- | --- |
| Cotação, com a aba 🤖 pronta | **3,4 s**: 1,6 s do servidor da XP + 1,6 s até o cartão. Eram 9 s quando a aba não estava pronta. |
| Preço exato | **0,9 a 1,9 s por fundo**. Chegou a 3,8 s quando o próprio Hub demorou a responder. |
| 6 fundos inéditos | **9,7 s**. Eram 76,5 s na 1.1.3. |
| Fundo buscado há menos de 10 minutos | Nada: o preço fica guardado com a hora da leitura. Desde 07/10 vale 10 minutos (antes, o dia todo): o PU muda ao longo do dia. |

- **Ir de uma boleta direto para outra dispara o pre-check no Hub de verdade.** No piloto, as 5
  trocas foram diretas, e o caminho de reserva (passar pela Prateleira) não foi usado.
- **Para instalar ou atualizar:**
  1. Na Mesa, clique em **Copiar robô**, cole no Tampermonkey e salve.
  2. **Feche a aba 🤖 antiga**: ela segue rodando o script velho até recarregar.
  3. Recarregue a Mesa e espere a linha **Robô** do painel dizer "pronto · aba 🤖 do Hub aberta",
     com o ponto verde.

  O passo a passo completo está no README, "Fundos no secundário".
- **Para diagnosticar:** depois de uma busca, **Copiar tempos** copia a linha do tempo da Mesa e do
  robô. Ele não leva nada do cliente: número longo vira `<n>`.

## Revisão de layout (06/10, à noite)

A pedido do usuário ("pode fazer tudo que conseguir"), depois de capturas das cinco abas nos dois
temas e no celular. A paleta, os temas e as outras abas ficaram como estavam; mudou o Ordens:

- **A tabela do cartão cabe inteira até o Preço de 1280px para cima.** Antes, até um pedido só de
  tickers transbordava em 1366 e 1400px, e o Preço ficava atrás de uma rolagem lateral (detalhes
  no `CLAUDE.md`, "Fundos no secundário").
- **Os cenários do Secundário viraram uma tabelinha** de colunas alinhadas; no celular, empilhados.
- **O Secundário do painel** virou duas linhas de estado com ponto de cor (Cotação e Robô), com o
  carregamento à mão recolhido. Os textos do robô mudaram: "não instalado", "pronto · aba 🤖 do Hub
  aberta", "versão X instalada — copie a Y".
- **No celular**, os botões de copiar e os do aviso de bloqueio descem para a linha de baixo. O
  aviso, antes, espremia o texto numa coluna e deixava a página com 446px numa tela de 390px.
- **Anotações:** o exemplo da entrada rápida ficou mais curto, para caber no campo.

Ficou de fora, por ser conteúdo e não layout: os 15 posts do Operacional com "texto pendente".

## O que custou caro descobrir

- **Parâmetro no endereço do Hub** (`?qualquer=coisa`) trava o módulo do Mercado Secundário: a
  página fica em branco, sem botão Atualizar e sem pre-check, até com F5.
- **Numa aba escondida, trocar de tela custa segundos.** Voltar à Prateleira levava 3,4 a 4 s de
  desenho. Depois, a Prateleira baixa a lista de novo, e a boleta seguinte disputava a aba com ela.
  Era quase metade do tempo da 1.1.3.
- **Duas trocas de endereço no mesmo instante, o Hub vê como uma só.** Por isso `trocarDeTela`
  espera o `hashchange` antes da próxima troca. O Hub falso do `verificar` reproduz isso.
- **O pre-check só sai com um cliente na boleta**, e o Hub o chama duas vezes por boleta. Com conta
  inventada (`1234567`), a boleta real fica em branco: o teste no Hub de verdade precisa de uma
  conta de cliente real, que o próprio usuário informa.
- **A medição apontou o gargalo.** Antes de medir, a suspeita era o Hub; o relatório mostrou que o
  Hub responde em menos de 1 s.

## Pendências e decisões em aberto

1. **O robô 1.3.2 no Hub de verdade**: instalar, fechar as abas 🤖 antigas e testar pela Mesa da
   Vercel (cliente, assessor em cópia e Outlook).
2. **Atualização sozinha do robô.** Publicar o script no próprio site (com `@updateURL`) permitiria
   que o Tampermonkey de cada colega se atualizasse sem colar de novo.
3. **Proposta sem resposta:** atualizar a lista quando a pessoa volta para a aba da Mesa, se ela
   tiver mais de 2 minutos. Isso tiraria os 3,4 s da cotação da frente da colagem, e o Hub só seria
   chamado nesse momento, não a cada X minutos.
4. **Boletas a conferir:** um XP CDI Private e um FIP, que vêm sem corretagem e decidem as duas
   travas desses fundos, e um fundo com ágio.
5. **Avisos do pre-check:** `checks` e `customer` (garantia, perfil) poderiam virar avisos no cartão
   antes do e-mail.
6. O resto do secundário está em [`ROADMAP.md`](ROADMAP.md), seção "Secundário — o que ficou em
   aberto".
7. **Fase 2:** login, RLS fechada e repositório privado (`CLAUDE.md`, "Pendência de segurança").

## Arquivos do secundário e do robô

| Arquivo | Papel |
| --- | --- |
| `src/modulos/ordens/core/secundario/estoque.js` | Lê a captura do Hub e a planilha exportada |
| `src/modulos/ordens/core/secundario/boleta.js` | A conta da boleta e as cotas que cabem no valor |
| `src/modulos/ordens/core/secundario/secundario.js` | Liga a boleta à ordem: cenários, teto, preço exato, `precoExatoMuda` |
| `src/modulos/ordens/core/validate/validar.js` | Os bloqueios `secundario-*` |
| `src/modulos/ordens/ui/secundario.js`, `ui/saidas.js` | O bloco do cartão e os botões de copiar por ROA |
| `src/modulos/ordens/ui/tempos.js` | O relatório do **Copiar tempos** |
| `src/modulos/ordens/platform/robo-hub.user.js` | **O robô**, o script do Tampermonkey (versão 1.3.1: Prateleira, boletas e a ficha do cliente) |
| `src/modulos/ordens/platform/roboHub.js` | A ponte Mesa ↔ robô: `pedirCotacao`, `pedirCotas`, `pedirRegistro` |
| `src/modulos/ordens/platform/secundario.js` | O que fica no `localStorage`: `ordens_secundario_estoque`, `_tetos_roa`, `_cotas` |
| `src/modulos/ordens/platform/favorito-hub.js`, `favoritoDoHub.js` | O favorito 📥 |
| `scripts/verificar-navegador.mjs` | Tampermonkey simulado e Hub falso: imita aba escondida, parâmetro no endereço, lista ao abrir e troca direta de boleta |
| `scripts/atualizar-fundos.mjs` | `npm run fundos:update -- captura.json` regenera `fundosXP.js` |

As chaves que o robô usa no armazenamento do Tampermonkey são `abas`, `abaPedida`, `abriuHubEm`,
`pedido`, `atendendo`, `captura`, `pedidoCotas`, `cotas`, `cotaVista` e `registro`, e desde a 1.3.0
`abaPedidaClientes`, `abriuClientesEm`, `atendendoClientes`, `pedidoCliente`, `cliente` e
`recarregouPara`. Nenhuma guarda dado de cliente depois da busca: `pedidoCotas` e `pedidoCliente`
são apagados ao fim dela, e `cliente` assim que a Mesa o recebe. O `verificar` confere isso.

O trabalho de 05 a 07/10 entrou num commit só, depois de `81e7981`. Novos nele: `core/secundario/*`,
`core/cliente/*`,
`platform/{assessores,favorito-hub,favoritoDoHub*,outlook*,robo-hub.user,roboHub*,secundario}.js`,
`ui/{cliente,secundario,tempos}*`, `AGENTS.md` e este arquivo.

## Fora do repositório (na pasta-mãe, `…/unificando ordens disparo calendario +/`)

- `mercado-secundario-06-10-2026-12h09.json` — a captura real. **Nunca versionar**: o repositório
  é público, e os dados são internos da XP.
- `favorito-roa-adicional.js` (fonte), `.txt` e `instalar-roa-adicional.html` — o favorito próprio
  do usuário, "📊 ROA Secundário", com a regra certa.
- `OPERACIONAL_CLAUDE.md` — documento antigo de outro agente (29/09). Não reflete o código atual.
- Prints das boletas: `OneDrive\Imagens\Screenshots` (05/10 17:22–18:16 e 06/10 11:11).

## Como o usuário prefere trabalhar

- Quando ele pede para **"só pensar e planejar"**, nada é alterado.
- **Medir antes de otimizar.** O relatório de tempos decidiu o que fazer no robô.
- Commit, push, deploy e SQL no banco **só com o OK dele**.
- **Nunca** ler ou guardar token ou cabeçalho do Hub, nem chamar a API dele por conta própria. O
  robô só escuta o `fetch` do próprio app e troca a rota da aba dele, e nunca passa da etapa 1 da
  boleta: não digita, não clica, não preenche.
- **Nunca pôr conta de cliente** em endereço nem escolher cliente no Hub por conta própria. Conta
  real em teste só a que o usuário informar, e ela não entra no repositório nem neste arquivo.
- Ao testar no Chrome dele (Claude in Chrome), **não abrir o Hub com parâmetro no endereço**: além
  de travar o Hub, o robô instalado pode adotar a aba.

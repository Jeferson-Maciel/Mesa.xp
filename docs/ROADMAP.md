# Roadmap

O que está **em aberto**: defeitos conhecidos, ideias e decisões que esperam o operador. O que já foi
feito sai daqui — a história fica no `git log`, e as regras no `CLAUDE.md` e nos documentos de cada
módulo. Revisto em 21/10/2026 (noite), depois do relatório "Raio-X da Mesa XP" e das decisões do
usuário sobre ele.

Cada item diz o que falta e, quando há, de quem é a decisão. Sugestão nova vem para cá, não para o
código.

## As fases decididas (21/10/2026)

Uma sessão de perguntas antes de cada fase (o usuário pediu "sempre faça sessões de grilling"); cada
fase sai publicada quando os testes, o build e o verificador passam.

1. **Base** — os testes antes de cada publicação (a Vercel roda `npm test`; o GitHub roda também o
   verificador); o robô que se atualiza sozinho (1.13.0, o arquivo `robo-hub.user.js` no site e a
   versão mínima compatível na Mesa); a limpeza deste roadmap e do CSS sem uso; o post "Como a Mesa
   funciona" no Operacional.
2. ~~**Renda Fixa configurável**~~ — **feita em 21/10/2026** (ver `docs/rendafixa.md`). Tudo o que faz a aba funcionar virou regra editável na própria tela,
   **uma configuração para cada mercado** (primário e secundário), guardada no navegador de cada um,
   sem login: o PU máximo, os prazos exibidos por categoria e os dos isentos, os tipos isentos, o
   descarte de liquidez diária e de público qualificado e profissional, os bancos, a linha sem Tax.Mín
   nem Tax.Máx (padrão: descartar), os títulos e o modelo de cada linha da mensagem (com ou sem
   emissor…), e, em "Avançado", o reconhecimento do tipo pelo nome e os nomes das colunas. Com
   "Restaurar o padrão" e "Copiar / Colar configuração" para passar a um colega.
   - **2b. O robô buscar os dados no Hub** em vez da planilha baixada todo dia (Renda Fixa → emissão
     bancária, e o secundário): estudo na tela de verdade, que o usuário mostra pelo Claude in Chrome.
     A planilha fica como reserva. A troca do SheetJS pelo menor (sem `.xls`) espera esse estudo.
3. ~~**Fila e avisos**~~ — **feita em 22/10/2026** (ver `docs/fila.md`, "O aviso de prazo" e "O
   histórico do Ordens e a Fila"): o som só na resposta do cliente, no erro e no aviso de prazo; no
   máximo 3 avisos à vista; o aviso de prazo em qualquer aba (15 min antes em Aprovação e execução, 30
   min antes nos Enviados), com o contador âmbar; Aprovação e execução em tabela; o histórico do Ordens
   com o estado na Fila e o Reabrir com as correções do cartão.
4. **Ordens** — a tabela de posições colada (`Ativo / Qtd. Teórica / Qtd. Atual`) não é pedido de
   ordem: não gera nada e diz isso; o fracionário (`PETR4F`); os exemplos num menu; os emoji dos
   atalhos de formato viram ícones de traço; o favorito 📥 sai depois de o robô passar no Hub de
   verdade.

## Decidido não fazer (por enquanto)

- **F22** (o "não" do cliente avisar o assessor): descartada por enquanto (21/10/2026).
- **Login no Calendário e nas Anotações**: ficam sem login; o que é de cada um fica no navegador.
- **ROA.E. da Tabela de Cetipados**: fica de fora por enquanto.
- **Os links antigos** (o Ordens no Netlify, o RendaFixa Pro, o Calendário antigo): o usuário já os
  desativou.

## A conferir no Hub e no Outlook de verdade

O passo a passo está em [`CONTEXTO.md`](CONTEXTO.md), "A testar no Hub e no Outlook de verdade".

1. **O print da venda (robô 1.12.0)**, numa aba do Hub à vista que fecha sozinha; e os prints entrando
   no e-mail do Outlook.
2. **As respostas no Outlook (robô 1.11.0)**: o selo verde com a caixa aberta, a resposta com e sem o
   assunto de confirmação.
3. **O Tesouro (robô 1.7.x)**: a lista e a posição, com a recarga da aba para ler de novo.
4. **A boleta pela Fila (robô 1.10.0)** e **o Estoque clientes** (o deságio e o estoque contra a boleta).
5. **A instalação pelo site (robô 1.13.0)**: "Instalar robô" abre a tela do Tampermonkey; a versão
   seguinte chega sozinha.

## Prateleira de fundos

- **Marcar o fundo de investidor qualificado** na tabela.
- **Do fundo na tabela para o Ordens**, com a linha pronta e a conta a preencher.

## Ordens

- **`PETR4 39,50` sozinho** vira ordem de R$ 39,50 (decisão do operador: centavos são financeiro), mas
  pode ter sido um preço sem quantidade; o preview é quem pega.
- **TWAP exige dois horários.** "A partir das 10h" não é lido, de propósito.
- **`Preço Would`** nunca é preenchido, e o horário na planilha (`HH:MM`) nunca foi confirmado:
  esperam um pedido real que mostre o formato.
- **Conta escrita depois das ordens** deixa as ordens numa solicitação sem conta. Bloqueia (não é
  perigoso), mas obriga a reescrever.
- **Linhas de conversa** ("Bom dia!") que a limpeza não pega aparecem nos descartes.
- **Editar um campo e clicar direto num Copiar**: o `change` do campo, que dispara no clique, refaz as
  saídas debaixo do mouse, e o clique se perde (achado pelo `verificar` na Fase 3; contornado lá com um
  Tab). Um clique que some é um clique a mais, não uma ordem errada, mas confunde.
- **Separar o `index.js` do Ordens** (1.521 linhas): aos poucos, quando cada parte for mexida.
- **A Fila guardar as quantidades aprovadas como dado** na hora do envio, em vez de relê-las do texto
  do e-mail (hoje presa aos modelos do `FORMATOS-DE-SAIDA.md`).

Ideias, com o custo grosseiro:

| | Ideia | Custo |
| --- | --- | --- |
| F5 | Colar a ordem enviada junto do pedido e receber as divergências | alto |
| F6 | Um clique põe a cesta inteira em Venda | baixo |
| F12 | Fila do dia: trabalhar o despejo da conversa solicitação por solicitação | médio |
| F15 | Pedido por print (OCR) — só como sugestão que obriga conferir campo a campo: OCR troca dígito de conta | alto |
| F16 | Cestas favoritas, depois de o uso mostrar quais se repetem | médio |
| F21 | Segmentados como `radiogroup`: duas paradas de tabulação por linha em vez de seis | baixo |

## Robô do Hub e secundário

- **Tirar o "Copiar robô"** e os 345 KB de texto dele da página depois de 28/10/2026, uma semana depois
  da instalação pelo site (robô 1.13.0).
- **Separar o robô em partes** montadas no build (hoje 1.766 linhas num arquivo), para testar cada uma.
- **Fundos sem corretagem** (44 na captura de 06/10: os XP CDI Private e FIPs com deságio de 5% a 15%
  e mínimo zero): a captura não dá o teto deles, e o pedido em R$ segura com
  `secundario-sem-corretagem`. Uma boleta de cada tipo, com a barra do ROA no fim, decide.
- **Ágio** (deságio negativo, em seis fundos): ver numa boleta se há ROA neles.
- **`canApply`** falso em 12 fundos da captura de 06/10: um aviso por ele precisa de uma boleta que
  mostre o que significa.
- **Avisos do pre-check**: a resposta traz `checks` e `customer` (garantia, perfil do cliente), que
  poderiam virar avisos no cartão antes do e-mail.
- **Atualizar a cotação ao voltar para a Mesa**: se a lista tem mais de 2 minutos quando a pessoa
  volta para a aba, o robô atualiza na hora, e a colagem não espera.
- **O incentivo do Estoque clientes** (0,50% cetipados, 0,25% Portfolio Renda+) não vem na resposta.
- **Histórico do ROA**: guardar as capturas mostraria quando o ROA de um fundo muda. Depende de onde
  guardar.

## Renda Fixa

- **Lê só a primeira aba** da planilha.
- **A imagem para baixar** segue o formato padrão da taxa e do prazo (as casas e o texto do prazo das
  regras valem só para a mensagem).

## Operacional

- **Colar o texto dos 15 posts pendentes** (os 12 de Padrões de Fixing, Confirmação resgate fundos,
  Confirmação aplicação Fundos, Ações e Fundos Listados): pela própria tela; não se inventa texto.
- **Restaurar uma versão pela tela**: o banco guarda todas (`operacional_revisoes`); hoje a
  recuperação é pelo painel do Supabase.
- Do Slab, não vieram: rascunhos, favoritos, "mais populares", Content Map, grupos, banner do tópico,
  excluir ou renomear tópico. Entram se a mesa sentir falta.

## Anotações

- **Alerta com o navegador fechado**: exigiria service worker, que o arquivo único não permite.
- **Os modelos de nota vindos do Operacional**, em vez de uma lista à parte.

## Casca e engenharia

- **O plano gratuito do Supabase pausa** depois de dias sem uso. Usado todo dia, não pausa; num
  recesso, pode.

## Segurança

A chave anon do Supabase está no código de um repositório público, e o banco do Calendário e do
Operacional fica aberto a quem tiver o link (ver `CLAUDE.md`, "Pendência de segurança — fase 2"). Em
21/10/2026 o usuário decidiu que o Calendário e as Anotações ficam sem login; o que resta da fase 2
(repositório privado, regras de acesso no banco sem login de cada pessoa) espera uma conversa com ele.

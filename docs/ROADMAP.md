# Roadmap

O que está **em aberto**: defeitos conhecidos, ideias e decisões que esperam o operador. O que já foi
feito sai daqui — a história fica no `git log`, e as regras no `CLAUDE.md` e nos documentos de cada
módulo. Revisto em 21/10/2026.

Cada item diz o que falta e, quando há, de quem é a decisão. Sugestão nova vem para cá, não para o
código.

## A conferir no Hub e no Outlook de verdade

O passo a passo está em [`CONTEXTO.md`](CONTEXTO.md), "A testar no Hub e no Outlook de verdade".

1. **O print da cotação de venda (robô 1.12.0).** A suspeita se confirmou na documentação do Chrome:
   a aba escondida tem os relógios segurados em um despertar por minuto, e o print não terminava. Desde
   a 1.12.0 ele sai numa aba à vista, como nos passos repetidos à mão em 20/10, que funcionavam. Falta o
   teste na boleta de verdade; se falhar, o motivo aparece na venda e o "Copiar tempos" diz o passo.
2. **O corpo em HTML colado no Outlook** (os prints abaixo de "Condições:", a tabela em grade): só no
   Outlook de mentira.
3. **O Tesouro (robô 1.7.x)**: a lista e a posição, com a recarga da aba para ler de novo. O fluxo foi
   repetido à mão no Hub em 20/10; o robô inteiro, não.
4. **O Estoque clientes**: o deságio e o estoque contra a boleta.
5. **As respostas no Outlook (robô 1.8.0)**: só a caixa de entrada de mentira foi testada. A forma da
   lista do Outlook na web de verdade (a lista, as opções, o e-mail no `title` do remetente, a hora)
   precisa ser conferida com um e-mail de teste respondido.

## Prateleira de fundos

- **O disparo "Tabela de Cetipados"** (o modelo do Operacional: os fundos agrupados por "ROA.E. x%"
  e por "Deságio Venda x%", com o "(IQ)" dos de investidor qualificado). Espera o operador: **como se
  chega ao ROA.E. de cada fundo** (o ROA máximo da captura? arredondado como? quais fundos entram?), e
  de onde vêm o deságio de venda e o "IQ" (a captura da Prateleira tem o de compra).

## Ordens

- **Tabela de posições colada lê a coluna errada.** `Ativo / Qtd. Teórica / Qtd. Atual` vira ordem
  com a teórica, e posição zerada entra junto. Implementar de verdade (usar `Qtd. Atual`, excluir
  `≤ 0` com aviso) ou recusar a tabela explicitamente. Decisão do operador.
- **Fracionário (`PETR4F`)** vai para os descartes: o formato de ticker não aceita o `F`.
- **`PETR4 39,50` sozinho** vira ordem de R$ 39,50 (decisão do operador: centavos são financeiro), mas
  pode ter sido um preço sem quantidade; o preview é quem pega.
- **Reabrir do histórico descarta as correções feitas no cartão**: o histórico guarda o texto e o
  passa pelo pipeline de novo. Guardar as correções ao lado do texto resolveria.
- **TWAP exige dois horários.** "A partir das 10h" não é lido, de propósito; se aparecer no grupo,
  vira lacuna.
- **`Preço Would`** nunca é preenchido: nenhum pedido mostrou como ele vem. **O horário na planilha
  (`HH:MM`)** nunca foi confirmado.
- **Conta escrita depois das ordens** deixa as ordens numa solicitação sem conta. Bloqueia (não é
  perigoso), mas obriga a reescrever.
- **Linhas de conversa** ("Bom dia!") que a limpeza não pega aparecem nos descartes.
- **Separar o `index.js` do Ordens** (1.240 linhas; o tratador de cliques tem ~190). Não muda nada
  para quem usa; facilita mexer sem quebrar o vizinho. Fazer aos poucos, quando cada parte for mexida.

Ideias, com o custo grosseiro:

| | Ideia | Custo |
| --- | --- | --- |
| F2 | Conta que nunca apareceu no histórico pede confirmação — a lógica da lista da B3 no campo mais crítico | médio |
| F3 | Mesma conta e mesmo ativo já processados hoje: alerta de envio duplicado | baixo |
| F4 | Depois de gerar, o texto colado com o que virou ordem marcado; o que ficar sem marca foi ignorado | médio |
| F5 | Colar a ordem enviada junto do pedido e receber as divergências | alto |
| F6 | Um clique põe a cesta inteira em Venda | baixo |
| F8 | `Ctrl+Z` depois de remover uma linha por engano | baixo |
| F9 | Baixar o lote como arquivo, além de copiar | baixo |
| F11 | Copiar tudo quando o bloco tem várias contas | baixo |
| F12 | Fila do dia: trabalhar o despejo da conversa solicitação por solicitação | médio |
| F13 | Estado por solicitação: pendente / enviado mesa / confirmado | médio |
| F14 | Resumo do dia por conta, para a conferência do fim do expediente | médio |
| F15 | Pedido por print (OCR) — só como sugestão que obriga conferir campo a campo: OCR troca dígito de conta | alto |
| F16 | Cestas favoritas, depois de o uso mostrar quais se repetem | médio |
| F20 | Atalhos visíveis (`Ctrl+Enter`, `Alt+H` só estão no `title`) | baixo |
| F21 | Segmentados como `radiogroup`: duas paradas de tabulação por linha em vez de seis | baixo |
| F22 | Fila: o cliente respondeu "não" → abrir no Outlook o e-mail ao assessor, preenchido, para a pessoa enviar (o usuário, 21/10/2026: "se o cliente responder não, aí notificamos o assessor"). Quem lê "sim" ou "não" é o operador | médio |

## Robô do Hub e secundário

- **O robô se atualizar sozinho em cada máquina.** Hoje cada um copia o robô novo à mão ("Copiar
  robô"). Publicar o script no site (Vercel) com `@updateURL`/`@downloadURL` faria o Tampermonkey de
  cada um buscar a versão nova sozinho.
- **Fundos sem corretagem** (44 na captura de 06/10: os XP CDI Private e FIPs com deságio de 5% a 15%
  e mínimo zero): a captura não dá o teto deles, e o pedido em R$ segura com
  `secundario-sem-corretagem`. Uma boleta de cada tipo, com a barra do ROA no fim, decide.
- **Ágio** (deságio negativo, em seis fundos): ver numa boleta se há ROA neles.
- **`canApply`** falso em 12 fundos da captura de 06/10 (11 sem estoque; o outro, o XP SS 1 FIC FIDC):
  um aviso por ele precisa de uma boleta que mostre o que significa.
- **Avisos do pre-check**: a resposta traz `checks` e `customer` (garantia, perfil do cliente), que
  poderiam virar avisos no cartão antes do e-mail.
- **Atualizar a cotação ao voltar para a Mesa** (proposto em 06/10, sem resposta): se a lista tem mais
  de 2 minutos quando a pessoa volta para a aba, o robô atualiza na hora, e a colagem não espera.
- **O incentivo do Estoque clientes** (0,50% cetipados, 0,25% Portfolio Renda+) não vem na resposta.
- **Histórico do ROA**: guardar as capturas mostraria quando o ROA de um fundo muda. Depende de onde
  guardar (fase 2).
- **O favorito 📥 velho**: quem o arrastou fica com aquela versão; se o Hub mudar o botão Atualizar ou a
  API, cada um arrasta o novo. Com o robô, ele é só o caminho de reserva.

## Renda Fixa

- **Sem Tax.Mín nem Tax.Máx, o motor usa o ROA como taxa** (a primeira célula com "%"). O golden da
  planilha sintética registra o comportamento atual (linha `CDB SO ROA`). Corrigir exige decidir com o
  assessor e atualizar os goldens à mão.
- Limitações herdadas do RendaFixa Pro: lê só a primeira aba; as regras (PU máximo, prazos exibidos,
  janela, bancos) estão fixas em `motor.js`; a seção de isentos diz "LCAs/LCIs" mesmo quando o
  vencedor é uma LCD; as variações dependem de uma análise salva antes de hoje; o histórico fica no
  navegador.
- **Tamanho do arquivo**: o SheetJS completo é a maior parte do `dist/index.html`. Medir se o
  `xlsx.mini.min.js` da mesma versão lê a exportação da XP e os .xls/.csv aceitos; se ler, o arquivo
  cai perto da metade, e a abertura fica mais rápida.

## Calendário

- **O erro de rede demora ~12 s para aparecer** (o supabase-js tenta de novo). Um "tentando
  conectar…" com contagem, ou menos tentativas, deixaria claro que a rede caiu.
- **O aviso de horário inválido aparece atrás do véu da janela do dia**: mostrar dentro da janela,
  como o erro ao salvar.
- O motivo do horário indisponível não aparece na matriz (pode ser de saúde). Se a mesa sentir falta,
  um ícone com o motivo no `title` — decidir junto com a fase 2.

## Operacional

- **Colar o texto dos 15 posts pendentes** (os 12 de Padrões de Fixing, Confirmação resgate fundos,
  Confirmação aplicação Fundos, Ações e Fundos Listados): pela própria tela; não se inventa texto.
- **Anexos** (foto, áudio, vídeo): no Storage do Supabase, num bucket privado — depende do login.
- **Restaurar uma versão pela tela**: o banco guarda todas (`operacional_revisoes`); hoje a
  recuperação é pelo painel do Supabase.
- **Autor por edição**: sem login não há quem.
- Do Slab, não vieram: rascunhos, favoritos, "mais populares", Content Map, grupos, banner do tópico,
  excluir ou renomear tópico. Entram se a mesa sentir falta.

## Anotações

- **Acompanhar a pessoa entre computadores**: com login, um adaptador do Supabase por usuário e o
  Storage privado para os prints. Hoje, o backup leva à mão.
- **Alerta com o navegador fechado**: exigiria service worker, que o arquivo único não permite.
- **Lembrete que se repete** (todo dia 5, toda segunda).
- **Anotar a partir das outras abas**: um "anotar" no cartão do Ordens com a conta e o ativo; um
  "lembrar" no dia do Calendário.
- **Compartilhar uma anotação** (depende do login) e **modelos da própria mesa** criados pela tela.

## Casca e engenharia

- **Os avisos de tela se acumulam sem limite** quando muitos saem juntos.
- **CI a cada envio**: `npm test`, o build e o `verificar` no GitHub Actions, antes da Vercel publicar.
  O workflow semanal dos tickers já roda os testes; falta um a cada push. As exportações reais da XP
  ficam fora do git, e os goldens delas seriam pulados no CI.
- **O plano gratuito do Supabase pausa** depois de dias sem uso. Usado todo dia, não pausa; num
  recesso, pode. Se a mesa depende disso, avaliar um plano que não pause.
- **Aposentar os links antigos** (o Ordens no Netlify, o RendaFixa Pro, o Calendário antigo na
  Vercel), se ainda estiverem no ar, depois que a mesa migrar.

## Segurança — fase 2

A chave anon do Supabase está no código, e o banco do Calendário e do Operacional fica aberto a quem
tiver o link (ver `CLAUDE.md`, "Pendência de segurança — fase 2"): Supabase Auth, políticas RLS
fechadas para a equipe, repositório privado e rever o que vai no motivo de ausência. Destrava também
os anexos do Operacional, as anotações entre computadores e o autor de cada edição.

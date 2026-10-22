# Contexto — onde paramos

**Última atualização: 22/10/2026.** Este arquivo é o estado do sistema para quem retoma o
trabalho, pessoa ou agente: o que está funcionando, o que foi testado e onde, e o que falta. As
regras estão no [`CLAUDE.md`](../CLAUDE.md) (o que vale sempre, e o mapa) e nos documentos de cada
módulo, aqui em `docs/`; o
[`AGENTS.md`](../AGENTS.md) é o resumo delas para outros agentes. Atualize este arquivo no fim de
cada sessão.

## Resumo

- A Mesa XP tem 7 abas: Ordens, Fila do dia, Fundos, Renda Fixa, Calendário, Operacional e
  Anotações. O build é um arquivo só (`dist/index.html`), que roda no site (Vercel) e aberto do disco.
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
- A última verificação (22/10), inteira, na máquina do usuário, com as duas branches da nuvem juntas:
  1.394 testes (`npm test`; sem as planilhas reais, 18 são pulados), o build e 355 conferências no
  navegador (`npm run verificar`); no GitHub também, no Ubuntu 24.04.
  Antes (21/10, noite), inteira: 1.340 testes e 336 conferências no navegador (`npm run verificar`). O Hub de mentira
  agora se comporta como o de verdade no Tesouro (uma leitura por carga, o clique cedo ignorado, a
  aba de Posições). As duas
  conferências das Anotações que falhavam de vez em quando desde 07/10 eram corrida no teste (o foco
  vai para o título no quadro seguinte; o print vem do IndexedDB depois do editor), e agora esperam
  a condição.
- **Publicado em 21/10/2026 (noite), com o OK do usuário**: os commits de 20 e 21/10 (o histórico
  limpo antes, ver abaixo), com o workflow semanal dos tickers da B3. Os colegas precisam copiar o
  robô 1.13.0 uma vez ("Instalar robô" → Instalar, no Tampermonkey) e recarregar a aba do Outlook e a
  do Hub; daí em diante ele se atualiza sozinho.

## Para quem continuar (a sessão na nuvem, ou outra)

**A Fase 3 (Fila e avisos), o Calendário, o F20 e o F9 estão publicados** (22/10): feitos em duas
sessões na nuvem, revistos e juntados na `main` na máquina do usuário (os pull requests #1 e #2).
**Próximo passo: a Fase 4 (Ordens)**, com a rodada de perguntas antes; e a 2b (o robô buscar os dados
de Renda Fixa no Hub — precisa do usuário mostrando a tela).

**Na nuvem, não há**: as exportações reais da XP (`src/modulos/rendafixa/fixtures/*.xlsx`, fora do git
— os goldens delas são pulados), o Hub e o Outlook de verdade, o Tampermonkey nem o Chrome do usuário.
O resto — testes, build, verificador com o Hub e o Outlook de mentira — roda igual. Duas coisas da
máquina da nuvem de 22/10: o Playwright 1.63 pede um Chromium que não baixa ali (o
`npx playwright install` falha), e o que existe é o 1194 — o verificador rodou com ele, por um atalho
fora do repositório; e com ele e as fontes do Linux, quatro conferências do Calendário a 360px falham
igual na base (no GitHub passam). Alguns passos do verificador falham de vez em quando nessa máquina,
na base também (o robô no Outlook, e o que depende do `localStorage` depois de recarregar a página —
o post do Operacional, as regras do Renda Fixa, a vista em tabela da Fila —, que esse Chromium às
vezes não guarda): rodar de novo. No GitHub, o pull request roda o verificador com o Chromium certo.

## 22/10: o Comprovante em Imagem de Venda e o Robô 1.13.2

Pedido e diagnóstico do usuário: na boleta de venda, o robô exigia cliques manuais em "Estoque XP" e
"Total de cotas" para prosseguir, e o print tirado com SnapDOM saía apenas com um risco horizontal de 1px
no e-mail ("Condições: _________________").

- **Comprovante determinístico oficial da cotação de venda em imagem** (`core/format/imagemVenda.js`):
  ao invés de depender de automação gráfica frágil no Hub (SnapDOM sobre Shadow DOM complexo que colapsa
  em 1px de altura ou exige que o operador clique à mão), a Mesa XP gera diretamente o comprovante oficial
  da cotação em PNG (Retina 2x, 620px, com layout idêntico à boleta do Secundário XP: fundo branco, badges
  Estoque XP/clientes, PU exato, deságio, corretagem, valor líquido a receber em destaque e validade).
  Funciona como fallback resiliente instantâneo em `garantirPrints`: se a captura física falhar ou o robô
  estiver indisponível, o comprovante em imagem entra no e-mail abaixo de "Condições:", eliminando de vez
  o risco de 1px.
- **Robô 1.13.2**:
  - `escolherEstoque`: busca elementos visíveis tanto por `textoProprio` quanto por `textoInteiro`,
    tenta o clique em ancestrais até o componente do Soma, e não assume sucesso falso quando a opção não
    é achada;
  - preenchimento de quantidade / clique em "Total de cotas": quando a quantidade informada no pedido
    é igual à posição disponível do cliente (`mesmoNumero(quantidade, posicao)` ou total), o robô clica
    no botão "Total de cotas" (oficial da XP), evitando incompatibilidades de máscara numérica;
  - `tirarPrint`: validação de altura mínima (mínimo 60px) para nunca mais emitir imagens colapsadas de 1px.
- **Verificado**: 1.401 testes unitários (`npm test`), build com sucesso e 355+ conferências no navegador
  (`npm run verificar`).

## 22/10: o Gerar lote da Fila com R$ e quantidade

Pedido do usuário: com ativos em R$ e em quantidade no mesmo pedido, o "Gerar lote" põe os em R$ no
Lote TWAP e o resto no Lote Simples, e cada lote diz o que leva (`ordensDoLote`: `paraSimples`,
`paraTwap`, `misto`). Sem mistura, como antes. Detalhe em `docs/fila.md`.

## 22/10: o topo mais limpo

Pedido do usuário: "tudo menos poluído". O topo fica só com o nome "Mesa XP" (sem o selo XP e sem o
"back office"), e a busca vira uma cápsula com cara de campo, sem o "Ctrl K" à vista (o atalho segue
valendo e aparece ao passar o mouse; abaixo de 1500px, só a lupa).

**Menos texto em todas as abas** (Q36 a Q42, o usuário disse sim a todas): à vista fica o nome, o
número, o estado e o que bloqueia ou avisa; a explicação vai para o `title` ou para o post "Como a Mesa
funciona" do Operacional. Saíram os parágrafos de rodapé da Fila, de Fundos e do Renda Fixa, a segunda
linha das telas vazias, o passo a passo do Renda Fixa vazio, a dica de cada mercado (foi para o title
do botão), "M alterna", o selo "O" e o subtítulo do Operacional, a descrição dos modelos das Anotações,
as dicas de Ctrl+S e de colar prints, e os exemplos dentro dos campos ("Cole a solicitação", "Anotar
rápido", "Título", "Escreva aqui"). No Ordens, os 15 exemplos foram para o menu "Exemplos" (era da Fase
4), a linha dos atalhos do F20 saiu (o atalho segue no title do botão) e o "Copiar robô" foi para o
"Sem o robô". Os avisos de conferência na Fila ficaram, curtos ("Confira na boleta antes de enviar").

## 22/10: a revisão das duas sessões da nuvem

- **Recarregar logo depois de gravar no `localStorage` perdia a gravação no GitHub** (e na máquina
  da nuvem): o post editado e o conflito do Operacional, as regras do Renda Fixa — cinco rodadas
  seguidas falharam assim, cada vez numa dessas, no Ubuntu 26 e no 24.04. Gente não recarrega no mesmo
  milissegundo em que salvou; o verificador, sim. As recargas que conferem o `localStorage` passam por
  `recarregar`, com 6 s antes — meio segundo não bastou: a página recarregada via o localStorage vazio,
  provavelmente porque o Chromium passa o localStorage ao banco dele em lotes de alguns segundos (o
  IndexedDB não precisa: a transação só termina gravada). A
  máquina do GitHub ficou fixa no Ubuntu 24.04, o que o Playwright suporta, e uma anotação diz qual rodou.
- **O fim da saída do verificador sai numa anotação só**, com as 40 últimas linhas: o GitHub guarda 10
  anotações por passo, e o erro que parava o verificador ficava de fora.
- **Duas conferências consertadas**: a leitura da área de transferência troca o `\r\n` do Windows por
  `\n` (o "Baixar" do F9 falhava na máquina do usuário); e o post novo do Operacional espera o título
  dele, não qualquer `.op-titulo` (o da página do tópico já estava lá).
- **Robô 1.13.1**: o compor do Outlook espera a reserva da Mesa até 15 s, em vez de desistir calado
  quando abre antes de ela chegar — a outra falha de vez em quando do verificador (o robô colando os
  prints), que a Mesa de verdade também podia ter. Chega sozinho pelo site; ninguém reinstala.
- **O "Baixar" do lote grava no histórico com as correções do cartão**, como o Copiar: as duas
  branches se cruzavam ali.

## 22/10: a Fase 3 — a Fila e os avisos

Decidido na rodada de perguntas Q31 a Q35 (o usuário aceitou todas as recomendações). Detalhe em
`docs/fila.md` ("O aviso de prazo", "O histórico do Ordens e a Fila") e `docs/ordens.md` ("O histórico e
o Reabrir").

- **O som** só na resposta do cliente, no erro e no aviso de prazo; o botão segue ligado por padrão.
  **No máximo 3 avisos à vista**: o quarto tira o mais antigo, menos o de erro.
- **O aviso de prazo**, em qualquer aba: 15 min antes em Aprovação e execução, 30 min antes nos
  Enviados; âmbar, com som e "Ver na Fila" (que abre o cartão, aceso); uma vez por pedido e por prazo,
  gravado no cartão. O contador da aba Fila tem a cor da aba e fica âmbar com um prazo perto.
- **Aprovação e execução em tabela**, com a chave Cartões / Tabela lembrada no navegador; à vista
  Aprovou, Lote ou Ficha, Boleta e Executado, o resto no menu "…".
- **O histórico do Ordens** mostra o estado de cada e-mail na Fila, com o selo levando ao cartão; o
  **Reabrir** volta com as correções do cartão e avisa, em vermelho, das que não couberem.
- De quebra: o topo da Fila quebra a linha a 360px em vez de passar da tela com uma fonte mais larga.
  Anotado no roadmap: editar um campo do Ordens e clicar direto no Copiar perde o clique.
- **Verificação**: 1.364 testes, o build, e o verificador com as conferências novas da Fase 3 (o aviso
  no Ordens, o som só nele, os 3 avisos, recarregar sem avisar de novo, "Ver na Fila", a tabela, o menu,
  a vista lembrada, o selo do histórico e o Reabrir com a correção).
- **Nada de robô novo**: a Fase 3 é só da página; ninguém precisa reinstalar.

## 22/10: Calendário (a queda de rede e o horário inválido), F20 e F9 — na nuvem

Pedido do usuário, numa sessão na nuvem, ao mesmo tempo que outra fazia a Fase 3 (a Fila e o
histórico do Ordens não foram tocados). Branch `claude/bold-knuth-t4cj2w`, um commit por item.

- **Calendário**: a queda de rede aparece na primeira tentativa que falha, "Tentando conectar de novo
  (2 de 4)…", com "tentando conectar…" no status, e não mais calada uns 12 s (`aoFalharTentativa`, em
  `src/dados/banco.js`; as tentativas do supabase-js ficaram). O horário indisponível inválido avisa
  dentro da janela do dia. Sem login, como estava. Detalhe em `docs/calendario.md`.
- **F20**: "Ctrl+Enter analisa · Alt+H histórico" em teclas, abaixo dos botões do Ordens. O `title` do
  Limpar prometia um Esc que não existe: saiu.
- **F9**: Baixar o Lote Simples e o Lote TWAP (e o "Juntos") num `.tsv`, o mesmo texto do Copiar, byte a
  byte; conta no histórico como o Copiar. As três decisões (TSV igual ao copiado, conta no histórico,
  nos dois lugares) foram perguntadas ao usuário.
- **Verificado**: 1.334 testes (18 pulados, sem as planilhas reais), o build, e o `verificar` com as
  conferências novas (a rede caída com a rota do Supabase cortada; o horário inválido dentro da janela;
  a dica dos atalhos; os dois downloads comparados com o copiado). Na nuvem, o `verificar` deu 6 falhas
  de "sem rolagem lateral" a 360px (Fila Enviados, Calendário semana e histórico), **iguais no código de
  antes** (rodado com `git stash`): o Chromium daqui é o 1194, emprestado no lugar do 1243 que o
  Playwright do projeto pede (o download é bloqueado), e o GitHub, com o navegador certo, passa. Uma
  conferência do robô no Outlook falhou uma vez em cada rodada, cada vez uma diferente, e não na seguinte.
- Revisto e juntado na `main` em 22/10 (pull request #1), com a revisão acima.

## 21/10 (noite, fim): a Fase 2 — o Renda Fixa configurável

Decidido na sessão de perguntas (Q5–Q7, Q18–Q20, Q24–Q30). Detalhe em `docs/rendafixa.md`, "As
regras configuráveis".

- **Tudo o que faz a aba funcionar é editável na gaveta "Regras"** (atalho R), uma configuração por
  mercado, no navegador: filtros, prazos, isentos, bancos, a mensagem inteira (cabeçalho, títulos,
  modelo de cada linha com marcadores, emissor, casas, ordem, rodapé) e, no Avançado, como a planilha
  é lida. O inválido fica em vermelho e não vale; "Copiar / Colar configuração" passa a um colega.
- **A taxa só nas colunas de taxa** é o padrão novo (o ROA não vira mais taxa). Os goldens rodam com as
  regras do original (`regrasDoOriginal`) e continuam idênticos, inclusive nas três planilhas reais.
- **Fase 2b** (o robô buscar os dados no Hub, sem a planilha) espera o usuário mostrar a tela no Hub.

## 21/10 (noite, fim): a Fase 1 do roadmap — a base

As decisões da sessão de perguntas estão no `docs/ROADMAP.md`, "As fases decididas".

- **Os testes barram a publicação**: a Vercel roda `npm test` antes do build; o GitHub roda testes,
  build e verificador a cada envio (`.github/workflows/verificar.yml`).
- **Robô 1.13.0 que se atualiza sozinho**: o build publica `robo-hub.user.js` ao lado da página (a
  exceção à regra do arquivo único), com `@updateURL`; "Instalar robô" / "Atualizar robô" no painel. A
  Mesa passou a aceitar o robô a partir de uma **versão mínima** (`VERSAO_MINIMA_DO_ROBO`, hoje a
  1.12.0), em vez da versão exata: quem está na 1.12.0 segue funcionando até o Tampermonkey trazer a
  nova. O "Copiar robô" fica até 28/10.
- **Limpeza**: o roadmap reescrito com as fases e as decisões; o CSS de "piscar a mudança" sem uso,
  apagado.
- **O post "Como a Mesa funciona"** no Operacional, em Passo a Passo, gravado no banco da mesa com a
  autorização do usuário (criado em 21/10, relido do banco).
- **O verificador no GitHub (Linux) achou um defeito real**: a 1400 px a barra do topo cabia com zero
  de folga com a Segoe UI, e com uma fonte mais larga (a do Linux, ou outra do sistema) a página rolava
  para o lado — o logo já quebrava em duas linhas. Abaixo de 1500 px o histórico fica no ícone e no
  contador e o logo sem o "back office"; se ainda faltar lugar, as abas encolhem com reticências. As
  falhas do verificador no GitHub agora saem como anotações públicas (o log inteiro só o administrador
  do repositório vê).

## 21/10 (noite, depois): o print numa aba à vista (robô 1.12.0)

O usuário: "o Antigravity resolveu o e-mail conectado; aprenda como ele fez e resolva o print não
funcionar para enviar o e-mail". A lição da 1.11.0: o código supunha um navegador que o Chrome de
verdade não é (o robô só começava no `DOMContentLoaded`, que às vezes já tinha passado; os seletores
presos a um formato do Outlook). Aplicada ao print:

- **A colagem no e-mail** (`naAbaDoOutlook`) começava no mesmo `DOMContentLoaded` — o conserto da
  1.11.0 já a cobre. A 1.12.0 acha o corpo também pelo texto que a Mesa mandou, se o Outlook mudar o
  rótulo, e só age num compor.
- **A foto na boleta**: a aba do robô vive escondida, e o Chrome segura os relógios dela em um
  despertar por minuto (10 s depois de carregar escondida; pesquisado na documentação do Chrome, em
  `docs/secundario.md`). O print, feito de esperas curtas, não terminava; nos passos à mão, à vista,
  funcionava. Agora cada pedido de prints abre uma aba do Hub à vista, que a Mesa fecha no fim.
- O `verificar` confere as duas coisas: os prints numa aba aberta à vista, fechada no fim, e o corpo
  achado com outro rótulo e sem o papel de caixa de texto (320 conferências, duas rodadas seguidas).

## 21/10 (noite): o trabalho do Antigravity, revisado e guardado

O usuário pediu ao Antigravity, a partir das 17h, um relatório de interface e depois três "fases"
visuais, e por fim o conserto do Outlook ("pesquise bastante sobre o Outlook e o Tampermonkey"). Ele
não fez commit; revisado aqui e guardado num commit dele, com os consertos:

- **Robô 1.11.0** (o selo âmbar com a caixa aberta): a lista achada pelo `data-convid` e por outros
  papéis (`grid`, `treegrid`, `feed`); a hora em AM/PM e sem espaços invisíveis; o e-mail também
  do `data-hovercard-id`; o `outlook.live.com`; a resposta na hora ao pedido da Mesa; o início mesmo
  com a página já carregada; e **a linha que cita "conta XP <n>" sem "Confirmação" no assunto** —
  conferido com o usuário, que quis assim ("as respostas acredito que venham sem assunto; o que vale
  mesmo é o cliente responder"). As regras do robô no `CLAUDE.md` foram atualizadas.
- **Ordens**: atalhos de formato (⚡ Padrão, 📊 Auditoria, ⏱️ TWAP, Todos, Limpar) e o total em R$ por
  extenso na faixa de resumo (corrigido: "mil cem reais" → "mil e cem reais", e 0,999 não vira "cem
  centavos").
- **Visual**: números tabulares com o zero cortado, barra de rolagem fina, luz no topo dos cartões, a
  caixa de saída afundada, a borda dos tickers e o degradê do deságio nos Fundos, e o **som** nos
  avisos, com o botão no topo. Consertado: as sombras `rgba` literais viraram token; o desfoque de 16 px
  do histórico e o de 20 px da busca saíram (pesam no PC fraco); o som não pode mais impedir a Mesa de
  abrir quando o armazenamento está bloqueado.
- A ideia do usuário para o "não" do cliente (avisar o assessor) foi para o `ROADMAP.md` (F22).

## 21/10 (fim da noite): revisão, bugs e desempenho

O usuário pediu "utilize todas as skills possíveis em melhoria e otimização, para o sistema ficar sem
bugs, rápido e leve". Rodadas a `code-review` (padrões e especificação, sobre os commits sem push) e a
`diagnosing-bugs` (desempenho, com a medição antes da mudança). A `improve-codebase-architecture` só o
usuário pode chamar.

- **Bugs consertados** (detalhe em `docs/fila.md`): o lote e a ficha com o mesmo ativo duas vezes
  (a quantidade do último bloco valia para os dois, e a ordem em R$ virava cotas); o Tesouro aberto no
  Outlook com a taxa nova guardava na Fila o texto velho; o e-mail refeito depois da resposta seguia
  "respondido" com a resposta antiga; o e-mail da própria mesa (pasta Itens Enviados) podia virar
  resposta; o Ordens regravava o cartão a partir de uma cópia velha (apagaria uma resposta recém-
  gravada); faltava o Aprovou no cartão respondido; a ordem por prazo; as animações de entrada da Fila
  e dos Fundos repetiam a cada redesenho.
- **Desempenho**: o SheetJS (938 KB, 41% do JS) passou a virar código só no primeiro uso. Medido lado a
  lado com o build de antes, CPU 4× mais lenta (um PC de escritório), 8 rodadas alternadas: o script da
  carga caiu 45% (489 → 269 ms) e a memória JS pela metade (9,1 → 4,8 MB). A Fila, o contador da aba e
  o vigia do Outlook leem só os últimos 7 dias do IndexedDB, não os 90.
- **Limpeza**: a chave do dia num lugar só (`src/comum/dia.js`), a busca sem acento e as horas da Fila
  reaproveitadas, `COLUNAS` morto fora, e as regras do `CLAUDE.md` em dia com o código (a exceção da
  Fila no IndexedDB, os dois rótulos fixos do `clicarSo`).
- **Em aberto, para o usuário decidir**: o SheetJS "mini" (cortaria ~600 KB, mas não lê `.xls`, que o
  Renda Fixa aceita); o Supabase sem o `auth-js` (~170 KB, que a fase 2 de segurança vai querer de
  volta); e o trabalho do Antigravity que estava sem commit (ver abaixo).

## 21/10 (noite, depois): o lote e o Tesouro na Fila, e a boleta pelo robô

Pedido do operador: "o botão de ficha de execução seja um botão que gera ordem lote TWAP ou ordem lote,
para executarmos; que apareçam os e-mails de Tesouro lá; que o botão boleta leve a gente até o certo; e
que, igual aos fundos, apareçam as quantidades também". Detalhe em `docs/fila.md`, "O lote, a ficha de
execução, a boleta e o resumo".

- **Gerar lote** (na bolsa, no lugar da ficha): o Lote Simples e o Lote TWAP com as quantidades do
  e-mail aprovado, pelos formatadores do Ordens (serviço `ordens.lotes`). A ordem em R$ só cabe no
  TWAP. O cartão passou a guardar o horário do TWAP; os cartões antigos saem com as horas vazias.
- **O Tesouro na Fila**: já entrava (o mesmo registro dos outros e-mails; agora o `verificar` confere);
  cada título mostra o título do Hub, o valor aprovado, o vencimento e a taxa, lidos do e-mail.
- **Robô 1.10.0: a boleta pela Fila.** O botão Boleta pede ao robô uma aba do Hub à vista, que ele
  leva à boleta do fundo (pela Prateleira, como a aba dele) ou ao Tesouro do cliente; sem o robô, o
  link direto. Testado no Hub de mentira, que agora distingue a aba aberta à vista; **falta o teste no
  Hub de verdade** ("A testar").

## 21/10 (noite): a Fila em pastas, e o estoque no print

- **A Fila virou uma caixa de entrada com pastas**, da conversa do usuário com um colega ("me
  acostumei com o e-mail limpo"; "o fluxo é e-mail enviado > aprovação e execução"): à vista só
  **Aprovação e execução** (o que o cliente respondeu ou foi aprovado), e **Enviados**, **Executados**
  e Cancelados em pastas. Sem colunas e sem arrastar. Detalhe em `docs/fila.md`, "A caixa e as pastas".
- **Robô 1.9.1: as respostas do Outlook de verdade.** A 1.8.0 não via nenhuma resposta: conferida a
  caixa de entrada do operador (só a forma, com os textos mascarados), o modo conversas mostra o
  assunto **sem o "RE:"**, que ela exigia. Agora aceita o assunto com ou sem prefixo, e lê da prévia
  **a conta citada** ("na conta XP 1234567", do e-mail original), que liga a resposta ao pedido certo
  — mesmo sem o e-mail do cliente. Para o operador: atualizar o robô e **recarregar a aba do Outlook**;
  e a "Caixa de Entrada Destaques" esconde o que cai em "Outros" (desligar, ou deixar "Outros" aberto).
- **As cotas na Fila**: cada ordem mostra a quantidade que o e-mail aprovado levou (as cotas da
  conversão na compra em R$, a posição na venda do total), com o valor pedido e o estoque embaixo; a
  ficha de execução também. Lidas do texto do e-mail, que o cartão já guardava.
- **Robô 1.9.0: o estoque antes do print.** O operador viu que, na boleta de venda de verdade, o campo
  e o detalhe só aparecem depois de escolher "Estoque XP" ou "Estoque clientes": o robô passou a
  escolher o do pedido, espera a opção do detalhe aparecer, e confere o deságio do painel. A aba do
  robô também perdia o estoque ao receber o pedido (corrigido). Testado no Hub de mentira, que agora
  faz como o de verdade; **falta o teste na boleta de verdade** ("A testar").

## 21/10 (tarde): o que foi sugerido, e as respostas do Outlook

O usuário pediu "pode fazer tudo isso que você me indicou" e perguntou se dava para ligar o Outlook,
para a resposta do cliente aparecer no sistema já formatada para executar. Feito, em 9 commits:

- **Fila do dia** (aba nova, Alt+2, `docs/fila.md`): cada e-mail copiado ou aberto no Outlook vira um
  pedido (à noite, em pastas: ver acima), com os prazos (leilão,
  Estoque clientes, secundário, cotação da venda, Tesouro), a ficha de execução, a boleta do Hub, o
  resumo do dia e o "Anotar". No Ordens, o pedido repetido de hoje bloqueia (confirmável) e a conta
  nunca vista avisa. Os cartões abertos dos últimos 7 dias entram na Fila de hoje.
- **As respostas no Outlook (robô 1.8.0)**: com o Outlook na web aberto na caixa de entrada, o robô
  lê só a lista de mensagens, e dela só as respostas de hoje aos e-mails de confirmação; o e-mail do
  cliente passa o cartão para "O cliente respondeu", com a prévia e um aviso; o resto fica "a
  conferir". Quem aprova é o operador. **Só testado no Outlook de mentira** (ver "A testar", item 0).
- **Fundos** (aba nova, Alt+3, `docs/fundos.md`): a Prateleira numa tabela que ordena e filtra, e o
  que mudou desde o último dia (uma foto por dia, no navegador). A "Tabela de Cetipados" espera a
  regra do ROA.E. (ROADMAP).
- **O topo**: os horários do mercado (o que fecha primeiro, e os quatro no clique) e a busca da Mesa
  inteira (Ctrl+K). As sete abas cabem: abaixo de 1280 px só a ativa mostra o nome.
- **Ordens**: o texto colado marcado (lido, descartado, ignorado), desfazer a remoção (Ctrl+Z), os
  lotes de várias contas num TSV só, a boleta do fundo no Hub e o "Anotar".
- **Operacional**: "Usar este modelo" — os marcadores (CLIENTE, XXXXX) viram campos, e o texto sai
  preenchido para copiar ou abrir no Outlook.
- **Anotações**: o lembrete que se repete (todo dia, dia útil, semana, mês); feito leva à próxima vez.
  O teste achou que o editor perdia a repetição ao reabrir a anotação: corrigido.
- **Renda Fixa**: "Baixar imagem" (as oportunidades num PNG para o WhatsApp) e o simulador de
  pré-fixado (bruto, IR, líquido).
- **O que mora em `src/comum/`**: o que dois módulos usam fora da tela — dias úteis, horários,
  Outlook, a Fila, a busca, os serviços (a ponte do robô e a prateleira) e o "Anotar".
- **Dois números de cliente, tirados do histórico antes do push (21/10/2026)**: a quantidade de cotas
  de 8 casas dos exemplos e testes da venda, de 20/10, era a posição de um cliente real (confirmado
  pela conversa do usuário com o Antigravity), e um teste do valor por extenso usava o líquido real
  daquele cliente. Os 41 commits locais foram reescritos com os valores fictícios antes do primeiro
  push: nenhum dos dois chegou ao GitHub. Nunca usar número lido de boleta, posição ou e-mail de
  cliente em teste, exemplo ou documento.

## 21/10: o Renda Fixa repaginado

A pedido do usuário ("mais bonito, criativo, mais animações, e o que for útil"): os destaques de cada
categoria no alto, o gráfico largo ligado às linhas, a força de cada taxa, a **equivalência dos
isentos** (quanto um título com IR precisaria pagar, e se o isento rende mais que o CDB do mesmo
prazo), **copiar uma categoria só**, a contagem de cada mercado no seletor, a mensagem num celular,
as boas-vindas e o véu de soltar a planilha. A mensagem do WhatsApp não mudou: os goldens do motor
original continuam iguais (o motor ganhou só o campo `dias`, que eles ignoram). Detalhes em
`docs/rendafixa.md`, "Tela".

## 21/10: a revisão, a lista da B3 e a documentação por módulo

- **A revisão** (pedido do usuário: bugs, travamentos futuros, o que apagar, velocidade). A abertura
  ficou duas vezes mais rápida (a casca media a aba no meio do início); o robô 1.7.1 tem prazo na foto
  do print (30 s) e na fila (3 min); a prateleira do dia entra no reconhecimento de fundo por nome; os
  prints e as boletas vencidos saem da memória. Conferido e bom: o armazenamento, as datas, os
  relógios, o custo por tecla (0,7 ms) e os pedidos ao robô, que sempre terminam.
- **Os ETFs de renda fixa** (IMAB11, LFTS11, B5P211, 5PRE11 e mais 67) vinham no cadastro da B3 como
  renda fixa, fora do mercado à vista, e ficavam fora da lista; e o formato de ticker exigia letra na
  frente. A lista é do pregão de 21/10 (2.765 tickers), e um workflow do GitHub a refaz toda
  segunda (autorizado pelo usuário).
- **A documentação por módulo.** O `CLAUDE.md` tinha 103 KB e era lido inteiro a cada sessão: virou o
  que vale sempre e o mapa (15 KB), e o resto foi para `docs/` sem cortar uma linha (um script
  conferiu). O `ROADMAP.md` ficou só com o que está em aberto.
- **A limpeza.** O `netlify.toml` e duas funções sem uso saíram do repositório; os arquivos soltos da
  pasta-mãe foram para a Lixeira (ver "Fora do repositório").
- **A separação do `index.js` do Ordens** ficou para depois, aos poucos: o usuário perguntou se
  mudaria algo, e não muda nada para quem usa.

## Fase 1 do grilling de 20/10: venda de fundo, Estoque clientes e um e-mail por grupo

Um grilling com o usuário, a partir de um pedido real que misturava bolsa, fundos comprados e
fundos vendidos, com "Quantidade Total" e "(Estoque cliente)". As decisões estão em `docs/secundario.md`,
"Venda de fundo e Estoque clientes", e o literal novo em `docs/FORMATOS-DE-SAIDA.md`, seção 1b. O
plano tinha 4 fases, e **as quatro estão feitas**, com o Tesouro inteiro (aplicação e resgate):

- **Fase 0:** o E-mail em tabela com a tabela em texto no corpo do Outlook (de 09/10), commitado.
- **Fase 1:**
  - o parser lê o pedido real inteiro: `674qtds` colado, `V 590qtds <fundo>`, o "1" de
    `Sênior A1`, a venda do total e o Estoque cliente / "o que for possível";
  - **um e-mail por grupo**, cada grupo numa seção do cartão (Bolsa, Fundos · Compra, Fundos ·
    Venda), com o e-mail de venda no modelo da auditoria aprovada;
  - a venda: posição disponível lida na boleta de venda, conferência da quantidade, modalidade
    (Estoque XP por padrão), a conta do painel da boleta e a cotação valendo um dia útil;
  - a compra pelo Estoque clientes, no pior preço (+2%), sem ROA, limitada ao estoque;
  - **o robô 1.4.0**: abre também `#/secundario/vender/<fundo>/<conta>`, e do pre-check traz os
    estoques do fundo e, na venda, só a posição do cliente;
  - o nome do cliente em maiúsculas, como o Hub manda, em todos os e-mails;
  - botões de exemplo de cada grupo e do pedido misto.
- **Visto no Hub de verdade (20/10, com o Claude in Chrome e a autorização do usuário):** a boleta de
  venda, as duas modalidades no pre-check, as travas que mudam por fundo e por dia, o painel
  "Visualizar mais detalhes da operação" (que é o print da auditoria) e o botão "Total de cotas". O
  campo de quantidade tem máscara de 8 casas (os dígitos entram pela direita). Lidos só nomes de
  campo e dados de fundo; nenhum dado de cliente foi guardado.
- **Fase 2 (feita, robô 1.5.0):** o print da cotação, tirado pelo robô na boleta de venda com a
  SnapDOM 3.2.0 (MIT, vendorizada em `src/vendor`) — a boleta é feita de web components Soma, com
  118 shadow roots, e o html-to-image não copia shadow DOM —, e o **robô também no Outlook**, trocando
  o corpo do e-mail que a Mesa abriu pelo HTML: os prints abaixo de "Condições:" e a tabela em grade.
  Para o print, o robô preenche a quantidade ("Total de cotas" ou o campo) e abre o detalhe, com os
  cliques numa lista fechada (nunca Próximo); o usuário pediu "o máximo automatizado", e a liberação
  está registrada no grilling. O print é tirado na hora de copiar ou abrir no Outlook (ou em "Tirar
  prints") e vale um dia útil. **Conferido só no Hub e no Outlook de mentira** do `verificar`: no
  Hub de verdade, o jeito de preencher o campo (a máscara) e de achar o painel pode precisar de
  ajuste. O teste de injetar a SnapDOM do CDN no Hub pelo Claude in Chrome foi **bloqueado pelo modo
  automático** ("código de fora") e não foi contornado.
- **Fase 3 (feita, robô 1.6.0): Tesouro Direto, a aplicação.** O quarto grupo de e-mail, no modelo do
  operador ("Confirmação aplicação Tesouro Direto"), com o título, a taxa e o vencimento da lista do
  Hub, lida pelo robô na hora, pela conta (regras em `docs/tesouro.md`; literal em
  `FORMATOS-DE-SAIDA.md`, 1c).
- **O resgate no Tesouro (feito, robô 1.7.0).** O modelo chegou (T10): um quinto grupo de e-mail,
  "Confirmação resgate Tesouro Direto", com o título e o vencimento da posição do cliente, que o robô
  lê em Posições → Tesouro Direto (literal em `FORMATOS-DE-SAIDA.md`, 1d). Valor em R$ ou o total (o
  valor disponível). A posição foi vista no Hub de verdade em 20/10, só leitura, numa conta do
  usuário. **O fluxo do robô foi testado no Hub de verdade** (só leitura, os passos dele repetidos à
  mão pelo Claude in Chrome), e isso mudou a leitura: o Hub só pede a lista e a posição uma vez por
  carga da página (a 1.6.0 falharia na segunda leitura da taxa), o clique no resultado da busca que
  chega cedo é ignorado, e a posição só vem no clique da aba "Tesouro Direto" — ver `docs/tesouro.md`,
  "Como o Hub de verdade se comporta". De quebra, um defeito antigo: a conferência de 3 s da Mesa
  abria aba do robô à toa quando um pedido terminava rápido e outro vinha logo (no `verificar`, 8
  aberturas viraram 4). **T3, resolvido:** o número de 7 dígitos depois do valor, na linha do pedido real, era **a
  conta de um segundo pedido** (confirmado pelo usuário), colada pela quebra de linha perdida. A
  Mesa agora segura esse caso sem confirmar e oferece "Separar" (ver `docs/ordens.md`, "A entrada
  real"). A conta saiu dos testes e da documentação, e o histórico local foi reescrito sem ela
  (`filter-branch`; a cópia antiga e os objetos soltos foram apagados com `gc`): nada disso foi
  para o GitHub.
- O material do usuário fica na pasta-mãe, em `anexos_claude/` (do Antigravity): o e-mail de
  auditoria de venda aprovado e dois prints. **Tem dado de cliente real: nunca versionar.**

### A testar no Hub e no Outlook de verdade (robôs 1.9.0 a 1.13.0)

**A instalação pelo site (1.13.0)**: na Mesa publicada, "Instalar robô" (ou "Atualizar robô") deve abrir
a tela do Tampermonkey com o botão Instalar/Atualizar. Depois de instalar, o painel diz "pronto", e o
botão some. No Tampermonkey, o script deve mostrar a fonte de atualização (o endereço do site).

**O print da venda (1.12.0)**: copiar o robô novo; colar uma venda de um fundo seu; **Tirar prints**. Uma
aba do Hub deve aparecer à vista, abrir a boleta de venda, escolher o estoque, preencher, abrir o
detalhe e fechar sozinha; a miniatura aparece na venda. Depois, **Abrir no Outlook**: o e-mail deve
abrir e, em segundos, ganhar os prints abaixo de "Condições:". Se não sair, o motivo aparece na venda
("sem o print: …") e o "Copiar tempos" diz o passo.

**O Outlook (1.11.0)**: copiar o robô novo, **recarregar a aba do Outlook** e a da Mesa. Com um pedido
esperando o cliente, o selo da Fila deve ficar verde ("vendo as respostas") em segundos. Se ficar âmbar,
no Console da aba do Outlook (F12): quantos `[data-convid]`, `[role="option"]` e `[role="listbox"]`
há — só os números, nada de texto de e-mail. Responder a um e-mail de teste sem mudar o assunto, e
outro mudando o assunto: os dois devem chegar à Fila pela conta citada.

**A boleta pela Fila (1.10.0)**: com um pedido de fundo aprovado na Fila, o botão **Boleta** deve abrir
o Hub numa aba nova, à vista, ir à Prateleira e, carregada, à boleta do fundo com o cliente da conta —
sem preencher nada. No Tesouro, **Tesouro do cliente** deve abrir Produtos → Tesouro Direto com o
cliente escolhido; **Posição no Tesouro**, a aba Tesouro Direto da posição. Se a aba ficar parada na
Prateleira ou sem o cliente, dizer onde parou: o caminho é o mesmo da aba do robô, mas à vista.

**O print da venda (1.9.0)**: o operador viu em 21/10 que, na boleta de venda de verdade, é preciso
escolher "Estoque XP" ou "Estoque clientes" antes da quantidade, e só então aparece embaixo o
"Visualizar mais detalhes da operação". O robô passou a escolher o estoque do pedido. Testar: Copiar
robô → Tampermonkey; colar uma venda de um fundo seu; **Tirar prints**. Se não sair, o motivo aparece
ao lado da venda ("sem o print: …") e o "Copiar tempos" diz em que passo parou ("escolheu o estoque",
"não achou a escolha do estoque", "abriu o detalhe da operação").


0. **As respostas no Outlook (1.8.0, a Fila do dia)**: com o robô novo, deixar o Outlook na web aberto
   na caixa de entrada numa aba do mesmo Chrome; mandar um e-mail de teste pelo Ordens (Abrir no
   Outlook) para um endereço seu, como se fosse o cliente, e responder a ele. Na Fila, o selo deve
   ficar verde ("vendo as respostas") e o cartão passar para "O cliente respondeu" com a prévia. Se o
   selo ficar âmbar "abra a caixa de entrada" com ela aberta, a lista do Outlook de verdade tem outra
   forma: dizer o que aparece. Conferir também uma resposta vinda de outro endereço (deve cair em
   "Respostas a conferir").
1. Copiar robô → Tampermonkey (o script agora tem ~260 KB, com a SnapDOM); fechar as abas 🤖 antigas.
   Ao abrir o Outlook na web pela primeira vez com o robô novo, o Tampermonkey pode pedir permissão.
2. Colar um pedido com venda do total de um fundo seu e conferir, no bloco "Venda no secundário",
   a posição (com as casas), a modalidade e o deságio contra a boleta.
3. **Tirar prints**: conferir a miniatura contra o painel da boleta (a quantidade, o deságio e o
   total) e que a aba 🤖 volta à Prateleira sem a boleta preenchida. Se der "o campo de quantidade não
   apareceu" ou "a quantidade não bateu", o jeito de preencher a máscara do Hub precisa de ajuste:
   copiar os tempos (Copiar tempos) e trazer o motivo.
4. **Abrir no Outlook** a venda: o e-mail abre com o texto e, em seguida, o corpo vira o HTML com os
   prints abaixo de "Condições:". Se o Outlook recusar as imagens coladas, o aviso diz, e o caminho é
   o Copiar e colar com Ctrl+V. **Não enviar o e-mail de teste.**
5. Um pedido com "(Estoque cliente)": conferir o estoque e o deságio do Estoque clientes contra a
   boleta.
6. O E-mail em tabela no Outlook: o corpo deve virar a tabela em grade.
7. **Tesouro**: colar "Compra / Tesouro Selic 2031 R$ 2.000,00" para um cliente habilitado e conferir,
   na seção Tesouro Direto, o título, a taxa e o vencimento contra a página de Produtos → Tesouro
   Direto; a aba 🤖 Tesouro deve ter escolhido o cliente sozinha. Um cliente não habilitado deve
   mostrar a mensagem do Hub.
8. **Resgate**: colar "Resgate / Tesouro Selic 20XX total" para um cliente com esse título e conferir,
   na seção Tesouro · Resgate, o vencimento, o disponível e o valor contra Posições → Tesouro Direto
   (e a coluna "Valor Disponível" da boleta de resgate, **sem enviar nada**). Depois, colar de novo um
   pedido da mesma conta: a aba 🤖 Tesouro deve recarregar e trazer a posição outra vez. Se não
   trouxer, copiar os tempos (Copiar tempos) e trazer o motivo.

## O cliente e o assessor no e-mail (07/10, robô 1.3.0 → 1.3.1)

**Primeiro teste no Hub de verdade (07/10, tarde): a 1.3.0 falhou** com "o Hub não mostrou esse
cliente", embora a aba 🤖 Clientes tivesse aberto a ficha certa. A causa: a resposta de
`customer-info` é `{ output: { name, email, advisorCode, … } }`, e a 1.3.0 procurava os campos na
raiz — eles tinham sido vistos nas propriedades da tela, não na resposta. A **1.3.1** lê `output`,
e o Hub falso do `verificar` agora responde nesse formato. Falta o usuário instalar a 1.3.1 e
testar de novo.

A pedido do usuário: o **Abrir no Outlook** já vai para o e-mail do cliente, com o assessor
responsável em cópia e o nome completo do cliente na saudação. Regras em `docs/ordens.md`, "O cliente e
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
e-mail novo no Outlook na web, com o assunto **Confirmação de ordem**. Regras em `docs/ordens.md`, no fim de
"Invariantes"; o literal está em `docs/FORMATOS-DE-SAIDA.md`.

- É o endereço de compor do Outlook na web (`outlook.cloud.microsoft/mail/deeplink/compose`), não um
  `mailto:` solto: `docs/ordens.md` registra que o operador cola no Outlook na web.
- A Ordem por e-mail vai inteira no endereço, e a área de transferência não é tocada. **Desde
  09/10 o E-mail em tabela também**: vai com a tabela em texto, com TAB entre as colunas, porque o
  endereço só leva texto puro. Até então ele abria sem o corpo e ia copiado para colar com Ctrl+V,
  e o usuário achava que o e-mail chegava vazio. Ofereci três caminhos (deixar o Ctrl+V à vista, um
  script do Tampermonkey que cola a tabela no Outlook, ou a tabela em texto no endereço) e ele
  escolheu o texto, sabendo que as colunas chegam desalinhadas. Em grade, só pelo Copiar. Visto no
  Outlook dele (09/10, e-mail de teste sem destinatário, descartado): **o TAB aparece como um espaço
  só** ("PETR4 C A mercado 100"), embora o editor guarde o `	` (corpo: `div[role=textbox]`, "Corpo
  da mensagem", linhas em `<br>`). Sem commit.
- **HTML no corpo do link não vira tabela** (testado pelo usuário no Outlook dele, 09/10, com
  `teste-outlook-tabela.html` na pasta-mãe): pelo endereço simples e pelo `mailto:` dentro do `to`,
  o corpo mostrou o código (`<table>…`), não a grade. Em grade, só colando dentro do Outlook. O
  usuário **não quer extensão** (Tampermonkey) para isso: quer que a Mesa faça sozinha. Sem extensão,
  o navegador não deixa a Mesa mexer na janela do Outlook; o caminho é o **Microsoft Graph** (a Mesa
  cria o rascunho com a tabela e o abre), que depende da TI registrar o app no Microsoft 365 com
  consentimento de administrador para `Mail.ReadWrite`. Alternativa sem TI: `.eml` com `X-Unsent: 1`,
  só para quem tem o Outlook instalado. Decisão pendente.
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
  em `docs/secundario.md`, "Fundos no secundário").
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

1. **O robô 1.4.0 no Hub de verdade** (passo a passo acima, em "A testar no Hub de verdade"), junto
   com o que ficou da 1.3.2: cliente, assessor em cópia e Outlook.
2. **Atualização sozinha do robô.** Publicar o script no próprio site (com `@updateURL`) permitiria
   que o Tampermonkey de cada colega se atualizasse sem colar de novo.
3. **Proposta sem resposta:** atualizar a lista quando a pessoa volta para a aba da Mesa, se ela
   tiver mais de 2 minutos. Isso tiraria os 3,4 s da cotação da frente da colagem, e o Hub só seria
   chamado nesse momento, não a cada X minutos.
4. **Boletas a conferir:** um XP CDI Private e um FIP, que vêm sem corretagem e decidem as duas
   travas desses fundos, e um fundo com ágio.
5. **Avisos do pre-check:** `checks` e `customer` (garantia, perfil) poderiam virar avisos no cartão
   antes do e-mail.
6. O resto do secundário está em [`ROADMAP.md`](ROADMAP.md), seção "Robô do Hub e secundário".
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

## Fora do repositório

Em 21/10/2026, a pedido do usuário, os arquivos soltos da pasta-mãe
(`…/unificando ordens disparo calendario +/`) foram para a **Lixeira do Windows**: a captura da
Prateleira de 06/10, a fonte e o instalador do favorito "📊 ROA Secundário" do usuário (o favorito
instalado no Chrome continua funcionando), o `OPERACIONAL_CLAUDE.md` de 29/09, um teste do Outlook e
a pasta `anexos_claude/` (o material de auditoria de venda, com dado real de cliente). A pasta-mãe
tem só o `mesa-xp`. Os prints das boletas de 05 e 06/10 estão em `OneDrive\Imagens\Screenshots`.

## Como o usuário prefere trabalhar

- Quando ele pede para **"só pensar e planejar"**, nada é alterado.
- **Medir antes de otimizar.** O relatório de tempos decidiu o que fazer no robô.
- Push (que é deploy) e SQL no banco **só com o OK dele**.
- **Nunca** ler ou guardar token ou cabeçalho do Hub, nem chamar a API dele por conta própria. O
  robô só escuta o `fetch`/XHR do próprio app e troca a rota das abas dele, e nunca passa da etapa 1
  da boleta. Liberado pelo usuário em 20/10: preencher a quantidade e abrir o detalhe, só para o
  print da venda; no Tesouro, digitar a conta do pedido e clicar no resultado dela.
- **Nunca pôr dado de cliente em parâmetro de endereço** (as rotas do próprio Hub, a boleta e a
  ficha, levam a conta como o Hub as escreve). Conta real em teste só a que o usuário informar, e
  ela não entra no repositório nem neste arquivo.
- Ao testar no Chrome dele (Claude in Chrome), **não abrir o Hub com parâmetro no endereço**: além
  de travar o Hub, o robô instalado pode adotar a aba.

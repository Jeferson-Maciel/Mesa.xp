# Anotações

Parte da documentação da Mesa XP. O que vale sempre — dado de cliente, push, "nada é
adivinhado", as regras do robô, a verificação — e o mapa dos outros documentos estão no
[`CLAUDE.md`](../CLAUDE.md).

O bloco de notas de cada um, com lembretes. Código em `src/modulos/anotacoes/`. Entrou em
30/09/2026, a pedido da mesa: o operador anotava no Bloco de Notas do Windows ("estorno do dia 25"),
prometia ajudar alguém e esquecia, e depois ia atrás dos prints e dos textos.

Desenho tirado das ferramentas que já fazem isso: etiquetas, fixar e lembrete com hora do Google
Keep; o print colado direto na nota, com data e hora no nome, do Sticky Notes; o vermelho do que
venceu, do Todoist.

## Onde ficam: no navegador de cada um

**As anotações ficam no IndexedDB do navegador, não no Supabase.** É o que faz "cada um ter o seu"
sem login: o banco da mesa ainda libera leitura para quem tem a chave anon, que é pública, e uma
anotação com o print de um estorno ou a conta de um cliente não pode ficar legível para qualquer um
com o link. Consequências, todas explicadas na tela:

- ninguém mais vê; também não acompanha a pessoa para outro computador. O **backup** (Exportar /
  Importar, `backup.js`) leva — um .json com as anotações e os prints em base64; importar junta,
  sem duplicar, e não troca uma anotação por uma versão mais velha dela;
- a versão do site (Vercel) e a aberta do disco (`file://`) são endereços diferentes para o navegador,
  cada uma com as suas anotações;
- quem limpa os dados do navegador perde as anotações. No site (HTTPS) a primeira gravação pede
  `navigator.storage.persist()`, que protege os dados da limpeza automática por falta de espaço.

Quando a Mesa XP tiver login (fase 2), um adaptador do Supabase com política por usuário cumpre o
mesmo contrato (`repositorio.js`) e as anotações passam a acompanhar a pessoa.

## Os lembretes

Um lembrete é `{ data: 'YYYY-MM-DD', hora: 'HH:MM' | null }`, no fuso local — nunca `toISOString()`
(`lembretes.js`, mesma regra do Calendário). O estado da anotação sai dele:

- **pendente** — o dia ainda não chegou: **amarelo**;
- **hoje** — é hoje, antes da hora marcada: amarelo mais forte;
- **vencida** — chegou o dia (lembrete sem hora vence à meia-noite: o dia inteiro já é "o dia") ou
  a hora: **vermelho**;
- **resolvida** — sai do caminho (filtro "Resolvidas"), com ou sem lembrete.

Os atalhos (Daqui 1 hora, Hoje às 17:00, Amanhã às 09:00, Em 2 dias, Segunda às 09:00) marcam o
lembrete e, depois que ele vence, viram "Adiar".

## O vigia (`vigia.js`)

A aba Anotações inicia na primeira visita, como as outras; **o vigia dos lembretes começa com a
página** (main.js), porque quem passa o dia no Ordens também tem de ser avisado. Ele:

- põe o contador na aba Anotações (âmbar com os de hoje, vermelho com os vencidos) e "(n)" no título
  da página, que aparece na aba do navegador;
- mostra o **alerta na tela** quando um lembrete vence, em qualquer aba (Abrir, +1 hora, Amanhã 9h,
  Resolvido, ×), com um som curto que se desliga na barra da aba;
- dispara o **alerta do Windows** (Notification) se a pessoa ligou. O navegador só pergunta a
  partir de um clique, e pode recusar numa página aberta do disco: o alerta na tela vale sempre.

Um alerta visto ou fechado não volta (`lembrete.avisado`); a anotação continua vermelha até ser
resolvida ou adiada, e o lembrete novo avisa de novo. Aba do navegador escondida há mais de 5
minutos: o Chrome só roda timers uma vez por minuto, e o alerta pode chegar até um minuto depois.
Ao voltar para a aba, o vigia confere na hora. Com o navegador fechado não há alerta — seria
preciso um service worker, que o arquivo único não permite.

Vigia e aba conversam por `eventos.js`: quem grava avisa, com a origem; os outros releem. Entre abas
do navegador, BroadcastChannel.

## A tela

Lista à esquerda (entrada rápida, busca, visões Lista e Planejado, filtros por estado com contagem,
etiquetas), anotação aberta à direita — e, sem nenhuma aberta, uma **anotação nova pronta para
escrever**. No celular, uma de cada vez. Rotas: `#anotacoes` (a que estava aberta),
`#anotacoes/nova`, `#anotacoes/nota/<id>`. N abre uma nova, / busca.

**Salvar é explícito** (pedido da mesa em 30/09: "não dá para saber quando salvou"; e o que o NN/g
mostra que as pessoas esperam — nada mudou até Salvar):

- o editor trabalha num **rascunho** (`estado.aberta`); nada vai para o IndexedDB até Salvar;
- o **selo de gravação** diz sempre em que pé está: Nova anotação · Alterações não salvas
  (âmbar, com Descartar) · Salvando… · Salvo às 14:32 (verde) · Não salvou;
- **Salvar** grava e abre uma anotação nova (a folha salva sai de cena, a nova entra, e a salva
  acende na lista); **Ctrl+S** salva e continua; **Ctrl+Enter** salva e começa outra;
- sair de uma anotação com alteração pergunta antes; fechar a página também (`beforeunload`);
- enquanto não é salvo, o rascunho fica no `localStorage` (`mesa_anotacoes_rascunho`): se a página
  fechar no meio, a anotação oferece **Recuperar** na volta (texto, etiquetas e lembrete — os
  anexos novos, não);
- ao salvar, vale o que a pessoa mudou desde que abriu; o que ela não mexeu vem do que está gravado
  agora (`mesclarAoSalvar`) — o alerta pode ter adiado o lembrete enquanto ela editava o texto;
- anexos colados ou arrastados entram no rascunho (selo "novo") e vão para o banco ao salvar.

O resto, tirado das ferramentas que a mesa já conhece:

- **Entrada rápida** (Todoist): "ligar pro cliente amanhã 10h #retorno" + Enter vira anotação com
  lembrete e etiqueta; a data lida aparece num selo antes, com × para ignorar (`dataNatural.js`, e
  as regras de cautela dele: "do dia 25" não é lembrete, "segunda via" não é segunda-feira).
- **Modelos** (Evernote, Notion): Estorno, Pendência de cliente, Ajudar um colega, Retornar ligação
  — título, campos e checklist prontos (`modelos.js`); só o de retorno sugere prazo.
- **Checklist** (Keep, Apple Notes): linhas `[ ]`/`[x]` no texto viram caixinhas com barra de
  progresso; o cartão mostra "1/3". Fica como texto: vai no backup e no "Copiar texto".
- **Planejado** (Microsoft To Do): a lista agrupada em Vencidas, Hoje, Amanhã, Próximos 7 dias,
  Mais adiante e Sem lembrete.
- **Bolinha de resolver** no cartão (Todoist) e **Desfazer** no aviso depois de resolver ou excluir
  (Gmail, Keep).
- **Lixeira de 30 dias** (Apple Notes): excluir é mandar para a lixeira (`excluidaEm`); de lá,
  Restaurar ou Apagar de vez; passados 30 dias, apaga sozinha ao abrir a aba.
- **Busca com o termo marcado** no cartão, sem ligar para acento; **Copiar texto** no editor.
- **Ctrl+V com uma imagem** anexa o print (nome "print AAAA-MM-DD HHhMM.png", como o Sticky Notes);
  o arquivo fica como Blob no IndexedDB, até 15 MB cada. No visor, "Copiar imagem" põe o print de
  volta na área de transferência (convertido para PNG, o único tipo que ela aceita).
- **Links** http(s) do texto viram botões que abrem em outra aba; `javascript:` e afins, nunca.
- Toda escrita passa por uma **fila**: duas gravações da mesma anotação nunca se cruzam.
- Tudo que é texto passa por `esc`: anotação é texto livre, às vezes colado de um e-mail.

## Mapa

`lembretes.js`, `notas.js`, `dataNatural.js` e `modelos.js` (funções puras: estado, rótulo,
atalhos, etiquetas, links, checklist, agenda, lixeira, rascunho, data na frase, modelos) ·
`repositorio.js` (contrato e validação) · `adaptadores/indexeddb.js` e `adaptadores/memoria.js` ·
`backup.js` · `eventos.js` · `banco.js` (um repositório para a página) · `vigia.js` · `render.js`
(HTML puro) · `index.js` (rascunho, estado, eventos) · `anotacoes.css`.

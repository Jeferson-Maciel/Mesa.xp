# Operacional

Parte da documentação da Mesa XP. O que vale sempre — dado de cliente, push, "nada é
adivinhado", as regras do robô, a verificação — e o mapa dos outros documentos estão no
[`CLAUDE.md`](../CLAUDE.md).

A base de conhecimento da mesa — o Slab dentro da Mesa XP: modelos de e-mail de confirmação, textos
de disparo, passo a passo dos sistemas, padrões de fixing e regras de execução. Código em
`src/modulos/operacional/`. Entrou em 30/09/2026, a pedido da mesa, depois de uma primeira tentativa
de outro agente (guardada na branch `antigravity/operacional`, não revisada).

## O conteúdo

`conteudo.js` é a cópia do Slab da equipe (lá "Gregori's Team"; na barra lateral, a pedido da mesa,
**Operacional Mesa**): a raiz **Mesa de Operações
Argentum** e cinco tópicos (Padrões de Email, Disparos, Passo a Passo, Padrões de Fixing, Execução
de Ordens), com os 34 posts na ordem do Slab. É a **semente**: o banco nasce dela
(`supabase/operacional.sql`) e o modo local também. Depois de semeado, o banco é a fonte — o que a
mesa edita pela tela não volta para o arquivo.

- **O texto é o do Slab, como foi colado**, erros de digitação incluídos ("cncelar"): é o que vai
  para o e-mail do cliente. Só foram normalizados espaço no fim da linha e linha feita só de espaço
  invisível (NBSP). `conteudo.test.js` prende a estrutura, a ordem e os posts sem texto.
- **15 posts vieram só com o título** (Confirmação resgate fundos, Confirmação aplicação Fundos, os
  12 de Padrões de Fixing e Ações e Fundos Listados). Ficam vazios e marcados "texto pendente";
  **não se inventa texto para eles** — a mesa cola o do Slab pela tela.
- O texto é mostrado como está, sem interpretar: os asteriscos do WhatsApp aparecem como
  asteriscos, porque é assim que o texto vai ser copiado. "Copiar texto" copia o conteúdo exato.

## Repositório e o banco

Mesmo padrão do Calendário: `repositorio.js` documenta o contrato, e dois adaptadores equivalentes
o cumprem — `adaptadores/supabase.js` (tabelas `operacional_topicos` e `operacional_posts`) e
`adaptadores/local.js` (`localStorage`, chave `mesa_operacional`). `repositorio.test.js` roda a
mesma bateria contra os dois, com um Supabase falso que imita o SQL.

Como o app não tem login e qualquer um com o link edita, duas regras protegem o conteúdo:

- **Excluir é esconder.** O post ganha `excluido_em` e some da tela, mas continua no banco. A chave
  anon **não tem política de DELETE** em tabela nenhuma do Operacional.
- **Ninguém salva por cima de quem salvou antes.** Cada post tem `versao`; o UPDATE só casa com a
  versão que foi aberta e sobe um número. Se outra pessoa salvou no meio, sai `ErroDeConflito`, nada
  é sobrescrito e o texto de quem foi recusado continua no editor.

No banco, um gatilho `security definer` guarda **cada versão de cada post** em
`operacional_revisoes`, uma tabela sem política nenhuma: a chave anon não lê nem apaga o histórico,
e um texto estragado ou excluído se recupera pelo painel do Supabase. Outro gatilho carimba
`atualizado_em`.

`supabase/operacional.sql` é **gerado** (`npm run sql:operacional`) por `sql.js` a partir da
semente — não edite à mão; `sql.test.js` recusa o arquivo se ele divergir. Ele cria tabelas,
gatilhos, RLS, Realtime e a semente, e pode rodar de novo: nada duplica e nenhuma edição da mesa é
desfeita. Foi validado num Postgres de verdade (PGlite): roda duas vezes, semeia 6 tópicos e 34
posts, o gatilho guarda o histórico, a trava de versão recusa a segunda gravação e o banco recusa
título vazio, slug repetido e apagar tópico com posts.

No banco da mesa (`rtvtgulivtkpfprcfpie`) ele já rodou, em 30/09/2026. Num projeto novo: SQL Editor
do Supabase → colar `supabase/operacional.sql` → executar.

## Tela

No desenho do Slab, no visual da Mesa XP:

- **Barra lateral**: a equipe, a busca (título e texto, sem ligar para acento) e a árvore de
  tópicos com a contagem de posts; "+ Novo tópico" abre um `<dialog>` e cria debaixo da raiz.
- **Raiz = início da aba** (`#operacional`): título, descrição e os posts agrupados por tópico, com a
  trilha "Mesa de Operações Argentum › tópico", como o Slab mostra.
- **Tópico** (`#operacional/topico/<slug>`) e **post** (`#operacional/post/<slug>`): cada um tem link
  próprio para mandar a um colega. O slug não muda quando o título muda.
- **Post aberto**: trilha, título grande, "Copiar texto", "Editar", "Excluir" (com confirmação).
- **Editor**: título, tópico e texto; Ctrl+Enter salva, Esc cancela; sair com alteração pede
  confirmação. Uma atualização ao vivo **não redesenha o editor** (o que está sendo digitado não
  some); se o post mudou no banco, o editor avisa.

Fora desta versão, e registrados no roadmap: anexos (foto, áudio, vídeo), rascunhos, favoritos,
"mais populares", restaurar versão pela tela e excluir tópico.

A base exige rede, como o Calendário: sem conexão o erro aparece na tela, e nada cai calado no
modo local.

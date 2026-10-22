# Calendário

Parte da documentação da Mesa XP. O que vale sempre — dado de cliente, push, "nada é
adivinhado", as regras do robô, a verificação — e o mapa dos outros documentos estão no
[`CLAUDE.md`](../CLAUDE.md).

Planilha semanal de presença da equipe, gravada no Supabase e sincronizada em tempo real entre quem
está com a página aberta. Código em `src/modulos/calendario/`.

## Repositório e adaptadores

Tudo que a tela lê e grava passa pelo repositório (`repositorio.js`, com o contrato documentado).
Dois adaptadores equivalentes cumprem o mesmo contrato:

- `adaptadores/supabase.js` — o banco da mesa. Recebe o cliente pronto (`src/dados/banco.js`).
- `adaptadores/local.js` — `localStorage`, chave **`presenca_app_data`**, no formato do app
  original. Ligado quando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão **as duas vazias**.

`repositorio.test.js` roda a mesma bateria contra os dois, com um Supabase falso
(`testes/supabase-falso.js`) que imita o schema: chave única, `check` de horário, chave estrangeira
e `on delete cascade`. Método novo ou alterado entra nos dois adaptadores e na bateria. Mudança de
schema: atualize `supabase/schema.sql` junto com o adaptador e o fake.

O domínio fala português (`colaborador`, `registro`, `indisponiveis`); o banco e o formato local
continuam com os nomes do original: `supabase/schema.sql` é o do app original, e os dados de um
banco do Calendário antigo passam para o novo tabela por tabela, sem conversão.

## Regras

- **Datas são sempre a chave local `YYYY-MM-DD`**, gerada por `chaveDoDia` (`datas.js`). Nunca
  `toISOString()`: ele converte para UTC e, às 21h de Brasília, o registro de quarta cai na quinta.
  Um teste varre o módulo e recusa `toISOString`.
- **Todo texto vindo do banco ou do usuário passa por `esc`**, e a cor do colaborador, que vai para
  um `style`, por `corSegura` (só hex). Qualquer pessoa com a chave anon escreve no banco: nome,
  observação e motivo são entrada não confiável.
- **Salvar o dia insere os horários novos ANTES de apagar os antigos**, e apaga pelos ids lidos
  antes da inserção. Uma queda no meio deixa os antigos (falha ao inserir) ou antigos e novos
  juntos (falha ao apagar) — nunca o dia sem horário, como no original, que apagava primeiro. E o
  horário que outra pessoa gravou no meio tempo não é apagado.
- **Consultas em lotes**: `in()` com no máximo 100 ids — a lista vai na URL.
- **Sem fallback silencioso para o modo local.** Erro de rede aparece na tela, com "Tentar de novo",
  e fica lá até dar certo; a janela do dia não fecha quando o salvamento falha. Só uma das duas
  variáveis vazia é erro de configuração, na tela — não modo local. Armazenamento local cheio também
  vira erro (o original só avisava no console).
- **A queda de rede aparece na hora** (22/10/2026). O supabase-js repete sozinho a leitura que caiu
  na rede (3 vezes, depois de 1, 2 e 4 s), e o erro só chegava à tela uns 12 s depois. Agora o
  cliente do banco avisa cada tentativa que falha (`aoFalharTentativa`, em `src/dados/banco.js`), e o
  Calendário mostra, já na primeira, "Sem resposta do banco de presença. Tentando conectar de novo
  (2 de 4)…", em amarelo, com "tentando conectar…" no status; na última, o erro de sempre, com
  "Tentar de novo". As tentativas ficaram (uma rede que pisca volta sozinha); só a espera calada
  saiu. A gravação não é repetida pelo supabase-js, e o erro dela já aparecia na hora.
- **O horário indisponível inválido avisa dentro da janela do dia** (22/10/2026), logo abaixo dos
  campos, em vermelho, como o erro ao salvar; o aviso flutuante ficava atrás do véu do `<dialog>`.
- O motivo do horário indisponível pode ser de saúde: a matriz da semana mostra o horário, não o
  motivo. O motivo aparece na janela do dia e no histórico, como no original.
- Remover um colaborador apaga os registros dele pelo `on delete cascade` do banco (no modo local,
  o adaptador faz a mesma coisa).

## Conexão

`src/dados/config.js` resolve URL e chave de `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, lidas no
build; sem elas vale o projeto da mesa (`rtvtgulivtkpfprcfpie`). `src/dados/banco.js` cria o
cliente do `@supabase/supabase-js` sem sessão de login (o app não tem login, e o hash da URL é a
rota das abas) e com 15 s por requisição. O Realtime escuta as três tabelas e recarrega a visão com
300 ms de espera (um salvamento gera vários eventos).

O status no topo sai de dois fatos juntos, a última carga e o Realtime, e não do último evento que
chegou: "carregando…", "sem conexão" (nunca carregou), "ao vivo", "sem atualização ao vivo"
(carregou, mas o Realtime caiu), "conectado" ou "modo local". O Realtime costuma ficar pronto antes
da primeira carga terminar; quando cada evento escrevia o status por cima do outro, a tela ficava em
"conectado" com o Realtime funcionando.

**"Ao vivo" só depois do aviso do banco.** O canal responde `SUBSCRIBED` quando o servidor do
Realtime aceita a inscrição, mas o banco só começa a repassar mudanças uns 150 ms depois, quando
chega a mensagem de sistema `postgres_changes` com status `ok`. Uma gravação feita nesse intervalo
não gera evento nenhum. `src/dados/realtime.js` espera por esse aviso (é o mesmo para Calendário e
Operacional), e a tela recarrega ao recebê-lo, para pegar o que mudou antes. Achado no primeiro
teste contra o banco real: a outra aba perdia o primeiro colaborador criado.

**Depois de salvar, a tela usa o que foi salvo sem esperar a releitura.** Um salvamento dispara
eventos do Realtime no meio do caminho, e a carga que eles pedem pode ler o dia (ou o post) pela
metade — o dia já gravado, os horários ainda não. Por isso `salvarDia` põe o registro salvo no
estado antes de recarregar, e o Operacional faz o mesmo com o post salvo ou excluído. Sem isso, a
janela do dia reaberta logo depois de salvar vinha sem os horários.

**O projeto mudou em 30/09/2026.** O antigo (`ekughbuuvjoojgfgbqbz`, o do Calendário na Vercel)
não resolvia no DNS desde 29/09 e não está na conta Supabase da mesa; os registros de presença dele
não vieram, e a mesa decidiu não migrá-los: o Calendário começa do zero. O projeto
`rtvtgulivtkpfprcfpie` recebeu `supabase/schema.sql` e `supabase/operacional.sql`.

## Tela

Matriz colaborador × dia útil, com o total de presenciais por dia no rodapé e o dia de hoje
destacado; clique na célula abre a janela do dia (`<dialog>` nativo: presencial, observação,
horários indisponíveis). Histórico do mês agrupado por semana, com filtro por colaborador. No
celular a matriz rola dentro do quadro, com a coluna dos nomes parada.

/**
 * Os serviços que um módulo cria e outros usam, sem um importar o outro.
 *
 * O robô do Hub conversa com a página por uma ponte só (`ordens/platform/roboHub.js`): duas pontes
 * mandariam dois "olá" e receberiam cada resposta em dobro. O Ordens, que inicia com a página, cria a
 * ponte e a registra aqui; a Fila (as respostas do cliente no Outlook) e a Prateleira de fundos (a
 * cotação) a pegam daqui. Quem pede um serviço que ainda não foi registrado recebe `null` e segue
 * sem ele.
 */

const servicos = new Map();
const esperando = new Map();

export const registrarServico = (nome, valor) => {
  servicos.set(nome, valor);
  for (const fn of esperando.get(nome) ?? []) fn(valor);
  esperando.delete(nome);
};

/** @returns {any|null} */
export const servico = (nome) => servicos.get(nome) ?? null;

/** Chama `fn` com o serviço assim que ele existir (na hora, se já existe). */
export const quandoHouver = (nome, fn) => {
  if (servicos.has(nome)) fn(servicos.get(nome));
  else esperando.set(nome, [...(esperando.get(nome) ?? []), fn]);
};

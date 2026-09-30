/**
 * Os erros dos repositórios que falam com o banco da mesa (Calendário e Operacional).
 *
 * Todo erro de repositório sai como `ErroDoRepositorio`, com a mensagem pronta para a tela. Nenhum
 * adaptador engole erro nem troca de adaptador sozinho: falha de rede aparece para quem está usando.
 */

export class ErroDoRepositorio extends Error {
  constructor(mensagem, opcoes) {
    super(mensagem, opcoes);
    this.name = 'ErroDoRepositorio';
  }
}

/**
 * Outra pessoa gravou o mesmo registro depois que ele foi aberto. Nada foi sobrescrito: quem recebe
 * este erro ainda tem o próprio texto na tela e decide o que fazer.
 */
export class ErroDeConflito extends ErroDoRepositorio {
  constructor(mensagem, opcoes) {
    super(mensagem, opcoes);
    this.name = 'ErroDeConflito';
  }
}

/** Erro de rede do navegador, do jeito que o supabase-js o repassa. */
export const ehErroDeRede = (erro) =>
  /Failed to fetch|NetworkError|Load failed|fetch failed|AbortError|TimeoutError|timed out/i.test(String(erro?.message ?? erro));

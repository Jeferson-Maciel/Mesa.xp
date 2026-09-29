/**
 * Terceira etapa do pipeline: a comporta entre o que foi interpretado e o que pode ser gerado.
 *
 * Dois níveis, e a diferença entre eles é toda a política do sistema:
 *
 *   **bloqueio** — segura a saída até o operador olhar. É o que impede uma ordem de sair com
 *   dado adivinhado (invariantes 5, 7 e 8).
 *   **aviso** — acompanha a saída, sem segurá-la. É o que o operador precisa saber, mas que não
 *   compromete o que vai ser executado.
 *
 * Quase todo bloqueio é `confirmavel`: o operador confirma e gera, sem ter que editar o texto de
 * entrada. Um bloqueio que não se pode destravar seria um beco sem saída no meio do expediente, e
 * o operador acabaria contornando o sistema — que é exatamente o risco que ele existe para evitar.
 * As exceções são os bloqueios que confirmar não resolve: a conta ausente (sem conta não existe
 * ordem), o fundo ambíguo (confirmar não escolhe o fundo) e a ordem que não cabe no formato. Esta
 * última não é beco sem saída — a saída é outro formato, marcado a um clique.
 *
 * O validador **não corrige nada**. Ele lê a solicitação e devolve diagnósticos.
 *
 * @typedef {object} Diagnostico
 * @property {'bloqueio'|'aviso'} nivel
 * @property {string} codigo
 * @property {string} mensagem
 * @property {number|null} indiceOrdem  qual ordem da lista, quando o problema é de uma só
 * @property {boolean} confirmavel
 * @property {{campo: string, rotulo: string}} [acao]  conserto de um clique, além de confirmar
 */

const bloqueio = (codigo, mensagem, indiceOrdem = null, confirmavel = true) => ({
  nivel: 'bloqueio',
  codigo,
  mensagem,
  indiceOrdem,
  confirmavel
});

const aviso = (codigo, mensagem, indiceOrdem = null) => ({
  nivel: 'aviso',
  codigo,
  mensagem,
  indiceOrdem,
  confirmavel: false
});

/**
 * @param {object} solicitacao
 * @param {'email'|'auditoria'|'lote'|'twap'} formato
 * @returns {Diagnostico[]}
 */
export const validar = (solicitacao, formato) => {
  const { conta, ordens = [], descartadas = [], horario } = solicitacao;
  const diagnosticos = [];

  if (!conta) {
    diagnosticos.push(
      bloqueio('conta-ausente', 'Conta XP não identificada. Informe o código da conta.', null, false)
    );
  }

  if (ordens.length === 0) {
    diagnosticos.push(bloqueio('sem-ordens', 'Nenhuma ordem foi interpretada nesta solicitação.'));
  }

  // Duas linhas ainda em branco não são o mesmo ativo repetido: cada uma já tem o seu bloqueio.
  const vezes = new Map();
  for (const o of ordens) if (o.ativo?.trim()) vezes.set(o.ativo, (vezes.get(o.ativo) ?? 0) + 1);

  ordens.forEach((o, i) => {
    const nome = o.ativo?.trim() || `Linha ${i + 1}`;

    // A linha acrescentada à mão nasce vazia. Nenhum dos dois é confirmável: confirmar escrevia
    // `Ativo: ;` ou `Quantidade: null;` no e-mail.
    if (!o.ativo?.trim()) {
      diagnosticos.push(bloqueio('ativo-vazio', `Na linha ${i + 1}, informe o ativo.`, i, false));
    }

    if ((o.quantidade === null || o.quantidade === undefined) && (o.financeiro === null || o.financeiro === undefined)) {
      diagnosticos.push(
        bloqueio('valor-ausente', `${nome}: informe a quantidade ou o valor em R$.`, i, false)
      );
    }

    // Nome digitado à mão que não é ticker e não bate com nada da prateleira. No texto colado ele
    // iria para os descartes; aqui foi o operador quem escreveu, e a prateleira pode estar velha —
    // por isso confirma-se.
    if (o.ativo?.trim() && o.fundo?.situacao === 'nenhum') {
      diagnosticos.push(
        bloqueio(
          'ativo-nao-reconhecido',
          `${o.ativo} não é um ticker e não está na prateleira de fundos da XP. Confira o nome.`,
          i
        )
      );
    }

    if (!o.operacao) {
      diagnosticos.push(
        bloqueio('operacao-ausente', `${nome}: compra ou venda não identificada.`, i)
      );
    }

    if (o.ticker?.situacao === 'parecido') {
      diagnosticos.push(
        bloqueio(
          'ticker-suspeito',
          `${o.ativo} não existe na B3 e se parece com ${o.ticker.sugestoes.join(', ')}. ` +
            'Confirme o ticker correto — o sistema não corrige sozinho.',
          i
        )
      );
    }

    // Número que sobrou na linha depois de explicados o ativo, o preço e o valor. O caso que
    // trouxe isto: `PETR4 100 a 39,50` saía como ordem a mercado, porque o 39,50 era descartado
    // sem que nada notasse — uma ordem limite virando ordem a mercado, em silêncio.
    if (o.numerosSobrando?.length > 0) {
      diagnosticos.push(
        bloqueio(
          'numero-nao-explicado',
          `${o.ativo}: o número ${o.numerosSobrando.join(' e ')} está na linha e não foi usado. ` +
            'Se for preço, preencha o campo Preço; se for ruído, confirme.',
          i
        )
      );
    }

    if (o.ticker?.situacao === 'desconhecido') {
      diagnosticos.push(
        aviso('ticker-desconhecido', `${o.ativo} não está na lista da B3. Confira antes de enviar.`, i)
      );
    }

    // ── Fundos cetipados ───────────────────────────────────────────────────────────────
    // Um nome erra por uma palavra, e é por isso que estes dois bloqueios **não** são
    // confirmáveis: confirmar não decide qual dos três XP Habitat o cliente pediu. O caminho
    // é o operador escolher o nome certo no preview, e só então a saída sai.
    if (o.fundo?.situacao === 'ambiguo') {
      diagnosticos.push(
        bloqueio(
          'fundo-ambiguo',
          `"${o.ativo}" cabe em ${o.fundo.candidatos.length} fundos da prateleira: ` +
            o.fundo.candidatos.map((c) => c.nome).join(' · ') +
            '. Escolha qual é.',
          i,
          false
        )
      );
    }

    if (o.fundo?.situacao === 'parcial') {
      diagnosticos.push(
        bloqueio(
          'fundo-parcial',
          `"${o.ativo}" não bate com nenhum fundo da prateleira. Parecidos: ` +
            o.fundo.candidatos.map((c) => c.nome).join(' · ') +
            '. Confirme qual é.',
          i,
          false
        )
      );
    }

    // O TSV identifica o ativo por código, e fundo cetipado não tem. Não é limitação do
    // sistema: essas ordens não são executadas em bolsa. Nenhum dos dois é confirmável, porque
    // confirmar poria o nome por extenso numa coluna de código.
    if (o.fundo && (formato === 'lote' || formato === 'twap')) {
      diagnosticos.push(
        bloqueio(
          'fundo-fora-do-lote',
          `${o.ativo} é fundo cetipado e não vai para lote — use o e-mail.`,
          i,
          false
        )
      );
    }

    // A coluna Ativo da tabela é de código, e o operador decidiu mantê-la assim: fundo cetipado
    // não entra nela. O e-mail de ordem, em texto, continua aceitando o nome.
    if (o.fundo && formato === 'auditoria') {
      diagnosticos.push(
        bloqueio(
          'fundo-na-auditoria',
          `${o.ativo} é fundo cetipado e não entra no e-mail em tabela — use a Ordem por e-mail.`,
          i,
          false
        )
      );
    }

    const minimo = o.fundo?.fundo?.qtdMinima;
    if (minimo && o.quantidade !== null && o.quantidade !== undefined && o.quantidade < minimo) {
      diagnosticos.push(
        aviso(
          'abaixo-do-minimo',
          `${o.ativo}: ${o.quantidade} cotas ficam abaixo do mínimo de ${minimo} da última ` +
            'listagem. Confira se o mínimo mudou.',
          i
        )
      );
    }

    // Sem coluna de financeiro não há onde pôr o valor, e confirmar escrevia `null` em
    // Qtd. Total. Por isso não é confirmável: a saída é trocar de formato.
    const porFinanceiro = o.financeiro !== null && o.financeiro !== undefined;

    if (formato === 'lote' && porFinanceiro) {
      diagnosticos.push(
        bloqueio(
          'financeiro-em-lote-simples',
          `${o.ativo} foi informado por valor financeiro, e o Lote Simples não tem essa coluna. ` +
            'Use o E-mail em tabela ou o Lote TWAP.',
          i,
          false
        )
      );
    }

  });

  // `BTLG11 3.000,00` / `XPML11 3.000`: a segunda linha é quantidade só porque ninguém escreveu os
  // centavos, e o caso comum é o assessor tê-los esquecido. Cesta mista de verdade existe, então
  // confirma-se — mas o bloqueio também traz o conserto a um clique. Só conta a quantidade que veio
  // de número solto: `100 cotas`, escrito assim, é mistura de propósito.
  const porValor = (o) => o.financeiro !== null && o.financeiro !== undefined;
  const soltas = ordens.filter((o) => !porValor(o) && o.quantidadeSolta);

  if (soltas.length > 0 && ordens.some(porValor)) {
    const lidas = soltas.map((o) => `${o.ativo} (${o.quantidade})`).join(', ');
    const verbo = soltas.length > 1 ? 'foram lidos' : 'foi lido';

    diagnosticos.push({
      ...bloqueio(
        'cesta-mista',
        `A cesta mistura valor em R$ com quantidade: ${lidas} ${verbo} como quantidade, sem a ` +
          'palavra cotas. Se tudo é financeiro, use Tudo em R$; se a mistura está certa, confirme.'
      ),
      acao: { campo: 'tudo-em-reais', rotulo: 'Tudo em R$' }
    });
  }

  for (const [ativo, quantas] of vezes) {
    if (quantas > 1) {
      diagnosticos.push(
        bloqueio(
          'ativo-duplicado',
          `${ativo} aparece ${quantas} vezes nesta solicitação. Confirme se são ordens separadas — ` +
            'o sistema não soma sozinho.'
        )
      );
    }
  }

  if (formato === 'twap' && !horario) {
    diagnosticos.push(
      aviso('twap-sem-horario', 'TWAP sem horário informado: as colunas de hora saem vazias.')
    );
  }

  if (descartadas.length > 0) {
    diagnosticos.push(
      aviso(
        'linhas-descartadas',
        `${descartadas.length} linha(s) não viraram ordem e precisam ser tratadas na mão.`
      )
    );
  }

  return diagnosticos;
};

/** @returns {boolean} se a saída pode ser gerada sem confirmação do operador. */
export const podeGerar = (solicitacao, formato) =>
  validar(solicitacao, formato).every((d) => d.nivel !== 'bloqueio');

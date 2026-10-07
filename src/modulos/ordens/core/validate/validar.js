import { LIMITE_DA_COTACAO_MIN } from '../secundario/secundario.js';
import { formatarFinanceiro, formatarPercentual } from '../util/dinheiro.js';

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
    // sistema: essas ordens não são executadas em bolsa. Pelo nome, nenhum dos dois é
    // confirmável, porque confirmar poria o nome por extenso numa coluna de código. Escrito pelo
    // ticker (`VGPR11`), o código cabe na coluna: o padrão é a boleta do secundário, e confirmar é
    // a saída para quando a mesa compra o fundo em bolsa.
    const peloTicker = Boolean(o.fundo?.fundo?.ticker) && o.ativo === o.fundo.fundo.ticker;
    const emBolsa =
      `${o.ativo} é fundo da prateleira, comprado pela boleta do secundário — use o e-mail. ` +
      'Se a ordem é em bolsa, confirme.';

    if (o.fundo && (formato === 'lote' || formato === 'twap')) {
      diagnosticos.push(
        bloqueio(
          'fundo-fora-do-lote',
          peloTicker ? emBolsa : `${o.ativo} é fundo cetipado e não vai para lote — use o e-mail.`,
          i,
          peloTicker
        )
      );
    }

    // A coluna Ativo da tabela é de código, e o operador decidiu mantê-la assim: fundo cetipado
    // não entra nela. O e-mail de ordem, em texto, continua aceitando o nome.
    if (o.fundo && formato === 'auditoria') {
      diagnosticos.push(
        bloqueio(
          'fundo-na-auditoria',
          peloTicker
            ? emBolsa
            : `${o.ativo} é fundo cetipado e não entra no e-mail em tabela — use a Ordem por e-mail.`,
          i,
          peloTicker
        )
      );
    }

    const porFinanceiro = o.financeiro !== null && o.financeiro !== undefined;

    // ── Secundário ─────────────────────────────────────────────────────────────────────
    // Compra de fundo cetipado: a planilha do dia converte o pedido em R$ em cotas
    // (`core/secundario`). `o.secundario` chega calculado pela tela; aqui só se julga.
    const sec = o.secundario;

    if (sec && formato === 'email' && porFinanceiro) {
      const pedido = formatarFinanceiro(o.financeiro);

      // Os dois primeiros confirmam: sem a planilha, o e-mail sai em R$, como saía antes dela.
      if (sec.situacao === 'sem-planilha') {
        diagnosticos.push(
          bloqueio(
            'secundario-sem-planilha',
            `${o.ativo}: carregue os fundos do secundário (favorito do Hub ou planilha) para converter ` +
              `${pedido} em cotas — ou confirme para mandar o valor em R$.`,
            i
          )
        );
      }

      if (sec.situacao === 'fora-da-planilha') {
        diagnosticos.push(
          bloqueio(
            'secundario-fora-da-planilha',
            `${o.ativo} não está nos fundos do secundário carregados (sem estoque, ou arquivo ` +
              'antigo). Confirme para mandar o valor em R$.',
            i
          )
        );
      }

      // Confirmar não diz qual é o teto. As saídas são trazê-lo (favorito do Hub ou anotação) ou
      // ir de ROA zerado, que não precisa dele: o deságio inteiro vai para o cliente.
      if (sec.situacao === 'sem-teto') {
        diagnosticos.push({
          ...bloqueio(
            'secundario-sem-teto',
            `${o.ativo}: falta o ROA adicional máximo do fundo. Carregue os fundos pelo favorito do ` +
              'Hub, que já traz o ROA, anote o fim da barra na boleta, ou use o ROA zerado.',
            i,
            false
          ),
          acao: { campo: 'roa-zerado', rotulo: 'Usar ROA zerado' }
        });
      }

      if (sec.situacao === 'pronto' && sec.cotas === 0) {
        diagnosticos.push(
          bloqueio(
            'secundario-sem-cota',
            `${o.ativo}: ${pedido} não compra nem uma cota (PU ${formatarFinanceiro(sec.fundo.pu)}).`,
            i,
            false
          )
        );
      }
    }

    // Corretagem 0,00 na captura é um modelo de boleta que ainda não foi conferido (os XP CDI
    // Private, os FIPs). Se a boleta cobrar a corretagem de sempre, as cotas passam do pedido.
    if (sec?.situacao === 'pronto' && formato === 'email' && porFinanceiro && sec.fundo.corretagem === 0) {
      diagnosticos.push(
        bloqueio(
          'secundario-sem-corretagem',
          `${o.ativo}: a captura do Hub traz corretagem 0,00% para este fundo, um tipo de boleta ` +
            'ainda não conferido. Confira na boleta a corretagem e o deságio, e confirme.',
          i
        )
      );
    }

    if (sec?.situacao === 'pronto' && formato === 'email' && sec.cotas > 0) {
      const { estoque } = sec.fundo;
      if (estoque !== null && sec.cotas > estoque) {
        diagnosticos.push(
          bloqueio(
            'secundario-sem-estoque',
            `${o.ativo}: ${sec.cotas.toLocaleString('pt-BR')} cotas passam do estoque da planilha ` +
              `(${estoque.toLocaleString('pt-BR')}). Confirme se o estoque mudou.`,
            i
          )
        );
      }
    }

    // O teto anotado foi visto num dia, com um deságio. Se o deságio mudou, o teto pode ter mudado
    // junto. O do Hub veio do deságio da mesma captura; e o ROA zerado não usa teto nenhum.
    const anotado = sec?.situacao === 'pronto' && !sec.semRoa && sec.teto && !sec.teto.doHub;
    if (anotado && sec.teto.desagio !== sec.fundo.desagio) {
      diagnosticos.push(
        aviso(
          'secundario-teto-antigo',
          `${o.ativo}: o ROA máximo de ${formatarPercentual(sec.teto.teto)} foi anotado com deságio ` +
            `de ${formatarPercentual(sec.teto.desagio)}; hoje o deságio é ` +
            `${formatarPercentual(sec.fundo.desagio)}. Confira na boleta.`,
          i
        )
      );
    }

    // A aplicação mínima é em reais (o Hub a rotula "Qtd. mínima"). Com a planilha, compara-se o
    // total que o cliente paga; sem ela, só dá para comparar um pedido em R$.
    const minimo = sec?.fundo?.aplicacaoMinima ?? o.fundo?.fundo?.aplicacaoMinima;
    const aplicado = sec?.conta?.total ?? (porFinanceiro ? o.financeiro : null);
    if (o.operacao === 'C' && minimo && aplicado !== null && aplicado < minimo) {
      diagnosticos.push(
        aviso(
          'abaixo-do-minimo',
          `${o.ativo}: ${formatarFinanceiro(aplicado)} fica abaixo da aplicação mínima de ` +
            `${formatarFinanceiro(minimo)}. Confira se o mínimo mudou.`,
          i
        )
      );
    }

    // Sem coluna de financeiro não há onde pôr o valor, e confirmar escrevia `null` em
    // Qtd. Total. Por isso não é confirmável: a saída é trocar de formato.
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

  // PU, deságio e estoque mudam todo dia: uma vez por solicitação basta para lembrar.
  const daPlanilha = ordens.find((o) => o.secundario?.planilha)?.secundario.planilha;
  if (daPlanilha && !daPlanilha.deHoje) {
    const dia = new Date(daPlanilha.exportadaEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    diagnosticos.push(
      aviso(
        'secundario-planilha-antiga',
        `Os fundos do secundário carregados são de ${dia}: PU, deságio, ROA e estoque mudam todo dia. ` +
          'Carregue os de hoje.'
      )
    );
  }

  // A cotação de um pedido em R$ vale por 10 minutos: o deságio muda ao longo do dia, e as cotas
  // de uma cotação velha podem passar do valor pedido. Uma vez por solicitação; o conserto pede ao
  // robô do Hub uma cotação nova.
  const velha = ordens.find(
    (o) =>
      o.secundario?.situacao === 'pronto' && o.secundario.porValor && o.secundario.planilha.minutos > LIMITE_DA_COTACAO_MIN
  );
  if (velha && formato === 'email') {
    const { exportadaEm, minutos } = velha.secundario.planilha;
    const hora = new Date(exportadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const idade = minutos < 120 ? `há ${minutos} min` : `há ${Math.floor(minutos / 60)} h`;
    diagnosticos.push({
      ...bloqueio(
        'secundario-cotacao-velha',
        `A cotação dos fundos é das ${hora} (${idade}): o deságio pode ter mudado, e as cotas, passado ` +
          'do valor pedido. Atualize as cotações, ou confirme para usar esta.'
      ),
      acao: { campo: 'atualizar-cotacoes', rotulo: 'Atualizar cotações' }
    });
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

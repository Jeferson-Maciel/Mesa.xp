import { CORRETAGEM } from '../core/secundario/boleta.js';
import { formatarFinanceiro, formatarPercentual } from '../core/util/dinheiro.js';
import { esc } from '../core/util/html.js';

/**
 * O bloco "Secundário" do cartão: o que os fundos do dia dizem de cada compra de fundo cetipado.
 *
 * É aqui que a conversão de R$ em cotas fica à vista antes de o e-mail sair, com os números da
 * boleta ao lado — PU, deságio, ROA, desconto do cliente — para o operador conferir contra o Hub.
 * Os dois cenários, ROA máximo e ROA zerado, ficam numa tabelinha, uma linha cada, com as colunas
 * alinhadas para comparar de relance; o que vai no e-mail fica marcado, e a escolha é feita nos
 * botões de copiar. Os valores em R$ levam "≈" enquanto o PU é o
 * da prateleira, com duas casas; com o preço exato da boleta, trazido pelo robô, saem sem ele.
 *
 * O ROA máximo vem da captura do favorito do Hub. Com a planilha exportada, que não o traz, ele é
 * anotado aqui, por fundo (`campo-teto`, gravado ao sair do campo).
 */

const dataDaPlanilha = ({ exportadaEm, doHub }) => {
  const d = new Date(exportadaEm);
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${doHub ? 'captura' : 'planilha'} de ${dia} às ${hora}`;
};

const descontoDoCliente = (desconto) => (desconto < 0 ? `ágio ${formatarPercentual(-desconto)}` : formatarPercentual(desconto));

// O teto do Hub é um dado, não uma anotação: aparece como texto.
const teto = (sec) => {
  if (sec.teto?.doHub) {
    return `<span class="secundario-teto" title="O fim da barra de ROA adicional na boleta: o deságio menos o deságio mínimo do cliente, na captura do Hub.">ROA até ${formatarPercentual(sec.teto.teto)} do Hub</span>`;
  }

  return `
  <label class="secundario-teto" title="O fim da barra de ROA adicional na boleta do Hub. Fica anotado para este fundo.">
    ROA máx.
    <input class="campo campo-teto" value="${esc(sec.teto ? formatarPercentual(sec.teto.teto).replace('%', '') : '')}"
           placeholder="?" size="4" inputmode="decimal" />%
  </label>`;
};

// Uma mensagem no lugar dos números, ocupando as quatro colunas.
const falta = (texto) => `<span class="secundario-falta secundario-largo" role="cell">${texto}</span>`;

// As colunas de um cenário. Cada célula leva o nome da coluna (`data-coluna`): numa tela estreita
// o cabeçalho some, e o nome aparece em cima do número.
const celulasDoCenario = (sec, cenario) => {
  if (!cenario.cotas) return falta('nenhuma cota cabe no valor pedido');

  const { desconto, total, remuneracao, percentualDaRemuneracao } = cenario.conta;
  // O "≈" diz que o PU é o arredondado da prateleira; com o preço exato da boleta, os valores são
  // os dela.
  const quase = sec.puExato ? '' : '≈ ';
  const celula = (coluna, conteudo) => `<span class="secundario-num" role="cell" data-coluna="${coluna}">${conteudo}</span>`;
  return (
    celula('Desconto do cliente', descontoDoCliente(desconto)) +
    celula('Cotas', `<strong>${cenario.cotas.toLocaleString('pt-BR')}</strong>`) +
    celula('Cliente paga', `${quase}${esc(formatarFinanceiro(total))}`) +
    celula(
      'Escritório',
      `${quase}${esc(formatarFinanceiro(remuneracao))} <span class="secundario-taxa">${formatarPercentual(percentualDaRemuneracao)}</span>`
    )
  );
};

const linha = (chave, rotulo, celulas, escolhido) => `
        <div class="secundario-cenario${escolhido ? ' escolhido' : ''}" data-cenario="${chave}" role="row">
          <span class="secundario-rotulo" role="rowheader">${rotulo}${escolhido ? ' <span class="secundario-no-email">no e-mail</span>' : ''}</span>
          ${celulas}
        </div>`;

const COLUNAS = ['Desconto do cliente', 'Cotas', 'Cliente paga', 'Escritório'];
const cabecalho = `
        <div class="secundario-cabecalho" role="row">
          <span class="secundario-th" role="columnheader">Cenário</span>${COLUNAS.map((c) => `<span class="secundario-th" role="columnheader">${c}</span>`).join('')}
        </div>`;

const cenarios = (ordem, sec) => {
  const { maximo, zerado } = sec.cenarios;

  // Sem ROA adicional, os dois cenários são o mesmo.
  const linhas =
    sec.teto && sec.teto.teto === 0
      ? linha('unico', 'Sem ROA adicional', celulasDoCenario(sec, zerado), false)
      : linha(
          'maximo',
          'ROA máximo',
          maximo ? celulasDoCenario(sec, maximo) : falta('falta o ROA máximo — anote-o, ou carregue os fundos pelo robô do Hub'),
          !sec.semRoa
        ) + linha('zerado', 'ROA zerado', celulasDoCenario(sec, zerado), sec.semRoa);

  return `<div class="secundario-cenarios" role="table" aria-label="Os cenários da boleta de ${esc(ordem.ativo)}">${cabecalho}${linhas}
      </div>`;
};

const fundo = (ordem, indice) => {
  const sec = ordem.secundario;
  const pedido = sec.porValor ? `<span class="secundario-pedido">pedido ${esc(formatarFinanceiro(ordem.financeiro))}</span>` : '';
  const nome = `<div class="secundario-topo"><span class="secundario-nome">${esc(ordem.ativo)}</span>${pedido}</div>`;

  if (sec.situacao === 'fora-da-planilha') {
    return `<div class="secundario-fundo" data-ordem="${indice}">${nome}
      <div class="secundario-conta"><span class="secundario-falta">não está nos fundos carregados</span></div></div>`;
  }

  const { fundo: linhaDoFundo } = sec;
  const pu = sec.puExato
    ? `PU R$ ${sec.pu.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} exato`
    : `PU ${esc(formatarFinanceiro(sec.pu ?? linhaDoFundo.pu))}`;
  const dados =
    `${pu} · deságio ${formatarPercentual(linhaDoFundo.desagio)}` +
    ` · corretagem ${formatarPercentual(linhaDoFundo.corretagem ?? CORRETAGEM)}`;

  return `
    <div class="secundario-fundo" data-ordem="${indice}">
      ${nome}
      <div class="secundario-dados">
        <span>${dados}</span>
        ${teto(sec)}
      </div>
      ${cenarios(ordem, sec)}
    </div>`;
};

/**
 * @param {object} solicitacao  com `ordem.secundario` já calculado
 * @returns {string} o bloco, ou vazio quando a solicitação não tem compra de fundo
 */
export const renderSecundario = (solicitacao) => {
  const comFundo = (solicitacao.ordens ?? []).map((o, i) => [o, i]).filter(([o]) => o.secundario);
  if (comFundo.length === 0) return '';

  // O robô do Hub está trazendo a cotação: o que está à vista vai mudar em segundos.
  const buscando = solicitacao.buscandoCotacao
    ? '<span class="meta-counter buscando">buscando cotações no Hub…</span>'
    : '';

  if (comFundo.every(([o]) => o.secundario.situacao === 'sem-planilha')) {
    return `
      <div class="secundario">
        <div class="secundario-cabeca"><span class="secundario-titulo">Secundário</span>${buscando}</div>
        ${buscando ? '' : '<p class="secundario-falta">Sem os fundos do secundário — traga-os pelo robô do Hub, pelo favorito 📥 ou pela planilha exportada, no painel da solicitação, para converter os fundos em cotas.</p>'}
      </div>`;
  }

  const planilha = comFundo.find(([o]) => o.secundario.planilha)?.[0].secundario.planilha;
  const quando = planilha ? `<span class="meta-counter${planilha.deHoje ? '' : ' antiga'}">${dataDaPlanilha(planilha)}</span>` : '';

  return `
    <div class="secundario">
      <div class="secundario-cabeca">
        <span class="secundario-titulo">Secundário</span>
        ${buscando || quando}
      </div>
      ${comFundo.filter(([o]) => o.secundario.situacao !== 'sem-planilha').map(([o, i]) => fundo(o, i)).join('')}
    </div>`;
};

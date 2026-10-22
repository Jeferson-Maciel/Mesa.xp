import { formatarCotas } from '../secundario/venda.js';
import { formatarFinanceiro, formatarPercentual } from '../util/dinheiro.js';

/**
 * Geração determinística do Comprovante de Cotação de Venda (Mercado Secundário).
 *
 * Replica visualmente, com precisão milimétrica, o painel oficial da boleta de venda do Hub XP:
 * - Caixa superior cinza clara: "Valor total da operação ⓘ" à esquerda e valor em negrito à direita;
 * - Seção expandida: "Visualizar mais detalhes da operação ˄";
 * - Tabela com as 7 linhas oficiais:
 *     1. Quantidade de cotas
 *     2. Preço unitário da cota
 *     3. Valor total da posição (R$)
 *     4. Deságio da operação (R$ e %)
 *     5. Valor da posição com deságio
 *     6. Corretagem (R$) ⓘ
 *     7. Valor total da operação
 *
 * Arquitetura (Clean Code & DDD):
 * - `layoutDoComprovanteVenda`: função pura com cálculo geométrico;
 * - `desenharComprovanteVenda`: pintor Canvas 2D nativo em alta resolução (Retina 2x);
 * - `gerarComprovanteVendaPng`: serializador para data URL PNG.
 */

const CORES = {
  fundo: '#ffffff',
  fundoCaixa: '#f4f4f6',
  textoDestaque: '#000000',
  textoCorpo: '#141414',
  textoRotulo: '#595959',
  linhaDivisoria: '#f0f0f2',
  icone: '#141414'
};

const FONTE_FAMILIA = "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif";
const LARGURA = 700;
const MARGEM = 24;

/**
 * @param {object} ordem  ordem com `ordem.venda` pronto
 * @param {{conta?: string|number, cliente?: object, hoje?: Date}} [opcoes]
 * @returns {{largura: number, altura: number, itens: Array<object>}}
 */
export const layoutDoComprovanteVenda = (ordem, { conta: _conta, cliente: _cliente, hoje: _hoje = new Date() } = {}) => {
  const v = ordem?.venda;
  const c = v?.conta;
  const condicoes = v?.condicoes;
  const itens = [];

  const cotas = v?.quantidade ?? ordem?.quantidade ?? 0;
  const valorDaCota = v?.valorDaCota ?? (c?.posicao && cotas ? c.posicao / cotas : 0);
  const posicao = c?.posicao ?? (cotas * valorDaCota);
  const desagioPct = condicoes?.desagio !== null && condicoes?.desagio !== undefined ? condicoes.desagio : 0;
  const desagioFin = c?.desagio ?? ((posicao * desagioPct) / 100);
  const comDesagio = c?.comDesagio ?? (posicao - desagioFin);
  const corretagemPct = condicoes?.corretagem ?? 0;
  const corretagemFin = c?.corretagem ?? ((comDesagio * corretagemPct) / 100);
  const total = c?.total ?? (comDesagio - corretagemFin);

  const texto = (x, y, t, tamanho, { peso = 400, cor = CORES.textoCorpo, alinhar = 'left' } = {}) =>
    itens.push({ tipo: 'texto', x, y, texto: String(t ?? ''), tamanho, peso, cor, alinhar });

  const caixa = (x, y, w, h, cor, { raio = 0, borda = null, bordaLargura = 1 } = {}) =>
    itens.push({ tipo: 'caixa', x, y, w, h, cor, raio, borda, bordaLargura });

  const linha = (x1, y1, x2, y2, cor = CORES.linhaDivisoria, largura = 1) =>
    itens.push({ tipo: 'linha', x1, y1, x2, y2, cor, largura });

  const iconeInfo = (x, y, raio = 7, cor = CORES.icone) =>
    itens.push({ tipo: 'icone-info', x, y, raio, cor });

  const chevron = (x, y, largura = 10, altura = 6, cor = CORES.textoDestaque) =>
    itens.push({ tipo: 'chevron', x, y, largura, altura, cor });

  const larguraUtil = LARGURA - 2 * MARGEM;
  let y = 18;

  // Caixa superior cinza clara ("Valor total da operação")
  const alturaCaixaTopo = 64;
  caixa(MARGEM, y, larguraUtil, alturaCaixaTopo, CORES.fundoCaixa, { raio: 6 });

  // Texto "Valor total da operação"
  texto(MARGEM + 16, y + 40, 'Valor total da operação', 16, { peso: 400, cor: CORES.textoCorpo });
  iconeInfo(MARGEM + 16 + 182, y + 35, 7, CORES.icone);

  // Valor total à direita da caixa cinza
  texto(LARGURA - MARGEM - 16, y + 40, formatarFinanceiro(total), 19, { peso: 700, cor: CORES.textoDestaque, alinhar: 'right' });

  y += alturaCaixaTopo + 34;

  // Título "Visualizar mais detalhes da operação" com chevron recolher/expandir à direita
  texto(MARGEM, y + 15, 'Visualizar mais detalhes da operação', 16, { peso: 700, cor: CORES.textoDestaque });
  chevron(LARGURA - MARGEM - 8, y + 9, 12, 6, CORES.textoDestaque);

  y += 26;

  // Tabela com as 7 linhas
  const desagioFormatado = `${formatarFinanceiro(desagioFin)} (${formatarPercentual(desagioPct)})`;
  const corretagemFormatada = `${formatarFinanceiro(corretagemFin)} (${corretagemPct === 0 ? '0%' : formatarPercentual(corretagemPct)})`;

  const linhas = [
    { rotulo: 'Quantidade de cotas', valor: formatarCotas(cotas), peso: 400 },
    { rotulo: 'Preço unitário da cota', valor: formatarFinanceiro(valorDaCota), peso: 400 },
    { rotulo: 'Valor total da posição (R$)', valor: formatarFinanceiro(posicao), peso: 400 },
    { rotulo: 'Deságio da operação', valor: desagioFormatado, peso: 400 },
    { rotulo: 'Valor da posição com deságio', valor: formatarFinanceiro(comDesagio), peso: 400 },
    { rotulo: 'Corretagem (R$)', valor: corretagemFormatada, peso: 400, comInfo: true },
    { rotulo: 'Valor total da operação', valor: formatarFinanceiro(total), peso: 600 }
  ];

  const alturaLinha = 44;
  for (let i = 0; i < linhas.length; i++) {
    const item = linhas[i];
    const yLinha = y + i * alturaLinha;

    texto(MARGEM, yLinha + 28, item.rotulo, 14, { cor: CORES.textoRotulo, peso: 400 });
    if (item.comInfo) {
      iconeInfo(MARGEM + 115, yLinha + 23, 6.5, CORES.textoRotulo);
    }
    texto(LARGURA - MARGEM, yLinha + 28, item.valor, 14, { cor: CORES.textoCorpo, peso: item.peso, alinhar: 'right' });

    if (i < linhas.length - 1) {
      linha(MARGEM, yLinha + alturaLinha, LARGURA - MARGEM, yLinha + alturaLinha, CORES.linhaDivisoria);
    }
  }

  y += linhas.length * alturaLinha + 16;

  // Fundo branco total
  itens.unshift({
    tipo: 'caixa',
    x: 0,
    y: 0,
    w: LARGURA,
    h: y,
    cor: CORES.fundo
  });

  return { largura: LARGURA, altura: y, itens };
};

/**
 * Pinta o layout do comprovante num canvas HTML5 2D.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {ReturnType<typeof layoutDoComprovanteVenda>} layout
 * @param {{escala?: number}} [opcoes]  fator de escala para Retina / alta densidade (padrão: 2)
 * @returns {HTMLCanvasElement}
 */
export const desenharComprovanteVenda = (canvas, layout, { escala = 2 } = {}) => {
  canvas.width = Math.round(layout.largura * escala);
  canvas.height = Math.round(layout.altura * escala);

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.save();
  ctx.scale(escala, escala);

  for (const item of layout.itens) {
    if (item.tipo === 'caixa') {
      ctx.fillStyle = item.cor;
      ctx.beginPath();
      if (item.raio && ctx.roundRect) {
        ctx.roundRect(item.x, item.y, item.w, item.h, item.raio);
      } else {
        ctx.rect(item.x, item.y, item.w, item.h);
      }
      ctx.fill();

      if (item.borda) {
        ctx.strokeStyle = item.borda;
        ctx.lineWidth = item.bordaLargura ?? 1;
        ctx.stroke();
      }
    } else if (item.tipo === 'linha') {
      ctx.strokeStyle = item.cor;
      ctx.lineWidth = item.largura ?? 1;
      ctx.beginPath();
      ctx.moveTo(item.x1, item.y1);
      ctx.lineTo(item.x2, item.y2);
      ctx.stroke();
    } else if (item.tipo === 'texto') {
      ctx.fillStyle = item.cor;
      ctx.font = `${item.peso} ${item.tamanho}px ${FONTE_FAMILIA}`;
      ctx.textAlign = item.alinhar;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(item.texto, item.x, item.y);
    } else if (item.tipo === 'icone-info') {
      const { x, y, raio, cor } = item;
      ctx.strokeStyle = cor;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(x, y, raio, 0, Math.PI * 2);
      ctx.stroke();

      // Ponto do "i"
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.arc(x, y - raio * 0.38, 1, 0, Math.PI * 2);
      ctx.fill();

      // Haste do "i"
      ctx.beginPath();
      ctx.lineWidth = 1.2;
      ctx.moveTo(x, y - raio * 0.05);
      ctx.lineTo(x, y + raio * 0.48);
      ctx.stroke();
    } else if (item.tipo === 'chevron') {
      const { x, y, largura, altura, cor } = item;
      ctx.strokeStyle = cor;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x - largura / 2, y + altura / 2);
      ctx.lineTo(x, y - altura / 2);
      ctx.lineTo(x + largura / 2, y + altura / 2);
      ctx.stroke();
    }
  }

  ctx.restore();
  return canvas;
};

/**
 * Gera a imagem PNG do comprovante de venda como Data URL (`data:image/png;base64,...`).
 *
 * @param {object} ordem
 * @param {{conta?: string|number, cliente?: object, hoje?: Date}} [opcoes]
 * @returns {string|null} a data URL em PNG
 */
export const gerarComprovanteVendaPng = (ordem, opcoes = {}) => {
  if (!ordem?.venda || ordem.venda.situacao !== 'pronto') return null;

  try {
    const layout = layoutDoComprovanteVenda(ordem, opcoes);
    if (typeof document !== 'undefined' && document.createElement) {
      const canvas = document.createElement('canvas');
      desenharComprovanteVenda(canvas, layout, { escala: 2 });
      if (typeof canvas.toDataURL === 'function') {
        const url = canvas.toDataURL('image/png');
        if (url && url.startsWith('data:image/png;base64,')) return url;
      }
    }
  } catch {
    /* Fallback resiliente */
  }

  return null;
};

import { formatarCotas } from '../secundario/venda.js';
import { formatarFinanceiro, formatarPercentual } from '../util/dinheiro.js';
import { diaEHora, hora } from '../../../../comum/fila/regras.js';

/**
 * Geração determinística do Comprovante de Cotação de Venda (Mercado Secundário).
 *
 * Ao invés de depender de automação frágil de navegador (abrir abas externas no Chrome,
 * esperar renderização do Hub da XP, depender de SnapDOM sobre Shadow DOM complexo que
 * colapsa em 1px de altura ou exige cliques manuais do operador), este módulo gera
 * a imagem oficial da cotação diretamente a partir dos dados auditados do pre-check.
 *
 * Arquitetura (DDD e Clean Code):
 * - `layoutDoComprovanteVenda`: função pura (regras e posições geométricas, testável isoladamente);
 * - `desenharComprovanteVenda`: pintor em canvas 2D nativo com suporte a alta densidade (Retina);
 * - `gerarComprovanteVendaPng`: serializador para data URL de imagem PNG.
 */

const CORES = {
  fundo: '#ffffff',
  fundoSecundario: '#f8fafc',
  borda: '#e2e8f0',
  bordaForte: '#cbd5e1',
  texto: '#0f172a',
  textoSuave: '#475569',
  textoMudo: '#64748b',
  ouro: '#ca8a04',
  ouroFundo: '#fefce8',
  ouroBorda: '#fef08a',
  azulTag: '#1d4ed8',
  azulTagFundo: '#eff6ff',
  verdeDestaque: '#166534',
  verdeFundo: '#f0fdf4',
  verdeBorda: '#bbf7d0',
  linhaDivisoria: '#f1f5f9'
};

const FONTE_FAMILIA = "'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif";
const LARGURA = 620;
const MARGEM = 28;

const NOME_DA_MODALIDADE = {
  xp: 'Estoque XP',
  clientes: 'Estoque clientes'
};

/**
 * @param {object} ordem  ordem com `ordem.venda` pronto
 * @param {{conta?: string|number, cliente?: object, hoje?: Date}} [opcoes]
 * @returns {{largura: number, altura: number, itens: Array<object>}}
 */
export const layoutDoComprovanteVenda = (ordem, { conta, cliente, hoje = new Date() } = {}) => {
  const v = ordem?.venda;
  const c = v?.conta;
  const condicoes = v?.condicoes;
  const itens = [];

  const texto = (x, y, t, tamanho, { peso = 400, cor = CORES.texto, alinhar = 'left' } = {}) =>
    itens.push({ tipo: 'texto', x, y, texto: String(t ?? ''), tamanho, peso, cor, alinhar });

  const caixa = (x, y, w, h, cor, { raio = 0, borda = null, bordaLargura = 1 } = {}) =>
    itens.push({ tipo: 'caixa', x, y, w, h, cor, raio, borda, bordaLargura });

  const linha = (x1, y1, x2, y2, cor = CORES.linhaDivisoria, largura = 1) =>
    itens.push({ tipo: 'linha', x1, y1, x2, y2, cor, largura });

  const larguraUtil = LARGURA - 2 * MARGEM;
  let y = MARGEM;

  // Cabeçalho da XP / Mercado Secundário
  texto(MARGEM, y + 16, 'MERCADO SECUNDÁRIO XP', 12, { peso: 700, cor: CORES.ouro });
  const modalidadeTexto = NOME_DA_MODALIDADE[v?.modalidade] ?? 'Estoque XP';
  
  // Badge da modalidade à direita
  const larguraBadge = modalidadeTexto.length * 8 + 20;
  caixa(LARGURA - MARGEM - larguraBadge, y, larguraBadge, 24, CORES.azulTagFundo, { raio: 6, borda: CORES.borda });
  texto(LARGURA - MARGEM - larguraBadge / 2, y + 16, modalidadeTexto, 12, { peso: 600, cor: CORES.azulTag, alinhar: 'center' });

  y += 34;
  // Título e Ativo
  const nomeAtivo = ordem?.ativo || 'Fundo Cetipado';
  texto(MARGEM, y + 22, `Cotação de Venda · ${nomeAtivo}`, 22, { peso: 700, cor: CORES.texto });

  y += 32;
  // Subtítulo de data, validade e conta
  const lidaEm = v?.lidaEm ? hora(v.lidaEm) : hora(hoje);
  const validaAte = v?.validaAte ? diaEHora(new Date(v.validaAte)) : diaEHora(hoje);
  const contaFormatada = conta ? ` · Conta: ${conta}` : '';
  texto(MARGEM, y + 14, `Cotação das ${lidaEm} · Válido até ${validaAte}${contaFormatada}`, 13, { cor: CORES.textoMudo });

  y += 24;
  linha(MARGEM, y, LARGURA - MARGEM, y, CORES.borda);
  y += 16;

  // Grid de Detalhes da Operação
  const detalhes = [];

  const quantidadeFormatada = formatarCotas(v?.quantidade ?? ordem?.quantidade ?? 0);
  detalhes.push({ rotulo: 'Quantidade de cotas', valor: quantidadeFormatada });

  const puFormatado = v?.valorDaCota
    ? `R$ ${Number(v.valorDaCota).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
    : '—';
  detalhes.push({ rotulo: 'Preço unitário (PU)', valor: puFormatado });

  if (c?.posicao) {
    detalhes.push({ rotulo: 'Valor bruto da posição', valor: formatarFinanceiro(c.posicao) });
  }

  const desagioPct = condicoes?.desagio !== null && condicoes?.desagio !== undefined ? formatarPercentual(condicoes.desagio) : '—';
  const desagioFin = c?.desagio ? ` (- ${formatarFinanceiro(c.desagio)})` : '';
  detalhes.push({ rotulo: 'Deságio da operação', valor: `${desagioPct}${desagioFin}` });

  if (c?.corretagem) {
    detalhes.push({ rotulo: 'Corretagem', valor: `- ${formatarFinanceiro(c.corretagem)}` });
  } else {
    detalhes.push({ rotulo: 'Corretagem', valor: 'Isenta (R$ 0,00)' });
  }

  // Desenhar as linhas de detalhes
  for (let i = 0; i < detalhes.length; i++) {
    const item = detalhes[i];
    const alturaLinha = 28;
    
    // Fundo zebrado sutil
    if (i % 2 === 1) {
      caixa(MARGEM, y - 4, larguraUtil, alturaLinha, CORES.fundoSecundario, { raio: 4 });
    }

    texto(MARGEM + 12, y + 16, item.rotulo, 14, { cor: CORES.textoSuave, peso: 500 });
    texto(LARGURA - MARGEM - 12, y + 16, item.valor, 14, { cor: CORES.texto, peso: 600, alinhar: 'right' });

    y += alturaLinha;
  }

  y += 12;

  // Caixa de Destaque Final: Total da Operação / Valor que o cliente recebe
  const alturaDestaque = 68;
  caixa(MARGEM, y, larguraUtil, alturaDestaque, CORES.verdeFundo, {
    raio: 10,
    borda: CORES.verdeBorda,
    bordaLargura: 1.5
  });

  texto(MARGEM + 16, y + 26, 'VALOR LÍQUIDO A RECEBER', 12, { peso: 700, cor: CORES.verdeDestaque });
  texto(MARGEM + 16, y + 48, 'Creditado na conta do cliente após liquidação', 12, { cor: CORES.textoSuave });

  const totalCliente = c?.total ? formatarFinanceiro(c.total) : (v?.valorDaCota && v?.quantidade ? formatarFinanceiro(v.valorDaCota * v.quantidade) : '—');
  texto(LARGURA - MARGEM - 16, y + 42, totalCliente, 24, { peso: 700, cor: CORES.verdeDestaque, alinhar: 'right' });

  y += alturaDestaque + 20;

  // Rodapé com aviso legal sutil
  texto(
    MARGEM,
    y + 12,
    'Condições garantidas pela XP no momento da cotação. Sujeito à confirmação e liquidação D+2.',
    11,
    { cor: CORES.textoMudo }
  );

  y += 12 + MARGEM;

  // Caixa de contorno geral em volta de tudo (card completo)
  // O primeiro item do array deve ser o fundo do card com a borda externa
  itens.unshift({
    tipo: 'caixa',
    x: 0,
    y: 0,
    w: LARGURA,
    h: y,
    cor: CORES.fundo,
    raio: 12,
    borda: CORES.borda,
    bordaLargura: 1.5
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

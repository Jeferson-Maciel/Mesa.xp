import { fmtP, partesDaTaxa } from './motor.js';

/**
 * "Baixar imagem": as oportunidades do dia num PNG para mandar no WhatsApp, para o cliente que lê
 * melhor uma tabela do que uma lista. O mesmo conteúdo da mensagem — as categorias, os prazos, as
 * taxas e, no secundário, o emissor —, desenhado num canvas.
 *
 * `layoutDaImagem` é puro (o que vai onde, testado em `imagem.test.js`); `desenharImagem` só pinta.
 * A imagem é sempre clara, nos dois temas da Mesa: vai para o celular do cliente. As cores são as
 * das pedras no tema claro (base.css), escritas aqui porque o canvas não lê os tokens.
 */

const COR = {
  fundo: '#f3f4f6',
  cartao: '#ffffff',
  borda: '#d6dbe3',
  texto: '#1b2433',
  fraco: '#4d586b',
  marca: '#74500b',
  secao: { pre: '#1f4fa3', pos: '#075c70', ipca: '#523ca8', isentos: '#74500b' }
};

const FONTE = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const LARGURA = 1080;
const MARGEM = 56;
const LINHA = 66;
const LINHA_COM_EMISSOR = 88;

/**
 * @param {{secoes: Array<{id: string, titulo: string, itens: object[]}>, secundario?: boolean}} resultado
 * @param {{data: string}} opcoes  o dia, como aparece no alto ("21/10/2026")
 * @returns {{largura: number, altura: number, itens: object[]}}
 */
export const layoutDaImagem = (resultado, { data }) => {
  const itens = [];
  const texto = (x, y, t, tamanho, { peso = 400, cor = COR.texto, alinhar = 'left' } = {}) => itens.push({ tipo: 'texto', x, y, texto: t, tamanho, peso, cor, alinhar });
  const caixa = (x, y, w, h, cor, raio = 0) => itens.push({ tipo: 'caixa', x, y, w, h, cor, raio });
  const comEmissor = Boolean(resultado.secundario);
  let y = MARGEM;

  texto(MARGEM, y + 52, 'Oportunidades de Renda Fixa', 52, { peso: 700 });
  y += 70;
  texto(MARGEM, y + 34, `${data}${comEmissor ? ' · mercado secundário' : ''}`, 30, { cor: COR.fraco });
  y += 64;

  for (const secao of resultado.secoes.filter((s) => s.itens.length)) {
    const cor = COR.secao[secao.id] ?? COR.texto;
    const altura = 78 + secao.itens.length * (comEmissor ? LINHA_COM_EMISSOR : LINHA) + 16;
    caixa(MARGEM, y, LARGURA - 2 * MARGEM, altura, COR.cartao, 20);
    caixa(MARGEM, y, 10, altura, cor, 0);
    texto(MARGEM + 40, y + 52, secao.titulo, 36, { peso: 700, cor });
    let yl = y + 78;
    secao.itens.forEach((item, i) => {
      if (i > 0) caixa(MARGEM + 40, yl, LARGURA - 2 * MARGEM - 80, 2, COR.borda);
      const { prefixo, valor, sufixo } = partesDaTaxa(item);
      texto(MARGEM + 40, yl + 44, `${fmtP(item.prazo)} · ${item.tipo}`, 32);
      texto(LARGURA - MARGEM - 40, yl + 44, `${prefixo}${valor}${sufixo}`, 34, { peso: 700, cor, alinhar: 'right' });
      if (comEmissor && item.emissor) texto(MARGEM + 40, yl + 76, item.emissor, 24, { cor: COR.fraco });
      yl += comEmissor ? LINHA_COM_EMISSOR : LINHA;
    });
    y += altura + 24;
  }

  texto(MARGEM, y + 30, 'Taxas brutas ao ano, sujeitas a alteração e à disponibilidade.', 24, { cor: COR.fraco });
  y += 30 + MARGEM;
  return { largura: LARGURA, altura: y, itens };
};

/** Pinta o layout num canvas do tamanho dele. */
export const desenharImagem = (canvas, layout) => {
  canvas.width = layout.largura;
  canvas.height = layout.altura;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, layout.largura, layout.altura);
  for (const item of layout.itens) {
    if (item.tipo === 'caixa') {
      ctx.fillStyle = item.cor;
      ctx.beginPath();
      if (item.raio && ctx.roundRect) ctx.roundRect(item.x, item.y, item.w, item.h, item.raio);
      else ctx.rect(item.x, item.y, item.w, item.h);
      ctx.fill();
    } else {
      ctx.fillStyle = item.cor;
      ctx.font = `${item.peso} ${item.tamanho}px ${FONTE}`;
      ctx.textAlign = item.alinhar;
      ctx.fillText(item.texto, item.x, item.y);
    }
  }
  return canvas;
};

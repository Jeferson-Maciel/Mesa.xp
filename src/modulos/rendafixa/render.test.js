import { describe, expect, it } from 'vitest';
import { LINHAS_SINTETICAS } from './fixtures/sintetica.js';
import { DATA_GOLDEN } from './golden/referencia.js';
import { trechosDaMensagem } from './analise.js';
import { montarTexto, processRows } from './motor.js';
import {
  htmlBloqueados,
  htmlBotaoHub,
  htmlCartoes,
  htmlDetalhesFunil,
  htmlFunil,
  htmlMensagem,
  htmlRegistro,
  htmlSemResultado,
  mensagemEmHTML,
  nomeDaPuxada,
  quando
} from './render.js';

const hoje = new Date(DATA_GOLDEN);
const primario = processRows(LINHAS_SINTETICAS, false, hoje);
const secundario = processRows(LINHAS_SINTETICAS, true, hoje);
const XSS = '<img src=x onerror=alert(1)>';

describe('prévia da mensagem', () => {
  it('mostra o negrito do WhatsApp sem mexer no resto do texto', () => {
    expect(mensagemEmHTML('*Taxas pré fixadas:*\n-> 1 ano - CDB 14,20% a.a.')).toBe(
      '<strong>Taxas pré fixadas:</strong>\n-&gt; 1 ano - CDB 14,20% a.a.'
    );
  });

  it('escapa antes de aplicar o negrito', () => {
    expect(mensagemEmHTML(`*${XSS}*`)).toBe('<strong>&lt;img src=x onerror=alert(1)&gt;</strong>');
  });

  it('é o mesmo texto que o Copiar leva, só com o negrito à vista', () => {
    const texto = montarTexto(primario);
    const html = htmlMensagem(texto);
    const semMarcacao = html.match(/<div class="rf-bolha-texto">([\s\S]*?)<\/div>/)[1]
      .replace(/<\/?strong>/g, '*')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
    expect(semMarcacao).toBe(texto.trimEnd());
  });
});

describe('cartões', () => {
  it('lista cada prazo com o tipo, o ativo e a taxa nas partes do motor', () => {
    const html = htmlCartoes(primario, null);
    expect(html).toContain('Pré-fixadas');
    expect(html).toContain('CDB BANCO ALFA S.A. - SET/2027');
    expect(html).toMatch(/14,20<\/span><span class="rf-taxa-suf">% a.a./);
  });

  it('só mostra o emissor no secundário', () => {
    expect(htmlCartoes(secundario, null)).toContain('<span class="rf-emissor">DIGIMAIS</span>');
    expect(htmlCartoes(primario, null)).not.toContain('rf-emissor');
  });

  it('escapa nome de ativo e emissor vindos da planilha', () => {
    const r = {
      secundario: true,
      secoes: [{ id: 'pre', titulo: 'Pré-fixadas', itens: [{ prazo: 1, tipo: 'CDB', taxa: 14, indexador: 'PRE', emissor: XSS, ativo: XSS }] }]
    };
    const html = htmlCartoes(r, null);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('mostra a variação contra a referência, com a taxa anterior no title', () => {
    const referencia = { created_at: '2026-09-22T18:00:00.000Z', itens: [{ s: 'pre', p: 1, t: 14.05, x: 'PRE', u: '' }] };
    const html = htmlCartoes(primario, referencia);
    expect(html).toContain('rf-delta rf-sobe');
    expect(html).toContain('▲ 0,15');
    expect(html).toContain('title="Em 22/09: 14,05% a.a."');
  });
});

describe('a repaginação de 21/10/2026', () => {
  const texto = montarTexto(primario);
  const trechos = trechosDaMensagem(texto, primario.secoes);

  it('um destaque por categoria com a maior taxa, que leva à seção', () => {
    const html = htmlCartoes(primario, null, { trechos });
    const ids = primario.secoes.filter((s) => s.itens.length).map((s) => s.id);
    for (const id of ids) expect(html).toContain(`class="rf-destaque" data-sec="${id}" data-acao="ir-para"`);
    expect(html).toMatch(/class="rf-num" data-contar="[\d.]+">[\d,]+<\/span>/);
  });

  it('cada seção copia só o trecho dela, e sem trechos não oferece o botão', () => {
    expect(htmlCartoes(primario, null, { trechos })).toContain('data-acao="copiar-secao" data-sec="pre"');
    expect(htmlCartoes(primario, null)).not.toContain('copiar-secao');
  });

  it('a linha de maior taxa é marcada, e o gráfico tem um ponto por linha, com o mesmo índice', () => {
    const html = htmlCartoes(primario, null, { trechos });
    expect(html).toContain('rf-linha rf-melhor');
    expect(html).toMatch(/<circle [^>]*data-i="0"/);
    expect(html).toMatch(/<li class="rf-linha[^"]*" data-i="0"/);
  });

  it('o isento mostra a taxa equivalente num título com IR, com a alíquota pelos dias', () => {
    const r = {
      secundario: false,
      secoes: [
        { id: 'pre', titulo: 'Pré-fixadas', itens: [{ prazo: 1, tipo: 'CDB', taxa: 12, indexador: 'PRE', ativo: 'CDB X', dias: 400 }] },
        { id: 'isentos', titulo: 'Isentos de IR', itens: [{ prazo: 1, tipo: 'LCA', taxa: 10.5, indexador: 'PRE', sub: 'PRE', ativo: 'LCA Y', dias: 400 }] }
      ]
    };
    const html = htmlCartoes(r, null);
    expect(html).toContain('≈ 12,73% a.a. num título com IR <small>(IR de 17,5%)</small>');
    expect(html).toContain('rende mais que o CDB de 1 ano (12% a.a.)');
  });

  it('a mensagem no celular: o mesmo texto, os números dela e os botões de cada categoria', () => {
    const html = htmlMensagem(texto, { trechos });
    expect(html).toContain('class="rf-celular"');
    expect(html).toContain(`<dd>${texto.trimEnd().split('\n').length}</dd>`);
    expect(html).toContain('class="rf-chip" data-acao="copiar-secao" data-sec="pre"');
  });

  it('o funil conta até os números, que já vêm escritos no HTML', () => {
    expect(htmlFunil(primario)).toContain(`data-contar="${primario.totais.lidos}" data-inteiro>${primario.totais.lidos}<`);
  });
});

describe('funil e bloqueados', () => {
  it('conta as quatro etapas do funil', () => {
    const html = htmlFunil(primario);
    for (const rotulo of ['Linhas lidas', 'Na emissão primária', 'Passaram nos filtros', 'Na mensagem']) {
      expect(html).toContain(rotulo);
    }
    expect(html).toContain(`>${primario.totais.lidos}<`);
  });

  it('explica cada linha que ficou de fora, com os motivos do motor', () => {
    const html = htmlDetalhesFunil(primario, []);
    expect(html).toContain('Público restrito');
    expect(html).toContain('Superadas por taxa maior');
    expect(html).toContain('Colunas usadas');
    expect(html).toContain('Tax.Mín');
  });

  it('lista os bloqueados escapando o nome do ativo', () => {
    const html = htmlBloqueados({ bloqueados: [{ ativo: XSS, motivo: 'Investidor qualificado' }] });
    expect(html).not.toContain('<img');
    expect(html).toContain('1 ativo bloqueado');
  });

  it('não mostra nada sem bloqueados', () => {
    expect(htmlBloqueados({ bloqueados: [] })).toBe('');
  });

  it('sem oportunidade, oferece o outro mercado', () => {
    expect(htmlSemResultado({ secundario: false, totais: { lidos: 10 } })).toContain('Ver mercado secundário');
  });
});

describe('histórico', () => {
  const agora = new Date('2026-09-23T15:00:00-03:00');

  it('diz Hoje, Ontem ou a data', () => {
    expect(quando('2026-09-23T10:05:00-03:00', agora)).toContain('Hoje');
    expect(quando('2026-09-22T10:05:00-03:00', agora)).toContain('Ontem');
    expect(quando('lixo', agora)).toBe('—');
  });

  it('escapa o nome do arquivo e a mensagem gravados', () => {
    const html = htmlRegistro({ id: 1, resultado: `*${XSS}*`, arquivo: XSS, created_at: '2026-09-23T10:05:00-03:00' }, agora);
    expect(html).not.toContain('<img');
  });

  it('lê registro antigo, sem modo nem arquivo', () => {
    const html = htmlRegistro({ id: 1, resultado: '*Oportunidades de RENDA FIXA hoje!* ⭐ (MERCADO SECUNDÁRIO)', created_at: '2026-09-20T10:00:00-03:00' }, agora);
    expect(html).toContain('Secundário');
    expect(html).not.toContain('rf-hist-arquivo');
  });
});

describe('botão Puxar do Hub', () => {
  it('formata o nome sugerido para o arquivo com dia e hora', () => {
    // 22/10 às 16:47
    const data = new Date(2026, 9, 22, 16, 47);
    expect(nomeDaPuxada(data.getTime())).toBe('Hub · 22/10 16:47');
  });

  it('sem robô: oferece Instalar robô', () => {
    const html = htmlBotaoHub({ estado: 'sem-robo' });
    expect(html).toContain('Instalar robô');
    expect(html).toContain('data-estado="sem-robo"');
    expect(html).not.toContain('disabled');
  });

  it('robô desatualizado: oferece Atualizar robô com a versão escapada', () => {
    const html = htmlBotaoHub({ estado: 'desatualizado', versao: '1.13.4' });
    expect(html).toContain('Atualizar robô');
    expect(html).toContain('v1.13.4');
    expect(html).toContain('data-estado="desatualizado"');
  });

  it('escapa versão maliciosa no botão desatualizado', () => {
    const html = htmlBotaoHub({ estado: 'desatualizado', versao: XSS });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('puxando: fica desabilitado e com indicador de carga', () => {
    const html = htmlBotaoHub({ estado: 'puxando' });
    expect(html).toContain('Puxando do Hub…');
    expect(html).toContain('data-estado="puxando"');
    expect(html).toContain('disabled');
    expect(html).toContain('rf-puxar-hub-spinner');
  });

  it('pronto: oferece Puxar do Hub com atalho P', () => {
    const html = htmlBotaoHub({ estado: 'pronto' });
    expect(html).toContain('Puxar do Hub');
    expect(html).toContain('data-estado="pronto"');
    expect(html).toContain('btn-primario');
    expect(html).toContain('(P)');
    expect(html).not.toContain('disabled');
  });
});


import { describe, expect, it } from 'vitest';
import { LINHAS_SINTETICAS } from './fixtures/sintetica.js';
import { DATA_GOLDEN } from './golden/referencia.js';
import { montarTexto, processRows } from './motor.js';
import {
  htmlBloqueados,
  htmlCartoes,
  htmlDetalhesFunil,
  htmlFunil,
  htmlMensagem,
  htmlRegistro,
  htmlSemResultado,
  mensagemEmHTML,
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
    const semMarcacao = html.match(/<div class="rf-bolha">([\s\S]*?)<\/div>/)[1]
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

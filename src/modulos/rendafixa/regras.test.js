import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LINHAS_SINTETICAS } from './fixtures/sintetica.js';
import { DATA_GOLDEN } from './golden/referencia.js';
import { montarMensagem, montarTexto, motivosDoDescarte, processRows } from './motor.js';
import {
  comValor,
  completarRegras,
  diferencasDoPadrao,
  lerConfiguracao,
  regrasDoOriginal,
  regrasPadrao,
  textoDaConfiguracao,
  validarRegras
} from './regras.js';

// As regras do Renda Fixa configuráveis na tela (decidido com o usuário em 21/10/2026), uma por mercado.

const hoje = new Date(DATA_GOLDEN);
const golden = (modo) => readFileSync(fileURLToPath(new URL(`./golden/sintetica.${modo}.txt`, import.meta.url)), 'utf8');

// Uma planilha mínima: cada regra com o seu caso. O vencimento de 22/09/2028 dá 2 anos em 23/09/2026.
const CABECALHO = ['Ativo', 'Indexador', 'Vencimento', 'Tax.Mín', 'Tax.Máx', 'ROA E. Aprox.', 'Data de Emissão', 'Público', 'Carência', 'Isento', 'PU'];
const em = (iso) => new Date(`${iso}T03:00:00.000Z`);
const linha = ({ ativo, indexador = 'PRÉ', venc = em('2028-09-22'), min = '', max = '', roa = '1,10%', publico = 'Investidor Geral', carencia = 30, isento = 'N', pu = 1000 }) => [
  ativo, indexador, venc, min, max, roa, ' ', publico, carencia, isento, pu
];
const planilha = (...linhas) => [CABECALHO, ...linhas.map(linha)];
const analisar = (rows, regras, secundario = false) => processRows(rows, secundario, hoje, regras);
const ativos = (resultado) => resultado.secoes.flatMap((s) => s.itens.map((e) => e.ativo));
const com = (regras, ...pares) => pares.reduce((r, [caminho, valor]) => comValor(r, caminho, valor), regras);
const P = () => regrasPadrao('primario');

describe('o padrão das regras', () => {
  it('é válido nos dois mercados; o secundário só muda o emissor e o cabeçalho', () => {
    expect(validarRegras(P())).toEqual({});
    expect(validarRegras(regrasPadrao('secundario'))).toEqual({});
    expect(diferencasDoPadrao(regrasPadrao('secundario'), 'primario').map((d) => d.caminho)).toEqual(['mensagem.cabecalho', 'mensagem.mostrarEmissor']);
  });

  it('a mensagem do padrão é a do original, caractere por caractere (a planilha sintética)', () => {
    expect(montarTexto(processRows(LINHAS_SINTETICAS, false, hoje, P()), P())).toBe(golden('primario'));
    const sec = regrasPadrao('secundario');
    expect(montarTexto(processRows(LINHAS_SINTETICAS, true, hoje, sec), sec)).toBe(golden('secundario'));
  });

  it('a taxa só nas colunas de taxa: a Tax.Máx vale quando a Tax.Mín vem vazia; o ROA, não (o original o lia)', () => {
    const rows = planilha({ ativo: 'CDB SO MAXIMA - SET/2028', max: '14,70%' }, { ativo: 'CDB SO ROA - SET/2028', venc: em('2027-09-22') });
    const padrao = analisar(rows, P());
    expect(ativos(padrao)).toEqual(['CDB SO MAXIMA - SET/2028']);
    expect(padrao.descartes.taxa).toBe(1);
    const original = analisar(rows, regrasDoOriginal('primario'));
    expect(ativos(original)).toEqual(['CDB SO ROA - SET/2028', 'CDB SO MAXIMA - SET/2028']);
  });
});

describe('os filtros', () => {
  it('o PU máximo: acima dele, bloqueado; o motivo diz o valor das regras', () => {
    const rows = planilha({ ativo: 'CDB CARO - SET/2028', min: '14%', pu: 1200 });
    expect(ativos(analisar(rows, P()))).toEqual(['CDB CARO - SET/2028']);
    const regras = com(P(), ['filtros.puMaximo', 1000]);
    const r = analisar(rows, regras);
    expect(r.bloqueados).toEqual([{ ativo: 'CDB CARO - SET/2028', motivo: 'PU R$ 1.200,00' }]);
    expect(motivosDoDescarte(regras).pu).toBe('PU acima de R$ 1.000');
  });

  it('o público restrito e a liquidez diária, cada um com a sua chave', () => {
    const rows = planilha(
      { ativo: 'CDB QUALI - SET/2028', min: '15%', publico: 'Investidor Qualificado' },
      { ativo: 'CDB PROF - SET/2027', min: '15%', venc: em('2027-09-22'), publico: 'Investidor Profissional' },
      { ativo: 'CDB DIARIO - SET/2029', min: '15%', venc: em('2029-09-24'), carencia: 'Diária' }
    );
    expect(ativos(analisar(rows, P()))).toEqual([]);
    const soliberal = com(P(), ['filtros.descartarQualificado', false], ['filtros.descartarLiquidezDiaria', false]);
    expect(ativos(analisar(rows, soliberal)).sort()).toEqual(['CDB DIARIO - SET/2029', 'CDB QUALI - SET/2028']);
  });
});

describe('os prazos e os isentos', () => {
  const rows = planilha(
    { ativo: 'CDB UM - SET/2027', min: '14%', venc: em('2027-09-22') },
    { ativo: 'CDB DOIS - SET/2028', min: '14%' },
    { ativo: 'LCA PRE - SET/2028', min: '12%', isento: 'S' }
  );

  it('os prazos exibidos de cada seção', () => {
    expect(ativos(analisar(rows, com(P(), ['prazos.pre', [1]])))).toEqual(['CDB UM - SET/2027', 'LCA PRE - SET/2028']);
  });

  it('os prazos dos isentos, e o que é isento', () => {
    expect(analisar(rows, com(P(), ['isentos.pre', [1]])).descartes.isento).toBe(1);
    // Sem a LCA nos tipos isentos (e sem a coluna Isento marcada), ela disputa com os pré-fixados.
    const semLca = analisar(planilha({ ativo: 'LCA PRE - SET/2028', min: '15%' }), com(P(), ['isentos.tipos', ['LCI']]));
    expect(semLca.secoes.find((s) => s.id === 'pre').itens.map((e) => e.ativo)).toEqual(['LCA PRE - SET/2028']);
  });
});

describe('a mensagem', () => {
  const rows = planilha({ ativo: 'CDB PINE - SET/2028', min: '14,70%' }, { ativo: 'LCA BANCO X - SET/2027', min: '12%', venc: em('2027-09-22'), isento: 'S' });

  it('o emissor, o modelo da linha, as casas e o prazo', () => {
    const regras = com(
      P(),
      ['mensagem.mostrarEmissor', true],
      ['mensagem.linhas.pre', '• {tipo} em {prazo}: {taxa}%{emissor}'],
      ['mensagem.casas', 1],
      ['mensagem.prazoVarios', '{n}a']
    );
    expect(montarTexto(analisar(rows, regras), regras)).toContain('• CDB em 2a: 14,7% (PINE)');
    const comZeros = com(P(), ['mensagem.tirarZeros', false]);
    expect(montarTexto(analisar(planilha({ ativo: 'CDB R - SET/2028', min: '15%' }), comZeros), comZeros)).toContain('-> 2 anos - CDB 15,00% a.a.');
  });

  it('a ordem das seções, o rodapé e o cabeçalho vazio', () => {
    const regras = com(P(), ['mensagem.ordem', ['isentos', 'pre', 'pos', 'ipca']], ['mensagem.rodape', 'Fale com seu assessor.']);
    const texto = montarTexto(analisar(rows, regras), regras);
    expect(texto.indexOf('*LCAs/LCIs ISENTA DE IR*')).toBeLessThan(texto.indexOf('*Taxas pré fixadas:*'));
    expect(texto.endsWith('a.a.\n\nFale com seu assessor.')).toBe(true);
    const semCabecalho = com(P(), ['mensagem.cabecalho', '']);
    expect(montarTexto(analisar(rows, semCabecalho), semCabecalho).startsWith('*Taxas pré fixadas:*')).toBe(true);
  });

  it('por partes: o cabeçalho, um bloco por seção e o rodapé (o "copiar uma seção")', () => {
    const regras = com(P(), ['mensagem.rodape', 'Assinado.']);
    const partes = montarMensagem(analisar(rows, regras), regras);
    expect(Object.keys(partes.blocos)).toEqual(['pre', 'isentos']);
    expect(partes.blocos.pre).toBe('*Taxas pré fixadas:*\n-> 2 anos - CDB 14,70% a.a.');
    expect(partes.rodape).toBe('Assinado.');
  });
});

describe('o avançado: os nomes das colunas e o tipo pelo nome', () => {
  it('a coluna de taxa com outro nome, pelos nomes das regras', () => {
    const rows = [['Ativo', 'Yield', 'Vencimento', 'Data de Emissão'], ['CDB NOVO - SET/2028', '14,9%', em('2028-09-22'), ' ']];
    expect(ativos(analisar(rows, P()))).toEqual([]);
    const regras = com(P(), ['avancado.colunas.taxa', ['tax.min', 'tax.max', 'taxa', 'yield']]);
    expect(analisar(rows, regras).secoes[0].itens[0]).toMatchObject({ ativo: 'CDB NOVO - SET/2028', taxa: 14.9 });
  });

  it('um tipo novo pelo nome por extenso', () => {
    const rows = planilha({ ativo: 'TITULO ESPECIAL DO BANCO - SET/2028', min: '14%' });
    expect(ativos(analisar(rows, P()))).toEqual([]);
    const regras = com(P(), ['avancado.tiposPorNome', [...P().avancado.tiposPorNome, ['titulo especial', 'CDB']]]);
    expect(analisar(rows, regras).secoes[0].itens[0]).toMatchObject({ tipo: 'CDB' });
  });
});

describe('a validação: nada é trocado em silêncio', () => {
  it('diz o que está errado, regra a regra', () => {
    const erradas = com(
      P(),
      ['filtros.puMaximo', 0],
      ['prazos.pre', [0, 2]],
      ['mensagem.linhas.pre', '-> {prazo} - {tipo}'],
      ['mensagem.linhas.ipca', '{prazo} {taxa} {preco}'],
      ['mensagem.prazoVarios', 'anos'],
      ['mensagem.ordem', ['pre', 'pos']],
      ['avancado.colunas.taxa', []]
    );
    expect(Object.keys(validarRegras(erradas)).sort()).toEqual(
      ['avancado.colunas.taxa', 'filtros.puMaximo', 'mensagem.linhas.ipca', 'mensagem.linhas.pre', 'mensagem.ordem', 'mensagem.prazoVarios', 'prazos.pre'].sort()
    );
    expect(validarRegras(erradas)['mensagem.linhas.ipca']).toContain('{preco}');
  });

  it('as regras salvas por cima do padrão; as inválidas voltam ao padrão, com o aviso', () => {
    const { regras, corrompidas } = completarRegras({ filtros: { puMaximo: 1500 } }, 'primario');
    expect(corrompidas).toBe(false);
    expect(regras.filtros).toMatchObject({ puMaximo: 1500, descartarQualificado: true });
    expect(regras.mensagem).toEqual(P().mensagem);
    expect(completarRegras({ filtros: { puMaximo: -1 } }, 'primario')).toEqual({ regras: P(), corrompidas: true });
  });
});

describe('copiar e colar a configuração (para um colega, sem login)', () => {
  it('vai e volta, os dois mercados', () => {
    const config = { primario: com(P(), ['filtros.puMaximo', 1500]), secundario: com(regrasPadrao('secundario'), ['mensagem.rodape', 'Até logo.']) };
    const lida = lerConfiguracao(textoDaConfiguracao(config));
    expect(lida.primario.filtros.puMaximo).toBe(1500);
    expect(lida.secundario.mensagem.rodape).toBe('Até logo.');
    expect(diferencasDoPadrao(lida.primario, 'primario')).toEqual([{ caminho: 'filtros.puMaximo', rotulo: 'PU máximo (R$)', de: '1.300', para: '1.500' }]);
  });

  it('um texto que não é configuração, cortado ou com regra inválida: o motivo', () => {
    expect(() => lerConfiguracao('bom dia')).toThrow('não é uma configuração');
    expect(() => lerConfiguracao('MESA XP · Renda Fixa · regras v1\n{"primario":')).toThrow('cortada');
    const ruim = textoDaConfiguracao({ primario: com(P(), ['filtros.puMaximo', 0]), secundario: regrasPadrao('secundario') });
    expect(() => lerConfiguracao(ruim)).toThrow('PU máximo');
  });
});

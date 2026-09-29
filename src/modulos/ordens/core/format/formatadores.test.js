import { describe, expect, it } from 'vitest';
import {
  formatarAuditoria,
  formatarAuditoriaHtml,
  formatarEmail,
  formatarLoteSimples,
  formatarLoteTwap
} from './formatadores.js';

const ordem = (extra = {}) => ({
  ativo: 'PETR4',
  operacao: 'C',
  quantidade: 100,
  financeiro: null,
  preco: null,
  ...extra
});

const solicitacao = (extra = {}) => ({
  conta: '7000001',
  ordens: [ordem()],
  horario: null,
  ...extra
});

describe('formatarEmail — ordem', () => {
  it('monta o e-mail completo de uma ordem', () => {
    expect(formatarEmail(solicitacao())).toBe(
      [
        'Prezado(a) Cliente,',
        '',
        'Conforme conversado, gostaria de realizar a ordem abaixo na conta XP 7000001:',
        '',
        'Ativo: PETR4;',
        'Quantidade: 100;',
        'Preço: A mercado',
        'Operação: Compra',
        '',
        'Observações importantes: Toda solicitação lançada no sistema antes do leilão de encerramento sofrerá tentativa de processamento no mesmo dia. Toda solicitação lançada após o leilão de encerramento sofrerá tentativa de processamento no próximo dia útil.',
        '',
        'Aguardo confirmação para realizar a ordem.',
        '',
        'Att,'
      ].join('\n')
    );
  });

  it('pluraliza com dois ou mais ativos', () => {
    const texto = formatarEmail(solicitacao({ ordens: [ordem(), ordem({ ativo: 'VALE3' })] }));
    expect(texto).toContain('realizar as ordens abaixo na conta XP');
    expect(texto).toContain('Aguardo confirmação para realizar as ordens.');
  });

  it('separa os blocos de ativo por uma linha em branco, sem linha em branco entre os campos', () => {
    const texto = formatarEmail(solicitacao({ ordens: [ordem(), ordem({ ativo: 'VALE3', quantidade: 50 })] }));
    expect(texto).toContain('Operação: Compra\n\nAtivo: VALE3;');
    expect(texto).toContain('Ativo: PETR4;\nQuantidade: 100;');
  });

  it('usa Valor no lugar de Quantidade na ordem por financeiro', () => {
    const texto = formatarEmail(solicitacao({ ordens: [ordem({ quantidade: null, financeiro: 50000 })] }));
    expect(texto).toContain('Valor: R$ 50.000,00;');
    expect(texto).not.toContain('Quantidade:');
  });

  it('escreve a operação por extenso, nunca C ou V', () => {
    expect(formatarEmail(solicitacao())).toContain('Operação: Compra');
    expect(formatarEmail(solicitacao({ ordens: [ordem({ operacao: 'V' })] }))).toContain('Operação: Venda');
  });

  it('preserva o preço informado exatamente', () => {
    expect(formatarEmail(solicitacao({ ordens: [ordem({ preco: '39,47' })] }))).toContain('Preço: 39,47');
  });

  it('põe A mercado quando o preço não foi informado', () => {
    expect(formatarEmail(solicitacao())).toContain('Preço: A mercado');
  });
});

describe('formatarAuditoria — texto', () => {
  // O exemplo que o operador trouxe, reproduzido caractere a caractere: o e-mail da ordem com a
  // tabela do Lote Simples no lugar dos blocos de ativo.
  it('monta o e-mail do exemplo do operador', () => {
    const s = solicitacao({ conta: '1234567', ordens: [ordem({ ativo: 'IVVB11', quantidade: 7 })] });
    expect(formatarAuditoria(s)).toBe(
      [
        'Prezado(a) Cliente,',
        '',
        'Conforme conversado, gostaria de realizar a ordem abaixo na conta XP 1234567:',
        '',
        'Estratégia\tCliente\tAtivo\tC/V\tPreço\tQtd. Total',
        'Simples\t1234567\tIVVB11\tC\tA mercado\t7',
        '',
        '',
        'Observações importantes: Toda solicitação lançada no sistema antes do leilão de encerramento sofrerá tentativa de processamento no mesmo dia. Toda solicitação lançada após o leilão de encerramento sofrerá tentativa de processamento no próximo dia útil.',
        '',
        'Aguardo confirmação para realizar a ordem.',
        '',
        'Att,'
      ].join('\n')
    );
  });

  it('na cesta por quantidade, a tabela é exatamente o Lote Simples', () => {
    const s = solicitacao({ ordens: [ordem(), ordem({ ativo: 'VALE3', operacao: 'V', preco: '61,20' })] });
    expect(formatarAuditoria(s)).toContain(formatarLoteSimples(s));
  });

  it('pluraliza com dois ou mais ativos', () => {
    const texto = formatarAuditoria(solicitacao({ ordens: [ordem(), ordem({ ativo: 'VALE3' })] }));
    expect(texto).toContain('gostaria de realizar as ordens abaixo na conta XP 7000001:');
    expect(texto).toContain('Aguardo confirmação para realizar as ordens.');
  });

  it('não repete os blocos em texto do e-mail de ordem', () => {
    const texto = formatarAuditoria(solicitacao());
    expect(texto).not.toContain('Ativo: PETR4;');
    expect(texto).not.toContain('Operação:');
  });
});

describe('formatarAuditoriaHtml', () => {
  const celulas = (html) => [...html.matchAll(/<td(?:\s[^>]*)?>(.*?)<\/td>/g)].map((m) => m[1]);
  const linhas = (html) => [...html.matchAll(/<tr>(.*?)<\/tr>/g)].map((m) => celulas(m[1]));

  it('abre e fecha como o e-mail em texto', () => {
    const html = formatarAuditoriaHtml(solicitacao());
    expect(html).toContain('Prezado(a) Cliente,');
    expect(html).toContain('Conforme conversado, gostaria de realizar a ordem abaixo na conta XP 7000001:');
    expect(html).toContain('Aguardo confirmação para realizar a ordem.');
    expect(html).toContain('Att,');
  });

  it('põe o Lote Simples numa tabela: cabeçalho e uma linha por ativo, na ordem digitada', () => {
    const s = solicitacao({ ordens: [ordem({ ativo: 'VALE3', quantidade: 4900 }), ordem({ preco: '39,47' })] });
    expect(linhas(formatarAuditoriaHtml(s))).toEqual([
      ['Estratégia', 'Cliente', 'Ativo', 'C/V', 'Preço', 'Qtd. Total'],
      ['Simples', '7000001', 'VALE3', 'C', 'A mercado', '4900'],
      ['Simples', '7000001', 'PETR4', 'C', '39,47', '100']
    ]);
  });

  it('desenha a grade: borda em todas as células', () => {
    const html = formatarAuditoriaHtml(solicitacao());
    const tags = [...html.matchAll(/<td[^>]*>/g)].map((m) => m[0]);
    expect(tags).toHaveLength(12);
    for (const tag of tags) expect(tag).toMatch(/border:1px solid/);
  });

  // O operador cola no Outlook na web, que dá ao conteúdo sem fonte a fonte da própria mensagem.
  // Declarar fonte, cor de fundo ou negrito foi o que fez a primeira versão destoar do e-mail.
  it('não declara fonte, fundo nem negrito', () => {
    const html = formatarAuditoriaHtml(solicitacao());
    expect(html).not.toMatch(/font|background|bold|<th|<b>|<strong/i);
  });

  it('escapa o que veio digitado', () => {
    const html = formatarAuditoriaHtml(solicitacao({ ordens: [ordem({ preco: '<39,47>' })] }));
    expect(html).toContain('&lt;39,47&gt;');
    expect(html).not.toContain('<39,47>');
  });
});

// Decidido com o operador em 28/09: a coluna acompanha a cesta. Só quantidade, a tabela é o Lote
// Simples de sempre; só R$, `Financeiro` no lugar de `Qtd. Total`; mista, as duas colunas.
describe('e-mail em tabela — financeiro', () => {
  const emReais = (ativo, financeiro) => ordem({ ativo, quantidade: null, financeiro });
  const celulas = (html) => [...html.matchAll(/<td(?:\s[^>]*)?>(.*?)<\/td>/g)].map((m) => m[1]);
  const linhas = (html) => [...html.matchAll(/<tr>(.*?)<\/tr>/g)].map((m) => celulas(m[1]));

  it('monta o e-mail do pedido real de 28/09, cesta toda em reais', () => {
    const s = solicitacao({
      conta: '7000002',
      ordens: [
        emReais('BTLG11', 3000),
        emReais('XPML11', 3000),
        emReais('KNSC11', 5000),
        emReais('KNCR11', 5000),
        emReais('MCRE11', 1000),
        emReais('AFHI11', 1000)
      ]
    });

    expect(formatarAuditoria(s)).toBe(
      [
        'Prezado(a) Cliente,',
        '',
        'Conforme conversado, gostaria de realizar as ordens abaixo na conta XP 7000002:',
        '',
        'Estratégia\tCliente\tAtivo\tC/V\tPreço\tFinanceiro',
        'Simples\t7000002\tBTLG11\tC\tA mercado\tR$ 3.000,00',
        'Simples\t7000002\tXPML11\tC\tA mercado\tR$ 3.000,00',
        'Simples\t7000002\tKNSC11\tC\tA mercado\tR$ 5.000,00',
        'Simples\t7000002\tKNCR11\tC\tA mercado\tR$ 5.000,00',
        'Simples\t7000002\tMCRE11\tC\tA mercado\tR$ 1.000,00',
        'Simples\t7000002\tAFHI11\tC\tA mercado\tR$ 1.000,00',
        '',
        '',
        'Observações importantes: Toda solicitação lançada no sistema antes do leilão de encerramento sofrerá tentativa de processamento no mesmo dia. Toda solicitação lançada após o leilão de encerramento sofrerá tentativa de processamento no próximo dia útil.',
        '',
        'Aguardo confirmação para realizar as ordens.',
        '',
        'Att,'
      ].join('\n')
    );
  });

  it('cesta toda em reais: Financeiro no lugar de Qtd. Total, também na grade', () => {
    const s = solicitacao({ ordens: [emReais('BTLG11', 3000)] });
    expect(linhas(formatarAuditoriaHtml(s))).toEqual([
      ['Estratégia', 'Cliente', 'Ativo', 'C/V', 'Preço', 'Financeiro'],
      ['Simples', '7000001', 'BTLG11', 'C', 'A mercado', 'R$ 3.000,00']
    ]);
  });

  // Mudou no mesmo dia: a cesta mista tinha uma tabela só, com as duas colunas e uma delas vazia
  // em cada linha. O operador pediu uma tabela para cada tipo — financeiro primeiro, duas linhas
  // em branco entre elas, sem título.
  describe('cesta mista: uma tabela para cada tipo', () => {
    const mista = () =>
      solicitacao({
        conta: '1234567',
        ordens: [ordem({ quantidade: 100 }), emReais('BTLG11', 3000), ordem({ ativo: 'VALE3', quantidade: 50 }), emReais('XPML11', 5000)]
      });

    it('monta o e-mail com a tabela de financeiro primeiro e a de quantidade depois', () => {
      expect(formatarAuditoria(mista())).toBe(
        [
          'Prezado(a) Cliente,',
          '',
          'Conforme conversado, gostaria de realizar as ordens abaixo na conta XP 1234567:',
          '',
          'Estratégia\tCliente\tAtivo\tC/V\tPreço\tFinanceiro',
          'Simples\t1234567\tBTLG11\tC\tA mercado\tR$ 3.000,00',
          'Simples\t1234567\tXPML11\tC\tA mercado\tR$ 5.000,00',
          '',
          '',
          'Estratégia\tCliente\tAtivo\tC/V\tPreço\tQtd. Total',
          'Simples\t1234567\tPETR4\tC\tA mercado\t100',
          'Simples\t1234567\tVALE3\tC\tA mercado\t50',
          '',
          '',
          'Observações importantes: Toda solicitação lançada no sistema antes do leilão de encerramento sofrerá tentativa de processamento no mesmo dia. Toda solicitação lançada após o leilão de encerramento sofrerá tentativa de processamento no próximo dia útil.',
          '',
          'Aguardo confirmação para realizar as ordens.',
          '',
          'Att,'
        ].join('\n')
      );
    });

    it('desenha duas grades, cada uma sem coluna vazia', () => {
      const html = formatarAuditoriaHtml(mista());
      const tabelas = [...html.matchAll(/<table[^>]*>(.*?)<\/table>/g)].map((m) => linhas(m[1]));
      expect(tabelas).toEqual([
        [
          ['Estratégia', 'Cliente', 'Ativo', 'C/V', 'Preço', 'Financeiro'],
          ['Simples', '1234567', 'BTLG11', 'C', 'A mercado', 'R$ 3.000,00'],
          ['Simples', '1234567', 'XPML11', 'C', 'A mercado', 'R$ 5.000,00']
        ],
        [
          ['Estratégia', 'Cliente', 'Ativo', 'C/V', 'Preço', 'Qtd. Total'],
          ['Simples', '1234567', 'PETR4', 'C', 'A mercado', '100'],
          ['Simples', '1234567', 'VALE3', 'C', 'A mercado', '50']
        ]
      ]);
    });

    it('separa as grades com duas linhas em branco', () => {
      expect(formatarAuditoriaHtml(mista())).toContain('</table><br><br><table');
    });
  });

  it('nunca escreve quantidade e financeiro na mesma linha', () => {
    const s = solicitacao({ ordens: [ordem({ quantidade: 100 }), emReais('BTLG11', 3000)] });
    for (const linha of linhas(formatarAuditoriaHtml(s)).slice(1)) {
      expect(linha.slice(5).filter(Boolean)).toHaveLength(1);
    }
  });

  it('preserva o preço informado na ordem por valor', () => {
    const s = solicitacao({ ordens: [ordem({ ativo: 'BTLG11', quantidade: null, financeiro: 3000, preco: '95,50' })] });
    expect(formatarAuditoria(s)).toContain('Simples\t7000001\tBTLG11\tC\t95,50\tR$ 3.000,00');
  });

  it('a grade continua sem fonte, fundo nem negrito', () => {
    const html = formatarAuditoriaHtml(solicitacao({ ordens: [emReais('BTLG11', 3000)] }));
    expect(html).not.toMatch(/font|background|bold|<th|<b>|<strong/i);
  });

  it('o Lote Simples da planilha não ganha coluna nenhuma', () => {
    const s = solicitacao({ ordens: [ordem({ quantidade: 100 })] });
    expect(formatarLoteSimples(s).split('\n')[0]).toBe('Estratégia\tCliente\tAtivo\tC/V\tPreço\tQtd. Total');
  });
});

describe('formatarLoteSimples', () => {
  it('escreve o cabeçalho exato com TAB real', () => {
    const [cabecalho] = formatarLoteSimples(solicitacao()).split('\n');
    expect(cabecalho).toBe('Estratégia\tCliente\tAtivo\tC/V\tPreço\tQtd. Total');
    expect(cabecalho.split('\t')).toHaveLength(6);
  });

  it('escreve a linha da ordem', () => {
    const [, linha] = formatarLoteSimples(solicitacao()).split('\n');
    expect(linha).toBe('Simples\t7000001\tPETR4\tC\tA mercado\t100');
  });

  it('usa C e V na coluna C/V, nunca Compra e Venda', () => {
    const tsv = formatarLoteSimples(solicitacao({ ordens: [ordem({ operacao: 'V' })] }));
    expect(tsv.split('\n')[1].split('\t')[3]).toBe('V');
    expect(tsv).not.toContain('Venda');
  });

  it('põe o cliente como código, nunca nome', () => {
    expect(formatarLoteSimples(solicitacao()).split('\n')[1].split('\t')[1]).toBe('7000001');
  });

  it('escreve a quantidade sem separador de milhar', () => {
    const tsv = formatarLoteSimples(solicitacao({ ordens: [ordem({ quantidade: 4900 })] }));
    expect(tsv.split('\n')[1].split('\t')[5]).toBe('4900');
  });

  it('gera uma linha por ativo, na ordem digitada', () => {
    const tsv = formatarLoteSimples(
      solicitacao({ ordens: [ordem({ ativo: 'VALE3' }), ordem({ ativo: 'PETR4' })] })
    );
    const ativos = tsv.trim().split('\n').slice(1).map((l) => l.split('\t')[2]);
    expect(ativos).toEqual(['VALE3', 'PETR4']);
  });
});

describe('formatarLoteTwap', () => {
  const colunas = (s) => formatarLoteTwap(s).split('\n')[1].split('\t');

  it('escreve o cabeçalho exato com dez colunas', () => {
    const [cabecalho] = formatarLoteTwap(solicitacao()).split('\n');
    expect(cabecalho).toBe(
      'Estratégia\tCliente\tAtivo\tC/V\tQtd. Total\tFinanceiro\tPreço\tPreço Would\tHora Inicial\tHora Final'
    );
    expect(cabecalho.split('\t')).toHaveLength(10);
  });

  it('ordem por quantidade: preenche Qtd. Total e deixa Financeiro vazio', () => {
    const c = colunas(solicitacao());
    expect(c[4]).toBe('100');
    expect(c[5]).toBe('');
    expect(c[6]).toBe('A mercado');
  });

  it('ordem por financeiro: preenche Financeiro e deixa Qtd. Total vazio', () => {
    const c = colunas(solicitacao({ ordens: [ordem({ quantidade: null, financeiro: 50000 })] }));
    expect(c[4]).toBe('');
    expect(c[5]).toBe('R$ 50.000,00');
    expect(c[6]).toBe('A mercado');
  });

  it('ordem por financeiro com preço informado mantém o preço', () => {
    const c = colunas(solicitacao({ ordens: [ordem({ quantidade: null, financeiro: 50000, preco: '39,47' })] }));
    expect(c[6]).toBe('39,47');
  });

  it('deixa Preço Would sempre vazio', () => {
    expect(colunas(solicitacao())[7]).toBe('');
  });

  it('deixa as horas vazias quando não informadas', () => {
    const c = colunas(solicitacao());
    expect(c[8]).toBe('');
    expect(c[9]).toBe('');
  });

  it('preenche as horas quando informadas', () => {
    const c = colunas(solicitacao({ horario: { inicial: '10:00', final: '15:00' } }));
    expect(c[8]).toBe('10:00');
    expect(c[9]).toBe('15:00');
  });

  it('gera uma linha por ativo da cesta, cada um com seu valor', () => {
    const tsv = formatarLoteTwap(
      solicitacao({
        ordens: [
          ordem({ ativo: 'PETR4', quantidade: null, financeiro: 10000 }),
          ordem({ ativo: 'VALE3', quantidade: null, financeiro: 25000 })
        ]
      })
    );
    const linhas = tsv.trim().split('\n').slice(1);
    expect(linhas).toHaveLength(2);
    expect(linhas[0].split('\t')[5]).toBe('R$ 10.000,00');
    expect(linhas[1].split('\t')[5]).toBe('R$ 25.000,00');
  });
});

describe('TSV cola corretamente em planilha', () => {
  it('termina em quebra de linha e nunca usa espaço no lugar de TAB', () => {
    for (const tsv of [formatarLoteSimples(solicitacao()), formatarLoteTwap(solicitacao())]) {
      expect(tsv.endsWith('\n')).toBe(true);
      for (const linha of tsv.trim().split('\n')) {
        expect(linha).not.toMatch(/ {2,}/);
      }
    }
  });

  it('toda linha tem o mesmo número de colunas do cabeçalho', () => {
    for (const tsv of [formatarLoteSimples(solicitacao()), formatarLoteTwap(solicitacao())]) {
      // Sem trim: ele comeria os TABs finais das colunas de hora vazias, que a planilha espera.
      const linhas = tsv.split('\n').filter((l) => l !== '');
      const esperado = linhas[0].split('\t').length;
      for (const linha of linhas) expect(linha.split('\t')).toHaveLength(esperado);
    }
  });
});

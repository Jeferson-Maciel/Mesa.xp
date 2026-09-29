import { describe, expect, it } from 'vitest';
import { lerPreco, lerValor } from './valores.js';

describe('lerValor — financeiro', () => {
  it('lê R$ como financeiro, nunca como quantidade', () => {
    expect(lerValor('R$ 11.000,00')).toMatchObject({ quantidade: null, financeiro: 11000 });
    expect(lerValor('R$ 50.000,00')).toMatchObject({ quantidade: null, financeiro: 50000 });
  });

  it('lê R$ sem centavos', () => {
    expect(lerValor('R$ 34.800')).toMatchObject({ quantidade: null, financeiro: 34800 });
  });

  it('ignora a observação colada no valor', () => {
    expect(lerValor('R$ 34.800(não ultrapassar esse valor)')).toMatchObject({
      quantidade: null,
      financeiro: 34800
    });
  });

  it('lê o sufixo k como financeiro', () => {
    expect(lerValor('20k')).toMatchObject({ quantidade: null, financeiro: 20000 });
    expect(lerValor('comprar 1,5k')).toMatchObject({ quantidade: null, financeiro: 1500 });
  });

  it('lê o sufixo M como financeiro', () => {
    expect(lerValor('1M')).toMatchObject({ quantidade: null, financeiro: 1000000 });
  });
});

describe('lerValor — quantidade', () => {
  it('lê número solto como quantidade', () => {
    expect(lerValor('100')).toMatchObject({ quantidade: 100, financeiro: null });
    expect(lerValor('- 7')).toMatchObject({ quantidade: 7, financeiro: null });
  });

  it.each(['7 qntds', '7 qtd', '7 qtds', '7 quantidade', '7 quantidades', '7 ações', '7 cotas', 'qtd total 7'])(
    'lê %j como quantidade',
    (texto) => expect(lerValor(texto)).toMatchObject({ quantidade: 7, financeiro: null })
  );

  it('lê quantidade com separador de milhar', () => {
    expect(lerValor('4.900 ações')).toMatchObject({ quantidade: 4900, financeiro: null });
  });

  it('nunca devolve quantidade fracionada', () => {
    expect(lerValor('7,5').quantidade).toBe(7);
  });
});

describe('lerValor — ausência e ambiguidade', () => {
  it('devolve os dois nulos quando não há número', () => {
    expect(lerValor('(Total)')).toMatchObject({ quantidade: null, financeiro: null });
    expect(lerValor('')).toMatchObject({ quantidade: null, financeiro: null });
  });

  it('nunca devolve quantidade e financeiro juntos', () => {
    const r = lerValor('R$ 10.000,00 em 100 ações');
    expect(r.quantidade === null || r.financeiro === null).toBe(true);
  });

  it('o R$ vence o número solto na mesma linha', () => {
    expect(lerValor('- R$ 50.000,00 -')).toMatchObject({ quantidade: null, financeiro: 50000 });
  });
});

describe('lerValor — trecho consumido', () => {
  it('diz que pedaço do texto virou o valor', () => {
    expect(lerValor('- R$ 50.000,00').trecho).toBe('R$ 50.000,00');
    expect(lerValor('100 ações').trecho).toBe('100');
    expect(lerValor('20k').trecho).toBe('20k');
  });

  it('devolve trecho vazio quando não há valor', () => {
    expect(lerValor('(Total)').trecho).toBe('');
  });

  it('o trecho é o que permite achar o que sobrou na linha', () => {
    const { trecho } = lerValor(' 100 a 39,50');
    expect(' 100 a 39,50'.replace(trecho, '')).toBe('  a 39,50');
  });
});

describe('lerPreco — as formas de escrever um preço', () => {
  it('devolve null quando não há preço, para o chamador aplicar A mercado', () => {
    expect(lerPreco('C - PETR4 - 100').preco).toBeNull();
  });

  it.each(['a mercado', 'à mercado', 'A MERCADO'])('reconhece %j', (t) =>
    expect(lerPreco(`PETR4 100 ${t}`).preco).toBe('A mercado')
  );

  it.each([
    ['PETR4 100 preço 39,50', '39,50'],
    ['PETR4 100 preço: 39,50', '39,50'],
    ['PETR4 100 a 39,50', '39,50'],
    ['PETR4 100 @ 39,50', '39,50'],
    ['PETR4 100 @39,50', '39,50'],
    ['PETR4 100 limite 39,50', '39,50'],
    ['PETR4 100 por 39,50', '39,50'],
    ['PETR4 100 a R$ 39,50', '39,50'],
    ['PETR4 100 preco 1.234,56', '1.234,56']
  ])('lê o preço em %j', (texto, esperado) => {
    expect(lerPreco(texto).preco).toBe(esperado);
  });

  it('preserva o preço exatamente como digitado, sem arredondar', () => {
    expect(lerPreco('PETR4 100 preço: 39,4').preco).toBe('39,4');
    expect(lerPreco('PETR4 100 preco 1.234,567').preco).toBe('1.234,567');
  });

  it('o "a" solto só vira preço com centavos — "a 100" é ambíguo demais', () => {
    expect(lerPreco('PETR4 a 100').preco).toBeNull();
  });

  it('não confunde o valor financeiro da ordem com preço', () => {
    expect(lerPreco('C - M2ST34 - R$ 50.000,00').preco).toBeNull();
  });

  it('diz que pedaço do texto virou o preço', () => {
    expect(lerPreco('PETR4 100 a 39,50').trecho).toBe('a 39,50');
    expect(lerPreco('PETR4 100 a mercado').trecho).toBe('a mercado');
    expect(lerPreco('PETR4 100').trecho).toBe('');
  });
});

// O pedido real de 28/09 que trouxe isto: `BTLG11 - 3.000,00` saía como 3.000 cotas, porque só o
// `R$` fazia um número virar financeiro. Três mil reais lidos como três mil cotas é uma ordem
// dezenas de vezes maior que a pedida, e saía sem alerta nenhum.
describe('lerValor — financeiro escrito sem R$', () => {
  it.each([
    ['3.000,00', 3000],
    ['- 3.000,00 ', 3000],
    ['3000,00', 3000],
    ['39,50', 39.5]
  ])('lê %j, com centavos, como financeiro — quantidade não tem centavos', (texto, valor) => {
    expect(lerValor(texto)).toMatchObject({ quantidade: null, financeiro: valor });
  });

  it('com centavos e outro número na linha, não escolhe: o outro vira quantidade e o de centavos sobra', () => {
    expect(lerValor(' 100 39,50')).toMatchObject({ quantidade: 100, financeiro: null, trecho: '100' });
  });

  it.each([
    ['3.000 reais', 3000],
    ['3000 reais', 3000],
    ['3.000,00 reais', 3000]
  ])('lê %j como financeiro', (texto, valor) => {
    expect(lerValor(texto)).toMatchObject({ quantidade: null, financeiro: valor });
  });

  it.each([
    ['valor 3.000', 3000],
    ['valor: 3.000', 3000],
    ['valor de 3.000', 3000],
    ['financeiro 3.000', 3000]
  ])('lê %j como financeiro', (texto, valor) => {
    expect(lerValor(texto)).toMatchObject({ quantidade: null, financeiro: valor });
  });

  it('só vale "valor" colado ao número: numa observação ele não transforma a quantidade', () => {
    expect(lerValor('100 (não ultrapassar esse valor)')).toMatchObject({ quantidade: 100, financeiro: null });
  });
});

describe('lerValor — mil, milhão e k', () => {
  // `3 mil` saía como 3 cotas e `R$ 3 mil` como R$ 3,00: o número era lido e a escala, jogada fora.
  it.each([
    ['3 mil', 3000],
    ['1,5 mil', 1500],
    ['3 mil reais', 3000],
    ['R$ 3 mil', 3000],
    ['R$ 3k', 3000],
    ['R$ 1,5 milhão', 1500000],
    ['2 milhões', 2000000]
  ])('lê %j como financeiro', (texto, valor) => {
    expect(lerValor(texto)).toMatchObject({ quantidade: null, financeiro: valor });
  });

  it.each([
    ['1 mil cotas', 1000],
    ['2 mil ações', 2000],
    ['1,5 mil cotas', 1500],
    ['3k cotas', 3000]
  ])('lê %j como quantidade, porque a unidade diz cotas', (texto, valor) => {
    expect(lerValor(texto)).toMatchObject({ quantidade: valor, financeiro: null });
  });

  it('não lê "mil" dentro de outra palavra', () => {
    expect(lerValor('100 militares')).toMatchObject({ quantidade: 100, financeiro: null });
  });
});

describe('lerValor — número solto', () => {
  it('número sem unidade e sem centavos continua quantidade', () => {
    expect(lerValor('3.000')).toMatchObject({ quantidade: 3000, financeiro: null });
  });

  // A marca é o que permite pegar `BTLG11 3.000,00` / `XPML11 3.000`: a segunda linha é
  // quantidade só porque ninguém escreveu os centavos, e a cesta mista precisa saber disso.
  it('marca a quantidade que veio de um número solto, sem unidade', () => {
    expect(lerValor('3.000').quantidadeSolta).toBe(true);
    expect(lerValor('- 7').quantidadeSolta).toBe(true);
  });

  it.each(['7 cotas', '7 ações', '7 qtd', 'qtd total 7', '1 mil cotas'])(
    'não marca %j, que diz a unidade',
    (texto) => expect(lerValor(texto).quantidadeSolta).toBe(false)
  );

  it('não marca financeiro', () => {
    expect(lerValor('R$ 3.000').quantidadeSolta).toBe(false);
    expect(lerValor('3.000,00').quantidadeSolta).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { validar } from './validar.js';

// Se a saída sai sem confirmação do operador.
const podeGerar = (solicitacao, formato) => validar(solicitacao, formato).every((d) => d.nivel !== 'bloqueio');
import { analisarTicker } from './ticker.js';
import { parseSolicitacoes } from '../parse/parseSolicitacoes.js';

const ordem = (extra = {}) => ({
  ativo: 'PETR4',
  ticker: analisarTicker('PETR4'),
  operacao: 'C',
  quantidade: 100,
  financeiro: null,
  preco: null,
  ...extra
});

const solicitacao = (extra = {}) => ({
  conta: '7000001',
  ordens: [ordem()],
  descartadas: [],
  horario: null,
  ...extra
});

const codigos = (s, formato = 'email') => validar(s, formato).map((d) => d.codigo);
const bloqueios = (s, formato = 'email') =>
  validar(s, formato).filter((d) => d.nivel === 'bloqueio').map((d) => d.codigo);

describe('solicitação completa', () => {
  it('não acusa nada', () => {
    expect(validar(solicitacao(), 'email')).toEqual([]);
  });

  it('libera a geração', () => {
    expect(podeGerar(solicitacao(), 'email')).toBe(true);
  });
});

describe('bloqueios', () => {
  it('bloqueia sem conta', () => {
    expect(bloqueios(solicitacao({ conta: null }))).toContain('conta-ausente');
  });

  it('bloqueia sem operação', () => {
    expect(bloqueios(solicitacao({ ordens: [ordem({ operacao: null })] }))).toContain('operacao-ausente');
  });

  it('bloqueia sem ordem nenhuma', () => {
    expect(bloqueios(solicitacao({ ordens: [] }))).toContain('sem-ordens');
  });

  it('bloqueia o ativo repetido em vez de somar', () => {
    const s = solicitacao({ ordens: [ordem({ quantidade: 100 }), ordem({ quantidade: 50 })] });
    expect(bloqueios(s)).toContain('ativo-duplicado');
    expect(s.ordens).toHaveLength(2);
    expect(s.ordens.map((o) => o.quantidade)).toEqual([100, 50]);
  });

  it('bloqueia o ticker parecido com outro, sem corrigir', () => {
    const s = solicitacao({ ordens: [ordem({ ativo: 'KCNR11', ticker: analisarTicker('KCNR11') })] });
    expect(bloqueios(s)).toContain('ticker-suspeito');
    expect(s.ordens[0].ativo).toBe('KCNR11');
  });

  it('cita a sugestão na mensagem, como confirmação a pedir', () => {
    const s = solicitacao({ ordens: [ordem({ ativo: 'KCNR11', ticker: analisarTicker('KCNR11') })] });
    const d = validar(s, 'email').find((x) => x.codigo === 'ticker-suspeito');
    expect(d.mensagem).toContain('KNCR11');
  });

  it('bloqueia financeiro no Lote Simples, que não tem essa coluna', () => {
    const s = solicitacao({ ordens: [ordem({ quantidade: null, financeiro: 50000 })] });
    expect(bloqueios(s, 'lote')).toContain('financeiro-em-lote-simples');
  });

  // Mudou em 28/09: o operador pediu a tabela do e-mail com financeiro. Ela ganha a coluna
  // `Financeiro` quando a cesta tem ordem por valor; o Lote Simples da planilha continua sem.
  it('aceita financeiro no e-mail em tabela', () => {
    const s = solicitacao({ ordens: [ordem({ quantidade: null, financeiro: 50000 })] });
    expect(bloqueios(s, 'auditoria')).toEqual([]);
    expect(podeGerar(s, 'auditoria')).toBe(true);
  });

  // Não cabe no formato não é coisa que se confirme: não há número para a coluna Qtd. Total, e
  // confirmar escrevia `null` nela. A saída é outro formato, que já está a um clique.
  it('financeiro no Lote Simples não é confirmável', () => {
    const s = solicitacao({ ordens: [ordem({ quantidade: null, financeiro: 50000 })] });
    const lote = validar(s, 'lote').find((x) => x.codigo === 'financeiro-em-lote-simples');
    expect(lote.confirmavel).toBe(false);
  });

  it('mas aceita o mesmo financeiro no TWAP', () => {
    const s = solicitacao({ ordens: [ordem({ quantidade: null, financeiro: 50000 })] });
    expect(bloqueios(s, 'twap')).not.toContain('financeiro-em-lote-simples');
    expect(podeGerar(s, 'twap')).toBe(true);
  });

  it('todo bloqueio é confirmável, para nunca virar beco sem saída', () => {
    const s = solicitacao({
      ordens: [ordem({ operacao: null }), ordem({ ativo: 'KCNR11', ticker: analisarTicker('KCNR11') })]
    });
    const confirmaveis = validar(s, 'email')
      .filter((x) => x.nivel === 'bloqueio')
      .map((d) => d.confirmavel);

    expect(confirmaveis.length).toBeGreaterThan(0);
    expect(confirmaveis.every(Boolean)).toBe(true);
  });

  it('a conta ausente não é confirmável: sem conta não existe ordem', () => {
    const d = validar(solicitacao({ conta: null }), 'email').find((x) => x.codigo === 'conta-ausente');
    expect(d.confirmavel).toBe(false);
  });

  it('impede a geração enquanto houver bloqueio', () => {
    expect(podeGerar(solicitacao({ conta: null }), 'email')).toBe(false);
  });
});

describe('avisos', () => {
  it('avisa sobre ticker fora da lista da B3 sem bloquear', () => {
    const s = solicitacao({ ordens: [ordem({ ativo: 'ZZZZ99', ticker: analisarTicker('ZZZZ99') })] });
    expect(codigos(s)).toContain('ticker-desconhecido');
    expect(bloqueios(s)).not.toContain('ticker-desconhecido');
    expect(podeGerar(s, 'email')).toBe(true);
  });

  it('não avisa sobre recibo de subscrição', () => {
    const s = solicitacao({ ordens: [ordem({ ativo: 'RECR12', ticker: analisarTicker('RECR12') })] });
    expect(codigos(s)).toEqual([]);
  });

  it('avisa sobre as linhas descartadas, para nada sumir calado', () => {
    const s = solicitacao({ descartadas: [{ linha: 'V - HGCR11 (Total)', motivo: 'sem quantidade' }] });
    expect(codigos(s)).toContain('linhas-descartadas');
    expect(podeGerar(s, 'email')).toBe(true);
  });

  it('avisa quando o TWAP vai sem horário', () => {
    expect(codigos(solicitacao(), 'twap')).toContain('twap-sem-horario');
  });

  it('não inventa horário de TWAP', () => {
    const s = solicitacao();
    validar(s, 'twap');
    expect(s.horario).toBeNull();
  });
});

describe('diagnóstico aponta a ordem culpada', () => {
  it('diz qual linha tem o problema', () => {
    const s = solicitacao({ ordens: [ordem(), ordem({ ativo: 'KCNR11', ticker: analisarTicker('KCNR11') })] });
    const d = validar(s, 'email').find((x) => x.codigo === 'ticker-suspeito');
    expect(d.indiceOrdem).toBe(1);
  });
});

describe('fundos cetipados', () => {
  it('nome exato não acusa nada no e-mail', async () => {
    const { procurarFundo } = await import('./fundo.js');
    const s = solicitacao({
      ordens: [
        ordem({
          ativo: 'Riza Malls Feeder FII RL',
          ticker: null,
          fundo: procurarFundo('Riza Malls Feeder FII RL'),
          quantidade: null,
          financeiro: 50000
        })
      ]
    });
    expect(validar(s, 'email')).toEqual([]);
  });

  it('bloqueia nome ambíguo e NÃO deixa confirmar — confirmar não decide qual fundo é', async () => {
    const { procurarFundo } = await import('./fundo.js');
    const s = solicitacao({
      ordens: [ordem({ ativo: 'Habitat', ticker: null, fundo: procurarFundo('Habitat') })]
    });
    const d = validar(s, 'email').find((x) => x.codigo === 'fundo-ambiguo');
    expect(d.nivel).toBe('bloqueio');
    expect(d.confirmavel).toBe(false);
    expect(d.mensagem).toContain('XP Habitat');
  });

  it('bloqueia nome que só bate em parte', async () => {
    const { procurarFundo } = await import('./fundo.js');
    const s = solicitacao({
      ordens: [
        ordem({ ativo: 'Riza terrax prefixado', ticker: null, fundo: procurarFundo('Riza terrax prefixado') })
      ]
    });
    expect(validar(s, 'email').map((x) => x.codigo)).toContain('fundo-parcial');
  });

  it('bloqueia fundo cetipado nos formatos de lote — não há código para a coluna Ativo', async () => {
    const { procurarFundo } = await import('./fundo.js');
    const s = solicitacao({
      ordens: [
        ordem({
          ativo: 'Riza Malls Feeder FII RL',
          ticker: null,
          fundo: procurarFundo('Riza Malls Feeder FII RL')
        })
      ]
    });
    for (const formato of ['lote', 'twap']) {
      expect(validar(s, formato).map((x) => x.codigo)).toContain('fundo-fora-do-lote');
    }
    expect(validar(s, 'email').map((x) => x.codigo)).not.toContain('fundo-fora-do-lote');
  });

  it('bloqueia fundo cetipado na tabela da auditoria, e deixa o e-mail de ordem livre', async () => {
    const { procurarFundo } = await import('./fundo.js');
    const s = solicitacao({
      ordens: [
        ordem({
          ativo: 'Riza Malls Feeder FII RL',
          ticker: null,
          fundo: procurarFundo('Riza Malls Feeder FII RL')
        })
      ]
    });
    expect(validar(s, 'auditoria').map((x) => x.codigo)).toContain('fundo-na-auditoria');
    expect(validar(s, 'email').map((x) => x.codigo)).not.toContain('fundo-na-auditoria');
  });

  it('fundo fora de formato não é confirmável: confirmar poria o nome numa coluna de código', async () => {
    const { procurarFundo } = await import('./fundo.js');
    const s = solicitacao({
      ordens: [
        ordem({
          ativo: 'Riza Malls Feeder FII RL',
          ticker: null,
          fundo: procurarFundo('Riza Malls Feeder FII RL')
        })
      ]
    });
    const codigos = { lote: 'fundo-fora-do-lote', twap: 'fundo-fora-do-lote', auditoria: 'fundo-na-auditoria' };
    for (const [formato, codigo] of Object.entries(codigos)) {
      expect(validar(s, formato).find((x) => x.codigo === codigo).confirmavel).toBe(false);
    }
  });

  // O ticker de um fundo da prateleira vai para a boleta do secundário; se a mesa comprar em bolsa,
  // o código cabe na coluna Ativo, e confirmar é a saída.
  it('fundo escrito pelo ticker no lote ou na tabela: confirmável, o código cabe na coluna', async () => {
    const { fundoPeloTicker } = await import('./fundo.js');
    const s = solicitacao({ ordens: [ordem({ ativo: 'VGPR11', ticker: null, fundo: fundoPeloTicker('VGPR11') })] });
    const codigos = { lote: 'fundo-fora-do-lote', twap: 'fundo-fora-do-lote', auditoria: 'fundo-na-auditoria' };
    for (const [formato, codigo] of Object.entries(codigos)) {
      const d = validar(s, formato).find((x) => x.codigo === codigo);
      expect(d.confirmavel, formato).toBe(true);
      expect(d.mensagem, formato).toMatch(/em bolsa/);
    }
  });

  // A aplicação mínima é em reais: o Hub rotula a coluna "Qtd. mínima", mas no XP Private Equity II
  // ela é 25.000 com PU de R$ 1.072 — em cotas seriam R$ 26 milhões.
  const fundoRizaMalls = async (extra) => {
    const { procurarFundo } = await import('./fundo.js');
    return solicitacao({
      ordens: [
        ordem({
          ativo: 'Riza Malls Feeder FII RL',
          ticker: null,
          fundo: procurarFundo('Riza Malls Feeder FII RL'),
          ...extra
        })
      ]
    });
  };

  it('avisa quando o valor fica abaixo da aplicação mínima, sem bloquear', async () => {
    const s = await fundoRizaMalls({ quantidade: null, financeiro: 500 });
    const d = validar(s, 'email').find((x) => x.codigo === 'abaixo-do-minimo');
    expect(d.nivel).toBe('aviso');
    expect(d.mensagem).toContain('R$ 1.000,00');
  });

  it('não avisa quando o valor atinge a aplicação mínima', async () => {
    const s = await fundoRizaMalls({ quantidade: null, financeiro: 1000 });
    expect(codigos(s)).not.toContain('abaixo-do-minimo');
  });

  it('não compara cotas com a aplicação mínima, que é em reais', async () => {
    const s = await fundoRizaMalls({ quantidade: 10 });
    expect(codigos(s)).not.toContain('abaixo-do-minimo');
  });

  it('não reclama de ticker ausente num fundo', async () => {
    const { procurarFundo } = await import('./fundo.js');
    const s = solicitacao({
      ordens: [
        ordem({ ativo: 'Riza Malls Feeder FII RL', ticker: null, fundo: procurarFundo('Riza Malls') })
      ]
    });
    const codigos = validar(s, 'email').map((x) => x.codigo);
    expect(codigos).not.toContain('ticker-suspeito');
    expect(codigos).not.toContain('ticker-desconhecido');
  });
});

describe('número não explicado na linha', () => {
  it('bloqueia, em vez de deixar a ordem sair com dado descartado', () => {
    const s = solicitacao({ ordens: [ordem({ numerosSobrando: ['39,50'] })] });
    const d = validar(s, 'email').find((x) => x.codigo === 'numero-nao-explicado');
    expect(d.nivel).toBe('bloqueio');
    expect(d.mensagem).toContain('39,50');
  });

  it('é confirmável: só o operador sabe se aquele número era ruído', () => {
    const s = solicitacao({ ordens: [ordem({ numerosSobrando: ['200'] })] });
    expect(validar(s, 'email').find((x) => x.codigo === 'numero-nao-explicado').confirmavel).toBe(true);
  });

  it('não acusa nada quando a linha foi explicada por inteiro', () => {
    expect(validar(solicitacao({ ordens: [ordem({ numerosSobrando: [] })] }), 'email')).toEqual([]);
  });
});

// `BTLG11 3.000,00` / `XPML11 3.000`: a segunda linha vira 3.000 cotas só porque ninguém escreveu
// os centavos. Cesta mista de verdade existe, então o bloqueio se confirma — mas também oferece o
// conserto de um clique, porque o caso comum é o assessor ter esquecido os centavos.
describe('cesta que mistura R$ e quantidade', () => {
  const emReais = (ativo) => ordem({ ativo, quantidade: null, financeiro: 3000 });
  const solta = (ativo, quantidade) => ordem({ ativo, quantidade, quantidadeSolta: true });

  it('bloqueia quando uma quantidade de número solto convive com financeiro', () => {
    const s = solicitacao({ ordens: [emReais('BTLG11'), solta('XPML11', 3000)] });
    expect(bloqueios(s)).toContain('cesta-mista');
  });

  it('é confirmável e oferece passar tudo para R$', () => {
    const s = solicitacao({ ordens: [emReais('BTLG11'), solta('XPML11', 3000)] });
    const d = validar(s, 'email').find((x) => x.codigo === 'cesta-mista');
    expect(d.confirmavel).toBe(true);
    expect(d.acao).toEqual({ campo: 'tudo-em-reais', rotulo: 'Tudo em R$' });
  });

  it('diz qual linha foi lida como quantidade', () => {
    const s = solicitacao({ ordens: [emReais('BTLG11'), solta('XPML11', 3000), solta('KNCR11', 5000)] });
    const d = validar(s, 'email').find((x) => x.codigo === 'cesta-mista');
    expect(d.mensagem).toContain('XPML11 (3000)');
    expect(d.mensagem).toContain('KNCR11 (5000)');
    expect(d.mensagem).not.toContain('BTLG11');
  });

  it('vale para todos os formatos', () => {
    const s = solicitacao({ ordens: [emReais('BTLG11'), solta('XPML11', 3000)] });
    for (const formato of ['email', 'auditoria', 'twap']) expect(bloqueios(s, formato)).toContain('cesta-mista');
  });

  it('não bloqueia quando a quantidade veio com unidade: "100 cotas" é mistura de propósito', () => {
    const s = solicitacao({ ordens: [emReais('BTLG11'), ordem({ ativo: 'XPML11', quantidadeSolta: false })] });
    expect(bloqueios(s)).not.toContain('cesta-mista');
  });

  it('não bloqueia cesta só de quantidade, nem só de financeiro', () => {
    expect(bloqueios(solicitacao({ ordens: [solta('XPML11', 100), solta('BTLG11', 200)] }))).not.toContain('cesta-mista');
    expect(bloqueios(solicitacao({ ordens: [emReais('XPML11'), emReais('BTLG11')] }))).not.toContain('cesta-mista');
  });
});

// A linha acrescentada à mão pelo botão + nasce vazia. Sem estes bloqueios, o e-mail saía com
// `Ativo: ;` e `Quantidade: null;`. Nenhum é confirmável: não há o que atestar num campo vazio.
describe('linha preenchida à mão', () => {
  const vazia = () => ordem({ ativo: '', ticker: null, fundo: null, operacao: null, quantidade: null });

  it('bloqueia o ativo vazio, sem deixar confirmar', () => {
    const d = validar(solicitacao({ ordens: [ordem(), vazia()] }), 'email').find((x) => x.codigo === 'ativo-vazio');
    expect(d).toMatchObject({ nivel: 'bloqueio', confirmavel: false, indiceOrdem: 1 });
    expect(d.mensagem).toContain('linha 2');
  });

  it('bloqueia a ordem sem quantidade nem financeiro, sem deixar confirmar', () => {
    const s = solicitacao({ ordens: [ordem({ quantidade: null })] });
    const d = validar(s, 'email').find((x) => x.codigo === 'valor-ausente');
    expect(d).toMatchObject({ nivel: 'bloqueio', confirmavel: false });
  });

  it('não acusa duas linhas vazias como ativo repetido', () => {
    expect(codigos(solicitacao({ ordens: [vazia(), vazia()] }))).not.toContain('ativo-duplicado');
  });

  it('bloqueia, com confirmação, o nome que não é ticker nem fundo da prateleira', async () => {
    const { procurarFundo } = await import('./fundo.js');
    const s = solicitacao({ ordens: [ordem({ ativo: 'PETR', ticker: null, fundo: procurarFundo('PETR') })] });
    const d = validar(s, 'email').find((x) => x.codigo === 'ativo-nao-reconhecido');
    expect(d).toMatchObject({ nivel: 'bloqueio', confirmavel: true });
  });
});

describe('secundário', () => {
  const RIZA_TERRAX = 'Riza Terrax Vintage FIAgro RL';
  const hoje = new Date(2026, 9, 5, 14, 35);
  const estoque = {
    arquivo: 'mercado-secundario-05-10-2026.xlsx',
    exportadaEm: new Date(2026, 9, 5, 14, 32).toISOString(),
    fundos: [{ nome: RIZA_TERRAX, ticker: null, pu: 98.93, casasDoPu: 2, desagio: 2.25, estoque: 100, aplicacaoMinima: 1000 }]
  };
  const tetos = { 'riza terrax vintage fiagro rl': { teto: 0.5, desagio: 2.25, em: '2026-10-05' } };

  // A tela calcula `ordem.secundario` antes de validar; aqui se faz o mesmo.
  const comFundo = async (extra = {}, contexto = {}) => {
    const { procurarFundo } = await import('./fundo.js');
    const { secundarioDaOrdem } = await import('../secundario/secundario.js');
    const o = ordem({ ativo: RIZA_TERRAX, ticker: null, fundo: procurarFundo(RIZA_TERRAX), quantidade: null, financeiro: 16000, ...extra });
    o.secundario = secundarioDaOrdem(o, { estoque, tetos, hoje, ...contexto });
    return solicitacao({ ordens: [o] });
  };

  const bloqueio = (s, codigo) => validar(s, 'email').find((d) => d.codigo === codigo);

  it('sem planilha, segura o pedido em R$ — e confirmar manda o valor em R$', async () => {
    const d = bloqueio(await comFundo({}, { estoque: null }), 'secundario-sem-planilha');
    expect(d).toMatchObject({ nivel: 'bloqueio', confirmavel: true });
    expect(d.mensagem).toContain('R$ 16.000,00');
  });

  it('sem planilha, uma ordem por quantidade passa', async () => {
    const s = await comFundo({ quantidade: 100, financeiro: null }, { estoque: null });
    expect(bloqueios(s)).toEqual([]);
  });

  it('fundo fora da planilha segura, com confirmação', async () => {
    const s = await comFundo({}, { estoque: { ...estoque, fundos: [] } });
    expect(bloqueio(s, 'secundario-fora-da-planilha')).toMatchObject({ confirmavel: true });
  });

  it('sem teto, segura sem confirmação e oferece o ROA zerado, que não precisa dele', async () => {
    const d = bloqueio(await comFundo({}, { tetos: {} }), 'secundario-sem-teto');
    expect(d).toMatchObject({ confirmavel: false, acao: { campo: 'roa-zerado', rotulo: 'Usar ROA zerado' } });
    expect(d.mensagem).toMatch(/favorito do Hub/);
    expect(bloqueios(await comFundo({ financeiro: 5000 }, { tetos: {}, semRoa: true }))).toEqual([]);
    expect(bloqueios(await comFundo({ financeiro: 5000 }))).toEqual([]);
  });

  it('valor que não compra uma cota segura, sem confirmação', async () => {
    expect(bloqueio(await comFundo({ financeiro: 50 }), 'secundario-sem-cota')).toMatchObject({ confirmavel: false });
  });

  it('mais cotas que o estoque da planilha segura, com confirmação', async () => {
    // R$ 16.000 dão 162 cotas; o estoque é 100.
    const d = bloqueio(await comFundo(), 'secundario-sem-estoque');
    expect(d).toMatchObject({ confirmavel: true });
    expect(d.mensagem).toContain('162 cotas');
  });

  it('avisa quando o deságio mudou desde que o teto foi anotado', async () => {
    const antigo = { 'riza terrax vintage fiagro rl': { teto: 0.5, desagio: 3, em: '2026-10-01' } };
    const d = validar(await comFundo({}, { tetos: antigo }), 'email').find((x) => x.codigo === 'secundario-teto-antigo');
    expect(d.nivel).toBe('aviso');
    expect(d.mensagem).toContain('3,00%');
  });

  it('com o ROA zerado, o teto anotado não entra na conta, e não há o que avisar', async () => {
    const antigo = { 'riza terrax vintage fiagro rl': { teto: 0.5, desagio: 3, em: '2026-10-01' } };
    expect(codigos(await comFundo({ financeiro: 5000 }, { tetos: antigo, semRoa: true }))).not.toContain('secundario-teto-antigo');
  });

  // 44 fundos da captura de 06/10 vêm com corretagem 0,00 (os XP CDI Private, os FIPs). Se a boleta
  // cobrar 1,5% num deles, as cotas do pedido em R$ passam do valor: confere-se antes.
  it('pedido em R$ num fundo sem corretagem segura, com confirmação', async () => {
    const semCorretagem = { ...estoque, origem: 'hub', fundos: [{ ...estoque.fundos[0], desagio: 0, desagioMinimo: 0, corretagem: 0 }] };
    const d = bloqueio(await comFundo({ financeiro: 5000 }, { estoque: semCorretagem }), 'secundario-sem-corretagem');
    expect(d).toMatchObject({ nivel: 'bloqueio', confirmavel: true });
    expect(d.mensagem).toContain('corretagem 0,00%');

    const porCotas = await comFundo({ financeiro: null, quantidade: 10 }, { estoque: semCorretagem });
    expect(codigos(porCotas)).not.toContain('secundario-sem-corretagem');
    expect(codigos(await comFundo({ financeiro: 5000 }))).not.toContain('secundario-sem-corretagem');
  });

  it('com o teto do Hub não há teto anotado para envelhecer', async () => {
    const antigo = { 'riza terrax vintage fiagro rl': { teto: 0.5, desagio: 3, em: '2026-10-01' } };
    const doHub = { ...estoque, origem: 'hub', fundos: [{ ...estoque.fundos[0], desagioMinimo: 1.75, corretagem: 1.5 }] };
    const s = await comFundo({ financeiro: 5000 }, { estoque: doHub, tetos: antigo });
    expect(codigos(s)).not.toContain('secundario-teto-antigo');
    expect(bloqueios(s)).toEqual([]);
  });

  // O deságio muda ao longo do dia; uma cotação velha pode pôr as cotas acima do pedido.
  it('cotação com mais de 10 minutos segura o e-mail em R$, com o conserto de atualizar', async () => {
    const velha = await comFundo({ financeiro: 5000 }, { hoje: new Date(2026, 9, 5, 14, 43) });
    const d = validar(velha, 'email').filter((x) => x.codigo === 'secundario-cotacao-velha');
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ nivel: 'bloqueio', confirmavel: true, acao: { campo: 'atualizar-cotacoes', rotulo: 'Atualizar cotações' } });
    expect(d[0].mensagem).toContain('14:32');
    expect(d[0].mensagem).toContain('há 11 min');

    expect(codigos(await comFundo({ financeiro: 5000 }, { hoje: new Date(2026, 9, 5, 14, 42) }))).not.toContain('secundario-cotacao-velha');
    const porCotas = await comFundo({ financeiro: null, quantidade: 10 }, { hoje: new Date(2026, 9, 5, 15, 30) });
    expect(codigos(porCotas)).not.toContain('secundario-cotacao-velha');
  });

  it('avisa uma vez quando a planilha não é do dia', async () => {
    const s = await comFundo({}, { hoje: new Date(2026, 9, 6, 9, 0) });
    expect(codigos(s).filter((c) => c === 'secundario-planilha-antiga')).toHaveLength(1);
  });

  it('compara a aplicação mínima com o total que o cliente paga', async () => {
    const s = await comFundo({ financeiro: 900 });
    expect(codigos(s)).toContain('abaixo-do-minimo');
  });

  it('não segura os formatos em que o fundo já está bloqueado', async () => {
    const s = await comFundo({}, { tetos: {} });
    expect(validar(s, 'lote').map((d) => d.codigo)).not.toContain('secundario-sem-teto');
  });
});

describe('venda de fundo do secundário', () => {
  const fundo = { situacao: 'exato', fundo: { nome: 'Riza Malls Feeder FII RL', ticker: null } };
  const lida = (extra = {}) => ({
    situacao: 'pronto',
    modalidade: 'xp',
    total: false,
    quantidade: 100,
    posicao: { quantidade: 120, disponivel: 120, aVenda: 0 },
    condicoes: { aberta: true, desagio: 2.25 },
    outraAberta: true,
    ...extra
  });
  const venda = (extra = {}, vendaExtra = {}) =>
    solicitacao({
      ordens: [ordem({ ativo: 'Riza Malls Feeder FII RL', ticker: null, fundo, operacao: 'V', quantidade: 100, venda: lida(vendaExtra), ...extra })]
    });

  it('a venda conferida com a posição só avisa que o print ainda vai ser tirado', () => {
    expect(codigos(venda())).toEqual(['venda-sem-print']);
  });

  it('com o print tirado, não acusa nada', () => {
    expect(codigos(venda({ print: { png: 'data:image/png;base64,AAAA' } }))).toEqual([]);
  });

  it('o total sem a posição bloqueia, sem confirmação: falta a quantidade', () => {
    const s = venda({ quantidade: null, total: true }, { situacao: 'sem-boleta', total: true, quantidade: null });
    expect(bloqueios(s)).toEqual(['venda-sem-posicao']);
    expect(validar(s, 'email')[0].confirmavel).toBe(false);
  });

  it('o total com a posição lida não bloqueia', () => {
    expect(bloqueios(venda({ quantidade: null, total: true }, { total: true, quantidade: 120 }))).toEqual([]);
  });

  it('acima da posição disponível bloqueia e oferece vender o total', () => {
    const d = validar(venda({ quantidade: 130 }, { quantidade: 130 }), 'email').find((x) => x.codigo === 'venda-acima-da-posicao');
    expect(d).toMatchObject({ confirmavel: false, acao: { campo: 'usar-posicao' } });
  });

  it('a quantidade sem conferir com a posição bloqueia, mas confirma', () => {
    const d = validar(venda({}, { situacao: 'sem-boleta' }), 'email').find((x) => x.codigo === 'venda-posicao-nao-conferida');
    expect(d.confirmavel).toBe(true);
  });

  it('o Estoque XP fechado oferece vender no Estoque clientes', () => {
    const d = validar(venda({}, { condicoes: { aberta: false } }), 'email').find((x) => x.codigo === 'venda-modalidade-fechada');
    expect(d).toMatchObject({ confirmavel: false, acao: { campo: 'estoque-clientes', rotulo: 'Vender no Estoque clientes' } });
  });

  it('as duas fechadas: não há o que oferecer', () => {
    expect(bloqueios(venda({}, { condicoes: { aberta: false }, outraAberta: false }))).toContain('venda-sem-modalidade');
  });

  it('venda em R$ não é tratada: vai em cotas', () => {
    expect(bloqueios(venda({ quantidade: null, financeiro: 10000 }))).toContain('venda-em-reais');
  });

  it('no Estoque clientes avisa que é uma intenção, cancelada às 14:00 se não casar', () => {
    expect(codigos(venda({}, { modalidade: 'clientes' }))).toContain('venda-estoque-clientes');
  });

  // Visto no Hub de verdade em 20/10/2026: com uma venda em aberto, a posição inteira fica à venda e
  // o disponível é zero; a boleta não faz conta, e não há print. Antes, o e-mail saía com 0 cotas.
  it('o total com todas as cotas já à venda bloqueia, sem confirmação: não há o que vender', () => {
    const s = venda({ quantidade: null, total: true }, { total: true, quantidade: 0, posicao: { quantidade: 120, disponivel: 0, aVenda: 120 } });
    const d = validar(s, 'email').find((x) => x.codigo === 'venda-sem-disponivel');
    expect(d).toMatchObject({ nivel: 'bloqueio', confirmavel: false });
    expect(d.mensagem).toContain('120 cotas dele já estão à venda');
    expect(codigos(s)).not.toContain('venda-cotas-a-venda');
    expect(codigos(s)).not.toContain('venda-sem-print');
  });

  it('avisa das cotas que o cliente já tem à venda', () => {
    expect(codigos(venda({}, { posicao: { quantidade: 120, disponivel: 100, aVenda: 20 } }))).toContain('venda-cotas-a-venda');
  });

  it('"total" fora da venda de fundo pede a quantidade', () => {
    const s = solicitacao({ ordens: [ordem({ quantidade: null, total: true, operacao: 'C' })] });
    expect(validar(s, 'email').find((d) => d.codigo === 'valor-ausente').mensagem).toMatch(/total/);
  });
});

describe('compra pelo Estoque clientes', () => {
  const fundo = { situacao: 'exato', fundo: { nome: 'Navi Hedge Fund', ticker: 'IMOV11' } };
  const p2p = (extra = {}) => ({ aberta: true, desagio: 9.9, corretagem: 1.5, disponivel: 25000, variacao: 2, origem: 'boleta', cotasQueCabem: 5000, ...extra });
  const sec = (extra = {}, p2pExtra = {}) => ({
    situacao: 'pronto',
    modalidade: 'clientes',
    porValor: true,
    cotas: 5000,
    limitadoAoEstoque: false,
    fundo: { nome: 'Navi Hedge Fund', estoque: 1000000, corretagem: 1.5 },
    planilha: { minutos: 1, deHoje: true, exportadaEm: new Date().toISOString() },
    p2p: p2p(p2pExtra),
    ...extra
  });
  const compra = (extra, p2pExtra) =>
    solicitacao({ ordens: [ordem({ ativo: 'IMOV11', ticker: null, fundo, financeiro: 50000, quantidade: null, estoque: 'clientes', secundario: sec(extra, p2pExtra) })] });

  it('com estoque e a boleta lida, só avisa da intenção', () => {
    expect(bloqueios(compra())).toEqual([]);
    expect(codigos(compra())).toContain('secundario-p2p-intencao');
  });

  it('fechado ou vazio bloqueia e oferece o Estoque XP', () => {
    for (const p of [{ aberta: false }, { disponivel: 0 }]) {
      const d = validar(compra({}, p), 'email').find((x) => x.codigo === 'secundario-p2p-fechado');
      expect(d).toMatchObject({ confirmavel: false, acao: { campo: 'estoque-xp' } });
    }
  });

  it('estoque menor que o pedido: comprar o que houver, ou no Estoque XP', () => {
    const d = validar(compra({}, { disponivel: 3000 }), 'email').find((x) => x.codigo === 'secundario-p2p-sem-estoque');
    expect(d.acoes.map((a) => a.campo)).toEqual(['o-que-for-possivel', 'estoque-xp']);
  });

  it('"o que for possível" limitado ao estoque só avisa', () => {
    const s = compra({ cotas: 3000, limitadoAoEstoque: true }, { disponivel: 3000 });
    expect(bloqueios(s)).toEqual([]);
    expect(codigos(s)).toContain('secundario-p2p-limitado');
  });

  it('sem a boleta, o estoque da Prateleira se confirma, com o conserto de cotar na boleta', () => {
    const d = validar(compra({}, { origem: 'captura' }), 'email').find((x) => x.codigo === 'secundario-p2p-sem-boleta');
    expect(d).toMatchObject({ confirmavel: true, acao: { campo: 'cotar-estoque-clientes' } });
  });

  it('o estoque do Estoque XP não conta na compra pelo Estoque clientes', () => {
    expect(bloqueios(compra({ cotas: 5000, fundo: { nome: 'Navi Hedge Fund', estoque: 10, corretagem: 1.5 } }))).not.toContain('secundario-sem-estoque');
  });
});

describe('aplicação no Tesouro Direto', () => {
  const titulo = { nome: 'Tesouro Selic 2031', taxa: 'SELIC + 0,0992 %', vencimento: '01/03/2031', minimo: 200.43 };
  const td = (extra = {}) => ({ situacao: 'pronto', titulo, unicoDoTipo: false, minutos: 1, foraDoHorario: false, ...extra });
  const aplicacao = (extra = {}, tdExtra = {}) =>
    solicitacao({
      ordens: [ordem({ ativo: 'Tesouro Selic 2031', ticker: null, tesouro: { especies: ['selic'], ano: 2031 }, quantidade: null, financeiro: 2000, tesouroDoHub: td(tdExtra), ...extra })]
    });

  it('com o título da lista, na hora, não acusa nada', () => {
    expect(codigos(aplicacao())).toEqual([]);
  });

  it('sem a lista do Hub, bloqueia com o conserto de ler', () => {
    const d = validar(aplicacao({ tesouroDoHub: { situacao: 'sem-lista' } }), 'email').find((x) => x.codigo === 'tesouro-sem-lista');
    expect(d).toMatchObject({ confirmavel: true, acao: { campo: 'ler-tesouro' } });
  });

  it('conta não habilitada: a mensagem do Hub', () => {
    const msg = 'A Conta 1234567 não está habilitada para operar no Tesouro Direto';
    const d = validar(aplicacao({ tesouroDoHub: { situacao: 'nao-habilitada', mensagem: msg } }), 'email').find((x) => x.codigo === 'tesouro-nao-habilitada');
    expect(d.mensagem).toContain('não está habilitada');
  });

  it('mais de um título cabe: um botão por candidato', () => {
    const candidatos = [{ nome: 'Tesouro Prefixado 2029' }, { nome: 'Tesouro Prefixado 2032' }];
    const d = validar(aplicacao({ tesouroDoHub: { situacao: 'ambiguo', candidatos } }), 'email').find((x) => x.codigo === 'tesouro-ambiguo');
    expect(d.acoes).toEqual([
      { campo: 'ativo', valor: 'Tesouro Prefixado 2029', rotulo: 'Tesouro Prefixado 2029' },
      { campo: 'ativo', valor: 'Tesouro Prefixado 2032', rotulo: 'Tesouro Prefixado 2032' }
    ]);
  });

  it('sem o vencimento, só avisa qual título vai', () => {
    expect(codigos(aplicacao({}, { unicoDoTipo: true }))).toEqual(['tesouro-sem-vencimento']);
  });

  it('abaixo do mínimo, por quantidade e com a taxa velha', () => {
    expect(bloqueios(aplicacao({ financeiro: 100 }))).toContain('tesouro-abaixo-do-minimo');
    expect(bloqueios(aplicacao({ financeiro: null, quantidade: 3 }))).toContain('tesouro-por-quantidade');
    const velha = validar(aplicacao({}, { minutos: 25 }), 'email').find((x) => x.codigo === 'tesouro-taxa-velha');
    expect(velha).toMatchObject({ confirmavel: true, acao: { campo: 'ler-tesouro', rotulo: 'Atualizar a taxa' } });
  });

  // O resgate: o título e o valor conferidos contra a posição do cliente, lida pelo robô.
  const POSICAO = { nome: 'Tesouro Selic 2031', vencimento: '01/03/2031', disponivel: 4.2, puVenda: 20024.39, valorDisponivel: 84102.44 };
  const resgate = (extra = {}, rg = {}) =>
    aplicacao({
      operacao: 'V',
      financeiro: 10000,
      resgateDoHub: { situacao: 'pronto', posicao: POSICAO, valor: extra.total ? POSICAO.valorDisponivel : (extra.financeiro ?? 10000), minutos: 1, ...rg },
      ...extra
    });

  it('o resgate com a posição, na hora, não acusa nada; o total também não', () => {
    expect(codigos(resgate())).toEqual([]);
    expect(codigos(resgate({ total: true, financeiro: null }))).toEqual([]);
  });

  it('acima do valor disponível bloqueia, com "Resgatar o total"', () => {
    const d = validar(resgate({ financeiro: 90000 }), 'email').find((x) => x.codigo === 'tesouro-resgate-acima');
    expect(d).toMatchObject({ confirmavel: false, acao: { campo: 'usar-posicao' } });
  });

  it('por quantidade de títulos bloqueia: o modelo pede o valor', () => {
    expect(bloqueios(resgate({ financeiro: null, quantidade: 2 }))).toContain('tesouro-resgate-por-quantidade');
  });

  it('sem a posição: o valor escrito se confirma; o total, não', () => {
    const escrito = validar(resgate({}, { situacao: 'sem-posicoes' }), 'email').find((x) => x.codigo === 'tesouro-resgate-sem-posicao');
    expect(escrito).toMatchObject({ confirmavel: true, acao: { campo: 'ler-tesouro', valor: 'posicoes' } });
    const total = validar(resgate({ total: true, financeiro: null }, { situacao: 'sem-posicoes' }), 'email');
    expect(total.find((x) => x.codigo === 'tesouro-resgate-sem-posicao').confirmavel).toBe(false);
    expect(total.map((x) => x.codigo)).not.toContain('valor-ausente');
  });

  it('o título que o cliente não tem bloqueia; a posição velha se confirma', () => {
    expect(bloqueios(resgate({}, { situacao: 'nao-tem' }))).toEqual(['tesouro-resgate-sem-titulo']);
    const velha = validar(resgate({}, { minutos: 25 }), 'email').find((x) => x.codigo === 'tesouro-posicao-velha');
    expect(velha).toMatchObject({ confirmavel: true, acao: { campo: 'ler-tesouro', valor: 'posicoes' } });
  });

  it('abaixo de 0,01 título bloqueia', () => {
    expect(bloqueios(resgate({ financeiro: 100 }))).toContain('tesouro-resgate-abaixo-do-minimo');
  });

  it('fora do horário do Tesouro, avisa', () => {
    expect(codigos(aplicacao({}, { foraDoHorario: true }))).toContain('tesouro-fora-do-horario');
  });
});

describe('a conta de outro pedido colada no fim da linha', () => {
  // Do pedido real de 20/10/2026, com contas fictícias.
  const colado = () => parseSolicitacoes('1234567\n\nCompra\nLFT - R$ 81.708,17   7654321 \nComprar 2k\nTesouro Selic 2031\nEmail').solicitacoes[0];

  it('bloqueia sem confirmar, com "Separar" e "Não é conta", e não acusa o número como solto', () => {
    const d = validar(colado(), 'email').find((x) => x.codigo === 'conta-no-fim-da-linha');
    expect(d).toMatchObject({ nivel: 'bloqueio', confirmavel: false });
    expect(d.mensagem).toContain('fica na conta 1234567');
    expect(d.acoes.map((a) => [a.campo, a.valor])).toEqual([['separar-conta', '7654321'], ['ignorar-numero', '7654321']]);
    expect(codigos(colado())).not.toContain('numero-nao-explicado');
  });

  it('número que não tem cara de conta segue como número solto', () => {
    const s = parseSolicitacoes('1234567\nPETR4 100 a 39,50 7').solicitacoes[0];
    expect(codigos(s)).toContain('numero-nao-explicado');
    expect(codigos(s)).not.toContain('conta-no-fim-da-linha');
  });
});


// A Fila do dia (21/10/2026): o Ordens anota em cada ordem o pedido igual de hoje que já saiu — mesma
// conta, mesmo ativo, mesma operação — e na solicitação a conta que nunca passou por este navegador.
describe('o que a Fila do dia já viu', () => {
  it('a ordem repetida de hoje bloqueia, e confirmar libera: pode ser um pedido novo de verdade', () => {
    const s = solicitacao({ ordens: [ordem({ repetidoHoje: { em: new Date(2026, 9, 21, 10, 2).getTime(), estado: 'enviado' } })] });
    const [b] = validar(s, 'email').filter((d) => d.nivel === 'bloqueio');
    expect(b).toMatchObject({ codigo: 'repetido-hoje', indiceOrdem: 0, confirmavel: true });
    expect(b.mensagem).toContain('PETR4');
    expect(b.mensagem).toContain('10:02');
    expect(b.mensagem).toContain('aguardando o cliente');
  });

  it('a conta nunca vista é só um aviso, para conferir o número', () => {
    const s = solicitacao({ contaNova: true });
    expect(bloqueios(s)).toEqual([]);
    const d = validar(s, 'email').find((x) => x.codigo === 'conta-nova');
    expect(d).toMatchObject({ nivel: 'aviso', indiceOrdem: null });
    expect(d.mensagem).toContain('7000001');
  });

  it('sem nada anotado, nada muda', () => {
    expect(codigos(solicitacao())).not.toContain('repetido-hoje');
    expect(codigos(solicitacao())).not.toContain('conta-nova');
  });
});

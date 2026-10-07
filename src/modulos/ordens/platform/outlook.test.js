import { describe, expect, it } from 'vitest';
import { formatarEmail } from '../core/format/formatadores.js';
import { TAMANHO_MAXIMO, enderecoDoEmail } from './outlook.js';

/**
 * O e-mail como o Outlook na web o lê: com o cliente, tudo vem do `mailto:` dentro do `to`; sem ele,
 * dos campos soltos do endereço.
 */
const lerEndereco = (endereco) => {
  const url = new URL(endereco);
  const to = url.searchParams.get('to');
  const campos = to ? new URL(to) : url;
  return {
    base: url.origin + url.pathname,
    para: to ? decodeURIComponent(campos.pathname) : null,
    cc: campos.searchParams.get('cc'),
    assunto: campos.searchParams.get('subject'),
    corpo: campos.searchParams.get('body')
  };
};

describe('enderecoDoEmail', () => {
  it('abre um e-mail novo no Outlook na web com o assunto da confirmação', () => {
    const { base, para, assunto, corpo } = lerEndereco(enderecoDoEmail());
    expect(base).toBe('https://outlook.office.com/mail/deeplink/compose');
    expect(para).toBeNull();
    expect(assunto).toBe('Confirmação de ordem');
    expect(corpo).toBeNull();
  });

  it('leva o corpo inteiro, com acento e com as quebras de linha', () => {
    const texto = 'Prezado(a) Cliente,\n\nAtivo: IVVB11;\nPreço: A mercado';
    const esperado = 'Prezado(a) Cliente,\r\n\r\nAtivo: IVVB11;\r\nPreço: A mercado';
    expect(lerEndereco(enderecoDoEmail({ corpo: texto })).corpo).toBe(esperado);
    expect(lerEndereco(enderecoDoEmail({ corpo: texto, para: 'ana@exemplo.com' })).corpo).toBe(esperado);
  });

  // Quem lê o endereço pode não desfazer o `+`; o espaço vai como %20.
  it('escreve o espaço como %20, não como +', () => {
    const endereco = enderecoDoEmail({ corpo: 'a b' });
    expect(endereco).toContain('subject=Confirma%C3%A7%C3%A3o%20de%20ordem');
    expect(endereco).toContain('body=a%20b');
    expect(enderecoDoEmail({ corpo: 'a b', para: 'ana@exemplo.com' })).not.toContain('+');
  });

  // O Outlook na web ignora o `cc` solto: só o lê dentro de um `mailto:` no `to` (conferido em 07/10).
  it('põe o cliente no Para e o assessor em cópia, num mailto: dentro do to', () => {
    const endereco = enderecoDoEmail({ corpo: 'texto', para: 'ana@exemplo.com', cc: 'bruno@exemplo.com.br' });
    expect(new URL(endereco).searchParams.get('to')).toMatch(/^mailto:ana@exemplo\.com\?cc=/);
    expect(new URL(endereco).searchParams.has('cc')).toBe(false);
    expect(lerEndereco(endereco)).toMatchObject({
      para: 'ana@exemplo.com',
      cc: 'bruno@exemplo.com.br',
      assunto: 'Confirmação de ordem',
      corpo: 'texto'
    });
  });

  it('é o formato que funcionou no Outlook da mesa', () => {
    expect(enderecoDoEmail({ assunto: 'teste Mesa B', corpo: 'linha 1\nlinha 2', para: 'teste.para@example.com', cc: 'teste.cc@example.com' })).toBe(
      'https://outlook.office.com/mail/deeplink/compose?to=mailto%3Ateste.para%40example.com%3Fcc%3Dteste.cc%2540example.com%26subject%3Dteste%2520Mesa%2520B%26body%3Dlinha%25201%250D%250Alinha%25202'
    );
  });

  it('sem assessor, a cópia não vai; sem cliente, nem o Para', () => {
    expect(lerEndereco(enderecoDoEmail({ corpo: 'texto', para: 'ana@exemplo.com', cc: null })).cc).toBeNull();
    expect(lerEndereco(enderecoDoEmail({ corpo: 'texto', cc: 'bruno@exemplo.com.br' }))).toMatchObject({ para: null, cc: null, corpo: 'texto' });
  });

  it('o que mudaria o sentido do mailto: no endereço do cliente vai codificado', () => {
    expect(lerEndereco(enderecoDoEmail({ para: 'a&b?c@exemplo.com', cc: 'x@exemplo.com' }))).toMatchObject({ para: 'a&b?c@exemplo.com', cc: 'x@exemplo.com' });
  });

  it('desiste do corpo que não cabe no endereço', () => {
    expect(enderecoDoEmail({ corpo: 'x'.repeat(TAMANHO_MAXIMO) })).toBeNull();
  });

  it('um e-mail de dez ativos cabe, com o cliente e o assessor', () => {
    const ordens = Array.from({ length: 10 }, (_, i) => ({ ativo: `PETR${i}`, operacao: 'C', quantidade: 1000, financeiro: null, preco: '38,50' }));
    const corpo = formatarEmail({ conta: '1234567', ordens, cliente: { nome: 'Ana Paula da Silva' } });
    const endereco = enderecoDoEmail({ corpo, para: 'ana.paula.silva@exemplo.com', cc: 'bruno.costa@exemplo.com.br' });
    expect(endereco).not.toBeNull();
    expect(endereco.length).toBeLessThan(TAMANHO_MAXIMO * 0.6);
  });
});

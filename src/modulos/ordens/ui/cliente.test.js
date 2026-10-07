import { describe, expect, it } from 'vitest';
import { renderCliente } from './cliente.js';

const achado = (assessor = {}) => ({
  situacao: 'achado',
  nome: 'Ana Paula da Silva',
  email: 'ana@exemplo.com',
  assessor: { codigo: 'A12345', nome: 'Bruno Costa', email: 'bruno@exemplo.com.br', peloNome: false, motivo: null, ...assessor }
});

describe('a linha do cliente no cartão', () => {
  it('sem robô, nada', () => {
    expect(renderCliente(null)).toBe('');
  });

  it('mostra o cliente e o assessor que vai em cópia', () => {
    const html = renderCliente(achado());
    expect(html).toContain('Ana Paula da Silva');
    expect(html).toContain('ana@exemplo.com');
    expect(html).toContain('Bruno Costa <span class="cliente-codigo">A12345</span>');
    expect(html).toContain('bruno@exemplo.com.br');
  });

  it('diz por que o assessor fica sem cópia', () => {
    expect(renderCliente(achado({ email: null, motivo: 'sem-planilha' }))).toContain('carregue a planilha dos assessores');
    expect(renderCliente(achado({ email: null, motivo: 'fora-da-planilha' }))).toContain('fora da planilha');
  });

  it('avisa quando o assessor foi achado pelo nome, não pelo código', () => {
    expect(renderCliente(achado({ peloNome: true }))).toContain('achado pelo nome');
  });

  it('diz quando o cliente não veio, e como o e-mail sai', () => {
    const html = renderCliente({ situacao: 'falhou', motivo: 'o Hub não respondeu a tempo' });
    expect(html).toContain('o Hub não respondeu a tempo');
    expect(html).toContain('Prezado(a) Cliente,');
  });

  it('escapa o que veio do Hub', () => {
    expect(renderCliente({ ...achado(), nome: '<img src=x onerror=alert(1)>' })).not.toContain('<img');
  });
});

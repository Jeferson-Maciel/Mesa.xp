import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HTML_DO_MANUAL, ligarManual } from './manual.js';

describe('Manual da Mesa XP', () => {
  it('o HTML do manual contém os capítulos fundamentais para treinamento e novos colaboradores', () => {
    expect(HTML_DO_MANUAL).toContain('id="cap-visao-geral"');
    expect(HTML_DO_MANUAL).toContain('id="cap-instalacao-robo"');
    expect(HTML_DO_MANUAL).toContain('id="cap-trio-de-abas"');
    expect(HTML_DO_MANUAL).toContain('id="cap-ordens"');
    expect(HTML_DO_MANUAL).toContain('id="cap-fila"');
    expect(HTML_DO_MANUAL).toContain('id="cap-rendafixa"');
    expect(HTML_DO_MANUAL).toContain('id="cap-fundos"');
    expect(HTML_DO_MANUAL).toContain('id="cap-troubleshooting"');
  });

  it('possui ações de salvar como PDF / imprimir e fechar', () => {
    expect(HTML_DO_MANUAL).toContain('data-manual-acao="imprimir"');
    expect(HTML_DO_MANUAL).toContain('Salvar como PDF / Imprimir');
    expect(HTML_DO_MANUAL).toContain('data-manual-acao="fechar"');
  });

  it('detalha a instalação da extensão Tampermonkey e do robô do Hub', () => {
    expect(HTML_DO_MANUAL).toContain('Tampermonkey');
    expect(HTML_DO_MANUAL).toContain('Instalar robô');
    expect(HTML_DO_MANUAL).toContain('Segurança e Sigilo Bancário');
  });

  it('explica o trio de abas obrigatórias no navegador (Mesa, Hub e Outlook)', () => {
    expect(HTML_DO_MANUAL).toContain('Mesa XP');
    expect(HTML_DO_MANUAL).toContain('Hub XP');
    expect(HTML_DO_MANUAL).toContain('Outlook');
    expect(HTML_DO_MANUAL).toContain('Pivô Central');
  });

  it('explica os fluxos de boletas, prints e validação estrita sem adivinhação', () => {
    expect(HTML_DO_MANUAL).toContain('Nada é Adivinhado');
    expect(HTML_DO_MANUAL).toContain('Fila do Dia');
    expect(HTML_DO_MANUAL).toContain('Puxar do Hub');
  });

  it('o index.html contém o botão #btn-manual com ícone e rótulo no cabeçalho', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html).toContain('id="btn-manual"');
    expect(html).toContain('class="header-btn manual-botao"');
    expect(html).toContain('Manual');
  });

  it('ligarManual não quebra caso executado fora de um ambiente de navegador com DOM', () => {
    const retorno = ligarManual(null);
    expect(retorno).toHaveProperty('abrir');
    expect(retorno).toHaveProperty('fechar');
    expect(typeof retorno.abrir).toBe('function');
    expect(typeof retorno.fechar).toBe('function');
  });
});

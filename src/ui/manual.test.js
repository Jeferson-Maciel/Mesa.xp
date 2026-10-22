import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HTML_DO_MANUAL, ligarManual } from './manual.js';

describe('Manual da Mesa XP', () => {
  it('o HTML do manual contém os capítulos fundamentais para treinamento e novos colaboradores', () => {
    expect(HTML_DO_MANUAL).toContain('id="cap-visao-geral"');
    expect(HTML_DO_MANUAL).toContain('id="cap-instalacao-robo"');
    expect(HTML_DO_MANUAL).toContain('id="cap-trio-de-abas"');
    expect(HTML_DO_MANUAL).toContain('id="cap-ordens"');
    expect(HTML_DO_MANUAL).toContain('id="cap-exemplos-ordens"');
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

  it('detalha a instalação da extensão Tampermonkey e ativação do modo desenvolvedor para pessoas leigas', () => {
    expect(HTML_DO_MANUAL).toContain('Tampermonkey');
    expect(HTML_DO_MANUAL).toContain('chrome://extensions');
    expect(HTML_DO_MANUAL).toContain('Modo do Desenvolvedor');
    expect(HTML_DO_MANUAL).toContain('quebra-cabeça');
    expect(HTML_DO_MANUAL).toContain('alfinete');
    expect(HTML_DO_MANUAL).toContain('Instalar robô');
    expect(HTML_DO_MANUAL).toContain('Segurança e Sigilo Bancário');
  });

  it('contém fluxogramas e diagramas SVG visuais integrados', () => {
    expect(HTML_DO_MANUAL).toContain('<svg viewBox="0 0 760 110"');
    expect(HTML_DO_MANUAL).toContain('<svg viewBox="0 0 760 160"');
    expect(HTML_DO_MANUAL).toContain('<svg viewBox="0 0 760 120"');
  });

  it('explica o trio de abas obrigatórias no navegador (Mesa, Hub e Outlook)', () => {
    expect(HTML_DO_MANUAL).toContain('Mesa XP');
    expect(HTML_DO_MANUAL).toContain('Hub XP');
    expect(HTML_DO_MANUAL).toContain('Outlook');
    expect(HTML_DO_MANUAL).toContain('Pivô Central');
  });

  it('contém exemplos reais de mensagens de WhatsApp e resultados', () => {
    expect(HTML_DO_MANUAL).toContain('PETR4');
    expect(HTML_DO_MANUAL).toContain('Riza Terrax');
  });

  it('o index.html contém o botão #btn-manual como ícone compacto no cabeçalho', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html).toContain('id="btn-manual"');
    expect(html).toContain('class="header-btn icone manual-botao"');
    expect(html).toContain('title="Manual e Ajuda da Mesa XP"');
  });

  it('casca.css oculta o nome das abas sem reticências (...) ao encolher a janela', () => {
    const css = readFileSync(new URL('../shell/casca.css', import.meta.url), 'utf8');
    expect(css).toContain('.aba-nome');
    expect(css).toContain('display: none');
    expect(css).not.toMatch(/\.aba-nome\s*\{[^}]*text-overflow:\s*ellipsis/);
  });

  it('ligarManual não quebra caso executado fora de um ambiente de navegador com DOM', () => {
    const retorno = ligarManual(null);
    expect(retorno).toHaveProperty('abrir');
    expect(retorno).toHaveProperty('fechar');
    expect(typeof retorno.abrir).toBe('function');
    expect(typeof retorno.fechar).toBe('function');
  });
});

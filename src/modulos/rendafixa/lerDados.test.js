import { describe, expect, it } from 'vitest';
import { LINHAS_SINTETICAS } from './fixtures/sintetica.js';
import { sheetjs } from '../../vendor/sheetjs.js';
import { lerPlanilha } from './planilha.js';
import { processRows } from './motor.js';
import { htmlBotaoHub, nomeDaPuxada } from './render.js';

/**
 * Monta um buffer .xlsx em memória usando o SheetJS vendorizado a partir
 * das linhas sintéticas (nunca uma exportação real em teste versionado).
 */
const montarXlsxSintetico = () => {
  const XLSX = sheetjs();
  const ws = XLSX.utils.aoa_to_sheet(LINHAS_SINTETICAS);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Resultado');
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(buffer);
};

describe('lerDados da Renda Fixa', () => {
  it('lê planilha .xlsx montada em memória e produz o mesmo resultado que o arquivo arrastado', async () => {
    const dados = montarXlsxSintetico();

    // 1. Caminho do Hub: Uint8Array direto em memória
    const doHub = lerPlanilha(dados, sheetjs());
    expect(doHub.aba).toBe('Resultado');
    expect(doHub.rows.length).toBeGreaterThan(0);

    // 2. Caminho do arquivo arrastado: simulação de File com .arrayBuffer()
    const file = {
      name: 'sintetica.xlsx',
      size: dados.byteLength,
      arrayBuffer: async () => dados.buffer
    };
    const doArquivo = lerPlanilha(await file.arrayBuffer(), sheetjs());

    // As linhas lidas são idênticas
    expect(doHub.rows).toEqual(doArquivo.rows);

    // A análise do motor produz as mesmas oportunidades nos dois mercados
    const analiseHubPrimario = processRows(doHub.rows, false);
    const analiseArqPrimario = processRows(doArquivo.rows, false);
    expect(analiseHubPrimario.totais).toEqual(analiseArqPrimario.totais);
    expect(analiseHubPrimario.secoes.length).toBe(analiseArqPrimario.secoes.length);

    const analiseHubSecundario = processRows(doHub.rows, true);
    const analiseArqSecundario = processRows(doArquivo.rows, true);
    expect(analiseHubSecundario.totais).toEqual(analiseArqSecundario.totais);
  });

  it('formata o nome sugerido para o histórico e exibição', () => {
    const momento = new Date(2026, 9, 22, 16, 47).getTime();
    expect(nomeDaPuxada(momento)).toBe('Hub · 22/10 16:47');
  });

  describe('render dos estados do botão Puxar do Hub', () => {
    it('estado sem-robo: oferece instalar robô', () => {
      const html = htmlBotaoHub({ estado: 'sem-robo' });
      expect(html).toContain('Instalar robô');
      expect(html).toContain('data-estado="sem-robo"');
      expect(html).not.toContain('disabled');
    });

    it('estado desatualizado: oferece atualizar com a versão escapada', () => {
      const html = htmlBotaoHub({ estado: 'desatualizado', versao: '1.13.4' });
      expect(html).toContain('Atualizar robô');
      expect(html).toContain('v1.13.4');
      expect(html).toContain('data-estado="desatualizado"');
    });

    it('estado desatualizado: escapa qualquer dado malicioso na versão', () => {
      const html = htmlBotaoHub({ estado: 'desatualizado', versao: '<img src=x onerror=alert(1)>' });
      expect(html).not.toContain('<img');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('estado puxando: fica desabilitado e com indicador de spinner', () => {
      const html = htmlBotaoHub({ estado: 'puxando' });
      expect(html).toContain('Puxando do Hub…');
      expect(html).toContain('disabled');
      expect(html).toContain('rf-puxar-hub-spinner');
    });

    it('estado pronto: ativo com atalho P', () => {
      const html = htmlBotaoHub({ estado: 'pronto' });
      expect(html).toContain('Puxar do Hub');
      expect(html).toContain('data-estado="pronto"');
      expect(html).toContain('(P)');
      expect(html).not.toContain('disabled');
    });
  });
});

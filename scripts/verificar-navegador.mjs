/**
 * Verificação no navegador: o que os testes do core não veem.
 *
 * Abre o `dist/index.html` via file:// no Chromium (Playwright) e confere:
 *   - as abas, pelo clique, pelo hash e por Alt+1 em diante, e os atalhos do Ordens presos à aba;
 *   - as abas nos dois temas, a 1400px, 1000px e ~360px, sem rolagem horizontal e sem erro no console;
 *   - que nenhum seletor do CSS do Ordens pega elemento das outras abas;
 *   - Operacional em modo local: o texto de um post copiado e colado igual ao do Slab, editar,
 *     criar e excluir post (título com <img onerror> como texto), criar tópico, busca, link direto
 *     e o conflito de duas abas salvando o mesmo post;
 *   - Renda Fixa: a planilha carregada na tela, o texto copiado e colado (Ctrl+V) idêntico ao golden,
 *     nos dois mercados — com as exportações reais da XP, se estiverem em fixtures/, e sempre com a
 *     planilha sintética convertida para .xlsx;
 *   - Calendário em modo local (um build à parte, com as duas variáveis vazias): nome com
 *     <img onerror> aparece como texto, a janela do dia, o histórico e a exclusão em cascata;
 *   - Calendário no build normal: ou conecta ("ao vivo"), ou mostra o erro na tela — nunca cai calado
 *     no modo local;
 *   - Ordens, o robô do Hub: o script do Tampermonkey nas duas abas, com as funções GM_* simuladas
 *     entre abas, um Hub falso e a Mesa do disco — colar o pedido busca a cotação, o "Atualizar
 *     cotações", a aba do Hub fechada (o robô abre outra) e a Mesa sem o robô;
 *   - Anotações, com o relógio controlado: lembrete amarelo, a hora chegando com a pessoa em outra
 *     aba (alerta, contador vermelho, título), print anexado, recarregar sem perder nada, marcação
 *     como texto, só link http(s), e o backup.
 *
 * Uso:  npm run build && node scripts/verificar-navegador.mjs
 * Na primeira vez: npx playwright install chromium
 *
 * Não grava nada no banco. O teste contra o Supabase real é o scripts/verificar-supabase.mjs.
 */

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { build } from 'vite';
import { ABAS } from '../src/shell/abas.js';

process.env.TZ = 'America/Sao_Paulo';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const distNormal = join(raiz, 'dist/index.html');
if (!existsSync(distNormal)) {
  console.error('dist/index.html não existe: rode npm run build antes.');
  process.exit(1);
}

let falhas = 0;
let blocoAtual = '';
const ok = (condicao, mensagem) => {
  if (!condicao) falhas++;
  console.log(`${condicao ? 'ok ' : 'FALHOU'} ${mensagem}`);
  // No GitHub, cada falha vira uma anotação do passo: o log inteiro só o administrador do repositório
  // vê, e a anotação, qualquer um (21/10/2026).
  if (!condicao && process.env.GITHUB_ACTIONS === 'true') {
    console.log(`::error title=${blocoAtual.replace(/[:,]/g, ' ')}::${String(mensagem).replace(/\r?\n/g, ' ')}`);
  }
};
const titulo = (texto) => {
  blocoAtual = texto;
  console.log(`\n── ${texto}`);
};
// O atalho de cada aba, na ordem da barra: uma aba nova no meio não desalinha o resto.
const altDe = (aba) => `Alt+${ABAS.indexOf(aba) + 1}`;

/* ── Preparação: build em modo local e a planilha sintética em .xlsx ─────────────────── */

const temporario = mkdtempSync(join(tmpdir(), 'mesa-xp-'));
writeFileSync(join(temporario, '.env'), 'VITE_SUPABASE_URL=\nVITE_SUPABASE_ANON_KEY=\n');
await build({
  root: raiz,
  configFile: join(raiz, 'vite.config.js'),
  envDir: temporario,
  logLevel: 'silent',
  build: { outDir: join(temporario, 'dist'), emptyOutDir: true }
});
const distLocal = join(temporario, 'dist/index.html');

const XLSX = createRequire(import.meta.url)('../src/vendor/xlsx.full.min.js');
const { LINHAS_SINTETICAS } = await import(pathToFileURL(join(raiz, 'src/modulos/rendafixa/fixtures/sintetica.js')).href);
const { DATA_GOLDEN } = await import(pathToFileURL(join(raiz, 'src/modulos/rendafixa/golden/referencia.js')).href);
const { POSTS } = await import(pathToFileURL(join(raiz, 'src/modulos/operacional/conteudo.js')).href);
const planilhaSintetica = join(temporario, 'sintetica.xlsx');
{
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet(LINHAS_SINTETICAS, { cellDates: true }), 'Resultado');
  // XLSX.writeFile não tem acesso ao disco carregado assim; o buffer vai pelo fs.
  writeFileSync(planilhaSintetica, XLSX.write(livro, { type: 'buffer', bookType: 'xlsx', cellDates: true }));
}
const pastaFixtures = join(raiz, 'src/modulos/rendafixa/fixtures');
const planilhas = [
  { nome: 'sintetica', arquivo: planilhaSintetica },
  ...readdirSync(pastaFixtures)
    .filter((n) => n.endsWith('.xlsx'))
    .map((n) => ({ nome: basename(n, '.xlsx'), arquivo: join(pastaFixtures, n) }))
];
const golden = (nome, modo) => JSON.parse(readFileSync(join(raiz, `src/modulos/rendafixa/golden/${nome}.${modo}.json`), 'utf8'));

const navegador = await chromium.launch();

const abrir = async ({ arquivo = distLocal, hash = '', largura = 1400, tema = 'escuro', relogio = null } = {}) => {
  const contexto = await navegador.newContext({
    viewport: { width: largura, height: 900 },
    timezoneId: 'America/Sao_Paulo',
    reducedMotion: 'reduce',
    permissions: ['clipboard-read', 'clipboard-write']
  });
  if (relogio) await contexto.clock.setFixedTime(new Date(relogio));
  await contexto.addInitScript((t) => localStorage.getItem('xp_tema') || localStorage.setItem('xp_tema', t), tema);
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
  pagina.on('pageerror', (e) => erros.push(String(e)));
  pagina.on('dialog', (d) => d.accept());
  await pagina.goto(pathToFileURL(arquivo).href + hash);
  return { pagina, contexto, erros };
};

const semRolagemLateral = (pagina) =>
  pagina.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

const adicionarColaborador = async (pagina, nome) => {
  await pagina.fill('[data-cal="nome"]', nome);
  await pagina.press('[data-cal="nome"]', 'Enter');
  await pagina.waitForFunction((n) => [...document.querySelectorAll('.cal-nome')].some((e) => e.textContent === n), nome);
};

try {
  /* ── Casca ──────────────────────────────────────────────────────────────────────── */
  titulo('Casca');
  {
    const { pagina, contexto, erros } = await abrir();
    const visivel = () => pagina.evaluate(() => [...document.querySelectorAll('.modulo')].find((s) => !s.hidden)?.id);
    ok((await visivel()) === 'modulo-ordens', 'sem hash, abre no Ordens');
    for (const aba of ABAS.slice(1)) {
      await pagina.keyboard.press(altDe(aba));
      ok((await visivel()) === `modulo-${aba}` && (await pagina.evaluate(() => location.hash)) === `#${aba}`, `${altDe(aba)} abre a aba ${aba} e muda o hash`);
    }
    await pagina.click('.aba[data-aba="ordens"]');
    // O clique troca pelo hashchange, que chega logo depois.
    await pagina.waitForFunction(() => !document.getElementById('modulo-ordens').hidden, null, { timeout: 2000 }).catch(() => {});
    ok((await visivel()) === 'modulo-ordens', 'o clique na aba Ordens volta');
    for (const hash of ['#rendafixa', '#calendario', '#operacional', '#anotacoes', '#xyz']) {
      await pagina.goto(pathToFileURL(distLocal).href + hash);
      const esperado = hash === '#xyz' ? 'modulo-ordens' : `modulo-${hash.slice(1)}`;
      ok((await visivel()) === esperado, `link direto ${hash} abre ${esperado}`);
    }
    await pagina.goto(pathToFileURL(distLocal).href + '#operacional/post/disparo-rf');
    await pagina.waitForSelector('.op-titulo');
    ok((await visivel()) === 'modulo-operacional' && (await pagina.textContent('.op-titulo')) === 'Disparo RF', 'link direto de um post abre o post na aba Operacional');
    ok(erros.length === 0, `console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
    await contexto.close();
  }

  titulo('Atalhos presos à aba');
  {
    const { pagina, contexto } = await abrir();
    ok(
      (await pagina.isVisible('.atalhos-dica')) && (await pagina.innerText('.atalhos-dica')).replace(/\s+/g, '') === 'Ctrl+Enteranalisa·Alt+Hhistórico',
      'os atalhos do Ordens à vista, abaixo dos botões (F20)'
    );
    await pagina.fill('#entrada', '1234567\nCOMPRA\nPETR4 100');
    await pagina.keyboard.press(altDe('rendafixa'));
    await pagina.keyboard.press('Control+Enter');
    await pagina.keyboard.press('Alt+h');
    await pagina.keyboard.press(altDe('ordens'));
    ok((await pagina.$eval('#solicitacoes', (e) => e.children.length)) === 0, 'Ctrl+Enter na aba Renda Fixa não analisa o Ordens');
    ok(!(await pagina.$eval('#drawer-historico', (e) => e.classList.contains('open'))), 'Alt+H na aba Renda Fixa não abre o histórico do Ordens');
    await pagina.focus('#entrada');
    await pagina.keyboard.press('Control+Enter');
    ok((await pagina.$eval('#solicitacoes', (e) => e.children.length)) === 1, 'Ctrl+Enter na aba Ordens analisa');
    await pagina.keyboard.press('m');
    await pagina.keyboard.press(altDe('rendafixa'));
    ok(await pagina.$eval('[data-mercado="primario"]', (b) => b.classList.contains('ativo')), '"m" na aba Ordens não troca o mercado do Renda Fixa');
    await pagina.keyboard.press('m');
    ok(await pagina.$eval('[data-mercado="secundario"]', (b) => b.classList.contains('ativo')), '"m" logo depois do atalho da Renda Fixa já vale nela');
    await contexto.close();
  }

  // Os extras de 21/10/2026: o texto colado marcado linha a linha, a linha removida que volta e os
  // lotes de várias contas num TSV só.
  titulo('Ordens: o texto lido, desfazer a remoção e os lotes juntos');
  {
    const { pagina, contexto, erros } = await abrir();
    // O Windows devolve a área de transferência com \r\n; o texto copiado é o mesmo (o arquivo baixado tem \n).
    const areaDeTransferencia = async () => (await pagina.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
    await pagina.fill('#entrada', '[13:46, 21/09/2026] Paulo: 1234567\nlote\nC PETR4 100\nvender XPML11 100 e comprar BTLG11 100\nenviado mesa\n7654321\nlote\nV VALE3 50');
    await pagina.click('#btn-analisar');
    ok(
      (await pagina.textContent('#texto-lido-resumo')) === 'O que foi lido do texto: 6 linhas lidas · 1 descartada, para fazer na mão · 1 ignorada',
      `o texto colado aparece marcado: lidas, a descartada e a ignorada (${await pagina.textContent('#texto-lido-resumo')})`
    );
    await pagina.click('#lotes-juntos [data-lotes="lote"]');
    const lotes = await areaDeTransferencia();
    ok(
      lotes.split('\n').filter((l) => l.startsWith('Estratégia')).length === 1 && lotes.includes('PETR4') && lotes.includes('VALE3'),
      '"Copiar todos os Lote Simples" junta as duas contas num TSV com um cabeçalho só'
    );
    // F9 (22/10/2026): o lote baixado é o texto do Copiar, num .tsv.
    const baixado = async (seletor) => {
      const [download] = await Promise.all([pagina.waitForEvent('download'), pagina.click(seletor)]);
      return { nome: download.suggestedFilename(), texto: readFileSync(await download.path(), 'utf8') };
    };
    const juntos = await baixado('#lotes-juntos [data-lotes="lote"][data-baixar-lotes]');
    ok(/^lote-simples-2-contas-\d{4}-\d{2}-\d{2}\.tsv$/.test(juntos.nome) && juntos.texto === lotes, `"Baixar" dos Juntos: o mesmo TSV, num arquivo (${juntos.nome})`);
    await pagina.click('[data-solicitacao="0"] [data-copiar="lote"]');
    const copiadoUm = await areaDeTransferencia();
    const um = await baixado('[data-solicitacao="0"] [data-baixar="lote"]');
    ok(/^lote-simples-1234567-\d{4}-\d{2}-\d{2}\.tsv$/.test(um.nome) && um.texto === copiadoUm, `"Baixar" do Lote Simples de uma conta: o texto do Copiar, byte a byte (${um.nome})`);
    await pagina.click('[data-solicitacao="0"] .btn-remover');
    ok((await pagina.$$('[data-solicitacao="0"] tbody tr')).length === 0, 'a linha sai do cartão');
    await pagina.locator('body').click({ position: { x: 5, y: 5 } });
    await pagina.keyboard.press('Control+z');
    ok((await pagina.$$('[data-solicitacao="0"] tbody tr')).length === 1, 'Ctrl+Z fora de um campo traz a linha de volta');
    ok(erros.length === 0, `console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
    await contexto.close();
  }

  titulo('Ordens: Abrir no Outlook');
  {
    const { pagina, contexto, erros } = await abrir();
    // A janela do Outlook não abre aqui: o endereço e o jeito de abrir são anotados no lugar dela.
    await pagina.evaluate(() => {
      window.__abertas = [];
      window.open = (endereco, _alvo, recursos) => (window.__abertas.push(endereco), (window.__recursos = recursos), {});
    });
    await pagina.fill('#entrada', '1234567\nCOMPRA\nPETR4 100');
    await pagina.focus('#entrada');
    await pagina.keyboard.press('Control+Enter');
    await pagina.check('#formatos input[value="email"]');
    await pagina.check('#formatos input[value="auditoria"]');
    const abertas = () => pagina.evaluate(() => window.__abertas);
    const areaDeTransferencia = () => pagina.evaluate(() => navigator.clipboard.readText());

    // A pessoa copiou o e-mail do cliente para o campo Para: o texto que vai no endereço não o apaga.
    await pagina.evaluate(() => navigator.clipboard.writeText('cliente@exemplo.com'));
    await pagina.click('.saida[data-formato="email"] [data-outlook]');
    const [endereco] = await abertas();
    const url = new URL(endereco);
    ok(
      url.origin + url.pathname === 'https://outlook.cloud.microsoft/mail/deeplink/compose' && url.searchParams.get('subject') === 'Confirmação de ordem',
      'Abrir no Outlook abre um e-mail novo no Outlook na web com o assunto "Confirmação de ordem"'
    );
    ok((await pagina.evaluate(() => window.__recursos)).startsWith('popup,'), 'numa janela só do e-mail, não numa aba nova');
    const texto = await pagina.textContent('.saida[data-formato="email"] pre');
    ok(url.searchParams.get('body') === texto.replace(/\n/g, '\r\n'), 'o corpo é o texto do e-mail à vista, com as quebras de linha');
    ok((await areaDeTransferencia()) === 'cliente@exemplo.com', 'o texto que vai no endereço não apaga a área de transferência');

    // A tabela não entra no endereço, que só leva texto puro: vai o texto dela, com TAB entre as
    // colunas, como o do e-mail (decidido com o operador em 09/10/2026).
    await pagina.click('.saida[data-formato="auditoria"] [data-outlook]');
    await pagina.waitForFunction(() => window.__abertas.length === 2, null, { timeout: 5000 });
    const segunda = new URL((await abertas())[1]);
    ok(segunda.searchParams.get('subject') === 'Confirmação de ordem', 'o e-mail em tabela abre com o assunto');
    ok(segunda.searchParams.get('body')?.includes('PETR4\tC\tA mercado\t100\r\n'), 'e com a tabela no corpo, em texto');
    ok((await areaDeTransferencia()) === 'cliente@exemplo.com', 'a tabela no endereço também não apaga a área de transferência');
    ok(erros.length === 0, `console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
    await contexto.close();
  }

  /* ── As abas, dois temas, três larguras ─────────────────────────────────────────── */
  titulo('As abas × dois temas × 1400px, 1000px e 360px (build em modo local)');
  const ordensCss = readFileSync(join(raiz, 'src/modulos/ordens/ordens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const seletoresDoOrdens = [...new Set(
    ordensCss
      .split('}')
      .map((bloco) => bloco.split('{')[0].trim())
      .filter((s) => s && !s.startsWith('@') && !/^(from|to|\d+%)$/.test(s))
      .flatMap((s) => s.split(','))
      .map((s) => s.trim().replace(/::?[a-z-]+(\([^)]*\))?/g, (p) => (p.startsWith(':where(') ? p.slice(7, -1) : '')).trim())
      .filter(Boolean)
  )];

  for (const tema of ['escuro', 'claro']) {
    for (const largura of [1400, 1000, 360]) {
      const { pagina, contexto, erros } = await abrir({ tema, largura });
      ok((await pagina.evaluate(() => document.documentElement.dataset.tema)) === tema, `${tema} ${largura}px: tema aplicado`);

      await pagina.click('#presets [data-exemplo="Cesta em R$"]');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Ordens com uma cesta, sem rolagem lateral`);
      // Cada linha do preview: os controles na mesma altura e a borda de baixo inteira. Um
      // `display: flex` direto num <td> tirava a célula da linha e quebrava as duas coisas.
      const desalinhadas = await pagina.$$eval('table.preview tbody tr', (linhas) =>
        linhas
          .map((tr, i) => {
            const tds = [...tr.children];
            const centros = tds
              .map((td) => td.querySelector('input, .segmentado'))
              .filter(Boolean)
              .map((el) => Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2));
            const bases = tds.map((td) => Math.round(td.getBoundingClientRect().bottom));
            return new Set(centros).size === 1 && new Set(bases).size === 1 ? null : i + 1;
          })
          .filter(Boolean)
      );
      ok(desalinhadas.length === 0, `${tema} ${largura}px: Ordens, controles de cada linha alinhados e borda inteira ${desalinhadas.length ? 'linhas ' + desalinhadas : ''}`);
      // Acima de 720px o topo é uma linha só: o painel de entrada do Ordens gruda a 59px.
      if (largura > 720) {
        const alturaDoTopo = await pagina.$eval('.casca-topo', (t) => t.getBoundingClientRect().height);
        ok(alturaDoTopo <= 60, `${tema} ${largura}px: o topo, com todas as abas, fica numa linha só (${Math.round(alturaDoTopo)}px)`);
      }

      // O e-mail copiado entra na Fila do dia.
      await pagina.locator('[data-copiar="email"]').first().click();
      await pagina.keyboard.press(altDe('fila'));
      await pagina.click('[data-pasta="enviados"]');
      await pagina.waitForSelector('.fl-linha');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Fila do dia, a pasta Enviados com um e-mail, sem rolagem lateral`);
      await pagina.keyboard.press(altDe('fundos'));
      await pagina.waitForSelector('.fu-topo');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Prateleira de fundos, sem a captura, sem rolagem lateral`);

      await pagina.keyboard.press(altDe('rendafixa'));
      await pagina.setInputFiles('[data-rf="entrada-arquivo"]', planilhaSintetica);
      await pagina.waitForSelector('.rf-secao');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Renda Fixa, cartões, sem rolagem lateral`);
      await pagina.keyboard.press('v');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Renda Fixa, mensagem, sem rolagem lateral`);

      await pagina.keyboard.press(altDe('calendario'));
      await adicionarColaborador(pagina, 'Colaborador de Nome Bem Comprido Teste');
      await pagina.locator('.cal-dia').first().click();
      await pagina.check('[data-cal="presencial"]');
      await pagina.click('[data-cal="salvar"]');
      await pagina.waitForFunction(() => !document.querySelector('.cal-dialogo').open);
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Calendário, semana, sem rolagem lateral`);
      await pagina.click('[data-visao="historico"]');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Calendário, histórico, sem rolagem lateral`);

      await pagina.keyboard.press(altDe('operacional'));
      await pagina.waitForSelector('.op-grupo');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Operacional, início, sem rolagem lateral`);
      await pagina.click('.op-linha >> nth=0');
      await pagina.waitForSelector('.op-texto');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Operacional, post aberto, sem rolagem lateral`);
      await pagina.click('[data-acao="editar"]');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Operacional, editor, sem rolagem lateral`);
      await pagina.click('[data-acao="cancelar"]');

      await pagina.keyboard.press(altDe('anotacoes'));
      await pagina.waitForSelector('.an-lateral', { state: 'visible' });
      await pagina.click('[data-an="nova"]');
      await pagina.waitForSelector('[data-campo="titulo"]', { state: 'visible' });
      await pagina.fill('[data-campo="titulo"]', 'Anotação de um título bem comprido para ver se cabe na tela do celular');
      await pagina.click('[data-atalho="2-dias"]');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Anotações, anotação aberta com lembrete, sem rolagem lateral`);

      const abas = await pagina.$$eval('.aba', (as) => as.map((a) => a.getBoundingClientRect().right));
      ok(Math.max(...abas) <= (largura <= 720 ? largura - 15 : largura), `${tema} ${largura}px: as abas cabem dentro da margem`);

      if (tema === 'escuro' && largura === 1400) {
        await pagina.keyboard.press(altDe('calendario'));
        await pagina.click('[data-visao="semana"]');
        const vazamentos = await pagina.evaluate((seletores) => {
          const achados = [];
          for (const raizModulo of ['#modulo-fila', '#modulo-fundos', '#modulo-rendafixa', '#modulo-calendario', '#modulo-operacional', '#modulo-anotacoes']) {
            const alvo = document.querySelector(raizModulo);
            for (const s of seletores) {
              let n = 0;
              try {
                n = alvo.querySelectorAll(s).length;
              } catch {
                continue;
              }
              if (n) achados.push(`${raizModulo}: ${s} (${n})`);
            }
          }
          return achados;
        }, seletoresDoOrdens);
        ok(vazamentos.length === 0, `nenhum dos ${seletoresDoOrdens.length} seletores do CSS do Ordens pega elemento das outras abas ${vazamentos.length ? JSON.stringify(vazamentos) : ''}`);
      }

      ok(erros.length === 0, `${tema} ${largura}px: console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
      await pagina.screenshot({ path: join(temporario, `calendario-${tema}-${largura}.png`), fullPage: true });
      await contexto.close();
    }
  }

  /* ── Renda Fixa: colar e comparar com o golden ──────────────────────────────────── */
  titulo('Renda Fixa: texto da tela colado e comparado com o golden');
  for (const { nome, arquivo } of planilhas) {
    const { pagina, contexto, erros } = await abrir({ hash: '#rendafixa', relogio: DATA_GOLDEN });
    await pagina.setInputFiles('[data-rf="entrada-arquivo"]', arquivo);
    await pagina.waitForSelector('[data-rf="corpo"] .rf-secao, [data-rf="corpo"] .empty-state button');
    for (const modo of ['primario', 'secundario']) {
      if (modo === 'secundario') await pagina.click('[data-mercado="secundario"]');
      // A cópia é assíncrona: espera o botão confirmar antes de colar, senão cola a anterior.
      await pagina.waitForFunction(() => document.querySelector('[data-rf="copiar"]').textContent === 'Copiar mensagem');
      await pagina.click('[data-rf="copiar"]');
      await pagina.waitForFunction(() => document.querySelector('[data-rf="copiar"]').textContent === 'Copiada');
      await pagina.keyboard.press(altDe('ordens'));
      await pagina.fill('#entrada', '');
      await pagina.focus('#entrada');
      await pagina.keyboard.press('Control+V');
      const colado = await pagina.inputValue('#entrada');
      await pagina.fill('#entrada', '');
      await pagina.keyboard.press(altDe('rendafixa'));
      ok(colado === golden(nome, modo).texto, `${nome} (${modo}): texto colado = golden`);
    }
    ok(erros.length === 0, `${nome}: console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
    await contexto.close();
  }

  // A repaginação de 21/10/2026: copiar uma seção só, a linha que acende o ponto do gráfico, o
  // destaque que leva à seção e a contagem de cada mercado no seletor.
  titulo('Renda Fixa: os destaques, copiar uma seção e o gráfico ligado às linhas');
  {
    const { pagina, contexto, erros } = await abrir({ hash: '#rendafixa', relogio: DATA_GOLDEN });
    await pagina.setInputFiles('[data-rf="entrada-arquivo"]', planilhaSintetica);
    await pagina.waitForSelector('[data-rf="corpo"] .rf-secao');
    const [tituloDaMensagem, primeiroBloco] = golden('sintetica', 'primario').texto.split('\n\n');
    const secao = await pagina.$eval('.rf-secao', (s) => s.dataset.sec);
    await pagina.click(`.rf-secao[data-sec="${secao}"] .rf-copiar-secao`);
    await pagina.waitForSelector(`.rf-secao[data-sec="${secao}"] .rf-copiar-secao.copiado`);
    await pagina.keyboard.press(altDe('ordens'));
    await pagina.fill('#entrada', '');
    await pagina.focus('#entrada');
    await pagina.keyboard.press('Control+V');
    const trecho = await pagina.inputValue('#entrada');
    await pagina.fill('#entrada', '');
    await pagina.keyboard.press(altDe('rendafixa'));
    ok(trecho === `${tituloDaMensagem}\n\n${primeiroBloco.trimEnd()}`, '"Copiar" de uma seção leva o título e só o bloco dela, como na mensagem');

    if (await pagina.$('.rf-secao .rf-curva circle[data-i="1"]')) {
      await pagina.hover('.rf-secao .rf-linha[data-i="1"]');
      ok(await pagina.$eval('.rf-secao .rf-curva circle[data-i="1"]', (c) => c.classList.contains('rf-par')), 'passar o mouse na linha acende o ponto dela no gráfico');
    }
    await pagina.click(`.rf-destaque[data-sec="${secao}"]`);
    ok(await pagina.$eval(`.rf-secao[data-sec="${secao}"]`, (s) => s.classList.contains('rf-acesa')), 'o destaque leva à seção, que acende');

    // A imagem para o WhatsApp e o simulador de pré-fixado (21/10/2026).
    const [download] = await Promise.all([pagina.waitForEvent('download', { timeout: 10_000 }), pagina.click('[data-rf="imagem"]')]);
    const caminhoDaImagem = await download.path();
    const png = readFileSync(caminhoDaImagem);
    ok(
      /^renda-fixa-\d{4}-\d{2}-\d{2}\.png$/.test(download.suggestedFilename()) && png.subarray(1, 4).toString() === 'PNG' && png.length > 10_000,
      `"Baixar imagem" baixa um PNG das oportunidades (${download.suggestedFilename()}, ${Math.round(png.length / 1024)} KB)`
    );
    if (await pagina.$('[data-rf-simulador]')) {
      await pagina.click('[data-rf-simulador] summary');
      await pagina.fill('[data-sim="valor"]', '10.000,00');
      ok((await pagina.textContent('[data-sim="resultado"]')).includes('Líquido'), 'o simulador de pré-fixado mostra o bruto, o IR e o líquido do valor digitado');
    } else ok(false, 'a planilha sintética tem pré-fixado com vencimento, para o simulador');

    const contas = await pagina.$$eval('.rf-conta', (selos) => selos.map((s) => s.textContent));
    const esperadas = ['primario', 'secundario'].map((modo) => String(golden('sintetica', modo).resultado.totais.exibidos));
    ok(JSON.stringify(contas) === JSON.stringify(esperadas), `cada mercado mostra quantas oportunidades tem (${contas.join(' e ')})`);
    ok(erros.length === 0, `console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
    await contexto.close();
  }

  /* ── Renda Fixa: as regras de cada mercado ──────────────────────────────────────────── */
  // A gaveta "Regras" (21/10/2026): o que muda vale na hora na mensagem; o inválido fica em vermelho e
  // não vale; a configuração vai a um colega por texto; e fica no navegador depois de recarregar.
  titulo('Renda Fixa: as regras de cada mercado');
  {
    const { pagina, contexto, erros } = await abrir({ hash: '#rendafixa', relogio: DATA_GOLDEN });
    await pagina.setInputFiles('[data-rf="entrada-arquivo"]', planilhaSintetica);
    await pagina.waitForSelector('[data-rf="corpo"] .rf-secao');
    ok(await pagina.isHidden('[data-rf="selo-regras"]'), 'no padrão, sem o selo de regras personalizadas');

    await pagina.click('[data-rf="abrir-regras"]');
    await pagina.waitForSelector('.rf-regras[open] [data-regra="filtros.puMaximo"]');
    ok(
      (await pagina.textContent('[data-rf-regras="previa"]')) === golden('sintetica', 'primario').texto,
      'a gaveta abre no mercado aberto, com a mensagem do padrão (a mesma do golden) ao lado'
    );

    // O emissor na emissão primária: vale na hora, na prévia e na mensagem da aba.
    await pagina.check('[data-regra="mensagem.mostrarEmissor"]');
    const comEmissor = (await pagina.textContent('[data-rf-regras="previa"]')) ?? '';
    ok(/a\.a\. \([A-Z]/.test(comEmissor), 'ligar o emissor põe o emissor nas linhas da prévia, na hora');

    // Um prazo inválido: vermelho, com o motivo, e a regra boa continua valendo.
    await pagina.fill('[data-regra="prazos.pre"]', '1, dois');
    ok(
      (await pagina.getAttribute('[data-regra="prazos.pre"]', 'aria-invalid')) === 'true' &&
        (await pagina.isVisible('[data-erro="prazos.pre"]')) &&
        (await pagina.textContent('[data-rf-regras="previa"]')) === comEmissor,
      'um prazo inválido fica em vermelho, com o motivo, e não muda a mensagem'
    );
    await pagina.fill('[data-regra="prazos.pre"]', '1, 2');
    const soDoisPrazos = (await pagina.textContent('[data-rf-regras="previa"]')) ?? '';
    ok(soDoisPrazos.includes('-> 2 anos') && !soDoisPrazos.includes('-> 3 anos - CDB 14,70%'), 'corrigido, o prazo vale: só 1 e 2 anos nas pré-fixadas');

    // Copiar a configuração e colá-la de volta depois de restaurar: tudo volta.
    await pagina.click('[data-acao="copiar-config"]');
    const configuracao = await pagina.evaluate(() => navigator.clipboard.readText());
    ok(configuracao.startsWith('MESA XP · Renda Fixa · regras v1'), '"Copiar configuração" copia o texto para mandar a um colega');
    await pagina.click('[data-acao="restaurar-tudo"]');
    ok((await pagina.textContent('[data-rf-regras="previa"]')) === golden('sintetica', 'primario').texto, '"Restaurar o padrão" volta a mensagem do padrão');
    await pagina.click('[data-acao="colar-config"]');
    await pagina.fill('[data-rf-regras="colar-texto"]', configuracao);
    await pagina.click('[data-acao="conferir-colar"]');
    const resumo = (await pagina.textContent('[data-rf-regras="colar-resumo"]')) ?? '';
    ok(resumo.includes('Mostrar o emissor') && resumo.includes('Prazos das pré-fixadas'), 'ao colar, a gaveta mostra o que vai mudar antes de aplicar');
    await pagina.click('[data-acao="aplicar-colar"]');
    ok((await pagina.textContent('[data-rf-regras="previa"]')) === soDoisPrazos, '"Aplicar" põe a configuração colada');

    await pagina.click('.rf-regras [data-fechar]');
    await pagina.click('[data-rf="copiar"]');
    await pagina.waitForSelector('[data-rf="copiar"].copiado');
    // O Windows devolve a área de transferência com \r\n; o texto é o mesmo.
    ok((await pagina.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n') === soDoisPrazos, '"Copiar mensagem" leva a mensagem das regras novas');
    ok(
      (await pagina.isVisible('[data-rf="selo-regras"]')) && (await pagina.textContent('[data-rf="selo-regras"]')) === 'regras personalizadas · 2',
      'o selo diz que as regras do mercado não são as do padrão, e quantas'
    );

    // O secundário tem as regras dele: o padrão.
    await pagina.click('[data-rf="mercado"] [data-mercado="secundario"]');
    ok(await pagina.isHidden('[data-rf="selo-regras"]'), 'o secundário tem as regras dele, no padrão');

    // Recarregar: as regras ficam no navegador.
    await pagina.reload();
    await pagina.setInputFiles('[data-rf="entrada-arquivo"]', planilhaSintetica);
    await pagina.waitForSelector('[data-rf="corpo"] .rf-secao');
    ok((await pagina.textContent('[data-rf="selo-regras"]')) === 'regras personalizadas · 2', 'recarregada a página, as regras continuam (no navegador)');
    ok(erros.length === 0, `console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
    await contexto.close();
  }

  /* ── Fila do dia ────────────────────────────────────────────────────────────────── */
  // O caminho de um pedido (21/10/2026): o e-mail copiado no Ordens vira cartão, o mesmo pedido
  // colado de novo bloqueia como repetido, o prazo perto acende o contador da aba, aprovar dá a
  // ficha de execução, executar fecha, o resumo do dia sai copiado, recarregar não perde nada e o
  // "Anotar" leva às Anotações com o pedido escrito. Uma quarta-feira, às 16h10: o leilão da B3, às
  // 16h55, está a menos de uma hora.
  titulo('Fila do dia: do e-mail copiado ao executado');
  {
    const { pagina, contexto, erros } = await abrir({ relogio: '2026-10-21T16:10:00-03:00' });
    const areaDeTransferencia = () => pagina.evaluate(() => navigator.clipboard.readText());
    // A caixa limpa (21/10/2026): o e-mail enviado vai para a pasta Enviados; à vista fica só
    // Aprovação e execução, e o contador da aba conta o que está nela.
    await pagina.click('#presets [data-exemplo="Bolsa · compra e venda"]');
    await pagina.locator('[data-copiar="email"]').first().click();
    await pagina.waitForTimeout(400);
    ok(await pagina.$eval('[data-contador="fila"]', (c) => c.hidden), 'o e-mail copiado vai para Enviados, sem acender a aba Fila: nada para executar ainda');

    await pagina.click('#presets [data-exemplo="Bolsa · compra e venda"]');
    await pagina.waitForSelector('.alert-danger');
    ok(
      (await pagina.textContent('#solicitacoes')).includes('já saiu hoje para esta conta'),
      'o mesmo pedido colado de novo bloqueia como repetido de hoje, com o confirmar à vista'
    );

    await pagina.keyboard.press(altDe('fila'));
    await pagina.waitForSelector('[data-pasta="enviados"]');
    ok(
      (await pagina.textContent('[data-fl="lista"]')).includes('Quando o cliente responder') && (await pagina.$eval('[data-pasta="executar"]', (b) => b.getAttribute('aria-pressed'))) === 'true',
      'a Fila abre em Aprovação e execução, limpa: o enviado não aparece nela'
    );
    ok(
      (await pagina.textContent('[data-pasta="enviados"] b')) === '1' && Boolean(await pagina.$('[data-pasta="enviados"] .fl-pasta-alerta')),
      'a pasta Enviados conta o e-mail, com o ponto âmbar do prazo perto (leilão em 45 min)'
    );
    await pagina.click('[data-pasta="enviados"]');
    await pagina.waitForSelector('.fl-linha');
    ok((await pagina.textContent('.fl-linha')).includes('KLBN11') && (await pagina.$eval('.fl-linha .fl-prazo', (p) => p.dataset.situacao)) === 'perto', 'em Enviados, uma linha por e-mail, com os ativos e o prazo âmbar');

    // O cliente aprovou por outro canal: "Aprovou" leva o pedido para Aprovação e execução.
    await pagina.click('.fl-linha [data-estado="aprovado"]');
    await pagina.waitForFunction(() => document.querySelector('[data-contador="fila"]') && !document.querySelector('[data-contador="fila"]').hidden, null, { timeout: 5000 }).catch(() => {});
    ok((await pagina.textContent('[data-contador="fila"]')) === '1', '"Aprovou" leva o pedido para Aprovação e execução, e a aba conta 1');
    await pagina.click('[data-pasta="executar"]');
    const cartao = '.fl-cartao';
    await pagina.waitForSelector(cartao);
    ok((await pagina.textContent(cartao)).includes('Aprovado por você'), 'em Aprovação e execução, o pedido diz que foi aprovado por você');
    // Na bolsa, "Gerar lote" (21/10/2026): o Lote Simples e o TWAP com as quantidades do e-mail. A
    // ordem em R$ (VULC3) não cabe no Lote Simples; o TWAP a leva em R$.
    await pagina.click(`${cartao} [data-acao="lote"]`);
    await pagina.waitForSelector('.fl-janela[open] .fl-lote');
    ok(
      (await pagina.textContent('.fl-lote[data-formato="simples"]')).includes('VULC3 está em R$. Use o Lote TWAP.'),
      '"Gerar lote": o Lote Simples diz que a ordem em R$ não cabe nele'
    );
    await pagina.click('[data-acao="copiar-lote"][data-formato="twap"]');
    const twap = await areaDeTransferencia();
    ok(
      twap.startsWith('Estratégia\tCliente\tAtivo') && twap.includes('TWAP\t1234567\tKLBN11\tV\t674\t') && twap.includes('TWAP\t1234567\tVULC3\tC\t\tR$ 11.800,00'),
      'e o Lote TWAP sai copiado, com a quantidade do e-mail aprovado e a ordem em R$'
    );
    ok((await pagina.textContent('.fl-lote-ficha pre')).startsWith('EXECUTAR · conta 1234567'), 'a ficha do pedido fica embaixo do lote');
    await pagina.click('.fl-janela [data-fechar]');

    await pagina.click(`${cartao} [data-estado="executado"]`);
    await pagina.waitForFunction(() => !document.querySelector('[data-fl="lista"] .fl-cartao'), null, { timeout: 5000 }).catch(() => {});
    ok(
      !(await pagina.$('[data-fl="lista"] .fl-cartao')) && (await pagina.textContent('[data-pasta="executados"] b')) === '1',
      'Executado tira o pedido da caixa e o põe na pasta Executados'
    );
    await pagina.click('[data-fl="resumo"]');
    ok((await areaDeTransferencia()).startsWith('21/10/2026: 1 pedido — 1 executado.'), 'o resumo do dia sai copiado');

    await pagina.reload();
    await pagina.keyboard.press(altDe('fila'));
    await pagina.waitForSelector('[data-pasta="executados"]');
    await pagina.click('[data-pasta="executados"]');
    await pagina.waitForSelector('.fl-linha');
    ok((await pagina.textContent('.fl-linha')).includes('executado'), 'recarregar a página não perde o pedido (IndexedDB), e ele está em Executados');

    await pagina.click('.fl-linha [data-acao="anotar"]');
    await pagina.waitForSelector('[data-campo="titulo"]', { state: 'visible' });
    ok(
      (await pagina.evaluate(() => location.hash)) === '#anotacoes/nova' && (await pagina.inputValue('[data-campo="titulo"]')).startsWith('Conta 1234567'),
      '"Anotar" abre uma anotação nova com o pedido escrito, sem a conta no endereço'
    );
    ok(erros.length === 0, `console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
    await contexto.close();
  }

  /* ── O topo: os horários do mercado e a busca ───────────────────────────────────── */
  // Uma quarta-feira às 13h10: o que fecha primeiro é o Estoque clientes, às 14h.
  titulo('O topo: os horários do mercado e a busca (Ctrl+K)');
  {
    const { pagina, contexto, erros } = await abrir({ relogio: '2026-10-21T13:10:00-03:00' });
    ok(
      (await pagina.textContent('#btn-relogio .relogio-nome')) === 'Estoque clientes' && (await pagina.textContent('#btn-relogio .relogio-falta')) === '50 min',
      'o topo mostra o que fecha primeiro: o Estoque clientes, em 50 min'
    );
    await pagina.click('#btn-relogio');
    ok((await pagina.$$eval('#relogio-painel li', (l) => l.length)) === 4 && (await pagina.isVisible('#relogio-painel')), 'no clique, os quatro horários do dia');
    await pagina.keyboard.press('Escape');

    await pagina.keyboard.press('Control+k');
    await pagina.waitForSelector('#busca[open]');
    await pagina.fill('#busca-termo', 'tabela cetipados');
    await pagina.waitForFunction(() => document.querySelector('.busca-item.ativo .busca-titulo')?.textContent === 'Tabela de Cetipados', null, { timeout: 5000 }).catch(() => {});
    ok((await pagina.textContent('.busca-item.ativo .busca-titulo')) === 'Tabela de Cetipados', 'Ctrl+K acha o modelo do Operacional pelo nome');
    await pagina.keyboard.press('Enter');
    await pagina.waitForFunction(() => location.hash.startsWith('#operacional/post/'), null, { timeout: 5000 }).catch(() => {});
    ok((await pagina.evaluate(() => location.hash)).startsWith('#operacional/post/') && !(await pagina.$('#busca[open]')), 'Enter abre o post, e a busca fecha');

    await pagina.keyboard.press('Control+k');
    await pagina.fill('#busca-termo', 'fila');
    await pagina.waitForFunction(() => document.querySelector('.busca-item.ativo .busca-titulo')?.textContent === 'Ir para Fila do dia');
    await pagina.keyboard.press('Enter');
    await pagina.waitForFunction(() => !document.getElementById('modulo-fila').hidden, null, { timeout: 5000 }).catch(() => {});
    ok(!(await pagina.$eval('#modulo-fila', (s) => s.hidden)), 'e leva às abas');
    ok(erros.length === 0, `console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
    await contexto.close();
  }

  /* ── Calendário em modo local ───────────────────────────────────────────────────── */
  titulo('Calendário em modo local: escape, janela do dia, histórico, cascata');
  {
    const { pagina, contexto, erros } = await abrir({ hash: '#calendario' });
    const rede = [];
    pagina.on('request', (r) => /^https?:/.test(r.url()) && rede.push(r.url()));
    ok((await pagina.textContent('[data-cal="conexao"]')).includes('modo local'), 'o build com as variáveis vazias está em modo local');

    const XSS = '<img src=x onerror=window.__xss=1>';
    await adicionarColaborador(pagina, XSS);
    await adicionarColaborador(pagina, 'Ana Teste');
    ok((await pagina.evaluate(() => window.__xss)) === undefined, 'nome com <img onerror>: o código não rodou');
    ok((await pagina.$$eval('#modulo-calendario img', (i) => i.length)) === 0, 'nome com <img onerror>: nenhum <img> criado');
    ok(await pagina.$$eval('.cal-nome', (es, n) => es.some((e) => e.textContent === n), XSS), 'nome com <img onerror>: aparece como texto');

    const celula = pagina.locator('.cal-linha', { hasText: 'Ana Teste' }).locator('.cal-dia').first();
    await celula.click();
    ok(await pagina.$eval('.cal-dialogo', (d) => d.matches(':modal')), 'a janela do dia é um <dialog> modal');
    // O horário inválido avisa dentro da janela, e não atrás do véu (22/10/2026).
    await pagina.fill('[data-cal="inicio"]', '15:00');
    await pagina.fill('[data-cal="fim"]', '14:00');
    await pagina.click('[data-cal="adicionar-horario"]');
    ok(
      await pagina.$eval('.cal-dialogo', (d) => {
        const alerta = d.querySelector('[data-cal="erro-horario"] .alert');
        if (!alerta || !alerta.textContent.includes('depois do inicial')) return false;
        const a = alerta.getBoundingClientRect();
        const j = d.getBoundingClientRect();
        return a.height > 0 && a.top >= j.top && a.bottom <= j.bottom;
      }),
      'horário final antes do inicial: o aviso aparece dentro da janela do dia'
    );
    ok((await pagina.$$eval('.cal-horarios li', (l) => l.length)) <= 1, 'o horário inválido não entra na lista');
    await pagina.check('[data-cal="presencial"]');
    await pagina.fill('[data-cal="observacao"]', 'obs <b>teste</b>');
    await pagina.fill('[data-cal="inicio"]', '14:00');
    await pagina.fill('[data-cal="fim"]', '15:00');
    await pagina.fill('[data-cal="motivo"]', 'motivo <i>teste</i>');
    await pagina.press('[data-cal="motivo"]', 'Enter');
    ok((await pagina.$$eval('[data-cal="erro-horario"] .alert', (a) => a.length)) === 0, 'o horário certo some com o aviso');
    await pagina.click('[data-cal="salvar"]');
    await pagina.waitForFunction(() => !document.querySelector('.cal-dialogo').open);
    const texto = await celula.innerText();
    ok(texto.includes('Presencial') && texto.includes('14:00–15:00') && !texto.includes('motivo'), 'a célula mostra presencial e o horário, sem o motivo');
    ok((await pagina.$$eval('tfoot td', (tds) => tds.map((t) => t.textContent)))[0] === '1', 'o rodapé soma um presencial no dia');

    await pagina.click('[data-visao="historico"]');
    const historico = await pagina.innerText('[data-cal="historico"]');
    ok(historico.includes('obs <b>teste</b>') && historico.includes('motivo <i>teste</i>'), 'o histórico mostra observação e motivo como texto');
    await pagina.selectOption('[data-cal="filtro"]', { label: 'Ana Teste' });
    ok((await pagina.$$eval('.cal-semana-hist:first-child tbody tr', (l) => l.length)) === 1, 'o filtro do histórico mostra só a pessoa escolhida');

    await pagina.click('[data-visao="semana"]');
    await pagina.click(`.cal-linha:has-text("Ana Teste") .cal-remover`);
    await pagina.waitForFunction(() => document.querySelectorAll('.cal-linha').length === 1);
    const dados = await pagina.evaluate(() => JSON.parse(localStorage.getItem('presenca_app_data')));
    ok(Object.keys(dados.entries).length === 0, 'remover o colaborador apaga os registros dele');
    ok(rede.length === 0, `o modo local não faz requisição de rede ${rede.length ? JSON.stringify(rede) : ''}`);
    ok(erros.length === 0, `console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
    await contexto.close();
  }

  /* ── Operacional em modo local ──────────────────────────────────────────────────── */
  titulo('Operacional em modo local: copiar, editar, criar, excluir, buscar, conflito');
  {
    const { pagina, contexto, erros } = await abrir({ hash: '#operacional' });
    const rede = [];
    pagina.on('request', (r) => /^https?:/.test(r.url()) && rede.push(r.url()));
    await pagina.waitForSelector('.op-grupo');
    ok((await pagina.textContent('[data-op="conexao"]')).includes('modo local'), 'o build com as variáveis vazias está em modo local');
    ok((await pagina.$$eval('.op-grupo', (g) => g.length)) === 5, 'o início agrupa os posts nos cinco tópicos, como o Slab');
    const contagem = (nome) => pagina.$eval(`.op-arvore .op-no:has-text("${nome}") .op-contagem`, (e) => e.textContent);
    ok((await contagem('Padrões de Email')) === '14' && (await contagem('Padrões de Fixing')) === '12', 'a árvore conta os posts de cada tópico');

    // Usar este modelo (21/10/2026): os marcadores viram campos, a prévia acompanha, e o texto sai
    // preenchido para copiar ou abrir no Outlook (a janela é anotada no lugar de abrir).
    {
      const resgate = POSTS.find((p) => p.titulo === 'Confirmação resgate Tesouro Direto');
      await pagina.evaluate(() => {
        window.__abertas = [];
        window.open = (endereco) => (window.__abertas.push(endereco), {});
      });
      await pagina.evaluate((slug) => (location.hash = `#operacional/post/${slug}`), resgate.slug);
      await pagina.click('[data-acao="usar"]');
      await pagina.fill('[data-usar-campo="cliente"]', 'FULANA DE TAL');
      await pagina.fill('[data-usar-campo="conta"]', '1234567');
      ok(
        (await pagina.textContent('[data-op="previa"]')).includes('Prezado(a) FULANA DE TAL,') && (await pagina.textContent('[data-op="faltam"]')).startsWith('3 campos em branco'),
        '"Usar este modelo": o cliente e a conta entram na prévia, e os campos em branco são contados'
      );
      await pagina.click('[data-acao="usar-copiar"]');
      const preenchido = await pagina.evaluate(() => navigator.clipboard.readText());
      ok(preenchido.includes('na conta XP 1234567') && preenchido.includes('Título: XXXXXXX'), 'Copiar leva o texto preenchido, e o campo em branco sai como no modelo');
      await pagina.fill('[data-usar="para"]', 'fulana@exemplo.com');
      await pagina.click('[data-acao="usar-outlook"]');
      const [aberta] = await pagina.evaluate(() => window.__abertas);
      ok(
        decodeURIComponent(decodeURIComponent(aberta ?? '')).includes('mailto:fulana@exemplo.com') && decodeURIComponent(decodeURIComponent(aberta ?? '')).includes('subject=Confirmação resgate Tesouro Direto'),
        'Abrir no Outlook leva o texto, o destinatário e o título do post como assunto'
      );
      await pagina.click('[data-acao="usar-fechar"]');
      ok(await pagina.isVisible('.op-post .op-texto') && !(await pagina.$('[data-op="usar"]')), 'Fechar volta ao post');
      await pagina.evaluate(() => (location.hash = '#operacional'));
      await pagina.waitForSelector('.op-grupo');
    }

    // Copiar e colar: o texto que vai para o e-mail é o do Slab.
    const compra = POSTS.find((p) => p.slug === 'confirmacao-de-ordem-compra');
    await pagina.click(`.op-linha:has-text("${compra.titulo}")`);
    await pagina.waitForSelector('[data-acao="copiar"]');
    await pagina.click('[data-acao="copiar"]');
    await pagina.waitForFunction(() => document.querySelector('[data-acao="copiar"]').textContent === 'Copiado');
    await pagina.keyboard.press(altDe('ordens'));
    await pagina.fill('#entrada', '');
    await pagina.focus('#entrada');
    await pagina.keyboard.press('Control+V');
    ok((await pagina.inputValue('#entrada')) === compra.conteudo, '"Copiar texto" copia exatamente o texto do Slab (colado com Ctrl+V)');
    await pagina.fill('#entrada', '');
    await pagina.keyboard.press(altDe('operacional'));

    // Editar um post pendente e ver que ficou gravado.
    await pagina.goto(pathToFileURL(distLocal).href + '#operacional/post/rubi');
    await pagina.waitForSelector('.op-vazio');
    await pagina.click('[data-acao="editar"]');
    await pagina.fill('[data-op="editor"] textarea', 'Rubi: texto colado do Slab\nsegunda linha');
    await pagina.press('[data-op="editor"] textarea', 'Control+Enter');
    await pagina.waitForSelector('.op-texto');
    ok((await pagina.textContent('.op-texto')) === 'Rubi: texto colado do Slab\nsegunda linha', 'editar e salvar mostra o texto novo, com a quebra de linha');
    await pagina.reload();
    await pagina.waitForSelector('.op-texto');
    ok((await pagina.textContent('.op-texto')).startsWith('Rubi: texto colado'), 'o texto editado continua lá depois de recarregar');

    // Criar post com título malicioso e excluir.
    const XSS = '<img src=x onerror=window.__xss=1>';
    await pagina.goto(pathToFileURL(distLocal).href + '#operacional/topico/disparos');
    await pagina.waitForSelector('[data-acao="criar-post"]');
    await pagina.click('[data-acao="criar-post"]');
    await pagina.fill('[data-op="editor"] input[name="titulo"]', XSS);
    await pagina.fill('[data-op="editor"] textarea', 'texto de teste');
    await pagina.click('[data-op="editor"] button[type="submit"]');
    await pagina.waitForFunction(() => location.hash.startsWith('#operacional/post/'));
    // A página do tópico também tem um .op-titulo ("Disparos"): espera o do post novo, senão a
    // conferência corre na frente do desenho numa máquina lenta (o GitHub, 22/10/2026).
    await pagina.waitForFunction((t) => document.querySelector('.op-titulo')?.textContent === t, XSS, { timeout: 5_000 }).catch(() => null);
    ok((await pagina.textContent('.op-titulo')) === XSS, 'post novo: o título com <img onerror> aparece como texto');
    ok((await pagina.evaluate(() => window.__xss)) === undefined && (await pagina.$$eval('#modulo-operacional img', (i) => i.length)) === 0, 'post novo: o onerror não rodou e nenhum <img> foi criado');
    ok((await contagem('Disparos')) === '4', 'post novo: a árvore passa a contar 4 em Disparos');
    await pagina.click('[data-acao="excluir"]');
    await pagina.waitForFunction(() => location.hash === '#operacional/topico/disparos');
    await pagina.waitForSelector('.op-lista');
    ok((await contagem('Disparos')) === '3' && (await pagina.$$eval('.op-linha', (l) => l.length)) === 3, 'excluir tira o post da lista e da contagem');

    // Novo tópico.
    await pagina.click('[data-op="novo-topico"]');
    ok(await pagina.$eval('.op-dialogo', (d) => d.matches(':modal')), 'novo tópico abre num <dialog> modal');
    await pagina.fill('[data-op="form-topico"] input[name="nome"]', 'Câmbio Teste');
    await pagina.click('[data-op="form-topico"] button[type="submit"]');
    await pagina.waitForFunction(() => document.querySelector('.op-titulo')?.textContent === 'Câmbio Teste');
    ok(await pagina.$eval('.op-arvore', (a) => a.textContent.includes('Câmbio Teste')), 'o tópico novo aparece na árvore, debaixo da raiz');

    // Busca.
    await pagina.fill('[data-op="busca"]', 'tesouro');
    ok((await pagina.$$eval('.op-linha', (l) => l.length)) === 2 && (await pagina.$$eval('.op-linha mark', (m) => m.length)) === 2, 'a busca por "tesouro" acha os dois posts do Tesouro Direto, com o trecho marcado');
    await pagina.press('[data-op="busca"]', 'Escape');
    ok((await pagina.$$eval('.op-linha mark', (m) => m.length)) === 0, 'Esc limpa a busca');

    await pagina.goto(pathToFileURL(distLocal).href + '#operacional/post/nao-existe');
    await pagina.waitForSelector('.op-folha .empty-state');
    ok((await pagina.textContent('.op-folha')).includes('Post não encontrado'), 'link de post que não existe avisa, em vez de tela vazia');

    // Conflito: duas abas com o mesmo post; a segunda a salvar é recusada e não perde o texto.
    const outra = await contexto.newPage();
    await pagina.goto(pathToFileURL(distLocal).href + '#operacional/post/confirmacao-de-ordem-venda');
    await outra.goto(pathToFileURL(distLocal).href + '#operacional/post/confirmacao-de-ordem-venda');
    for (const p of [pagina, outra]) {
      await p.waitForSelector('[data-acao="editar"]');
      await p.click('[data-acao="editar"]');
    }
    await outra.fill('[data-op="editor"] textarea', 'versão da outra aba');
    await outra.click('[data-op="editor"] button[type="submit"]');
    await outra.waitForSelector('.op-texto');
    await pagina.fill('[data-op="editor"] textarea', 'versão desta aba');
    await pagina.click('[data-op="editor"] button[type="submit"]');
    await pagina.waitForSelector('[data-op="aviso-editor"] .alert-danger');
    ok((await pagina.textContent('[data-op="aviso-editor"]')).includes('Outra pessoa alterou'), 'conflito: quem salvou depois é avisado');
    ok((await pagina.inputValue('[data-op="editor"] textarea')) === 'versão desta aba', 'conflito: o texto de quem foi recusado continua no editor');
    await outra.reload();
    await outra.waitForSelector('.op-texto');
    ok((await outra.textContent('.op-texto')) === 'versão da outra aba', 'conflito: a versão salva primeiro não foi sobrescrita');
    await outra.close();

    ok(rede.length === 0, `o modo local não faz requisição de rede ${rede.length ? JSON.stringify(rede) : ''}`);
    ok(erros.length === 0, `console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
    await contexto.close();
  }

  /* ── Anotações ──────────────────────────────────────────────────────────────────── */
  titulo('Anotações: lembrete amarelo e vermelho, alerta em outra aba, prints, backup');
  {
    // Relógio instalado (e não só parado): os timers do vigia andam com o fastForward.
    const contexto = await navegador.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' });
    await contexto.clock.install({ time: new Date('2026-09-30T10:05:00-03:00') });
    const pagina = await contexto.newPage();
    const erros = [];
    pagina.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
    pagina.on('pageerror', (e) => erros.push(String(e)));
    pagina.on('dialog', (d) => d.accept());
    const rede = [];
    pagina.on('request', (r) => /^https?:/.test(r.url()) && rede.push(r.url()));

    // Um print de verdade: a planilha sintética não serve, então um PNG desenhado no canvas.
    const print = join(temporario, 'print.png');
    writeFileSync(
      print,
      Buffer.from(
        await pagina.evaluate(() => {
          const c = Object.assign(document.createElement('canvas'), { width: 200, height: 120 });
          c.getContext('2d').fillRect(10, 10, 100, 50);
          return c.toDataURL('image/png').split(',')[1];
        }),
        'base64'
      )
    );

    const status = () => pagina.textContent('[data-an="status"] .an-status-texto');
    await pagina.goto(pathToFileURL(distLocal).href + '#anotacoes');
    await pagina.waitForSelector('[data-an="editor"]');
    await pagina.keyboard.press('n');
    // O título já está na tela antes do N (a aba abre com uma anotação nova pronta); o foco vai para ele
    // no quadro seguinte à troca de endereço. Olhar uma vez só, logo depois, falhava de vez em quando.
    const focouNoTitulo = await pagina
      .waitForFunction(() => document.activeElement?.dataset.campo === 'titulo', null, { timeout: 5000 })
      .then(() => true, () => false);
    ok(focouNoTitulo, 'N abre uma anotação nova com o cursor no título');
    await pagina.keyboard.type('Estorno do dia 25 <img src=x onerror=window.__xss=1>');
    await pagina.fill('[data-campo="texto"]', 'Ver https://hub.xpi.com.br/relatorios?conta=1234567 e javascript:alert(1)\n[ ] pedir o estorno');
    await pagina.fill('[data-campo="etiqueta"]', 'estorno');
    await pagina.press('[data-campo="etiqueta"]', 'Enter');
    await pagina.click('[data-atalho="2-dias"]');
    await pagina.setInputFiles('[data-an="arquivo"]', print);
    await pagina.waitForSelector('.an-anexo-novo img[src^="blob:"]');
    ok((await status()) === 'Alterações não salvas' && (await pagina.$$('.an-cartao')).length === 0, 'antes de Salvar, o selo avisa e nada vai para a lista');

    // Ctrl+S salva e continua na anotação.
    await pagina.keyboard.press('Control+s');
    await pagina.waitForFunction(() => document.querySelector('[data-an="editor"]')?.dataset.gravacao === 'salvo');
    ok(
      (await status()).startsWith('Salvo às') &&
        (await pagina.textContent('.an-lembrete .an-selo')) === 'Lembrar sex 02/10' &&
        (await pagina.$eval('.an-cartao:has([aria-current="true"])', (c) => c.classList.contains('an-pendente'))),
      'Ctrl+S salva: "Salvo às", e a anotação fica amarela na lista, com o lembrete'
    );
    ok((await pagina.$$eval('.an-link-externo', (l) => l.map((a) => a.href))).join() === 'https://hub.xpi.com.br/relatorios?conta=1234567', 'o link http vira botão; o javascript: não');
    ok((await pagina.evaluate(() => window.__xss)) === undefined && (await pagina.$$eval('.an-lista img', (l) => l.length)) === 0, 'título com <img onerror> fica texto na lista');
    ok((await pagina.$$eval('.an-miniatura:not(.an-anexo-novo) img[src^="blob:"]', (l) => l.length)) === 1, 'o print foi gravado junto com a anotação');

    // Lembrete para hoje às 10:30; o botão Salvar grava e abre uma anotação nova.
    await pagina.fill('[data-campo="data"]', '2026-09-30');
    await pagina.dispatchEvent('[data-campo="data"]', 'change');
    await pagina.fill('[data-campo="hora"]', '10:30');
    await pagina.dispatchEvent('[data-campo="hora"]', 'change');
    await pagina.click('[data-acao="salvar"]');
    const abriuNova = await pagina
      .waitForFunction(() => location.hash === '#anotacoes/nova' && document.querySelector('[data-an="editor"]')?.classList.contains('an-editor-nova'), null, { timeout: 5000 })
      .then(() => true, () => false);
    ok(abriuNova && (await pagina.inputValue('[data-campo="titulo"]')) === '', 'Salvar grava e abre uma anotação nova, em branco');
    const contadorHoje = await pagina.waitForFunction(() => document.querySelector('[data-contador="anotacoes"]')?.textContent === '1', null, { timeout: 5000 }).then(() => true, () => false);
    ok(contadorHoje && !(await pagina.$eval('[data-contador="anotacoes"]', (c) => c.classList.contains('vencidas'))), 'lembrete para hoje: contador âmbar na aba');
    await pagina.keyboard.press(altDe('ordens'));
    await contexto.clock.fastForward('26:00');
    await pagina.waitForSelector('.an-alerta', { timeout: 5000 }).catch(() => null);
    ok(Boolean(await pagina.$('.an-alerta')), 'no Ordens, quando a hora chega, o alerta do lembrete aparece');
    ok((await pagina.title()).startsWith('(1) ') && (await pagina.$eval('[data-contador="anotacoes"]', (c) => c.classList.contains('vencidas'))), 'o título da página e o contador da aba ficam em alerta');
    await pagina.click('.an-alerta [data-alerta="abrir"]');
    await pagina.waitForSelector('.an-editor:not(.an-editor-nova)');
    ok(await pagina.$eval('.an-cartao:has([aria-current="true"])', (c) => c.classList.contains('an-vencida')), 'Abrir leva à anotação, vermelha');

    await pagina.reload();
    await pagina.waitForSelector('.an-editor:not(.an-editor-nova)');
    // O print vem do IndexedDB depois do editor: espera os dois, em vez de contar as miniaturas cedo.
    const voltouInteira = await pagina
      .waitForFunction(
        () =>
          document.querySelector('[data-campo="titulo"]')?.value.startsWith('Estorno do dia 25') &&
          document.querySelectorAll('.an-miniatura').length === 1,
        null,
        { timeout: 5000 }
      )
      .then(() => true, () => false);
    ok(voltouInteira, 'depois de recarregar, a anotação e o print continuam lá');
    ok(!(await pagina.$('.an-alerta')), 'o alerta já visto não volta ao recarregar');

    await pagina.click('[data-acao="resolver"]');
    // O contador é do vigia, que relê depois que a gravação termina: espera por ele.
    const contadorSumiu = await pagina.waitForFunction(() => document.querySelector('[data-contador="anotacoes"]').hidden, null, { timeout: 5000 }).then(() => true, () => false);
    ok((await pagina.textContent('[data-filtro="resolvidas"] span')) === '1' && contadorSumiu, 'Resolvido: vai para "Resolvidas" e o contador some');

    const [download] = await Promise.all([pagina.waitForEvent('download'), pagina.click('[data-an="exportar"]')]);
    const backup = JSON.parse(readFileSync(await download.path(), 'utf8'));
    ok(backup.formato === 'mesa-xp-anotacoes' && backup.notas.length === 1 && backup.anexos.length === 1, 'o backup leva a anotação e o print');

    ok(rede.length === 0, `as anotações não fazem requisição de rede ${rede.length ? JSON.stringify(rede) : ''}`);
    ok(await semRolagemLateral(pagina), 'sem rolagem lateral');
    ok(erros.length === 0, `console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
    await contexto.close();
  }

  /* ── Ordens: o robô do Hub ───────────────────────────────────────────────────────── */
  // O lembrete que se repete e o "Anotar" do cartão do Ordens (21/10/2026). Uma quarta, às 10h.
  titulo('Anotações: o lembrete que se repete e o Anotar do Ordens');
  {
    const { pagina, contexto, erros } = await abrir({ relogio: '2026-10-21T10:00:00-03:00' });
    await pagina.fill('#entrada', '1234567\nCOMPRA\nPETR4 100');
    await pagina.click('#btn-analisar');
    await pagina.click('[data-solicitacao="0"] [data-anotar]');
    await pagina.waitForSelector('[data-campo="titulo"]', { state: 'visible' });
    ok(
      (await pagina.inputValue('[data-campo="titulo"]')) === 'Conta 1234567' && (await pagina.inputValue('[data-campo="texto"]')).startsWith('C PETR4 100'),
      '"Anotar" no cartão do Ordens abre uma anotação nova com a conta e as ordens'
    );
    await pagina.fill('[data-campo="data"]', '2026-10-21');
    await pagina.locator('[data-campo="data"]').dispatchEvent('change');
    await pagina.fill('[data-campo="hora"]', '09:00');
    await pagina.locator('[data-campo="hora"]').dispatchEvent('change');
    await pagina.selectOption('[data-campo="repetir"]', 'dias-uteis');
    await pagina.click('[data-acao="salvar"]');
    // Salvar termina abrindo uma anotação nova: só depois disso se abre a salva.
    await pagina.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('Anotação salva')) && !document.querySelector('.an-saindo'));
    // O lembrete das 9h já venceu às 10h: o alerta aparece, e o "Resolvido" dele leva o lembrete a amanhã.
    await pagina.click('.an-alerta [data-alerta="resolver"]');
    const pulouNoAlerta = await pagina
      .waitForFunction(() => document.querySelector('.an-cartao')?.textContent.includes('Lembrar amanhã às 09:00 · todo dia útil'), null, { timeout: 5000 })
      .then(() => true, () => false);
    ok(pulouNoAlerta && !(await pagina.$('.an-cartao.an-resolvida')), '"Resolvido" no alerta do lembrete que se repete o leva ao próximo dia útil, e a anotação continua');
    // E o "Resolvido" da anotação aberta, de novo: quinta → sexta. Pelo endereço do cartão: o meio dele
    // cai na etiqueta, que filtra a lista.
    await pagina.evaluate(() => (location.hash = document.querySelector('.an-cartao-link').getAttribute('href')));
    await pagina.waitForFunction(() => location.hash.startsWith('#anotacoes/nota/'));
    await pagina.click('[data-acao="resolver"]');
    await pagina.waitForFunction(() => document.querySelector('[data-campo="data"]')?.value === '2026-10-23', null, { timeout: 5000 }).catch(() => {});
    ok(
      (await pagina.inputValue('[data-campo="data"]')) === '2026-10-23' && (await pagina.textContent('.an-lembrete')).includes('todo dia útil'),
      'feito na anotação aberta, o lembrete pula outra vez, e ela continua aberta'
    );
    ok(erros.length === 0, `console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
    await contexto.close();
  }

  titulo('Ordens: o robô do Hub (Tampermonkey simulado, Hub falso)');
  {
    // O robô só reconhece a Mesa aberta do disco em .../mesa-xp/dist/index.html.
    const mesaDoDisco = join(temporario, 'mesa-xp', 'dist', 'index.html');
    mkdirSync(join(temporario, 'mesa-xp', 'dist'), { recursive: true });
    copyFileSync(distLocal, mesaDoDisco);
    const MESA = pathToFileURL(mesaDoDisco).href;
    const PRATELEIRA = 'https://hub.xpi.com.br/new/fundos-de-investimento#/secundario/prateleira';
    const API = 'https://api-advisor.xpi.com.br/investment-funds/yield-rede';
    const LISTA = `${API}/v3/investment-funds-secondary`;
    const PRE_CHECK = `${API}/v1/order-secondary/pre-check`;
    const VGPR = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const IMOV = '22222222-3333-4444-8555-666666666666';
    const TERRAX = '11111111-2222-4333-8444-555555555555';
    // O preço exato de cada fundo, a menos de meia casa do arredondado da prateleira.
    const PRECOS = { [VGPR]: 7.996321, [IMOV]: 8.9961, [TERRAX]: 98.9961 };
    // O robô como a Mesa o entrega no "Copiar robô": com a SnapDOM vendorizada no marcador do print.
    const robo = readFileSync(join(raiz, 'src/modulos/ordens/platform/robo-hub.user.js'), 'utf8').replace(
      '/*@@SNAPDOM@@*/',
      () => readFileSync(join(raiz, 'src/vendor/snapdom.js'), 'utf8')
    );

    // A resposta da prateleira e a do pre-check, com números inventados — o repositório é público.
    const fundo = (id, fundName, unityPrice, desagio, minimo) => ({
      id,
      fundName,
      quotaDate: '2026-10-01T00:00:00',
      unityPrice,
      secondaryPurchaseDiscount: desagio,
      treasuryMinimumPurchaseDiscount: minimo,
      percentageComission: '1,50',
      stockOfTreasuryQuotas: '500.000,00',
      minimalInitialInvestment: '10,00'
    });
    const resposta = {
      isMarketOpen: true,
      data: [
        fundo(VGPR, 'VGPR11 - Valora Imobiliário Multiestratégia Premium', '8,00', '6,00', '5,50'),
        fundo(IMOV, 'IMOV11 - Navi Hedge Fund', '9,00', '8,75', '8,25'),
        fundo(TERRAX, 'Riza Terrax Vintage FIAgro RL', '99,00', '2,00', '1,75')
      ]
    };
    // A boleta de compra e a de venda (robô 1.4.0) chamam o mesmo pre-check, com os estoques do
    // fundo e, na venda, a posição do cliente. O saldo e o preço médio da posição nunca podem sair do Hub.
    const ESTOQUES = {
      [VGPR]: {
        canOperateBuyTreasury: true,
        canOperateBuyPeerToPeer: true,
        canOperateSellTreasury: true,
        canOperateSellPeerToPeer: true,
        treasury: { modalityId: 1, buy: { secondaryDiscount: 6, percentageComission: 1.5, quotaQuantityAvailable: 500000 }, sell: { secondaryDiscount: 7.5, percentageComission: 0 } },
        peerToPeer: { modalityId: 2, buy: { secondaryDiscount: 6.15, percentageComission: 1.5, quotaQuantityAvailable: 500, maxAmountVariationPercentage: 2 }, sell: { secondaryDiscount: 7, percentageComission: 0 } }
      },
      [IMOV]: {
        canOperateBuyTreasury: true,
        canOperateBuyPeerToPeer: false,
        canOperateSellTreasury: true,
        canOperateSellPeerToPeer: true,
        treasury: { modalityId: 1, buy: {}, sell: { secondaryDiscount: 10.5, percentageComission: 0, unitaryQuotaValue: 8.05 } },
        peerToPeer: { modalityId: 2, buy: {}, sell: { secondaryDiscount: 10, percentageComission: 0 } }
      },
      [TERRAX]: {
        canOperateBuyTreasury: true,
        canOperateBuyPeerToPeer: false,
        canOperateSellTreasury: false,
        canOperateSellPeerToPeer: true,
        treasury: { modalityId: 1, buy: {}, sell: {} },
        peerToPeer: { modalityId: 2, buy: {}, sell: { secondaryDiscount: 3, percentageComission: 0 } }
      }
    };
    const POSICOES = {
      [IMOV]: { quotaQuantity: 1234.5678, quotaQuantityAvailable: 1234.5678, quotaQuantityOnSale: 0, balance: 99999.99, averagePriceValue: 9.87654 },
      [TERRAX]: { quotaQuantity: 50, quotaQuantityAvailable: 50, quotaQuantityOnSale: 0, balance: 99999.99, averagePriceValue: 9.87654 }
    };
    const preCheck = (id, lado) => ({
      isSuccess: true,
      fund: { id, quotaValue: PRECOS[id], quotaDate: '2026-10-01T00:00:00', stock: ESTOQUES[id] },
      customer: {
        name: 'CLIENTE QUE NÃO PODE SAIR DO HUB',
        availableGuarantee: 123456.78,
        ...(lado === 'vender' ? { balancePosition: POSICOES[id] } : {})
      }
    });

    // A ficha do cliente na Posição Consolidada (customer-info), inventada, no formato do Hub de
    // verdade: os campos dentro de `output` (conferido em 07/10; a 1.3.0 os procurava na raiz e falhou
    // no Hub). Do que vem nela, só o nome, o e-mail e o assessor podem sair do Hub. A conta 2718281
    // responde num formato que o robô não conhece.
    const FICHA_API = 'https://api-advisor.xpi.com.br/advisor-customer-consolidated-portfolio/v1/api';
    const CLIENTES = {
      1234567: { name: 'FULANA DE TAL DA SILVA', email: 'FULANA.TAL@EXEMPLO.COM', advisorCode: 'A12345', advisorName: 'Beltrano Souza' },
      7654321: { name: 'CICLANO DOS SANTOS', email: 'CICLANO@EXEMPLO.COM', advisorCode: 'A99999', advisorName: 'Sem Planilha' },
      3141592: { name: 'MARIA-CLARA D\'AVILA', email: 'MARIA@EXEMPLO.COM', advisorCode: 'A12345', advisorName: 'Beltrano Souza' }
    };
    const ficha = (conta) => {
      const campos = { name: 'NOME QUE NÃO PODE SAIR', ...CLIENTES[conta], xpAccount: Number(conta), cpf: '99988877766', phoneNumber: 'TELEFONE QUE NÃO PODE SAIR' };
      return conta === '2718281' ? { resultado: campos } : { output: campos };
    };
    // Com true, a Posição Consolidada só pede a ficha ao abrir, não ao trocar de cliente: o caso em que
    // o robô recarrega a página.
    let fichaSoAoAbrir = false;
    const ASSESSORES_CSV = [
      'Status,Nome,Email,Líder,Time,Cluster,Código,Código em uso,Tipo Assessor,Região,Nome',
      'TRUE,Beltrano Souza,beltrano.souza@exemplo.com.br,,,,A12345,A12345,Assessor Jr,,Beltrano Souza',
      'TRUE,Outra Pessoa,-,,,,A23456,A23456,,,Outra Pessoa'
    ].join('\n');

    // O Tampermonkey de mentira: um armazenamento só para as abas do contexto, com aviso de mudança.
    const GM = `(() => {
      const cache = {};
      let mesclado = false;
      // Como no Tampermonkey de verdade, o que já está guardado vale desde o primeiro instante da aba.
      const dados = () => {
        if (!mesclado) {
          mesclado = true;
          const pedido = new XMLHttpRequest();
          pedido.open('GET', 'https://gm.teste/loja', false);
          try { pedido.send(); Object.assign(cache, JSON.parse(pedido.responseText)); } catch {}
        }
        return cache;
      };
      const ouvintes = {};
      window.__gmMudou = (k, v) => { const antigo = dados()[k]; cache[k] = v; (ouvintes[k] || []).forEach((fn) => fn(k, antigo, v, true)); };
      window.GM_getValue = (k, padrao) => (k in dados() && cache[k] !== null ? JSON.parse(JSON.stringify(cache[k])) : padrao);
      window.GM_setValue = (k, v) => { dados(); cache[k] = v; window.__gm('set', k, v); };
      window.GM_addValueChangeListener = (k, fn) => { (ouvintes[k] ||= []).push(fn); };
      window.GM_openInTab = (url, opcoes) => {
        const id = 'aba-' + Math.random().toString(36).slice(2);
        window.__gm('abrir', url, Boolean(opcoes && opcoes.active), id);
        return { close: () => window.__gm('fechar', id) };
      };
      window.unsafeWindow = window;
      // O Hub como o Chrome o trata em segundo plano: escondido e sem quadro de desenho. A aba que o
      // robô abre à vista (a boleta da Fila, 1.10.0) fica como está: a pessoa está nela.
      const aVista = () => {
        const pedido = new XMLHttpRequest();
        pedido.open('GET', 'https://gm.teste/vista', false);
        try { pedido.send(); return pedido.responseText === 'sim'; } catch { return false; }
      };
      if (location.hostname === 'hub.xpi.com.br' && !aVista()) {
        Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => 'hidden' });
        Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => true });
        window.requestAnimationFrame = () => 0;
      }
    })();`;

    const contexto = await navegador.newContext({
      viewport: { width: 1400, height: 900 },
      timezoneId: 'America/Sao_Paulo',
      reducedMotion: 'reduce',
      permissions: ['clipboard-read', 'clipboard-write']
    });
    const loja = {};
    // Tudo o que passou pelo armazenamento do robô, para conferir o que nunca pode passar por ele.
    const escritas = [];
    const pedidosAoHub = { lista: 0, preCheck: 0, ficha: 0 };
    // As abas que o robô abriu à vista (GM_openInTab com active), para o Hub falso não as esconder.
    const abasAVista = new Set();
    // As abas abertas pelo robô, pelo id do controle que o GM_openInTab devolveu.
    const abasPorId = new Map();
    const novaAba = async (url, aVista = false, id = null) => {
      const p = await contexto.newPage();
      if (aVista) abasAVista.add(p);
      if (id) abasPorId.set(id, p);
      await p.addInitScript(`window.__gmFoto = ${JSON.stringify(loja)};`);
      await p.goto(url).catch(() => {});
      return p;
    };
    // O que a boleta falsa viu (o estoque escolhido, um clique em Próximo), guardado aqui: a aba do
    // print (robô 1.12.0) fecha no fim, e o que estava nela some com ela.
    const naBoletaFalsa = { estoques: [], proximos: 0 };
    await contexto.exposeBinding('__hubFalso', (_origem, tipo, valor) => {
      if (tipo === 'estoque') naBoletaFalsa.estoques.push(valor);
      if (tipo === 'proximo') naBoletaFalsa.proximos++;
    });
    await contexto.exposeBinding('__gm', async (_origem, op, chave, valor, id) => {
      if (op === 'set') {
        loja[chave] = valor;
        escritas.push(JSON.stringify(valor) ?? '');
        for (const p of contexto.pages()) p.evaluate(([k, v]) => window.__gmMudou?.(k, v), [chave, valor]).catch(() => {});
      }
      if (op === 'abrir') novaAba(chave, valor === true, id);
      if (op === 'fechar') abasPorId.get(chave)?.close().catch(() => {});
    });
    await contexto.route('https://gm.teste/**', (r) => {
      if (r.request().url().endsWith('/vista')) {
        let pagina = null;
        try { pagina = r.request().frame().page(); } catch {}
        return r.fulfill({ contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: abasAVista.has(pagina) ? 'sim' : 'nao' });
      }
      return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(loja) });
    });
    await contexto.addInitScript(GM);
    await contexto.addInitScript(robo);
    await contexto.route(`${API}/**`, (r) => {
      const url = new URL(r.request().url());
      const ehPreCheck = url.pathname.endsWith('/order-secondary/pre-check');
      pedidosAoHub[ehPreCheck ? 'preCheck' : 'lista']++;
      const corpo = ehPreCheck ? preCheck(url.searchParams.get('f'), url.searchParams.get('l')) : resposta;
      r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(corpo) });
    });
    // A lista do Tesouro Direto (robô 1.6.0), com dados de título como os do Hub em 20/10/2026. A conta
    // 7654321 não está habilitada, como uma conta de verdade que tem outra conta XP no mesmo CPF.
    const TESOURO_API = 'https://api-advisor.xpi.com.br/rede-treasury';
    const pedidosDoTesouro = [];
    const pedidosDasPosicoes = [];
    // As cargas da página do Renda Fixa: o robô recarrega a aba dele para ler de novo.
    let cargasDoRendaFixa = 0;
    contexto.on('request', (pedido) => {
      if (pedido.isNavigationRequest() && pedido.url().startsWith('https://hub.xpi.com.br/new/renda-fixa')) cargasDoRendaFixa++;
    });
    await contexto.route(`${TESOURO_API}/**`, (r) => {
      const [, conta, recurso] = new URL(r.request().url()).pathname.match(/customers\/(\d+)\/(available-assets|positions)$/) ?? [];
      (recurso === 'positions' ? pedidosDasPosicoes : pedidosDoTesouro).push(conta);
      // A posição do cliente no Tesouro (robô 1.7.0): uma lista solta, como a do Hub. Os PUs de venda
      // são os de 20/10/2026; as quantidades, inventadas. O preço médio e o líquido não podem sair.
      const posicoes = [
        { bondName: 'Tesouro Selic 2029', codeBonds: 178, expirateDate: '2029-03-01T00:00:00-03:00', quantityBuy: 0.5, quantityBalance: 0.5, blockedQuantity: 0, sellPrice: 20090.26, grossValue: 10045.13, buyPrice: 17777.77, netValue: 9999.99 },
        { bondName: 'Tesouro Selic 2031', codeBonds: 212, expirateDate: '2031-03-01T00:00:00-03:00', quantityBuy: 4.2, quantityBalance: 4.2, blockedQuantity: 0, sellPrice: 20024.39, grossValue: 84102.44, buyPrice: 17777.77, netValue: 83333.33 }
      ];
      const corpo =
        conta === '7654321'
          ? { statusCode: 400, message: 'A Conta 7654321 não está habilitada para operar no Tesouro Direto pois já existe outra conta XP Inc atrelada ao CPF do cliente.' }
          : recurso === 'positions'
            ? posicoes
            : {
              data: {
                items: [
                  { codeBonds: 212, descTypeBond: 'LFT', expirateDate: '2031-03-01T00:00:00-03:00', buyValue: 20043.37, minimumInvestmentValue: 200.43, nickname: 'Tesouro Selic 2031', descIndex: 'SELIC', profitability: 'SELIC + 0,0992 %', indexBonds: 17, riskScore: 1, clienteQueNaoPodeSair: 'NÃO PODE SAIR' },
                  { codeBonds: 174, descTypeBond: 'LTN', expirateDate: '2029-01-01T00:00:00-03:00', buyValue: 772.09, minimumInvestmentValue: 7.72, nickname: 'Tesouro Prefixado 2029', descIndex: 'prefixado', profitability: '12,63 %', indexBonds: 19 },
                  { codeBonds: 214, descTypeBond: 'LTN', expirateDate: '2032-01-01T00:00:00-03:00', buyValue: 536.71, minimumInvestmentValue: 5.36, nickname: 'Tesouro Prefixado 2032', descIndex: 'prefixado', profitability: '12,81 %', indexBonds: 19 }
                ]
              }
            };
      r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(corpo) });
    });
    await contexto.route(`${FICHA_API}/**`, (r) => {
      pedidosAoHub.ficha++;
      const conta = new URL(r.request().url()).pathname.match(/customers\/(\d+)\/customer-info$/)?.[1];
      r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(ficha(conta)) });
    });
    // O Hub falso, como o de verdade:
    //  - qualquer parâmetro no endereço trava o Mercado Secundário (sem botão, sem nada);
    //  - a Prateleira, ao abrir, pede a lista sozinha, e o botão Atualizar aparece com ela;
    //  - a boleta só carrega o cliente à vista, e depois de um quadro de desenho;
    //  - com __semTrocaDireta, ir de uma boleta direto para outra não refaz o pre-check — o caso que
    //    o robô contorna passando pela Prateleira.
    //  - a Posição Consolidada pede a ficha do cliente do endereço (#/<conta em base64>) por XHR, ao
    //    abrir e ao trocar de cliente — ou só ao abrir, com `fichaSoAoAbrir`.
    // __rotas guarda só o tipo de cada rota (boleta ou Prateleira), sem a conta.
    await contexto.route('https://hub.xpi.com.br/**', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><meta charset=utf-8><title>Hub</title><body>
          <script>
            // O Renda Fixa, como o Hub de verdade em 20/10/2026 (robô 1.7.0):
            //  - o cliente escolhido no "Pesquisar cliente" (o resultado diz "Conta XP: <conta>") vale
            //    para Produtos e Posições, e continua escolhido depois de recarregar;
            //  - a lista e a posição de um cliente são pedidas uma vez só por carga da página: entrar
            //    em Produtos → Tesouro Direto pede a lista; em Posições, o clique na aba Tesouro Direto
            //    pede a posição; escolher o cliente pede a da tela em que se está;
            //  - Posições abre na aba Renda Fixa e desfaz a troca de rota para a do Tesouro;
            //  - o resultado da busca ignora o clique do primeiro segundo.
            if (location.pathname.startsWith('/new/renda-fixa')) {
              let escolhido = sessionStorage.getItem('cliente');
              const pedidas = new Set();
              const pedir = (recurso) => {
                if (!escolhido || pedidas.has(recurso + ':' + escolhido)) return;
                pedidas.add(recurso + ':' + escolhido);
                fetch('${TESOURO_API}/v1/customers/' + escolhido + '/' + recurso);
              };
              let abas = null;
              let pelaAba = false;
              let entradas = 0;
              const naTela = () => {
                const entrada = ++entradas;
                if (location.hash.startsWith('#/produtos/tesouro-direto')) pedir('available-assets');
                if (location.hash.startsWith('#/posicoes/cliente/tesouro-direto')) {
                  if (pelaAba) pedir('positions');
                  else setTimeout(() => entrada === entradas && location.replace('#/posicoes/cliente/renda-fixa'), 300);
                }
                pelaAba = false;
                if (abas) abas.hidden = !location.hash.startsWith('#/posicoes/cliente');
              };
              addEventListener('hashchange', naTela);
              document.addEventListener('DOMContentLoaded', () => {
                const busca = document.createElement('input');
                busca.placeholder = 'Pesquisar cliente';
                const resultados = document.createElement('div');
                busca.addEventListener('input', () => {
                  resultados.dataset.desde = Date.now();
                  resultados.innerHTML = /^\\d{5,8}$/.test(busca.value)
                    ? '<div role="menuitem"><span>FULANO</span><span>Conta XP: ' + busca.value + '</span></div>'
                    : '';
                });
                resultados.addEventListener('click', (e) => {
                  const item = e.target.closest('[role="menuitem"]');
                  if (!item || Date.now() - Number(resultados.dataset.desde) < 1000) return;
                  escolhido = item.textContent.match(/Conta XP: (\\d+)/)[1];
                  sessionStorage.setItem('cliente', escolhido);
                  resultados.innerHTML = '';
                  if (location.hash.startsWith('#/produtos/tesouro-direto')) pedir('available-assets');
                  if (location.hash.startsWith('#/posicoes/cliente/tesouro-direto')) pedir('positions');
                });
                abas = document.createElement('div');
                for (const nome of ['Renda Fixa', 'Tesouro Direto']) {
                  const aba = document.createElement('soma-tab');
                  aba.textContent = nome;
                  aba.addEventListener('click', () => {
                    const rota = nome === 'Tesouro Direto' ? '#/posicoes/cliente/tesouro-direto' : '#/posicoes/cliente/renda-fixa';
                    if (location.hash !== rota) {
                      pelaAba = true;
                      location.hash = rota;
                    } else if (nome === 'Tesouro Direto') pedir('positions');
                  });
                  abas.append(aba);
                }
                document.body.append(busca, resultados, abas);
                naTela();
              });
            }
            if (location.pathname.startsWith('/new/posicao-consolidada')) {
              const pedirFicha = () => {
                const x = new XMLHttpRequest();
                x.open('GET', '${FICHA_API}/customers/' + atob(location.hash.slice(2)) + '/customer-info');
                x.send();
              };
              if (!${fichaSoAoAbrir}) addEventListener('hashchange', pedirFicha);
              pedirFicha();
            }
            window.__rotas = [];
            const atualizar = () => {
              const b = document.createElement('soma-button');
              b.setAttribute('aria-label', 'atualizar');
              b.textContent = 'atualizar';
              b.addEventListener('click', () => { window.__cliques = (window.__cliques || 0) + 1; fetch('${LISTA}'); });
              document.body.append(b);
            };
            if (!location.search) {
              if (location.hash.startsWith('#/secundario/prateleira')) fetch('${LISTA}').then(atualizar);
              else atualizar();
            }
            let anterior = '';
            const rota = () => {
              const m = location.hash.match(/^#\\/secundario\\/(comprar|vender)\\/([0-9a-f-]{36})\\/(\\d+)$/);
              const deBoleta = /^#\\/secundario\\/(comprar|vender)\\//.test(anterior);
              anterior = location.hash;
              window.__rotas.push(m ? 'boleta' : 'prateleira');
              if (m && document.visibilityState === 'visible' && !(window.__semTrocaDireta && deBoleta)) requestAnimationFrame(() => fetch('${PRE_CHECK}?f=' + m[2] + '&l=' + m[1]));
            };
            addEventListener('hashchange', rota);
            rota();

            // A boleta de venda (robô 1.5.0), como a do Hub: o campo de quantidade num componente com
            // shadow DOM e máscara de 8 casas (os dígitos entram pela direita); "Total de cotas"; a caixa
            // do total e o detalhe que abre e fecha; e um Próximo que conta cliques — tem de ficar em zero.
            if (!customElements.get('campo-falso')) {
              customElements.define('campo-falso', class extends HTMLElement {
                constructor() {
                  super();
                  this.attachShadow({ mode: 'open' }).innerHTML = '<input placeholder="Adicione a quantidade de cotas">';
                }
              });
            }
            const POSICOES_DA_PAGINA = ${JSON.stringify(Object.fromEntries(Object.entries(POSICOES).map(([k, v]) => [k, v.quotaQuantityAvailable])))};
            const PUS_DA_PAGINA = ${JSON.stringify(PRECOS)};
            // O deságio de venda de cada estoque, o mesmo do pre-check: o painel o mostra (robô 1.9.0).
            const DESAGIOS_DA_VENDA = ${JSON.stringify(
              Object.fromEntries(
                Object.entries(ESTOQUES).map(([k, v]) => [k, { xp: v.treasury.sell.secondaryDiscount ?? null, clientes: v.peerToPeer.sell.secondaryDiscount ?? null }])
              )
            )};
            window.__proximo = 0;
            window.__estoqueEscolhido = [];
            // Como o Hub de verdade, visto pelo operador em 21/10/2026: primeiro se escolhe o estoque
            // (Estoque XP ou Estoque clientes); só então aparecem o campo e o "Total de cotas"; e o
            // detalhe da operação só aparece embaixo depois que a boleta faz a conta.
            const montarVenda = (fundo) => {
              document.getElementById('boleta-venda')?.remove();
              const b = document.createElement('div');
              b.id = 'boleta-venda';
              b.innerHTML =
                '<div class="modalidades"><div class="opcao" data-m="xp"><span>Estoque XP</span></div><div class="opcao" data-m="clientes"><span>Estoque clientes</span></div></div>' +
                '<div class="passo2" hidden><campo-falso></campo-falso><span class="total">Total de cotas</span></div>' +
                '<div class="info"><div class="caixa"><span>Valor total da operação</span><span class="vt">R$ 0,00</span></div>' +
                '<div class="det" hidden><span>Visualizar mais detalhes da operação</span></div>' +
                '<div class="linhas" hidden><div><span>Quantidade de cotas</span><span class="q">0</span></div>' +
                '<div><span>Deságio</span><span class="ds">—</span></div>' +
                '<div><span>Preço unitário da cota</span><span>R$ 9,00</span></div>' +
                '<div><span>Valor total da operação</span><span class="vt2">R$ 0,00</span></div></div></div>' +
                '<button class="proximo">Próximo</button>';
              document.body.append(b);
              for (const opcao of b.querySelectorAll('.opcao')) {
                opcao.addEventListener('click', () => {
                  for (const outra of b.querySelectorAll('.opcao')) outra.classList.toggle('selecionada', outra === opcao);
                  window.__estoqueEscolhido.push(opcao.dataset.m);
                  window.__hubFalso?.('estoque', opcao.dataset.m);
                  const desagio = (DESAGIOS_DA_VENDA[fundo] || {})[opcao.dataset.m];
                  b.querySelector('.ds').textContent = typeof desagio === 'number' ? desagio.toFixed(2).replace('.', ',') + '%' : '—';
                  b.querySelector('.passo2').hidden = false;
                });
              }
              const campo = b.querySelector('campo-falso').shadowRoot.querySelector('input');
              const conta = () => {
                const digitos = campo.value.replace(/\\D/g, '');
                const n = digitos ? Number(digitos) / 1e8 : 0;
                if (digitos) campo.value = n.toFixed(8).replace('.', ',');
                const total = 'R$ ' + (n * (PUS_DA_PAGINA[fundo] || 9)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                b.querySelector('.vt').textContent = total;
                b.querySelector('.vt2').textContent = total;
                b.querySelector('.q').textContent = String(Number(n.toFixed(8)));
                // A opção do detalhe aparece embaixo uns instantes depois da conta.
                if (n > 0) setTimeout(() => { b.querySelector('.det').hidden = false; }, 600);
              };
              campo.addEventListener('input', conta);
              b.querySelector('.total').addEventListener('click', () => {
                campo.value = String(Math.round((POSICOES_DA_PAGINA[fundo] || 0) * 1e8));
                conta();
              });
              b.querySelector('.det').addEventListener('click', () => {
                b.querySelector('.linhas').hidden = !b.querySelector('.linhas').hidden;
              });
              b.querySelector('.proximo').addEventListener('click', () => { window.__proximo++; window.__hubFalso?.('proximo'); });
            };
            const boletaDaRota = () => {
              const m = location.hash.match(/^#\\/secundario\\/vender\\/([0-9a-f-]{36})\\/(\\d+)$/);
              if (m) montarVenda(m[1]);
              else document.getElementById('boleta-venda')?.remove();
            };
            addEventListener('hashchange', boletaDaRota);
            boletaDaRota();
          </script></body>`
      })
    );

    // O Outlook na web de mentira: o compor abre com o texto do endereço (o `body` do `mailto:` dentro
    // do `to`, ou o solto) num corpo editável, uns instantes depois, e trata o colar como o editor dele:
    // o HTML colado entra no corpo.
    // A caixa de entrada de mentira (robô 1.8.0): a lista de mensagens como a do Outlook na web — cada
    // mensagem uma opção da lista, com o remetente (o e-mail no title), a hora, o assunto e a prévia.
    // `chegar` põe uma mensagem nova no alto. Duas mensagens que o robô não pode ler: uma que não é
    // resposta a pedido e uma resposta antiga (com data, não hora). Um clique qualquer é contado.
    const CAIXA_DE_ENTRADA = `<!doctype html><meta charset=utf-8><title>Caixa de Entrada - Outlook</title><body>
      <div role="listbox" aria-label="Lista de mensagens" id="lista"></div>
      <script>
        window.__cliques = 0;
        document.addEventListener('click', () => window.__cliques++, true);
        const lista = document.getElementById('lista');
        window.chegar = (m) => {
          const item = document.createElement('div');
          item.setAttribute('role', 'option');
          item.setAttribute('data-convid', m.id);
          const linha = (texto, title) => {
            const div = document.createElement('div');
            const span = document.createElement('span');
            if (title) span.title = title;
            span.textContent = texto;
            div.append(span);
            return div;
          };
          // Como a linha do Outlook de verdade (vista em 21/10/2026): um ícone e as iniciais do avatar
          // antes do remetente, e a prévia com o começo do e-mail citado.
          item.append(linha('!'), linha(m.de.split(' ').map((p) => p[0]).join('').slice(0, 2)), linha(m.de, m.email), linha(m.assunto), linha(m.hora), linha(m.previa));
          lista.prepend(item);
        };
        chegar({ id: 'c0', de: 'Equipe da Mesa', email: 'equipe@exemplo.com', hora: '09:00', assunto: 'Pauta de amanhã', previa: 'TEXTO QUE O ROBO NAO PODE LER' });
        chegar({ id: 'c00', de: 'Fulana Tal', email: 'fulana.tal@exemplo.com', hora: 'seg 19/10', assunto: 'RE: Confirmação de ordem', previa: 'RESPOSTA ANTIGA' });
      </script></body>`;
    // O corpo do e-mail no Outlook falso: o rótulo e o papel de hoje, ou outros — o Outlook muda —, para
    // conferir que o robô ainda acha o corpo pelo começo do texto que a Mesa mandou (1.12.0).
    let corpoDoOutlook = { papel: 'textbox', rotulo: 'Corpo da mensagem' };
    await contexto.route('https://outlook.cloud.microsoft/**', (r) =>
      !r.request().url().includes('/deeplink/') ? r.fulfill({ contentType: 'text/html', body: CAIXA_DE_ENTRADA }) :
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><meta charset=utf-8><title>Outlook</title><body>
          <script>
            const endereco = new URL(location.href);
            const para = endereco.searchParams.get('to') || '';
            const corpo = para.startsWith('mailto:') ? new URLSearchParams(para.split('?')[1] || '').get('body') || '' : endereco.searchParams.get('body') || '';
            setTimeout(() => {
              const editor = document.createElement('div');
              ${corpoDoOutlook.papel ? `editor.setAttribute('role', '${corpoDoOutlook.papel}');` : ''}
              editor.setAttribute('contenteditable', 'true');
              editor.setAttribute('aria-label', ${JSON.stringify(corpoDoOutlook.rotulo)});
              editor.innerText = corpo;
              editor.addEventListener('paste', (e) => {
                const html = e.clipboardData && e.clipboardData.getData('text/html');
                if (!html) return;
                e.preventDefault();
                editor.innerHTML = html;
              });
              document.body.append(editor);
            }, 400);
          </script></body>`
      })
    );

    const minhaAba = await novaAba(PRATELEIRA);
    await minhaAba.waitForSelector('soma-button');
    const mesa = await novaAba(MESA);
    const erros = [];
    mesa.on('pageerror', (e) => erros.push(String(e)));
    const esperarTexto = (seletor, trecho, prazo = 20_000) =>
      mesa.waitForFunction(([sel, t]) => document.querySelector(sel)?.textContent.includes(t), [seletor, trecho], { timeout: prazo });
    const terminarBusca = () =>
      mesa.waitForFunction(() => !document.querySelector('#robo-status').classList.contains('buscando'), null, { timeout: 40_000 });
    const abaDoRobo = async () => {
      for (const p of contexto.pages()) {
        if ((await p.evaluate(() => window.name).catch(() => '')) === 'mesa-xp-robo') return p;
      }
      return null;
    };

    const PEDIDO = '1234567\nCompra\nVGPR11 R$ 10.000,00\nIMOV11 R$ 10.000,00\nRiza Terrax Vintage FIAgro RL R$ 15.000,00';
    // O cliente chega da aba de clientes do robô ao mesmo tempo que os preços.
    const esperarCliente = (trecho) =>
      mesa.waitForFunction((t) => document.querySelector('.linha-cliente .cliente-nome')?.textContent === t, trecho, { timeout: 40_000 });
    // O mesmo pedido colado de novo bloquearia como repetido de hoje (a Fila do dia): este bloco testa
    // o robô, então a Fila é esvaziada antes de cada colagem. Sem criar o banco, se ele não existe.
    const esquecerFila = () =>
      mesa.evaluate(
        () =>
          new Promise((pronto) => {
            const req = indexedDB.open('mesa_fila');
            req.onupgradeneeded = () => req.transaction.abort();
            req.onerror = () => pronto();
            req.onsuccess = () => {
              const db = req.result;
              const tx = db.transaction('pedidos', 'readwrite');
              tx.objectStore('pedidos').clear();
              tx.oncomplete = tx.onerror = () => {
                db.close();
                pronto();
              };
            };
          })
      );
    // Na Fila, o pedido dos Enviados aprovado ("Aprovou"), e o cartão dele em Aprovação e execução.
    const aprovarNaFila = async () => {
      await mesa.keyboard.press(altDe('fila'));
      await mesa.waitForSelector('[data-pasta="enviados"]');
      await mesa.click('[data-pasta="enviados"]');
      await mesa.waitForSelector('.fl-linha [data-estado="aprovado"]');
      await mesa.click('.fl-linha [data-estado="aprovado"]');
      await mesa.click('[data-pasta="executar"]');
      await mesa.waitForSelector('.fl-cartao [data-acao="boleta"]');
    };
    const colar = async () => {
      await esquecerFila();
      await mesa.fill('#entrada', PEDIDO);
      await mesa.focus('#entrada');
      await mesa.keyboard.press('Control+Enter');
      await mesa.waitForFunction(() => document.querySelector('.secundario-dados')?.textContent.includes('exato'), null, { timeout: 40_000 });
      await terminarBusca();
      await esperarCliente('FULANA DE TAL DA SILVA');
    };
    const email = () => mesa.textContent('.saida[data-formato="email"] pre');
    const abaDeClientes = async () => {
      for (const p of contexto.pages()) {
        if ((await p.evaluate(() => window.name).catch(() => '')) === 'mesa-xp-clientes') return p;
      }
      return null;
    };
    const MARCAS_DO_CLIENTE = ['1234567', '7654321', '3141592', '2718281', 'NÃO PODE SAIR', 'FULANA', 'fulana', 'CICLANO', 'MARIA', '99988877766', 'TELEFONE', btoa('1234567')];
    const nadaDoCliente = () => {
      const chaves = Object.keys(loja).filter((k) => MARCAS_DO_CLIENTE.some((t) => JSON.stringify(loja[k]).includes(t)));
      return chaves.length === 0;
    };

    await esperarTexto('#robo-status', 'pronto');
    ok(true, 'a Mesa acha o robô');
    ok(await mesa.isHidden('#btn-instalar-robo'), 'com o robô em dia, o "Instalar robô" some');

    // A aba do robô abre junto com a Mesa, antes de qualquer pedido, e a Prateleira dela já traz a cotação.
    await esperarTexto('#robo-status', 'aba 🤖 do Hub aberta');
    await esperarTexto('#estoque-status', 'captura do Hub das');
    ok(Boolean(await abaDoRobo()) && !(await abaDoRobo()).url().includes('?'), 'a Mesa abre a aba do robô assim que abre, sem parâmetro no endereço');
    ok(pedidosAoHub.lista === 2 && (await (await abaDoRobo()).evaluate(() => window.__cliques ?? 0)) === 0, 'a Prateleira da aba nova traz a lista sozinha, sem clique');

    // A prova de controle: numa aba do Hub comum, escondida, a boleta não carrega — como no Chrome.
    await minhaAba.evaluate((v) => { location.hash = '#/secundario/comprar/' + v + '/1234567'; }, VGPR);
    await new Promise((r) => setTimeout(r, 800));
    ok(pedidosAoHub.preCheck === 0, 'numa aba escondida comum, a boleta não carrega o cliente (como no Chrome)');
    await minhaAba.evaluate(() => { location.hash = '#/secundario/prateleira'; });

    // A planilha dos assessores, como o .csv baixado da aba Contatos.
    await mesa.setInputFiles('#arquivo-assessores', { name: 'Contatos.csv', mimeType: 'text/csv', buffer: Buffer.from(ASSESSORES_CSV) });
    await esperarTexto('#assessores-status', '1 assessor · Contatos.csv');
    ok(true, 'a planilha dos assessores carrega pelo .csv, só com quem tem e-mail');

    await (await abaDoRobo()).evaluate(() => { window.__rotas = []; });
    await colar();
    const robo1 = await abaDoRobo();
    ok((await minhaAba.evaluate(() => [window.__cliques ?? 0, location.hash])).join() === '0,#/secundario/prateleira', 'o robô nunca mexe na aba da pessoa');
    ok(
      pedidosAoHub.preCheck === 2 && pedidosAoHub.lista === 2,
      'colar o pedido traz o preço exato dos 2 fundos em que ele muda as cotas — o Riza Terrax, que daria as mesmas, fica sem boleta —, e a cotação da abertura serve'
    );
    ok((await robo1.evaluate(() => window.__rotas.join())) === 'boleta,boleta,prateleira', 'o robô vai de uma boleta direto para a outra e volta à Prateleira uma vez só, no fim');
    ok((await robo1.title()).startsWith('🤖'), 'a aba do robô diz no título que é dele');
    ok(!JSON.stringify(loja).includes('NÃO PODE SAIR') && !JSON.stringify(loja).includes('1234567'), 'nada do cliente sai do Hub, e a conta não fica guardada');
    await mesa.check('#formatos input[value="email"]');
    // Com o PU da prateleira seriam 1.302 VGPR11 e 1.192 IMOV11; com o exato, 1.303 e 1.193.
    ok(
      (await email()).includes('Ativo: VGPR11;\nQuantidade: 1303;') && (await email()).includes('Ativo: IMOV11;\nQuantidade: 1193;'),
      'o e-mail sai com as cotas do preço exato'
    );
    ok(!(await mesa.textContent('.secundario-fundo')).includes('≈'), 'com o preço exato, os valores saem sem o "≈"');

    // O cliente: a ficha no Hub, numa aba de clientes do robô, e o assessor pela planilha.
    const clientes1 = await abaDeClientes();
    ok(
      Boolean(clientes1) && clientes1 !== (await abaDoRobo()) && !clientes1.url().includes('?') && (await clientes1.title()).startsWith('🤖 Clientes'),
      'o cliente vem de uma aba de clientes do robô, separada da Prateleira e sem parâmetro no endereço'
    );
    const linhaCliente = await mesa.textContent('.linha-cliente');
    ok(
      linhaCliente.includes('fulana.tal@exemplo.com') && linhaCliente.includes('Beltrano Souza') && linhaCliente.includes('A12345') && linhaCliente.includes('beltrano.souza@exemplo.com.br'),
      'o cartão mostra o cliente, o e-mail dele e o assessor que vai em cópia, achado pelo código'
    );
    ok((await email()).startsWith('Prezado(a) FULANA DE TAL DA SILVA,\n'), 'o e-mail sai com o nome completo do cliente, em maiúsculas como no Hub');
    ok(nadaDoCliente(), 'nada do cliente fica no armazenamento do robô: nem a conta, nem o nome, nem o e-mail, nem o CPF');
    ok(!linhaCliente.includes('99988877766') && !linhaCliente.includes('TELEFONE'), 'da ficha só saem o nome, o e-mail e o assessor');

    await mesa.evaluate(() => {
      window.__abertas = [];
      window.open = (endereco) => (window.__abertas.push(endereco), {});
    });
    await mesa.click('.saida[data-formato="email"] [data-outlook]');
    // O Outlook na web só lê a cópia dentro de um mailto: no `to` (conferido no Outlook da mesa).
    const outlook = new URL(new URL((await mesa.evaluate(() => window.__abertas))[0]).searchParams.get('to'));
    ok(
      outlook.protocol === 'mailto:' &&
        decodeURIComponent(outlook.pathname) === 'fulana.tal@exemplo.com' &&
        outlook.searchParams.get('cc') === 'beltrano.souza@exemplo.com.br' &&
        outlook.searchParams.get('body').startsWith('Prezado(a) FULANA DE TAL DA SILVA,'),
      'Abrir no Outlook vai para o cliente, com o assessor em cópia (num mailto: dentro do to) e o nome no corpo'
    );

    // A conta corrigida no cartão: enquanto se digita, o nome do cliente anterior sai do e-mail; ao
    // sair do campo, o robô troca de cliente na mesma aba.
    const fichasAntes = pedidosAoHub.ficha;
    await mesa.fill('.campo-conta', '7654321');
    ok((await email()).startsWith('Prezado(a) Cliente,\n'), 'com a conta mudada, o nome do cliente anterior sai do e-mail na hora');
    await mesa.press('.campo-conta', 'Tab');
    await esperarCliente('CICLANO DOS SANTOS');
    ok(
      pedidosAoHub.ficha === fichasAntes + 1 && (await abaDeClientes()) === clientes1 && (await mesa.textContent('.linha-cliente')).includes('fora da planilha'),
      'outra conta: a mesma aba troca de cliente, e o assessor fora da planilha fica sem cópia, com o motivo à vista'
    );

    // Se trocar de cliente não fizer o Hub pedir a ficha, o robô recarrega a aba de clientes uma vez.
    fichaSoAoAbrir = true;
    await clientes1.reload();
    await mesa.fill('.campo-conta', '3141592');
    await mesa.press('.campo-conta', 'Tab');
    await esperarCliente("MARIA-CLARA D'AVILA");
    ok(true, 'se trocar de cliente não traz a ficha, o robô recarrega a aba e traz o cliente do mesmo jeito');
    fichaSoAoAbrir = false;
    await clientes1.reload();

    // A ficha num formato que o robô não conhece: o aviso diz que é o robô, sem recarregar à toa.
    const fichasAntesDoFormato = pedidosAoHub.ficha;
    await mesa.fill('.campo-conta', '2718281');
    await mesa.press('.campo-conta', 'Tab');
    await mesa.waitForFunction(() => document.querySelector('.linha-cliente.falhou')?.textContent.includes('atualizado'), null, { timeout: 40_000 });
    ok(
      pedidosAoHub.ficha === fichasAntesDoFormato + 1 && (await email()).startsWith('Prezado(a) Cliente,\n'),
      'a ficha num formato desconhecido avisa que o robô precisa ser atualizado, sem recarregar, e o e-mail sai com "Cliente"'
    );
    ok(nadaDoCliente(), 'e nada do cliente fica guardado depois das trocas');

    // O relatório de tempos: a Mesa e o robô numa linha do tempo, e nada do cliente.
    await mesa.waitForSelector('#btn-copiar-tempos:not([hidden])', { timeout: 10_000 });
    await mesa.click('#btn-copiar-tempos');
    const tempos = await mesa.evaluate(() => navigator.clipboard.readText());
    ok(
      [
        'Tempos do robô do Hub',
        'Preço exato de VGPR11:',
        'Preço exato de IMOV11:',
        'Preço exato de Riza Terrax Vintage FIAgro RL: dispensado',
        'Robô: abriu a boleta de IMOV11, direto da anterior',
        'pre-check'
      ].every((t) => tempos.includes(t)),
      '"Copiar tempos" entrega o resumo e a linha do tempo da Mesa e do robô'
    );
    ok(!tempos.includes('1234567') && !/\d{5,}/.test(tempos), 'e o relatório não leva a conta nem número longo nenhum');

    await mesa.click('#btn-atualizar-cotacoes');
    await terminarBusca();
    ok(
      pedidosAoHub.lista === 3 && pedidosAoHub.preCheck === 2 && (await robo1.evaluate(() => window.__cliques ?? 0)) === 1,
      '"Atualizar cotações" clica em Atualizar, e o preço exato de menos de 10 minutos não é buscado de novo'
    );

    // Se ir direto de uma boleta para a outra não disparar o pre-check no Hub de verdade, o robô passa
    // pela Prateleira e traz o preço do mesmo jeito.
    await robo1.evaluate(() => { window.__semTrocaDireta = true; window.__rotas = []; });
    await mesa.evaluate(() => localStorage.removeItem('ordens_secundario_cotas'));
    await mesa.reload();
    await esperarTexto('#robo-status', 'aba 🤖 do Hub aberta');
    await colar();
    await mesa.check('#formatos input[value="email"]');
    ok(
      pedidosAoHub.preCheck === 4 &&
        (await robo1.evaluate(() => window.__rotas.join())) === 'boleta,boleta,prateleira,boleta,prateleira' &&
        (await email()).includes('Ativo: IMOV11;\nQuantidade: 1193;'),
      'se a troca direta de boleta não traz o pre-check, o robô passa pela Prateleira e traz o preço do mesmo jeito'
    );

    await robo1.close();
    await mesa.click('#btn-atualizar-cotacoes');
    await terminarBusca();
    const robo2 = await abaDoRobo();
    ok(
      pedidosAoHub.lista === 4 && Boolean(robo2) && (await robo2.evaluate(() => window.__cliques ?? 0)) === 0,
      'com a aba do robô fechada, ele abre outra e traz a cotação da lista que a Prateleira pede ao abrir, sem clicar'
    );

    // A aba aberta pelas versões 1.1.0 e 1.1.1, com a marca no endereço, recarrega limpa e segue do robô.
    const antiga = await novaAba('https://hub.xpi.com.br/new/fundos-de-investimento?mesaxp=robo#/secundario/prateleira');
    await antiga.waitForURL((u) => !u.search, { timeout: 10_000 });
    ok((await antiga.evaluate(() => window.name)) === 'mesa-xp-robo' && (await antiga.evaluate(() => location.hash)) === '#/secundario/prateleira', 'a aba antiga, com a marca no endereço, recarrega limpa e segue do robô');

    // ── A venda e o Estoque clientes (robô 1.4.0) ──
    // A venda do total de dois fundos e a compra de um pelo Estoque clientes, no mesmo pedido: o robô
    // abre as duas boletas de venda e a de compra, e a Mesa monta os três e-mails.
    const rotasAntes = await antiga.evaluate(() => window.__rotas.length);
    await mesa.fill('#entrada', '1234567\nvia email\nVendas | Quantidade Total\nIMOV11\nRiza Terrax Vintage FIAgro RL\nCompras\nVGPR11 R$ 10.000,00 (Estoque cliente)');
    await mesa.focus('#entrada');
    await esquecerFila();
    await mesa.keyboard.press('Control+Enter');
    await mesa.waitForFunction(() => document.querySelectorAll('.secundario-fundo[data-venda="pronto"]').length === 2, null, { timeout: 40_000 });
    await terminarBusca();
    const rotasDaVenda = (await antiga.evaluate(() => window.__rotas)).slice(rotasAntes);
    ok(rotasDaVenda.filter((r) => r === 'boleta').length >= 3, `o robô abre as boletas de venda e a de compra do Estoque clientes (${rotasDaVenda.join(', ')})`);
    const vendaNaTela = await mesa.textContent('.secundario-vendas');
    ok(vendaNaTela.includes('1234,56780000') && vendaNaTela.includes('10,50%'), 'a posição disponível do cliente chega da boleta de venda, com as 8 casas, e o deságio do Estoque XP');
    ok(!(await mesa.textContent('body')).includes('99999') && !(await mesa.textContent('body')).includes('9,87654'), 'o saldo e o preço médio da posição não saem do Hub');
    const vendaBloqueada = await mesa.textContent('.saida[data-grupo="fundos-venda"]');
    ok(vendaBloqueada.includes('não está comprando este fundo hoje'), 'o Estoque XP fechado para um fundo segura o e-mail de venda');
    await mesa.click('.saida[data-grupo="fundos-venda"] [data-campo="estoque-clientes"]');
    await mesa.waitForSelector('.saida[data-grupo="fundos-venda"] pre', { timeout: 40_000 });
    const emailDeVenda = await mesa.textContent('.saida[data-grupo="fundos-venda"] pre');
    ok(
      emailDeVenda.includes('Ativo: IMOV11;\nQuantidade: 1234,56780000;\nOperação: Venda;\n\nCondições:') &&
        emailDeVenda.includes('Quantidade: 50;') &&
        emailDeVenda.endsWith('atte,'),
      '"Vender no Estoque clientes" destrava o e-mail de venda, no modelo da auditoria, com a posição de cada fundo'
    );
    ok((await mesa.textContent('.secundario:not(.secundario-vendas)')).includes('Estoque clientes · pior preço'), 'a compra pelo Estoque clientes sai num cenário só, no pior preço');
    // O Estoque clientes do Hub falso tem 500 cotas, e o pedido daria mais: bloqueia e oferece comprar o que houver.
    const compraP2p = await mesa.textContent('.saida[data-grupo="fundos-compra"]');
    ok(compraP2p.includes('Estoque clientes tem 500 na boleta do Hub') && compraP2p.includes('Comprar o que houver (500)'), 'o Estoque clientes que não cobre o pedido segura o e-mail, com a quantidade da boleta');
    await mesa.click('.saida[data-grupo="fundos-compra"] [data-campo="o-que-for-possivel"]');
    await mesa.waitForSelector('.saida[data-grupo="fundos-compra"] pre', { timeout: 10_000 });
    ok((await mesa.textContent('.saida[data-grupo="fundos-compra"] pre')).includes('Ativo: VGPR11;\nQuantidade: 500;'), '"Comprar o que houver" leva o e-mail às 500 cotas do Estoque clientes');
    const lojaDepois = JSON.stringify(loja);
    ok(!lojaDepois.includes('1234.5678') && !lojaDepois.includes('99999') && !lojaDepois.includes('1234567'), 'nem a posição nem a conta ficam no armazenamento do robô depois da busca');

    // ── O print da cotação de venda e o corpo no Outlook (robô 1.5.0; a aba do print, 1.12.0) ──
    // "Tirar prints": o robô abre uma aba do Hub à vista (escondida, o Chrome segura os relógios dela, e
    // o print não terminava), abre a boleta de venda de cada fundo, escolhe o estoque, preenche a
    // quantidade (o total), abre o detalhe, tira o print do painel — e a Mesa fecha a aba no fim.
    const estoquesAntes = naBoletaFalsa.estoques.length;
    const [abaDoPrint] = await Promise.all([contexto.waitForEvent('page'), mesa.click('.secundario-vendas [data-campo="tirar-prints"]')]);
    const prints = await mesa
      .waitForFunction(() => document.querySelectorAll('.secundario-print img').length === 2, null, { timeout: 60_000 })
      .then(() => true, () => false);
    await terminarBusca();
    const fontes = await mesa.$$eval('.secundario-print img', (l) => l.map((i) => i.getAttribute('src')));
    ok(prints && fontes.every((f) => /^data:image\/png;base64,.{200,}/.test(f)), 'o robô tira o print da cotação de cada venda na boleta, e a miniatura aparece na venda');
    ok((await mesa.textContent('.secundario-vendas')).includes('vale até'), 'cada print diz até quando vale (um dia útil)');
    const estoquesDoPrint = naBoletaFalsa.estoques.slice(estoquesAntes);
    ok(
      JSON.stringify(estoquesDoPrint) === '["xp","clientes"]',
      `o robô escolhe na boleta o estoque de cada venda (o XP do IMOV11, o clientes do Riza Terrax), antes da quantidade, e confere o deságio dele no painel (${JSON.stringify(estoquesDoPrint)})`
    );
    ok(naBoletaFalsa.proximos === 0, 'o robô nunca clica em Próximo na boleta');
    const fechou = abaDoPrint.isClosed() || (await abaDoPrint.waitForEvent('close', { timeout: 5000 }).then(() => true, () => false));
    ok(abasAVista.has(abaDoPrint) && fechou, 'os prints saem numa aba do Hub aberta à vista, que a Mesa fecha no fim');
    const roboAgora = await abaDoRobo();
    ok(
      (await roboAgora.evaluate(() => location.hash)) === '#/secundario/prateleira' && (await roboAgora.evaluate(() => (window.__estoqueEscolhido ?? []).length)) === 0,
      'a aba do robô, escondida, não faz os prints: fica na Prateleira'
    );
    const lojaDosPrints = JSON.stringify(loja);
    ok(!lojaDosPrints.includes('data:image') && !lojaDosPrints.includes('1234567'), 'os prints e a conta não ficam no armazenamento do robô');

    // Abrir no Outlook a venda: a janela abre já, com o texto; o robô no Outlook troca o corpo pelo HTML,
    // com os prints abaixo de "Condições:".
    // A janela do e-mail pelo endereço, e não pela primeira que abrir: outra aba (a do robô, a do
    // print) pode nascer no meio.
    const abrirOEmailDeVenda = async () => {
      const antes = new Set(contexto.pages());
      await mesa.click('.saida[data-grupo="fundos-venda"] [data-outlook]');
      for (let i = 0; i < 100; i++) {
        const janela = contexto.pages().find((pg) => !antes.has(pg) && !pg.isClosed() && pg.url().includes('/deeplink/compose'));
        if (janela) return janela;
        await mesa.waitForTimeout(100);
      }
      return null;
    };
    const janelaDoOutlook = await abrirOEmailDeVenda();
    const colou = janelaDoOutlook
      ? await janelaDoOutlook
        .waitForFunction(() => document.querySelectorAll('[role="textbox"] img').length === 2, null, { timeout: 30_000 })
        .then(() => true, () => false)
      : false;
    const corpoNoOutlook = janelaDoOutlook ? await janelaDoOutlook.evaluate(() => document.querySelector('[role="textbox"]')?.innerText ?? '') : '';
    ok(
      colou && corpoNoOutlook.includes('Condições:') && corpoNoOutlook.trim().endsWith('atte,'),
      `o robô põe no Outlook o e-mail de venda com os dois prints, abaixo de "Condições:"${colou ? '' : ` (${janelaDoOutlook ? 'a janela abriu' : 'a janela do e-mail não abriu'}; o robô disse ${JSON.stringify(loja.corpoColado ?? null)})`}`
    );
    const avisouQueColou = await mesa
      .waitForFunction(() => document.body.textContent.includes('Os prints da cotação estão no e-mail'), null, { timeout: 10_000 })
      .then(() => true, () => false);
    ok(avisouQueColou, 'a Mesa avisa que os prints estão no e-mail');
    ok(!JSON.stringify(loja).includes('data:image'), 'o corpo em HTML não fica no armazenamento do robô depois de colado');
    await janelaDoOutlook?.close();

    // O Outlook muda o rótulo e o papel do corpo do e-mail (1.12.0, a lição da caixa de entrada na
    // 1.11.0: a tela da Microsoft muda): o robô acha o corpo pelo começo do texto que a Mesa mandou.
    corpoDoOutlook = { papel: null, rotulo: 'Editor de texto' };
    // A janela do e-mail pelo endereço, e não pela primeira que abrir: no GitHub (Linux), outra aba pode
    // nascer no meio.
    const abertasAntes = new Set(contexto.pages());
    const outroOutlook = await abrirOEmailDeVenda();
    const colouNoOutro = outroOutlook
      ? await outroOutlook
        .waitForFunction(() => document.querySelectorAll('[contenteditable="true"] img').length === 2, null, { timeout: 30_000 })
        .then(() => true, () => false)
      : false;
    const porque = colouNoOutro
      ? ''
      : ` (${outroOutlook ? `janela ${outroOutlook.url().split('?')[0]}` : 'a janela do e-mail não abriu'}; o robô disse ${JSON.stringify(loja.corpoColado ?? null)}; abas novas: ${contexto.pages().filter((p) => !abertasAntes.has(p)).map((p) => p.url().split('?')[0]).join(', ')})`;
    ok(colouNoOutro, `com outro rótulo, e sem o papel de caixa de texto, o robô ainda acha o corpo do e-mail pelo texto e cola os prints${porque}`);
    await outroOutlook?.close();
    corpoDoOutlook = { papel: 'textbox', rotulo: 'Corpo da mensagem' };

    // ── A boleta pela Fila (robô 1.10.0) ──
    // O e-mail de venda entrou na Fila; aprovado, o botão Boleta pede ao robô a boleta do fundo: ele
    // abre o Hub numa aba à vista, espera a Prateleira e troca a rota para a boleta de venda da conta.
    // A aba é da pessoa: não vira do robô, e nada é preenchido.
    await aprovarNaFila();
    const [abaDaBoleta] = await Promise.all([contexto.waitForEvent('page'), mesa.click('.fl-cartao [data-acao="boleta"]')]);
    const levouABoleta = await abaDaBoleta
      .waitForFunction(() => /^#\/secundario\/vender\/[^/]+\/1234567$/.test(location.hash), null, { timeout: 30_000 })
      .then(() => true, () => false);
    ok(
      levouABoleta && (await abaDaBoleta.evaluate(() => window.name)) === '' && !(await abaDaBoleta.title()).startsWith('🤖'),
      `o botão Boleta da Fila: o robô abre o Hub à vista e leva à boleta de venda do fundo na conta, sem tomar a aba (${await abaDaBoleta.evaluate(() => location.hash)})`
    );
    ok((await abaDaBoleta.evaluate(() => window.__proximo ?? 0)) === 0 && (await abaDaBoleta.evaluate(() => (window.__estoqueEscolhido ?? []).length)) === 0, 'na boleta da pessoa, o robô não escolhe estoque nem clica em nada');
    await abaDaBoleta.close();
    await mesa.keyboard.press(altDe('ordens'));

    // ── O Tesouro Direto (robô 1.6.0) ──
    // O robô abre a aba dele no Renda Fixa, escolhe o cliente da conta e traz a lista que o Hub
    // recebe; a Mesa acha o título e monta o e-mail do modelo, com a taxa e o vencimento.
    await mesa.fill('#entrada', '1234567\nvia email\nCompra\nTesouro Selic 2031 R$ 2.000,00\nComprar 1k\nLFT');
    await mesa.focus('#entrada');
    await esquecerFila();
    await mesa.keyboard.press('Control+Enter');
    const tesouroPronto = await mesa
      .waitForFunction(() => document.querySelectorAll('.tesouro [data-tesouro="pronto"]').length === 2, null, { timeout: 45_000 })
      .then(() => true, () => false);
    ok(tesouroPronto && pedidosDoTesouro.includes('1234567'), 'o robô escolhe o cliente na página do Tesouro e traz a lista da conta');
    const emailDoTesouro = (await mesa.textContent('.saida[data-grupo="tesouro"] pre')) ?? '';
    ok(
      emailDoTesouro.includes('para a aplicação no Tesouro Direto abaixo na conta XP 1234567:') &&
        emailDoTesouro.includes('Título: Tesouro Selic 2031;\nTaxa: SELIC + 0,0992 %;\nVencimento: 01/03/2031;\nValor a ser aplicado: R$ 2.000,00') &&
        emailDoTesouro.includes('Valor a ser aplicado: R$ 1.000,00'),
      'o e-mail do Tesouro sai no modelo, com a taxa e o vencimento do Hub, e o valor da linha de cima ("Comprar 1k")'
    );
    ok((await mesa.textContent('.grupo-saidas[data-grupo="tesouro"]')).includes('não diz o vencimento'), '"LFT" sem o ano vai no único Selic da lista, com o aviso');
    ok(!(await mesa.textContent('.secundario.tesouro')).includes('NÃO PODE SAIR'), 'da lista do Tesouro só saem os dados dos títulos');
    const [outlookDoTesouro] = await Promise.all([contexto.waitForEvent('page'), mesa.click('.saida[data-grupo="tesouro"] [data-outlook]')]);
    // Com o cliente no Para, o assunto vai dentro do mailto:, codificado duas vezes.
    const enderecoDoTesouro = decodeURIComponent(decodeURIComponent(outlookDoTesouro.url()));
    ok(enderecoDoTesouro.includes('subject=Confirmação aplicação Tesouro Direto'), 'o e-mail do Tesouro abre no Outlook com o assunto dele');
    await outlookDoTesouro.close();

    // O e-mail do Tesouro entra na Fila (21/10/2026: "que apareçam os e-mails de Tesouro lá"), com o
    // título do Hub, o valor e o vencimento que saíram; o botão do Tesouro do cliente faz o robô abrir
    // o Tesouro Direto à vista e escolher o cliente da conta.
    await aprovarNaFila();
    const cartaoDoTesouro = await mesa.textContent('.fl-cartao');
    ok(
      cartaoDoTesouro.includes('Tesouro · Aplicação') && cartaoDoTesouro.includes('Tesouro Selic 2031') && cartaoDoTesouro.includes('R$ 2.000,00') && cartaoDoTesouro.includes('venc. 01/03/2031'),
      'o e-mail do Tesouro aparece na Fila, com o título do Hub, o valor e o vencimento do e-mail aprovado'
    );
    const listasAntes = pedidosDoTesouro.length;
    const [abaDoTesouro] = await Promise.all([contexto.waitForEvent('page'), mesa.click('.fl-cartao [data-acao="boleta"]')]);
    const pediuALista = await (async () => {
      for (let i = 0; i < 60 && !pedidosDoTesouro.slice(listasAntes).includes('1234567'); i++) await abaDoTesouro.waitForTimeout(500);
      return pedidosDoTesouro.slice(listasAntes).includes('1234567');
    })();
    ok(
      pediuALista && (await abaDoTesouro.evaluate(() => window.name)) === '' && abaDoTesouro.url().startsWith('https://hub.xpi.com.br/new/renda-fixa/'),
      'o botão "Tesouro do cliente": o robô abre o Tesouro Direto à vista e escolhe o cliente da conta, sem tomar a aba'
    );
    await abaDoTesouro.close();
    await mesa.keyboard.press(altDe('ordens'));

    // Outra conta, não habilitada no Tesouro: o erro do Hub segura o e-mail, com a mensagem dele.
    await mesa.fill('.campo-conta', '7654321');
    await mesa.press('.campo-conta', 'Tab');
    const naoHabilitada = await mesa
      .waitForFunction(() => document.querySelector('.saida[data-grupo="tesouro"]')?.textContent.includes('não está habilitada'), null, { timeout: 45_000 })
      .then(() => true, () => false);
    ok(naoHabilitada, 'a conta não habilitada no Tesouro segura o e-mail, com a mensagem do Hub');
    const lojaDoTesouro = JSON.stringify(loja);
    ok(!lojaDoTesouro.includes('Tesouro Selic') && !lojaDoTesouro.includes('7654321'), 'a lista e a conta não ficam no armazenamento do robô');

    // ── O resgate no Tesouro (robô 1.7.0) ──
    // O robô vai a Posições → Tesouro Direto na mesma aba, é levado à aba Renda Fixa (sem cliente
    // escolhido ali), escolhe o cliente, volta e traz a posição; o total é o valor disponível.
    await mesa.fill('#entrada', '1234567\nvia email\nResgate\nTesouro Selic 2031 R$ 5.000,00\nTesouro Selic 2029 total');
    await mesa.focus('#entrada');
    await esquecerFila();
    await mesa.keyboard.press('Control+Enter');
    const resgatePronto = await mesa
      .waitForFunction(() => document.querySelectorAll('.tesouro-resgate [data-resgate="pronto"]').length === 2, null, { timeout: 45_000 })
      .then(() => true, () => false);
    ok(resgatePronto && pedidosDasPosicoes.includes('1234567'), 'o robô escolhe o cliente em Posições → Tesouro Direto e traz a posição da conta');
    const emailDoResgate = (await mesa.textContent('.saida[data-grupo="tesouro-resgate"] pre')) ?? '';
    ok(
      emailDoResgate.includes('as ordens para os resgates no Tesouro Direto abaixo na conta XP 1234567:') &&
        emailDoResgate.includes('Título: Tesouro Selic 2031;\nVencimento: 01/03/2031;\nValor a ser resgatado: R$ 5.000,00') &&
        emailDoResgate.includes('Título: Tesouro Selic 2029;\nVencimento: 01/03/2029;\nValor a ser resgatado: R$ 10.045,13') &&
        emailDoResgate.trim().endsWith('atte,'),
      'o e-mail de resgate sai no modelo, com o vencimento da posição e o total pelo valor disponível'
    );
    ok(!(await mesa.textContent('.secundario.tesouro-resgate')).includes('17.777,77'), 'da posição não sai o preço médio');
    const [outlookDoResgate] = await Promise.all([contexto.waitForEvent('page'), mesa.click('.saida[data-grupo="tesouro-resgate"] [data-outlook]')]);
    ok(
      decodeURIComponent(decodeURIComponent(outlookDoResgate.url())).includes('subject=Confirmação resgate Tesouro Direto'),
      'o e-mail de resgate abre no Outlook com o assunto dele'
    );
    await outlookDoResgate.close();

    // Acima do valor disponível bloqueia, com "Resgatar o total".
    await mesa.fill('#entrada', '1234567\nvia email\nResgate Tesouro Selic 2031 R$ 90.000,00');
    await mesa.focus('#entrada');
    await esquecerFila();
    await mesa.keyboard.press('Control+Enter');
    const acima = await mesa
      .waitForFunction(() => document.querySelector('.grupo-saidas[data-grupo="tesouro-resgate"]')?.textContent.includes('passa do valor disponível'), null, { timeout: 45_000 })
      .then(() => true, () => false);
    ok(acima, 'o resgate acima do valor disponível bloqueia');
    await mesa.click('.grupo-saidas[data-grupo="tesouro-resgate"] [data-campo="usar-posicao"]');
    ok(
      ((await mesa.textContent('.saida[data-grupo="tesouro-resgate"] pre')) ?? '').includes('Valor a ser resgatado: R$ 84.102,44'),
      '"Resgatar o total" põe o valor disponível no e-mail'
    );
    const lojaDoResgate = JSON.stringify(loja);
    ok(!lojaDoResgate.includes('84102') && !lojaDoResgate.includes('Tesouro Selic'), 'a posição não fica no armazenamento do robô');

    // A releitura (robô 1.7.0): o Hub não pede de novo, na mesma carga da página, a lista ou a posição
    // que já pediu. O robô recarrega a aba dele e retoma o pedido, sem a Mesa abrir outra aba. O pedido
    // vai ao robô pela mesma mensagem que a Mesa usa.
    const pedirAoRobo = (leitura) =>
      mesa.evaluate(
        (leitura) =>
          new Promise((resolver) => {
            const id = `releitura-${leitura}-${Date.now()}`;
            const ouvir = (e) => {
              if (e.data?.origem !== 'robo-hub' || e.data.tipo !== 'tesouro' || e.data.id !== id) return;
              removeEventListener('message', ouvir);
              resolver({ itens: e.data.itens?.length ?? null, posicoes: e.data.posicoes?.length ?? null, erro: e.data.erro ?? null });
            };
            addEventListener('message', ouvir);
            postMessage({ origem: 'mesa-xp', tipo: 'pedir-tesouro', id, conta: '1234567', leitura }, '*');
            setTimeout(() => resolver({ erro: 'sem resposta em 60 s' }), 60_000);
          }),
        leitura
      );
    const abasDoRendaFixa = () => contexto.pages().filter((p) => p.url().startsWith('https://hub.xpi.com.br/new/renda-fixa')).length;
    let cargas = cargasDoRendaFixa;
    const relista = await pedirAoRobo('lista');
    ok(relista.itens === 3 && cargasDoRendaFixa === cargas + 1, `a lista lida de novo: o robô recarrega a aba e retoma o pedido ${JSON.stringify(relista)}`);
    cargas = cargasDoRendaFixa;
    const primeiraPosicao = await pedirAoRobo('posicoes');
    ok(primeiraPosicao.posicoes === 2 && cargasDoRendaFixa === cargas, `a posição ainda não lida nesta carga vem no clique da aba, sem recarregar ${JSON.stringify(primeiraPosicao)}`);
    const reposicao = await pedirAoRobo('posicoes');
    ok(reposicao.posicoes === 2 && cargasDoRendaFixa === cargas + 1, `a posição lida de novo: recarrega e clica na aba ${JSON.stringify(reposicao)}`);
    ok(abasDoRendaFixa() === 1, `uma aba do Tesouro só, sem outra aberta pela Mesa (${abasDoRendaFixa()})`);

    // A conta do pedido seguinte colada no fim da linha (pedido real de 20/10/2026, contas fictícias):
    // bloqueia sem confirmar, e "Separar" devolve a quebra de linha e faz dois cartões.
    await mesa.fill('#entrada', '1234567\n\nCompra\nLFT - R$ 81.708,17   7654321 \nComprar 2k\nTesouro Selic 2031\nEmail');
    await mesa.focus('#entrada');
    await esquecerFila();
    await mesa.keyboard.press('Control+Enter');
    await mesa.waitForSelector('[data-campo="separar-conta"]');
    ok(
      (await mesa.textContent('#solicitacoes')).includes('parece a conta de outro pedido') && (await mesa.$$('.campo-conta')).length === 1,
      'a conta colada no fim da linha segura o cartão, sem confirmar'
    );
    await mesa.click('[data-campo="separar-conta"]');
    const contasSeparadas = await mesa.$$eval('.campo-conta', (campos) => campos.map((c) => c.value));
    ok(
      JSON.stringify(contasSeparadas) === JSON.stringify(['1234567', '7654321']) && (await mesa.inputValue('#entrada')).includes('81.708,17\n7654321'),
      `"Separar" faz dois pedidos, e o de baixo fica na conta dele (${contasSeparadas.join(', ')})`
    );

    // ── As respostas no Outlook (robô 1.8.0) ──
    // O e-mail copiado entra na Fila; com a caixa de entrada aberta numa aba, a resposta do cliente
    // passa o cartão para "O cliente respondeu", com a prévia. O robô não lê o resto da caixa.
    await esquecerFila();
    await mesa.fill('#entrada', '1234567\nvia email\nC PETR4 100');
    await mesa.focus('#entrada');
    await mesa.keyboard.press('Control+Enter');
    await esperarCliente('FULANA DE TAL DA SILVA');
    await mesa.locator('[data-copiar="email"]').first().click();
    const caixa = await novaAba('https://outlook.cloud.microsoft/mail/inbox');
    await caixa.waitForFunction(() => typeof window.chegar === 'function');
    await caixa.evaluate(() =>
      // O modo conversas: o assunto sem o RE:, a resposta de outro endereço do cliente, e a conta na
      // prévia, do começo do e-mail citado. É a conta que liga a resposta ao pedido (robô 1.9.1).
      chegar({ id: 'c1', de: 'Fulana Tal', email: 'fulana.pessoal@exemplo.com.br', hora: '10:42', assunto: 'Confirmação de ordem', previa: 'De acordo, pode seguir. Em ter., 21 de out. de 2026 às 10:00, Mesa escreveu: Prezado(a) FULANA DE TAL DA SILVA, Conforme conversado, gostaria de realizar a ordem abaixo na conta XP 1234567:' })
    );
    await mesa.keyboard.press(altDe('fila'));
    const respondeu = await mesa
      .waitForFunction(() => document.querySelector('[data-fl="lista"] .fl-cartao[data-estado="respondeu"]')?.textContent.includes('De acordo, pode seguir.'), null, { timeout: 30_000 })
      .then(() => true, () => false);
    ok(respondeu, 'a resposta no Outlook, no modo conversas (sem RE: e de outro endereço), casa pela conta citada e traz o pedido para Aprovação e execução, com a prévia');
    ok((await mesa.getAttribute('[data-fl="outlook"]', 'data-tipo')) === 'vigiando', 'a Fila diz que está vendo as respostas no Outlook');
    const todasAsEscritas = escritas.join('\n');
    ok(
      !todasAsEscritas.includes('TEXTO QUE O ROBO NAO PODE LER') && !todasAsEscritas.includes('Pauta de amanhã') && !todasAsEscritas.includes('RESPOSTA ANTIGA'),
      'da caixa de entrada só passam as respostas de hoje aos e-mails de confirmação: nem a outra mensagem, nem a resposta antiga'
    );
    // Desde a 1.11.0 a aba do Outlook relê na hora a cada pedido da Mesa: entre a escrita e a entrega
    // há um instante em que a resposta está no armazenamento. Ela tem de sair logo — não ficar.
    let saiuDoArmazenamento = false;
    for (let i = 0; i < 50 && !saiuDoArmazenamento; i++) {
      saiuDoArmazenamento = loja.outlookVigia === null && !JSON.stringify(loja).includes('De acordo');
      if (!saiuDoArmazenamento) await mesa.waitForTimeout(100);
    }
    ok(saiuDoArmazenamento, 'a resposta sai do armazenamento do robô assim que a Mesa a recebe');
    ok((await caixa.evaluate(() => window.__cliques)) === 0, 'o robô não clica em nada na caixa de entrada');

    // Uma resposta de quem não tem cartão: fica a conferir, e "Não é de pedido" a tira.
    await caixa.evaluate(() =>
      chegar({ id: 'c2', de: 'Beltrano Souza', email: 'beltrano@exemplo.com', hora: '10:50', assunto: 'RE: Confirmação de ordem', previa: 'Pode sim.' })
    );
    const aConferir = await mesa.waitForSelector('[data-fl="conferir"] .fl-solta', { timeout: 30_000 }).then(() => true, () => false);
    ok(aConferir && (await mesa.textContent('[data-fl="conferir"]')).includes('Beltrano Souza'), 'a resposta que não casou fica em "Respostas a conferir", com os pedidos para escolher');
    await mesa.click('[data-fl="conferir"] [data-acao="ignorar"]');
    ok(await mesa.isHidden('[data-fl="conferir"]'), '"Não é de pedido" tira a resposta da conferência');
    await caixa.close();

    // ── A Prateleira de fundos (21/10/2026): a mesma captura do Ordens, numa tabela que ordena, e o que
    // mudou contra a foto do último dia (plantada aqui, com o deságio de um fundo diferente).
    await mesa.evaluate(() => {
      const fotos = { '2000-01-01': { 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee': { nome: 'Valora Imobiliário Multiestratégia Premium', ticker: 'VGPR11', desagio: 5, roaMaximo: 0.5, estoque: 500000 } } };
      localStorage.setItem('mesa_prateleira_fotos', JSON.stringify(fotos));
    });
    await mesa.keyboard.press(altDe('fundos'));
    await mesa.waitForSelector('.fu-tabela tbody tr');
    ok((await mesa.$$eval('.fu-tabela tbody tr', (l) => l.length)) === 3, 'a aba Fundos mostra os três fundos da prateleira do Hub');
    ok((await mesa.textContent('.fu-tabela tbody tr:first-child .fu-fundo')).includes('IMOV11'), 'ordenada pelo maior deságio');
    await mesa.click('[data-ordenar="nome"]');
    ok((await mesa.textContent('.fu-tabela tbody tr:first-child .fu-fundo')).includes('Navi'), 'o clique no cabeçalho ordena pelo nome');
    await mesa.fill('[data-fu="busca"]', 'vgpr');
    ok((await mesa.$$eval('.fu-tabela tbody tr', (l) => l.length)) === 1, 'a busca filtra pelo ticker');
    ok(
      (await mesa.textContent('[data-fu="mudancas"]')).includes('Deságio') && (await mesa.textContent('[data-fu="mudancas"]')).includes('Entraram'),
      'o que mudou desde a última foto: o deságio do fundo e os que entraram'
    );
    await mesa.fill('[data-fu="busca"]', '');
    await mesa.screenshot({ path: join(temporario, 'fundos.png'), fullPage: true });

    ok(erros.length === 0, `console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
    await contexto.close();

    const semRobo = await abrir();
    await new Promise((r) => setTimeout(r, 300));
    ok((await semRobo.pagina.textContent('#robo-status')) === 'não instalado', 'sem o robô, a Mesa diz que ele não está');
    ok(await semRobo.pagina.evaluate(() => document.querySelector('#secundario-manual').open), 'e deixa aberto o carregamento à mão');
    ok(await semRobo.pagina.isHidden('#btn-atualizar-cotacoes'), 'e esconde o "Atualizar cotações"');
    ok(
      (await semRobo.pagina.isVisible('#btn-instalar-robo')) && (await semRobo.pagina.textContent('#btn-instalar-robo')) === 'Instalar robô',
      'sem o robô, a Mesa oferece "Instalar robô", que abre o robô no site para o Tampermonkey (1.13.0)'
    );
    await semRobo.pagina.click('#btn-copiar-robo');
    ok((await semRobo.pagina.evaluate(() => navigator.clipboard.readText())).startsWith('// ==UserScript=='), '"Copiar robô" copia o script do Tampermonkey');
    await semRobo.contexto.close();
  }

  /* ── Operacional no build normal ────────────────────────────────────────────────── */
  titulo('Operacional no build normal (banco da mesa)');
  {
    const { pagina, contexto, erros } = await abrir({ arquivo: distNormal, hash: '#operacional' });
    await pagina.waitForFunction(
      () => document.querySelector('[data-op="conexao"]')?.textContent === 'ao vivo' || document.querySelector('[data-op="erro"] .alert'),
      null,
      { timeout: 45_000 }
    );
    const erroNaTela = await pagina.$('[data-op="erro"] .alert');
    if (erroNaTela) {
      console.log(`   o banco não respondeu: "${(await erroNaTela.innerText()).split('\n')[0]}"`);
      ok(true, 'sem banco, o erro aparece na tela, com "Tentar de novo"');
      ok((await pagina.evaluate(() => localStorage.getItem('mesa_operacional'))) === null, 'sem banco, nada é gravado no modo local');
      ok(!erros.some((e) => !/Failed to fetch|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|Failed to load resource|ErroDoRepositorio|WebSocket/i.test(e)), 'sem banco, só erros de rede no console');
    } else {
      ok((await pagina.$$eval('.op-grupo', (g) => g.length)) >= 5, 'conectou e mostrou a base do banco');
      ok(erros.length === 0, `console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
    }
    await contexto.close();
  }

  /* ── Calendário com a rede caída ────────────────────────────────────────────────── */
  titulo('Calendário com a rede caída: o aviso na hora, com a contagem');
  {
    const contexto = await navegador.newContext();
    await contexto.route(/supabase\.co/, (r) => r.abort('internetdisconnected'));
    const pagina = await contexto.newPage();
    const inicio = Date.now();
    await pagina.goto(`${pathToFileURL(distNormal).href}#calendario`);
    await pagina.waitForSelector('.cal-erro .alert-warning', { timeout: 5_000 }).catch(() => null);
    const decorrido = Date.now() - inicio;
    const aviso = (await pagina.$('.cal-erro .alert-warning')) && (await pagina.innerText('.cal-erro .alert-warning'));
    ok(Boolean(aviso) && /Tentando conectar de novo \(\d de 4\)/.test(aviso) && decorrido < 5_000, `a queda aparece em menos de 5 s, com a contagem (${decorrido} ms: "${aviso}")`);
    ok((await pagina.textContent('[data-cal="conexao"]')) === 'tentando conectar…', 'o status diz "tentando conectar…"');
    await pagina.waitForSelector('.cal-erro .alert-danger [data-cal="tentar"]', { timeout: 20_000 });
    ok((await pagina.textContent('[data-cal="conexao"]')) === 'sem conexão', 'depois das tentativas, o erro com "Tentar de novo" e "sem conexão"');
    await contexto.close();
  }

  /* ── Calendário no build normal ─────────────────────────────────────────────────── */
  titulo('Calendário no build normal (banco da mesa)');
  {
    const { pagina, contexto, erros } = await abrir({ arquivo: distNormal, hash: '#calendario' });
    await pagina.waitForFunction(
      () => document.querySelector('[data-cal="conexao"]')?.textContent === 'ao vivo' || document.querySelector('.cal-erro .alert-danger'),
      null,
      { timeout: 45_000 }
    );
    const status = await pagina.textContent('[data-cal="conexao"]');
    const erroNaTela = await pagina.$('.cal-erro .alert-danger');
    if (erroNaTela) {
      console.log(`   o banco não respondeu: "${(await erroNaTela.innerText()).split('\n')[0]}"`);
      ok(true, 'sem banco, o erro aparece na tela');
      ok((await pagina.evaluate(() => localStorage.getItem('presenca_app_data'))) === null, 'sem banco, nada é gravado no modo local');
      ok(!erros.some((e) => !/Failed to fetch|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|Failed to load resource|ErroDoRepositorio|WebSocket/i.test(e)), 'sem banco, só erros de rede no console');
    } else {
      ok(status === 'ao vivo', 'conectou ao banco e ao Realtime');
      ok(erros.length === 0, `console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
    }
    await contexto.close();
  }
} finally {
  await navegador.close();
}

console.log(`\nCapturas de tela em ${temporario}`);
console.log(falhas ? `${falhas} verificação(ões) falharam.` : 'Tudo conferido no navegador.');
process.exit(falhas ? 1 : 0);

/**
 * Verificação no navegador: o que os testes do core não veem.
 *
 * Abre o `dist/index.html` via file:// no Chromium (Playwright) e confere:
 *   - as cinco abas, pelo clique, pelo hash e por Alt+1 a Alt+5, e os atalhos do Ordens presos à aba;
 *   - as cinco abas nos dois temas, a 1400px e a ~360px, sem rolagem horizontal e sem erro no console;
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

process.env.TZ = 'America/Sao_Paulo';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const distNormal = join(raiz, 'dist/index.html');
if (!existsSync(distNormal)) {
  console.error('dist/index.html não existe: rode npm run build antes.');
  process.exit(1);
}

let falhas = 0;
const ok = (condicao, mensagem) => {
  if (!condicao) falhas++;
  console.log(`${condicao ? 'ok ' : 'FALHOU'} ${mensagem}`);
};
const titulo = (texto) => console.log(`\n── ${texto}`);

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
    await pagina.keyboard.press('Alt+2');
    ok((await visivel()) === 'modulo-rendafixa' && (await pagina.evaluate(() => location.hash)) === '#rendafixa', 'Alt+2 abre a Renda Fixa e muda o hash');
    await pagina.keyboard.press('Alt+3');
    ok((await visivel()) === 'modulo-calendario', 'Alt+3 abre o Calendário');
    await pagina.keyboard.press('Alt+4');
    ok((await visivel()) === 'modulo-operacional', 'Alt+4 abre o Operacional');
    await pagina.keyboard.press('Alt+5');
    ok((await visivel()) === 'modulo-anotacoes', 'Alt+5 abre as Anotações');
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
    await pagina.fill('#entrada', '1234567\nCOMPRA\nPETR4 100');
    await pagina.keyboard.press('Alt+2');
    await pagina.keyboard.press('Control+Enter');
    await pagina.keyboard.press('Alt+h');
    await pagina.keyboard.press('Alt+1');
    ok((await pagina.$eval('#solicitacoes', (e) => e.children.length)) === 0, 'Ctrl+Enter na aba Renda Fixa não analisa o Ordens');
    ok(!(await pagina.$eval('#drawer-historico', (e) => e.classList.contains('open'))), 'Alt+H na aba Renda Fixa não abre o histórico do Ordens');
    await pagina.focus('#entrada');
    await pagina.keyboard.press('Control+Enter');
    ok((await pagina.$eval('#solicitacoes', (e) => e.children.length)) === 1, 'Ctrl+Enter na aba Ordens analisa');
    await pagina.keyboard.press('m');
    await pagina.keyboard.press('Alt+2');
    ok(await pagina.$eval('[data-mercado="primario"]', (b) => b.classList.contains('ativo')), '"m" na aba Ordens não troca o mercado do Renda Fixa');
    await pagina.keyboard.press('m');
    ok(await pagina.$eval('[data-mercado="secundario"]', (b) => b.classList.contains('ativo')), '"m" logo depois de Alt+2 já vale na Renda Fixa');
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

  /* ── Três abas, dois temas, duas larguras ───────────────────────────────────────── */
  titulo('Cinco abas × dois temas × 1400px e 360px (build em modo local)');
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
    for (const largura of [1400, 360]) {
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

      await pagina.keyboard.press('Alt+2');
      await pagina.setInputFiles('[data-rf="entrada-arquivo"]', planilhaSintetica);
      await pagina.waitForSelector('.rf-secao');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Renda Fixa, cartões, sem rolagem lateral`);
      await pagina.keyboard.press('v');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Renda Fixa, mensagem, sem rolagem lateral`);

      await pagina.keyboard.press('Alt+3');
      await adicionarColaborador(pagina, 'Colaborador de Nome Bem Comprido Teste');
      await pagina.locator('.cal-dia').first().click();
      await pagina.check('[data-cal="presencial"]');
      await pagina.click('[data-cal="salvar"]');
      await pagina.waitForFunction(() => !document.querySelector('.cal-dialogo').open);
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Calendário, semana, sem rolagem lateral`);
      await pagina.click('[data-visao="historico"]');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Calendário, histórico, sem rolagem lateral`);

      await pagina.keyboard.press('Alt+4');
      await pagina.waitForSelector('.op-grupo');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Operacional, início, sem rolagem lateral`);
      await pagina.click('.op-linha >> nth=0');
      await pagina.waitForSelector('.op-texto');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Operacional, post aberto, sem rolagem lateral`);
      await pagina.click('[data-acao="editar"]');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Operacional, editor, sem rolagem lateral`);
      await pagina.click('[data-acao="cancelar"]');

      await pagina.keyboard.press('Alt+5');
      await pagina.waitForSelector('.an-lateral', { state: 'visible' });
      await pagina.click('[data-an="nova"]');
      await pagina.waitForSelector('[data-campo="titulo"]', { state: 'visible' });
      await pagina.fill('[data-campo="titulo"]', 'Anotação de um título bem comprido para ver se cabe na tela do celular');
      await pagina.click('[data-atalho="2-dias"]');
      ok(await semRolagemLateral(pagina), `${tema} ${largura}px: Anotações, anotação aberta com lembrete, sem rolagem lateral`);

      const abas = await pagina.$$eval('.aba', (as) => as.map((a) => a.getBoundingClientRect().right));
      ok(Math.max(...abas) <= (largura <= 720 ? largura - 15 : largura), `${tema} ${largura}px: as cinco abas cabem dentro da margem`);

      if (tema === 'escuro' && largura === 1400) {
        await pagina.keyboard.press('Alt+3');
        await pagina.click('[data-visao="semana"]');
        const vazamentos = await pagina.evaluate((seletores) => {
          const achados = [];
          for (const raizModulo of ['#modulo-rendafixa', '#modulo-calendario', '#modulo-operacional', '#modulo-anotacoes']) {
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
      await pagina.keyboard.press('Alt+1');
      await pagina.fill('#entrada', '');
      await pagina.focus('#entrada');
      await pagina.keyboard.press('Control+V');
      const colado = await pagina.inputValue('#entrada');
      await pagina.fill('#entrada', '');
      await pagina.keyboard.press('Alt+2');
      ok(colado === golden(nome, modo).texto, `${nome} (${modo}): texto colado = golden`);
    }
    ok(erros.length === 0, `${nome}: console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
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
    await pagina.check('[data-cal="presencial"]');
    await pagina.fill('[data-cal="observacao"]', 'obs <b>teste</b>');
    await pagina.fill('[data-cal="inicio"]', '14:00');
    await pagina.fill('[data-cal="fim"]', '15:00');
    await pagina.fill('[data-cal="motivo"]', 'motivo <i>teste</i>');
    await pagina.press('[data-cal="motivo"]', 'Enter');
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

    // Copiar e colar: o texto que vai para o e-mail é o do Slab.
    const compra = POSTS.find((p) => p.slug === 'confirmacao-de-ordem-compra');
    await pagina.click(`.op-linha:has-text("${compra.titulo}")`);
    await pagina.waitForSelector('[data-acao="copiar"]');
    await pagina.click('[data-acao="copiar"]');
    await pagina.waitForFunction(() => document.querySelector('[data-acao="copiar"]').textContent === 'Copiado');
    await pagina.keyboard.press('Alt+1');
    await pagina.fill('#entrada', '');
    await pagina.focus('#entrada');
    await pagina.keyboard.press('Control+V');
    ok((await pagina.inputValue('#entrada')) === compra.conteudo, '"Copiar texto" copia exatamente o texto do Slab (colado com Ctrl+V)');
    await pagina.fill('#entrada', '');
    await pagina.keyboard.press('Alt+4');

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
    await pagina.waitForSelector('.op-titulo');
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
    const contadorHoje = await pagina.waitForFunction(() => document.querySelector('.aba-contador')?.textContent === '1', null, { timeout: 5000 }).then(() => true, () => false);
    ok(contadorHoje && !(await pagina.$eval('.aba-contador', (c) => c.classList.contains('vencidas'))), 'lembrete para hoje: contador âmbar na aba');
    await pagina.keyboard.press('Alt+1');
    await contexto.clock.fastForward('26:00');
    await pagina.waitForSelector('.an-alerta', { timeout: 5000 }).catch(() => null);
    ok(Boolean(await pagina.$('.an-alerta')), 'no Ordens, quando a hora chega, o alerta do lembrete aparece');
    ok((await pagina.title()).startsWith('(1) ') && (await pagina.$eval('.aba-contador', (c) => c.classList.contains('vencidas'))), 'o título da página e o contador da aba ficam em alerta');
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
    const contadorSumiu = await pagina.waitForFunction(() => document.querySelector('.aba-contador').hidden, null, { timeout: 5000 }).then(() => true, () => false);
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
    const robo = readFileSync(join(raiz, 'src/modulos/ordens/platform/robo-hub.user.js'), 'utf8');

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
      window.GM_openInTab = (url) => { window.__gm('abrir', url); };
      window.unsafeWindow = window;
      // O Hub como o Chrome o trata em segundo plano: escondido e sem quadro de desenho.
      if (location.hostname === 'hub.xpi.com.br') {
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
    const pedidosAoHub = { lista: 0, preCheck: 0, ficha: 0 };
    const novaAba = async (url) => {
      const p = await contexto.newPage();
      await p.addInitScript(`window.__gmFoto = ${JSON.stringify(loja)};`);
      await p.goto(url).catch(() => {});
      return p;
    };
    await contexto.exposeBinding('__gm', async (_origem, op, chave, valor) => {
      if (op === 'set') {
        loja[chave] = valor;
        for (const p of contexto.pages()) p.evaluate(([k, v]) => window.__gmMudou?.(k, v), [chave, valor]).catch(() => {});
      }
      if (op === 'abrir') novaAba(chave);
    });
    await contexto.route('https://gm.teste/**', (r) =>
      r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(loja) })
    );
    await contexto.addInitScript(GM);
    await contexto.addInitScript(robo);
    await contexto.route(`${API}/**`, (r) => {
      const url = new URL(r.request().url());
      const ehPreCheck = url.pathname.endsWith('/order-secondary/pre-check');
      pedidosAoHub[ehPreCheck ? 'preCheck' : 'lista']++;
      const corpo = ehPreCheck ? preCheck(url.searchParams.get('f'), url.searchParams.get('l')) : resposta;
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
    const colar = async () => {
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
    ok(erros.length === 0, `console sem erros ${erros.length ? JSON.stringify(erros) : ''}`);
    await contexto.close();

    const semRobo = await abrir();
    await new Promise((r) => setTimeout(r, 300));
    ok((await semRobo.pagina.textContent('#robo-status')) === 'não instalado', 'sem o robô, a Mesa diz que ele não está');
    ok(await semRobo.pagina.evaluate(() => document.querySelector('#secundario-manual').open), 'e deixa aberto o carregamento à mão');
    ok(await semRobo.pagina.isHidden('#btn-atualizar-cotacoes'), 'e esconde o "Atualizar cotações"');
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

  /* ── Calendário no build normal ─────────────────────────────────────────────────── */
  titulo('Calendário no build normal (banco da mesa)');
  {
    const { pagina, contexto, erros } = await abrir({ arquivo: distNormal, hash: '#calendario' });
    await pagina.waitForFunction(
      () => document.querySelector('[data-cal="conexao"]')?.textContent === 'ao vivo' || document.querySelector('.cal-erro .alert'),
      null,
      { timeout: 45_000 }
    );
    const status = await pagina.textContent('[data-cal="conexao"]');
    const erroNaTela = await pagina.$('.cal-erro .alert');
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

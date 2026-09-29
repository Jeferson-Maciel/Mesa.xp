/**
 * Verificação no navegador: o que os testes do core não veem.
 *
 * Abre o `dist/index.html` via file:// no Chromium (Playwright) e confere:
 *   - as três abas, pelo clique, pelo hash e por Alt+1/2/3, e os atalhos do Ordens presos à aba;
 *   - as três abas nos dois temas, a 1400px e a ~360px, sem rolagem horizontal e sem erro no console;
 *   - que nenhum seletor do CSS do Ordens pega elemento das abas Renda Fixa e Calendário;
 *   - Renda Fixa: a planilha carregada na tela, o texto copiado e colado (Ctrl+V) idêntico ao golden,
 *     nos dois mercados — com as exportações reais da XP, se estiverem em fixtures/, e sempre com a
 *     planilha sintética convertida para .xlsx;
 *   - Calendário em modo local (um build à parte, com as duas variáveis vazias): nome com
 *     <img onerror> aparece como texto, a janela do dia, o histórico e a exclusão em cascata;
 *   - Calendário no build normal: ou conecta ("ao vivo"), ou mostra o erro na tela — nunca cai calado
 *     no modo local.
 *
 * Uso:  npm run build && node scripts/verificar-navegador.mjs
 * Na primeira vez: npx playwright install chromium
 *
 * Não grava nada no banco. O teste contra o Supabase real é o scripts/verificar-supabase.mjs.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
    await pagina.click('.aba[data-aba="ordens"]');
    // O clique troca pelo hashchange, que chega logo depois.
    await pagina.waitForFunction(() => !document.getElementById('modulo-ordens').hidden, null, { timeout: 2000 }).catch(() => {});
    ok((await visivel()) === 'modulo-ordens', 'o clique na aba Ordens volta');
    for (const hash of ['#rendafixa', '#calendario', '#xyz']) {
      await pagina.goto(pathToFileURL(distLocal).href + hash);
      const esperado = hash === '#xyz' ? 'modulo-ordens' : `modulo-${hash.slice(1)}`;
      ok((await visivel()) === esperado, `link direto ${hash} abre ${esperado}`);
    }
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

  /* ── Três abas, dois temas, duas larguras ───────────────────────────────────────── */
  titulo('Três abas × dois temas × 1400px e 360px (build em modo local)');
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

      if (tema === 'escuro' && largura === 1400) {
        await pagina.click('[data-visao="semana"]');
        const vazamentos = await pagina.evaluate((seletores) => {
          const achados = [];
          for (const raizModulo of ['#modulo-rendafixa', '#modulo-calendario']) {
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
        ok(vazamentos.length === 0, `nenhum dos ${seletoresDoOrdens.length} seletores do CSS do Ordens pega elemento da Renda Fixa ou do Calendário ${vazamentos.length ? JSON.stringify(vazamentos) : ''}`);
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

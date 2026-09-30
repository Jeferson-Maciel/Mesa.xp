/**
 * O Operacional contra o Supabase REAL: leitura, criação, edição, o conflito de versão entre duas
 * abas, a exclusão que só esconde, o Realtime, a queda de rede no salvamento e o que o banco
 * garante sozinho (a chave anon não apaga, não lê o histórico, e o gatilho guarda cada versão).
 *
 * GRAVA NO BANCO DA MESA. Só mexe num post de teste ("ZZ Teste Mesa XP <b>…</b>", no tópico
 * Disparos) criado aqui mesmo; os posts da mesa só são lidos. Rode fora do expediente: quem estiver
 * com a aba aberta vê o post de teste aparecer e sumir.
 *
 * A chave anon não apaga nada no Operacional (é a regra), então o post de teste termina escondido,
 * como qualquer post excluído pela tela. Para apagá-lo de verdade, com o histórico junto, o script
 * usa a API de gerenciamento do Supabase quando SUPABASE_ACCESS_TOKEN está no ambiente (um token
 * pessoal, de supabase.com/dashboard/account/tokens — nunca gravado em arquivo). Sem o token, ele
 * imprime o SQL para colar no SQL Editor, e as conferências do histórico ficam de fora.
 *
 * Uso:  npm run build && node scripts/verificar-supabase-operacional.mjs
 * Usa o banco do build (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, ou o padrão de config.js).
 */
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const projeto = fileURLToPath(new URL('..', import.meta.url));
const { resolverConfig } = await import(pathToFileURL(join(projeto, 'src/dados/config.js')).href);
const PADRAO = (() => {
  const config = resolverConfig({ VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY });
  if (config.modo !== 'supabase') {
    console.error('Sem banco configurado (modo local ou configuração inválida): nada a verificar.');
    process.exit(1);
  }
  return { url: config.url, chave: config.chave };
})();
const base = pathToFileURL(join(projeto, 'dist/index.html')).href;
const PREFIXO = 'ZZ Teste Mesa XP';
const TITULO = `${PREFIXO} <b>${String(Date.now()).slice(-4)}</b>`;
const LIMPEZA_SQL = `delete from public.operacional_posts where titulo like '${PREFIXO}%';`;

const rest = async (caminho, opcoes = {}) => {
  const r = await fetch(`${PADRAO.url}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: { apikey: PADRAO.chave, Authorization: `Bearer ${PADRAO.chave}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...opcoes.headers }
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${texto}`);
  return texto ? JSON.parse(texto) : null;
};
const q = encodeURIComponent;

// A API de gerenciamento roda SQL como dono do banco: só ela enxerga o histórico e apaga de verdade.
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = new URL(PADRAO.url).hostname.split('.')[0];
const sql = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`API de gerenciamento: ${r.status} ${texto}`);
  return JSON.parse(texto);
};

let falhas = 0;
const ok = (cond, msg) => {
  if (!cond) falhas++;
  console.log(`${cond ? 'ok ' : 'FALHOU'} ${msg}`);
};
const esperar = async (fn, ms = 15000) => {
  const inicio = Date.now();
  while (Date.now() - inicio < ms) {
    if (await fn()) return Date.now() - inicio;
    await new Promise((r) => setTimeout(r, 150));
  }
  return -1;
};

// Sobras de uma execução que caiu no meio: com o token, apagadas; sem ele, ao menos escondidas.
const limpar = async () => {
  if (TOKEN) return (await sql(`${LIMPEZA_SQL.slice(0, -1)} returning id;`)).length;
  const escondidos = await rest(`operacional_posts?titulo=like.${q(PREFIXO + '*')}&excluido_em=is.null`, {
    method: 'PATCH',
    body: JSON.stringify({ excluido_em: new Date().toISOString() })
  });
  return escondidos.length;
};
try {
  console.log(`sobras de execuções anteriores ${TOKEN ? 'apagadas' : 'escondidas'}: ${await limpar()}`);
} catch (erro) {
  console.error(`O banco não respondeu (${erro.cause?.code ?? erro.message}). Confira no painel do Supabase se o projeto está ativo.`);
  process.exit(1);
}
if (!TOKEN) console.log('sem SUPABASE_ACCESS_TOKEN: o histórico não é conferido, e o post de teste fica escondido no banco');

const navegador = await chromium.launch();
try {
  const contexto = await navegador.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: 'America/Sao_Paulo' });
  const erros = [];
  const abrir = async (rotulo, hash) => {
    const p = await contexto.newPage();
    p.on('console', (m) => m.type() === 'error' && erros.push(`${rotulo}: ${m.text()}`));
    p.on('pageerror', (e) => erros.push(`${rotulo}: ${e}`));
    p.on('dialog', (d) => d.accept());
    await p.goto(base + hash);
    return p;
  };
  const A = await abrir('A', '#operacional/topico/disparos');
  const B = await abrir('B', '#operacional');
  for (const [rotulo, p] of [['A', A], ['B', B]]) {
    const t = await esperar(() => p.$eval('[data-op="conexao"]', (e) => e.textContent === 'ao vivo').catch(() => false));
    ok(t >= 0, `aba ${rotulo}: leu o banco e o realtime conectou ("ao vivo" em ${t} ms)`);
  }

  // Leitura: a tela mostra o que o banco tem.
  const topicos = await rest('operacional_topicos?select=id,slug');
  const disparos = topicos.find((t) => t.slug === 'disparos');
  const visiveis = await rest('operacional_posts?excluido_em=is.null&select=id,topico_id');
  const emDisparos = visiveis.filter((p) => p.topico_id === disparos.id).length;
  const total = (p) => p.$eval('.op-arvore > li > .op-no .op-contagem', (e) => Number(e.textContent));
  const linhas = (p) => p.$$eval('.op-linha', (l) => l.length);
  ok(topicos.length >= 6, `leitura: ${topicos.length} tópicos no banco (a raiz e os cinco do Slab)`);
  ok((await linhas(B)) === visiveis.length && (await total(B)) === visiveis.length, `leitura: o início e a árvore mostram os ${visiveis.length} posts do banco`);
  ok((await linhas(A)) === emDisparos, `leitura: o tópico Disparos mostra os ${emDisparos} posts do banco`);
  await B.goto(base + '#operacional/topico/disparos');
  await B.waitForSelector('.op-lista');

  // Criação.
  await A.click('[data-acao="criar-post"]');
  await A.fill('[data-op="editor"] input[name="titulo"]', TITULO);
  await A.fill('[data-op="editor"] textarea', 'primeira versão\nsegunda linha');
  await A.click('[data-op="editor"] button[type="submit"]');
  await A.waitForFunction(() => location.hash.startsWith('#operacional/post/'));
  await A.waitForSelector('.op-texto');
  const slug = (await A.evaluate(() => location.hash)).split('/').pop();
  const [criado] = await rest(`operacional_posts?slug=eq.${q(slug)}&select=id,titulo,conteudo,versao,topico_id,excluido_em`);
  ok(criado?.titulo === TITULO && criado.conteudo === 'primeira versão\nsegunda linha' && criado.versao === 1 && criado.topico_id === disparos.id, 'criação: o post está no banco, no tópico Disparos, na versão 1');
  ok((await A.textContent('.op-titulo')) === TITULO && (await A.$$eval('#modulo-operacional b', (b) => b.length)) === 0, 'criação: o <b> do título aparece como texto, sem virar negrito');
  const tCriado = await esperar(async () => (await linhas(B)) === emDisparos + 1);
  ok(tCriado >= 0, `realtime: o post novo apareceu na lista da aba B (${tCriado} ms)`);

  // Edição: A salva, B (com o post aberto) vê o texto novo.
  await B.goto(`${base}#operacional/post/${slug}`);
  await B.waitForSelector('.op-texto');
  await A.click('[data-acao="editar"]');
  await A.fill('[data-op="editor"] textarea', 'segunda versão, editada na aba A');
  await A.press('[data-op="editor"] textarea', 'Control+Enter');
  await esperar(async () => (await A.textContent('.op-texto').catch(() => '')) === 'segunda versão, editada na aba A');
  const [editado] = await rest(`operacional_posts?id=eq.${criado.id}&select=conteudo,versao`);
  ok(editado.versao === 2 && editado.conteudo === 'segunda versão, editada na aba A', 'edição: o banco tem o texto novo, na versão 2');
  const tEditado = await esperar(async () => (await B.textContent('.op-texto').catch(() => '')) === 'segunda versão, editada na aba A');
  ok(tEditado >= 0, `realtime: a aba B, com o post aberto, mostrou o texto novo (${tEditado} ms)`);

  // Conflito: as duas abas editam a mesma versão; a segunda a salvar é recusada.
  for (const p of [A, B]) await p.click('[data-acao="editar"]');
  await B.fill('[data-op="editor"] textarea', 'versão da aba B');
  await B.click('[data-op="editor"] button[type="submit"]');
  await B.waitForSelector('.op-texto');
  const tAviso = await esperar(() => A.$('[data-op="aviso-editor"] .alert-warning').then(Boolean));
  ok(tAviso >= 0, `conflito: o editor aberto na aba A avisa que outra pessoa salvou (${tAviso} ms)`);
  await A.fill('[data-op="editor"] textarea', 'versão da aba A');
  await A.click('[data-op="editor"] button[type="submit"]');
  await A.waitForSelector('[data-op="aviso-editor"] .alert-danger');
  ok((await A.textContent('[data-op="aviso-editor"]')).includes('Outra pessoa alterou'), 'conflito: quem salvou depois é recusado, com o motivo');
  ok((await A.inputValue('[data-op="editor"] textarea')) === 'versão da aba A', 'conflito: o texto recusado continua no editor');
  const [depoisDoConflito] = await rest(`operacional_posts?id=eq.${criado.id}&select=conteudo,versao`);
  ok(depoisDoConflito.versao === 3 && depoisDoConflito.conteudo === 'versão da aba B', 'conflito: o banco guardou a versão salva primeiro, sem sobrescrever');

  // Queda de rede no salvamento: o editor não fecha e o texto não se perde.
  await A.press('[data-op="editor"] textarea', 'Escape');
  await A.waitForSelector('.op-texto');
  await esperar(async () => (await A.textContent('.op-texto')) === 'versão da aba B');
  await A.route('**/rest/v1/operacional_posts**', (rota) => (rota.request().method() === 'PATCH' ? rota.abort('internetdisconnected') : rota.continue()));
  await A.click('[data-acao="editar"]');
  await A.fill('[data-op="editor"] textarea', 'texto digitado durante a queda');
  await A.click('[data-op="editor"] button[type="submit"]');
  await A.waitForSelector('[data-op="aviso-editor"] .alert-danger');
  const msg = await A.textContent('[data-op="aviso-editor"]');
  ok(/Sem conexão/.test(msg) && (await A.inputValue('[data-op="editor"] textarea')) === 'texto digitado durante a queda', `queda no salvamento: o erro aparece e o texto continua no editor ("${msg.trim().slice(0, 60)}…")`);
  await A.unroute('**/rest/v1/operacional_posts**');
  await A.click('[data-op="editor"] button[type="submit"]');
  await esperar(async () => (await A.textContent('.op-texto').catch(() => '')) === 'texto digitado durante a queda');
  const [aposQueda] = await rest(`operacional_posts?id=eq.${criado.id}&select=conteudo,versao`);
  ok(aposQueda.versao === 4 && aposQueda.conteudo === 'texto digitado durante a queda', 'com a rede de volta, salvar de novo grava (versão 4)');

  // Excluir: some das duas abas, mas continua no banco.
  await B.goto(base + '#operacional/topico/disparos');
  await B.waitForSelector('.op-lista');
  await A.click('[data-acao="excluir"]');
  await A.waitForFunction(() => location.hash === '#operacional/topico/disparos');
  await A.waitForSelector('.op-lista');
  ok((await linhas(A)) === emDisparos, 'exclusão: o post saiu da lista da aba A');
  const tExcluido = await esperar(async () => (await linhas(B)) === emDisparos);
  ok(tExcluido >= 0, `realtime: a exclusão chegou na aba B (${tExcluido} ms)`);
  const [excluido] = await rest(`operacional_posts?id=eq.${criado.id}&select=conteudo,versao,excluido_em`);
  ok(Boolean(excluido?.excluido_em) && excluido.conteudo === 'texto digitado durante a queda', 'exclusão: o banco guarda o post, marcado como excluído');

  // O que o banco garante sozinho, direto na API com a chave anon.
  await rest(`operacional_posts?id=eq.${criado.id}`, { method: 'DELETE' }).catch(() => null);
  ok((await rest(`operacional_posts?id=eq.${criado.id}&select=id`)).length === 1, 'banco: a chave anon não apaga post (sem política de DELETE)');
  const revisoesAnon = await rest(`operacional_revisoes?post_id=eq.${criado.id}&select=versao`).catch((e) => e.message);
  ok(Array.isArray(revisoesAnon) ? revisoesAnon.length === 0 : /401|403|permission/i.test(revisoesAnon), 'banco: a chave anon não lê o histórico');
  if (TOKEN) {
    const revisoes = await sql(`select versao, conteudo, excluido_em is not null as excluido from public.operacional_revisoes where post_id = '${criado.id}' order by versao, id;`);
    const resumo = revisoes.map((r) => `${r.versao}${r.excluido ? '×' : ''}`).join(' ');
    ok(revisoes.length === 5 && revisoes[4].excluido && revisoes[2].conteudo === 'versão da aba B', `banco: o gatilho guardou cada versão no histórico (${resumo})`);
  }

  const inesperados = erros.filter((e) => !/internetdisconnected|ERR_INTERNET_DISCONNECTED|Failed to fetch|Failed to load resource/i.test(e));
  ok(inesperados.length === 0, `console das abas A e B sem erros além da queda simulada ${JSON.stringify(inesperados)}`);
} finally {
  await navegador.close();
  const n = await limpar();
  const restam = TOKEN ? (await rest(`operacional_posts?titulo=like.${q(PREFIXO + '*')}&select=id`)).length : null;
  if (TOKEN) console.log(`limpeza final: ${n} post(s) de teste apagado(s), com o histórico; restam ${restam} no banco`);
  else console.log(`limpeza final: o post de teste ficou escondido. Para apagá-lo, cole no SQL Editor do Supabase:\n  ${LIMPEZA_SQL}`);
}
console.log(falhas ? `${falhas} falha(s)` : 'Operacional no Supabase real: tudo conferido.');
process.exit(falhas ? 1 : 0);

/**
 * O Calendário contra o Supabase REAL: leitura, gravação, exclusão em cascata, Realtime entre duas
 * abas e as duas quedas de rede (ao abrir e no meio do salvamento).
 *
 * GRAVA NO BANCO DA MESA. Usa só um colaborador de teste ("ZZ Teste Mesa XP <b>…</b>" — o <b>
 * prova o escape sem ser perigoso se não for escapado) e apaga tudo no fim, inclusive sobras de uma
 * execução anterior que tenha caído no meio. Não registra nem fotografa dado de ninguém: o que é
 * conferido é só o colaborador de teste, direto na API REST do banco. Rode fora do expediente, que
 * os colegas com a página aberta veem o colaborador de teste aparecer e sumir.
 *
 * Uso:  npm run build && node scripts/verificar-supabase.mjs
 * Usa o banco do build (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, ou o padrão de config.js).
 *
 * Situação em 29/09/2026: preparado mas ainda não rodado — o projeto Supabase não resolvia no DNS
 * (pausado). A primeira execução é também o teste deste script.
 */
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const projeto = fileURLToPath(new URL('..', import.meta.url));
const { resolverConfig } = await import(pathToFileURL(join(projeto, 'src/modulos/calendario/config.js')).href);
const PADRAO = (() => {
  const config = resolverConfig({ VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY });
  if (config.modo !== 'supabase') {
    console.error('Sem banco configurado (modo local ou configuração inválida): nada a verificar.');
    process.exit(1);
  }
  return { url: config.url, chave: config.chave };
})();
const url = pathToFileURL(join(projeto, 'dist/index.html')).href + '#calendario';
const PREFIXO = 'ZZ Teste Mesa XP';
const NOME = `${PREFIXO} <b>${String(Date.now()).slice(-4)}</b>`;

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
const limpar = async () => rest(`collaborators?name=like.${q(PREFIXO + '*')}`, { method: 'DELETE' });

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

let sobras;
try {
  sobras = await limpar();
} catch (erro) {
  console.error(`O banco não respondeu (${erro.cause?.code ?? erro.message}). Confira no painel do Supabase se o projeto está ativo.`);
  process.exit(1);
}
console.log(`sobras de execuções anteriores apagadas: ${sobras.length}`);

const navegador = await chromium.launch();
try {
  const contexto = await navegador.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: 'America/Sao_Paulo' });
  const erros = [];
  const abrir = async (rotulo) => {
    const p = await contexto.newPage();
    p.on('console', (m) => m.type() === 'error' && erros.push(`${rotulo}: ${m.text()}`));
    p.on('pageerror', (e) => erros.push(`${rotulo}: ${e}`));
    p.on('dialog', (d) => d.accept());
    await p.goto(url);
    return p;
  };
  const A = await abrir('A');
  const B = await abrir('B');
  for (const [rotulo, p] of [['A', A], ['B', B]]) {
    const t = await esperar(() => p.$eval('[data-cal="conexao"]', (e) => e.textContent === 'ao vivo').catch(() => false));
    ok(t >= 0, `aba ${rotulo}: leu o banco e o realtime conectou ("ao vivo" em ${t} ms)`);
  }
  const antes = await A.$$eval('.cal-linha', (l) => l.length);
  ok(antes > 0, `leitura: a matriz carregou os colaboradores do banco (${antes} linhas)`);

  // Gravação: colaborador novo.
  await A.fill('[data-cal="nome"]', NOME);
  await A.press('[data-cal="nome"]', 'Enter');
  const [linhaBanco] = await (async () => {
    await esperar(async () => (await rest(`collaborators?name=eq.${q(NOME)}`)).length === 1);
    return rest(`collaborators?name=eq.${q(NOME)}&select=id,name,color`);
  })();
  ok(Boolean(linhaBanco), 'gravação: o colaborador de teste está no banco');
  const id = linhaBanco.id;
  const noA = await esperar(() => A.$$eval('.cal-nome', (es, n) => es.some((e) => e.textContent === n), NOME));
  ok(noA >= 0, 'aba A mostra o colaborador novo');
  ok((await A.$$eval('#modulo-calendario b', (b) => b.length)) === 0, 'o <b> do nome aparece como texto, sem virar negrito');
  const noB = await esperar(() => B.$$eval('.cal-nome', (es, n) => es.some((e) => e.textContent === n), NOME));
  ok(noB >= 0, `realtime: a aba B recebeu o colaborador sem recarregar (${noB} ms)`);

  // Gravação do dia com dois horários.
  const celula = (p) => p.locator(`.cal-dia[data-colaborador="${id}"]`).first();
  const dataDia = await celula(A).getAttribute('data-dia');
  const adicionarHorario = async (p, inicio, fim, motivo) => {
    await p.fill('[data-cal="inicio"]', inicio);
    await p.fill('[data-cal="fim"]', fim);
    await p.fill('[data-cal="motivo"]', motivo);
    await p.click('[data-cal="adicionar-horario"]');
  };
  await celula(A).click();
  await A.check('[data-cal="presencial"]');
  await A.fill('[data-cal="observacao"]', 'teste automatizado da Mesa XP');
  await adicionarHorario(A, '08:00', '09:00', 'teste A');
  await adicionarHorario(A, '14:00', '15:00', 'teste B');
  await A.click('[data-cal="salvar"]');
  await esperar(() => A.$eval('.cal-dialogo', (d) => !d.open));
  const [entrada] = await rest(`daily_entries?collaborator_id=eq.${id}&select=id,date,presencial,observation`);
  ok(entrada && entrada.date === dataDia && entrada.presencial === true && entrada.observation === 'teste automatizado da Mesa XP', `banco: o dia ${dataDia} gravado com presencial e observação (data local, sem deslocar)`);
  const horarios1 = await rest(`unavailable_slots?entry_id=eq.${entrada.id}&select=id,start_time,end_time,reason&order=start_time`);
  ok(JSON.stringify(horarios1.map((h) => [h.start_time, h.end_time, h.reason])) === JSON.stringify([['08:00:00', '09:00:00', 'teste A'], ['14:00:00', '15:00:00', 'teste B']]), 'banco: os dois horários gravados');
  const tB = await esperar(async () => {
    const texto = await celula(B).innerText().catch(() => '');
    return texto.includes('Presencial') && texto.includes('08:00–09:00') && texto.includes('14:00–15:00');
  });
  ok(tB >= 0, `realtime: a aba B mostrou o dia salvo na aba A (${tB} ms)`);

  // Substituir horários: os novos entram antes, os antigos saem depois.
  await celula(A).click();
  await A.click('.cal-horario:has-text("teste A") [data-remover-horario]');
  await adicionarHorario(A, '10:00', '11:00', 'teste C');
  await A.click('[data-cal="salvar"]');
  await esperar(() => A.$eval('.cal-dialogo', (d) => !d.open));
  const horarios2 = await rest(`unavailable_slots?entry_id=eq.${entrada.id}&select=id,start_time,reason&order=start_time`);
  ok(JSON.stringify(horarios2.map((h) => [h.start_time, h.reason])) === JSON.stringify([['10:00:00', 'teste C'], ['14:00:00', 'teste B']]), 'banco: salvar de novo substitui os horários, sem duplicar');
  const idsAntigos = new Set(horarios1.map((h) => h.id));
  ok(horarios2.every((h) => !idsAntigos.has(h.id)), 'banco: os horários antigos foram apagados (ids novos)');

  // Falha no meio do salvamento: a inserção dos novos horários cai. Nada pode sumir.
  await A.route('**/rest/v1/unavailable_slots**', (rota) => (rota.request().method() === 'POST' ? rota.abort('internetdisconnected') : rota.continue()));
  await celula(A).click();
  await adicionarHorario(A, '16:00', '17:00', 'teste D');
  await A.click('[data-cal="salvar"]');
  await esperar(() => A.$eval('[data-cal="erro-dialogo"]', (e) => e.textContent.length > 0));
  ok(await A.$eval('.cal-dialogo', (d) => d.open), 'queda na gravação: a janela continua aberta, com o que foi digitado');
  const msg = await A.textContent('[data-cal="erro-dialogo"]');
  ok(/Sem conexão/.test(msg) && /Nada foi perdido/.test(msg), `queda na gravação: o erro aparece na janela ("${msg.slice(0, 80)}…")`);
  const horarios3 = await rest(`unavailable_slots?entry_id=eq.${entrada.id}&select=start_time,reason&order=start_time`);
  ok(JSON.stringify(horarios3.map((h) => h.reason)) === JSON.stringify(['teste C', 'teste B']), 'queda na gravação: os horários que já estavam no banco continuam lá');
  await A.unroute('**/rest/v1/unavailable_slots**');
  await A.click('[data-cal="salvar"]');
  await esperar(() => A.$eval('.cal-dialogo', (d) => !d.open));
  const horarios4 = await rest(`unavailable_slots?entry_id=eq.${entrada.id}&select=reason&order=start_time`);
  ok(JSON.stringify(horarios4.map((h) => h.reason)) === JSON.stringify(['teste C', 'teste B', 'teste D']), 'com a rede de volta, salvar de novo grava tudo');

  // Exclusão em cascata.
  await A.click(`.cal-remover[data-remover="${id}"]`);
  await esperar(async () => (await rest(`collaborators?id=eq.${id}`)).length === 0);
  const restam = {
    colaborador: (await rest(`collaborators?id=eq.${id}`)).length,
    dias: (await rest(`daily_entries?collaborator_id=eq.${id}`)).length,
    horarios: (await rest(`unavailable_slots?entry_id=eq.${entrada.id}`)).length
  };
  ok(restam.colaborador === 0 && restam.dias === 0 && restam.horarios === 0, `cascata: colaborador, dias e horários apagados juntos ${JSON.stringify(restam)}`);
  const saiuB = await esperar(() => B.$$eval('.cal-nome', (es, n) => !es.some((e) => e.textContent === n), NOME));
  ok(saiuB >= 0, `realtime: a exclusão chegou na aba B (${saiuB} ms)`);
  ok((await A.$$eval('.cal-linha', (l) => l.length)) === antes, 'a matriz voltou ao número de linhas de antes');

  // Sem rede ao abrir: erro na tela, nada de modo local escondido.
  const C = await contexto.newPage();
  const errosC = [];
  C.on('pageerror', (e) => errosC.push(String(e)));
  await C.route('**/*.supabase.co/**', (rota) => rota.abort('internetdisconnected'));
  await C.goto(url);
  await esperar(() => C.$('.cal-erro .alert').then(Boolean));
  const banner = await C.textContent('.cal-erro .alert').catch(() => '');
  ok(/Sem conexão com o banco de presença/.test(banner), `sem rede: o erro aparece na tela ("${banner.trim().slice(0, 60)}…")`);
  ok((await C.textContent('[data-cal="conexao"]')) === 'sem conexão', 'sem rede: o status diz "sem conexão"');
  ok((await C.evaluate(() => localStorage.getItem('presenca_app_data'))) === null, 'sem rede: nada foi gravado no modo local');
  await C.unroute('**/*.supabase.co/**');
  await C.click('[data-cal="tentar"]');
  const volta = await esperar(() => C.$eval('.cal-erro', (e) => e.textContent.trim() === ''));
  ok(volta >= 0, 'rede de volta: "Tentar de novo" carrega e o erro some');
  ok(errosC.length === 0, `sem rede: nenhum erro de script ${JSON.stringify(errosC)}`);

  // Os únicos erros de console esperados são os da queda simulada na aba A.
  const inesperados = erros.filter((e) => !/internetdisconnected|ERR_INTERNET_DISCONNECTED|Failed to fetch|ErroDoRepositorio|Failed to load resource/i.test(e));
  ok(inesperados.length === 0, `console das abas A e B sem erros além da queda simulada ${JSON.stringify(inesperados)}`);
} finally {
  await navegador.close();
  const restantes = await limpar();
  const conferencia = await rest(`collaborators?name=like.${q(PREFIXO + '*')}&select=id`);
  console.log(`limpeza final: ${restantes.length} colaborador(es) de teste apagado(s); restam ${conferencia.length} no banco`);
}
console.log(falhas ? `${falhas} falha(s)` : 'Supabase real: tudo conferido.');
process.exit(falhas ? 1 : 0);

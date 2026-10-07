/**
 * Regenera `src/modulos/ordens/core/validate/fundosXP.js` a partir da prateleira de fundos da XP.
 *
 * Diferente da lista da B3, esta não tem fonte pública para baixar: a prateleira de distribuição
 * é da XP e não é publicada como dado aberto. Servem dois arquivos:
 *
 * - o `.json` que o favorito do Hub baixa (`mercado-secundario-DD-MM-AAAA-HHhMM.json`) — o jeito
 *   mais simples, porque já vem estruturado;
 * - a listagem copiada do portal e colada num `.txt`: o nome do fundo numa linha, alguns campos
 *   abaixo, e a linha `Comprar` ou `Avise-me` fechando cada fundo. A página inteira também serve:
 *   o menu e os "Destaques" do topo, antes da tabela, são pulados.
 *
 * Uso:  npm run fundos:update -- mercado-secundario-06-10-2026-12h09.json
 *       npm run fundos:update -- prateleira.txt
 */

import { readFileSync, writeFileSync } from 'node:fs';

const entrada = process.argv[2];
if (!entrada) {
  console.error('Informe o arquivo do favorito do Hub (.json) ou a listagem copiada do portal (.txt).');
  console.error('Uso: npm run fundos:update -- mercado-secundario-DD-MM-AAAA-HHhMM.json');
  process.exit(1);
}

/** `RZDS11 - Riza Domus FII` — alguns fundos da prateleira têm ticker. */
const TICKER_NO_NOME = /^([A-Z]{4}\d{0,2})\s*[–-]\s*(.+)$/;

// A API manda espaço dobrado em alguns nomes; a página, que é o que o operador copia, não.
const limpo = (texto) => String(texto ?? '').replace(/\s+/g, ' ').trim();

const registro = (nomeCompleto, aplicacaoMinima) => {
  const nome = limpo(nomeCompleto);
  const encontrado = nome.match(TICKER_NO_NOME);
  return {
    nome: encontrado ? encontrado[2].trim() : nome,
    ticker: encontrado ? encontrado[1] : null,
    aplicacaoMinima
  };
};

/** O arquivo do favorito: a resposta da API, com `data`. "2.500.000,00" fica "2.500.000". */
const doJson = (texto) => {
  const { data } = JSON.parse(texto.replace(/^\uFEFF/, ''));
  if (!Array.isArray(data)) {
    console.error('O .json não tem a lista de fundos (data): não é o arquivo do favorito do Hub.');
    process.exit(1);
  }
  return data.map((f) =>
    registro(f.fundName, f.minimalInitialInvestment ? limpo(f.minimalInitialInvestment).replace(/,0+$/, '') : null)
  );
};

/** A listagem copiada do portal. */
const doTexto = (texto) => {
  let linhas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // A página inteira traz o menu e os "Destaques" antes da tabela, que começa depois do cabeçalho
  // terminado em "Ações", e o filtro depois dela.
  const cabecalho = linhas.indexOf('Ações');
  if (cabecalho >= 0) linhas = linhas.slice(cabecalho + 1);
  const rodape = linhas.indexOf('Filtrar listagem');
  if (rodape >= 0) linhas = linhas.slice(0, rodape);

  const blocos = [];
  let atual = [];
  for (const linha of linhas) {
    atual.push(linha);
    if (linha === 'Comprar' || linha === 'Avise-me') {
      blocos.push(atual);
      atual = [];
    }
  }

  return blocos.map((bloco) => {
    const iPreco = bloco.findIndex((l) => /^R\$\s/.test(l));
    return registro(bloco[0], iPreco > 0 ? bloco[iPreco - 1] : null);
  });
};

const conteudoDaEntrada = readFileSync(entrada, 'utf8');
const registros = /\.json$/i.test(entrada) ? doJson(conteudoDaEntrada) : doTexto(conteudoDaEntrada);

const semMinimo = registros.filter((r) => !r.aplicacaoMinima);
if (semMinimo.length > 0) {
  console.error('Não achei a aplicação mínima destes, o formato pode ter mudado:');
  for (const r of semMinimo) console.error('  ' + r.nome);
  process.exit(1);
}

if (registros.length < 20) {
  console.error(`Só ${registros.length} fundos — listagem suspeita, arquivo não reescrito.`);
  process.exit(1);
}

const corpo = registros
  .map(
    (r) =>
      `  { nome: ${JSON.stringify(r.nome)}, ticker: ${r.ticker ? JSON.stringify(r.ticker) : 'null'}, aplicacaoMinima: ${JSON.stringify(r.aplicacaoMinima)} }`
  )
  .join(',\n');

const hoje = new Date().toISOString().slice(0, 10);
const comTicker = registros.filter((r) => r.ticker).length;

const conteudo = `// GERADO a partir da prateleira de fundos da XP, capturada em ${hoje}.
// ${registros.length} fundos, ${comTicker} deles com ticker.
//
// Guardamos só o que é estável: nome comercial, ticker e aplicação mínima, em reais (o Hub
// rotula a coluna "Qtd. mínima", mas ela é o minimalInitialInvestment da exportação). Preço unitário,
// quantidade disponível, deságio e rentabilidade mudam todo dia — embuti-los seria carregar
// dado vencido dentro de um sistema cuja regra é não inventar dado. A aplicação mínima entra
// como AVISO e nunca como bloqueio, justamente porque também pode mudar.
//
// Para atualizar: \`npm run fundos:update -- arquivo.json\` com o arquivo do favorito do Hub, ou
// \`npm run fundos:update -- arquivo.txt\` com a lista copiada do portal.

export const CAPTURADO_EM = '${hoje}';

export const FUNDOS_XP = [
${corpo}
];
`;

writeFileSync(new URL('../src/modulos/ordens/core/validate/fundosXP.js', import.meta.url), conteudo);
console.log(`${registros.length} fundos escritos (${comTicker} com ticker).`);
console.log('Rode `npm test` em seguida: os testes checam nomes reais contra a lista.');

/**
 * RendaFixa Pro — motor de análise.
 *
 * Funções puras, sem DOM. Recebem a planilha como matriz (saída de
 * XLSX.utils.sheet_to_json(aba, { header: 1 })) e devolvem as oportunidades e o
 * texto para WhatsApp.
 *
 * Portado do RendaFixaDisparo (frontend/motor.js) sem mudar uma regra: o corpo é o
 * mesmo, só o `module.exports` do fim virou `export`. Os testes de golden
 * (motor.golden.test.js) comparam a saída com a do motor original.
 */

import { regrasPadrao } from './regras.js';

// As regras — o PU máximo, os prazos, os isentos, os bancos, a mensagem… — moram em regras.js,
// configuráveis na tela, uma por mercado (21/10/2026). Estas são as do padrão, para quem as lê.
const PADRAO = regrasPadrao('primario');

// Prazos (em anos) que entram na mensagem, por seção, no padrão. Isentos têm regra própria em processRows.
const PRAZOS_EXIBIDOS = {
    pre: (prazo) => PADRAO.prazos.pre.includes(prazo),
    pos: (prazo) => PADRAO.prazos.pos.includes(prazo),
    ipca: (prazo) => PADRAO.prazos.ipca.includes(prazo),
};

/** O motivo de cada descarte, com o PU máximo das regras. */
function motivosDoDescarte(regras = PADRAO) {
    return {
        modo: 'Do outro mercado',
        pu: `PU acima de R$ ${regras.filtros.puMaximo.toLocaleString('pt-BR')}`,
        publico: 'Público restrito',
        liquidez: 'Liquidez diária',
        taxa: 'Sem taxa legível',
        prazo: 'Prazo fora de ano cheio',
        tipo: 'Tipo não reconhecido',
        isento: 'Isento fora dos prazos',
    };
}

const MOTIVOS_DESCARTE = motivosDoDescarte(PADRAO);

const escaparRegex = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// O que o motor usa das regras, preparado uma vez por objeto de regras.
const compilados = new WeakMap();
function compilar(regras) {
    if (compilados.has(regras)) return compilados.get(regras);
    const porTamanho = (lista) => [...lista].sort((a, b) => b.length - a.length);
    const siglas = porTamanho(regras.avancado.siglas.map((t) => t.toLowerCase())).map(escaparRegex).join('|');
    const c = {
        // O tipo pelo nome por extenso: cada trecho (sem acento), e "|" separa jeitos de escrever.
        tiposPorNome: regras.avancado.tiposPorNome.map(([trechos, sigla]) => [
            String(trechos).split('|').map((t) => removeAccents(t.trim())).filter(Boolean),
            String(sigla).trim(),
        ]),
        siglaNoInicio: new RegExp(`^(${siglas})(?![a-z])`),
        siglaSolta: new RegExp(`\\b(${siglas})\\b`),
        prefixoEmissor: `^(?:${porTamanho(regras.avancado.siglas.map((t) => t.toUpperCase())).map(escaparRegex).join('|')}|DEB[EÊ]NTURE)\\s+(?:BANCO\\s+)?`,
        bancos: regras.bancos.length ? new RegExp(`(?:${regras.bancos.map(escaparRegex).join('|')})`, 'i') : null,
    };
    compilados.set(regras, c);
    return c;
}

// Funciona com Date de outra janela/iframe, onde instanceof falha
function ehData(valor) {
    return Object.prototype.toString.call(valor) === '[object Date]';
}

function texto(valor) {
    return valor === null || valor === undefined ? '' : String(valor).trim();
}

function removeAccents(str) {
    if (!str) return "";
    return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Normaliza variações de indexador: IPC-A, IPCA, ipc-a → IPCA
function normalizeIndexador(str) {
    if (!str) return '';
    return str.replace(/IPC[\-\s]*A/gi, 'IPCA');
}

/**
 * Converte "1.250,00", "1,250.00", "14,55" ou "1.300" em número.
 * O separador decimal é o último que aparece; "1.300" (só pontos em grupos de 3) é milhar.
 */
function parseNumero(raw) {
    let s = String(raw).replace(/[^\d,.\-]/g, '');
    if (!s) return null;
    const virgula = s.lastIndexOf(','), ponto = s.lastIndexOf('.');
    if (virgula > -1 && ponto > -1) {
        s = virgula > ponto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (virgula > -1) {
        s = s.replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
        s = s.replace(/\./g, '');
    }
    const valor = parseFloat(s);
    return isNaN(valor) ? null : valor;
}

/**
 * Lê a taxa de uma célula. O número guardado depende do indexador:
 * pré = % a.a., % do CDI = percentual do CDI, IPCA+ e CDI+ = spread.
 */
function parseTaxaLocal(raw) {
    if (raw === null || raw === undefined || raw === '') return null;

    if (typeof raw === 'number') {
        // Célula em formato de porcentagem: 0,1455 = 14,55%
        if (raw > 0 && raw < 1) return raw * 100;
        return raw;
    }

    const s = normalizeIndexador(String(raw).trim());
    if (!s) return null;

    // "IPCA + 7,85%" ou "CDI + 0,80%": o que importa é o spread depois do +
    const spread = s.match(/(?:IPCA|CDI)\s*\+\s*(\d[\d.,]*)/i);
    if (spread) {
        const valor = parseNumero(spread[1]);
        if (valor > 0) return valor;
    }

    const numero = s.match(/\d[\d.,]*/);
    if (!numero) return null;
    const valor = parseNumero(numero[0]);
    if (valor === null) return null;

    // Sem "%" e abaixo de 1, é fração escrita como texto ("0.1455")
    if (valor > 0 && valor < 1 && !s.includes('%')) return valor * 100;
    return valor;
}

function parsePULocal(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') return raw;
    const s = String(raw).replace(/R\$\s*/gi, '').trim();
    if (!s) return null;
    return parseNumero(s);
}

/**
 * Converte o vencimento em prazo de anos cheios, contado a partir de `hoje`.
 * Aceita Date, número de dias, data serial do Excel e textos como "720 dias",
 * "24 meses", "2 anos", "15/04/2033" ou "2033-04-15".
 */
function parsePrazoLocal(raw, hoje = new Date()) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (ehData(raw)) return calcularAnos(raw, hoje);
    if (typeof raw === 'number') {
        // Até ~1954 na escala serial do Excel: é quantidade de dias, não data
        if (raw < 20000) return classificarDiasEmAnos(Math.round(raw));
        return calcularAnos(new Date(Math.round((raw - 25569) * 86400 * 1000)), hoje);
    }

    const txt = removeAccents(String(raw)).trim();
    const dias = txt.match(/(\d+)\s*dias?/);
    if (dias) return classificarDiasEmAnos(parseInt(dias[1], 10));
    const meses = txt.match(/(\d+)\s*mes(es)?/);
    if (meses) return classificarDiasEmAnos(parseInt(meses[1], 10) * 30);
    const anos = txt.match(/(\d+)\s*anos?/);
    if (anos) return parseInt(anos[1], 10) || null;

    const br = txt.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
    if (br) return calcularAnos(new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00Z`), hoje);
    const iso = txt.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return calcularAnos(new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00Z`), hoje);

    return null;
}

/**
 * Converte dias corridos em "ano cheio".
 * REGRA: N anos = de 365·N − 95 até 365·N + 15 dias. Fora disso (ex.: 1 ano e
 * 4 meses, ou menos de 270 dias) → DESCARTA (retorna null).
 */
function classificarDiasEmAnos(dias) {
    if (!(dias > 0)) return null;
    const anosInteiros = Math.floor(dias / 365);
    const restoDias = dias - (anosInteiros * 365);

    // Ano exato (até 15 dias depois)
    if (restoDias <= 15 && anosInteiros > 0) return anosInteiros;
    // Gordura: faltam até 95 dias para completar o próximo ano
    if (restoDias >= (365 - 95)) return anosInteiros + 1;
    // Prazo quebrado
    return null;
}

function calcularAnos(dataAlvo, hoje = new Date()) {
    const diffDays = Math.ceil((dataAlvo - hoje) / (1000 * 60 * 60 * 24));
    return classificarDiasEmAnos(diffDays);
}

/**
 * Os dias corridos até o vencimento, para a alíquota do IR na equivalência dos isentos
 * (`equivalencia.js`). Lê o vencimento como `parsePrazoLocal`: "N meses" vale 30 dias por mês, e o
 * texto só em anos ("2 anos"), 365 por ano. Acrescentado na Mesa XP em 21/10/2026 — o motor original
 * não tinha —, e os goldens conferem o resto do resultado sem ele.
 */
function diasAteOVencimento(raw, hoje = new Date()) {
    if (raw === null || raw === undefined || raw === '') return null;
    const ate = (data) => Math.ceil((data - hoje) / (1000 * 60 * 60 * 24));
    if (ehData(raw)) return ate(raw);
    if (typeof raw === 'number') return raw < 20000 ? Math.round(raw) : ate(new Date(Math.round((raw - 25569) * 86400 * 1000)));

    const txt = removeAccents(String(raw)).trim();
    const dias = txt.match(/(\d+)\s*dias?/);
    if (dias) return parseInt(dias[1], 10);
    const meses = txt.match(/(\d+)\s*mes(es)?/);
    if (meses) return parseInt(meses[1], 10) * 30;
    const anos = txt.match(/(\d+)\s*anos?/);
    if (anos) return parseInt(anos[1], 10) * 365 || null;

    const br = txt.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
    if (br) return ate(new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00Z`));
    const iso = txt.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return ate(new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00Z`));

    return null;
}

/**
 * Identifica o tipo do título. Aceita o nome por extenso ("Letra de Crédito do
 * Agronegócio"), a sigla solta ("LCA", "LCD BNDES - SET/2036") ou o prefixo de
 * um ticker ("CDB6258GLVF"). Tickers sem prefixo ("26I1LCD8XR3") → null.
 */
function normalizeTipoLocal(raw, regras = PADRAO) {
    if (raw === null || raw === undefined || ehData(raw)) return null;
    const s = removeAccents(String(raw)).trim();
    if (!s) return null;
    const c = compilar(regras);
    for (const [trechos, tipo] of c.tiposPorNome) {
        if (trechos.some((t) => s.includes(t))) return tipo;
    }
    const sigla = s.match(c.siglaNoInicio) || s.match(c.siglaSolta);
    return sigla ? sigla[1].toUpperCase() : null;
}

/**
 * Descobre o indexador a partir dos textos informados (coluna Indexador, texto da taxa).
 * Retorna 'IPCA', 'CDI+' (CDI + spread), 'CDI' (% do CDI), 'PRE' ou null se nada indicar.
 */
function detectarIndexador(...valores) {
    const s = normalizeIndexador(removeAccents(valores.map(texto).join(' '))).toUpperCase();
    if (!s.trim()) return null;
    if (/IPCA|INFLA/.test(s)) return 'IPCA';
    if (/CDI\s*\+/.test(s)) return 'CDI+';
    if (/CDI|SELIC/.test(s)) return 'CDI';
    if (/PRE/.test(s)) return 'PRE';
    return null;
}

function isentoPorColuna(raw) {
    if (raw === true) return true;
    return /^(s|sim|y|yes|true|1)$/.test(removeAccents(texto(raw)));
}

function limparEmissor(nome) {
    return nome
        .replace(/S\/A/g, '')
        .replace(/\bS\.A\.?/g, '')
        .replace(/\bSA\b/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * Emissor da coluna própria, se houver; senão, extraído do nome do ativo
 * (padrão XP: "CDB PINE - ABR/2033" → "PINE"); por fim, lista de bancos conhecidos.
 */
function extrairEmissor(emissorRaw, descricao, regras = PADRAO) {
    const direto = texto(emissorRaw);
    if (direto && direto.toLowerCase() !== 'nan') return limparEmissor(direto);

    const c = compilar(regras);
    const desc = texto(descricao).toUpperCase();
    const prefixo = c.prefixoEmissor;
    const nome = desc.match(new RegExp(prefixo + '(.+?)\\s+[-–]\\s')) || desc.match(new RegExp(prefixo + '(.+?)\\s*[-–]'));
    if (nome) return limparEmissor(nome[1]);

    const conhecido = c.bancos ? desc.match(c.bancos) : null;
    return conhecido ? conhecido[0].toUpperCase() : '';
}

function detectarCabecalho(rows, palavras = PADRAO.avancado.palavrasDoCabecalho) {
    const keywords = palavras.map((p) => removeAccents(p));
    let headerIdx = 0, bestScore = 0;
    const limit = Math.min(rows.length, 15);
    for (let i = 0; i < limit; i++) {
        if (!rows[i]) continue;
        const sRow = Array.from(rows[i], (c) => removeAccents(texto(c)));
        let score = 0;
        for (const kw of keywords) {
            if (sRow.some((val) => val.includes(kw))) score++;
        }
        if (score > bestScore) {
            bestScore = score;
            headerIdx = i;
        }
    }
    return headerIdx;
}

/**
 * Um nome de coluna das regras casa com o cabeçalho? "trecho" = contém; "=texto" = igual; "^texto" =
 * começa com; "trecho -outro" = contém o trecho e não contém o outro.
 */
function casaColuna(norm, nome) {
    const a = removeAccents(String(nome)).trim();
    if (a.startsWith('=')) return norm === a.slice(1).trim();
    if (a.startsWith('^')) return norm.startsWith(a.slice(1).trim());
    const [inclui, ...exclui] = a.split(/\s+-/);
    return norm.includes(inclui.trim()) && exclui.every((e) => !norm.includes(e.trim()));
}

/**
 * Mapeia campo → índice da coluna, pelo nome do cabeçalho sem acento e pelos nomes das regras.
 * Quando várias colunas combinam, vale a última; em "taxa" vale a primeira — e as outras de taxa
 * ficam em `indicesDeTaxa`, para procurar a taxa quando a primeira vem vazia.
 */
function mapearColunas(headers, colunas = PADRAO.avancado.colunas) {
    const mapping = { tipo: -1, instrumento: -1, taxa: -1, indexador: -1, vencimento: -1, liquidez: -1, emissor: -1, emissao: -1, pu: -1, publico: -1, isento: -1 };
    const indicesDeTaxa = [];

    Array.from(headers, (col, idx) => {
        if (!col) return;
        const norm = removeAccents(String(col)).trim();
        for (const campo of Object.keys(mapping)) {
            if (!(colunas[campo] ?? []).some((nome) => casaColuna(norm, nome))) continue;
            if (campo === 'taxa') {
                indicesDeTaxa.push(idx);
                if (mapping.taxa === -1) mapping.taxa = idx;
            } else mapping[campo] = idx;
        }
    });

    const nomes = {};
    for (const [campo, idx] of Object.entries(mapping)) {
        if (idx !== -1) nomes[campo] = texto(headers[idx]);
    }
    return { mapping, nomes, indicesDeTaxa };
}

// % do CDI e CDI + spread não se comparam sem projetar o CDI: % do CDI tem prioridade.
function venceDisputa(atual, candidato) {
    if (!atual) return true;
    if (atual.indexador !== candidato.indexador) return atual.indexador === 'CDI+' && candidato.indexador === 'CDI';
    return candidato.taxa > atual.taxa;
}

function disputar(pool, chave, candidato) {
    if (venceDisputa(pool[chave], candidato)) pool[chave] = candidato;
}

function linhaTemDados(row) {
    return Array.isArray(row) && row.some((c) => texto(c) !== '');
}

/**
 * Analisa a planilha e devolve as oportunidades.
 * @param {Array[]} rows       matriz da planilha (linhas × colunas)
 * @param {boolean} secundario true = mercado secundário (linhas com Data de Emissão)
 * @param {Date}    hoje       data de referência para calcular os prazos
 * @param {object}  regras     as regras do mercado (regras.js); sem elas, as do padrão
 */
function processRows(rows, secundario, hoje = new Date(), regras = regrasPadrao(secundario ? 'secundario' : 'primario')) {
    const resultado = {
        secundario,
        linhaCabecalho: -1,
        colunas: {},
        totais: { lidos: 0, noMercado: 0, elegiveis: 0, vencedores: 0, exibidos: 0 },
        descartes: Object.fromEntries(Object.keys(MOTIVOS_DESCARTE).map((m) => [m, 0])),
        bloqueados: [],
        secoes: [],
    };
    const pools = { pre: {}, pos: {}, ipca: {}, isentos: {} };

    if (rows && rows.length) {
        const headerIdx = detectarCabecalho(rows, regras.avancado.palavrasDoCabecalho);
        const { mapping, nomes, indicesDeTaxa } = mapearColunas(rows[headerIdx] || [], regras.avancado.colunas);
        resultado.linhaCabecalho = headerIdx;
        resultado.colunas = nomes;

        for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!linhaTemDados(row)) continue;
            resultado.totais.lidos++;

            const getV = (key) => mapping[key] !== -1 ? row[mapping[key]] : null;
            const descartar = (motivo) => { resultado.descartes[motivo]++; };
            const tipoRaw = getV('tipo');
            const ativo = texto(row[0]) || texto(tipoRaw) || 'Ativo de renda fixa';

            // 1ª Barreira: mercado. Linha com Data de Emissão preenchida = secundário
            let emissaoRaw = texto(getV('emissao'));
            if (['nan', 'none', 'undefined', '-'].includes(emissaoRaw.toLowerCase())) emissaoRaw = '';
            if ((emissaoRaw.length > 0) !== secundario) { descartar('modo'); continue; }
            resultado.totais.noMercado++;

            // 2ª Barreira: Preço Unitário acima do máximo das regras (R$ 1.300 no padrão)
            const pu = parsePULocal(getV('pu'));
            if (pu !== null && pu > regras.filtros.puMaximo) {
                resultado.bloqueados.push({ ativo, motivo: `PU R$ ${pu.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` });
                descartar('pu'); continue;
            }

            // 3ª Barreira: ativos restritos a Investidor Qualificado ou Profissional
            const publico = removeAccents(texto(getV('publico')));
            const profissional = publico.includes('profissional') && regras.filtros.descartarProfissional;
            const qualificado = publico.includes('qualificado') && regras.filtros.descartarQualificado;
            if (profissional || qualificado) {
                resultado.bloqueados.push({ ativo, motivo: profissional ? 'Investidor profissional' : 'Investidor qualificado' });
                descartar('publico'); continue;
            }

            const liquidez = removeAccents(texto(getV('liquidez'))).toUpperCase().replace(/\s+/g, '');
            if (regras.filtros.descartarLiquidezDiaria && (liquidez.includes('DIARIA') || liquidez === 'D+0')) { descartar('liquidez'); continue; }

            let taxaRaw = getV('taxa');
            let taxa = parseTaxaLocal(taxaRaw);
            // A primeira coluna de taxa vazia: procura nas outras colunas de taxa (Tax.Máx…). O original
            // lia qualquer célula com "%", e o ROA virava taxa; esse jeito é a opção 'qualquer-celula'.
            if (taxa === null) {
                if (regras.filtros.taxaFora === 'qualquer-celula') {
                    for (const cell of row) {
                        if (typeof cell === 'string' && cell.includes('%')) {
                            const teste = parseTaxaLocal(cell);
                            if (teste > 0) { taxa = teste; taxaRaw = cell; break; }
                        }
                    }
                } else {
                    for (const idx of indicesDeTaxa) {
                        if (idx === mapping.taxa) continue;
                        const teste = parseTaxaLocal(row[idx]);
                        if (teste > 0) { taxa = teste; taxaRaw = row[idx]; break; }
                    }
                }
            }
            if (!(taxa > 0)) { descartar('taxa'); continue; }

            const prazo = parsePrazoLocal(getV('vencimento'), hoje);
            if (!prazo) { descartar('prazo'); continue; }

            let tipo = normalizeTipoLocal(tipoRaw, regras) || normalizeTipoLocal(getV('instrumento'), regras);
            for (let j = 0; !tipo && j < Math.min(5, row.length); j++) tipo = normalizeTipoLocal(row[j], regras);
            if (!tipo) { descartar('tipo'); continue; }

            // Indexador: coluna própria e texto da taxa; na falta, IPCA/CDI nas 15 primeiras células
            const naLinha = detectarIndexador(...Array.from(row.slice(0, 15)));
            const indexador = detectarIndexador(getV('indexador'), taxaRaw) || (naLinha !== 'PRE' && naLinha) || 'PRE';

            // Célula numérica em formato de porcentagem: 105% do CDI chega como 1,05
            if (typeof taxaRaw === 'number' && indexador === 'CDI' && taxa >= 1 && taxa < 3) taxa *= 100;

            const entrada = { prazo, tipo, taxa, indexador, emissor: extrairEmissor(getV('emissor'), row[0], regras), ativo, dias: diasAteOVencimento(getV('vencimento'), hoje) };

            if (regras.isentos.tipos.includes(tipo) || isentoPorColuna(getV('isento'))) {
                const sub = indexador === 'IPCA' ? 'IPCA' : indexador === 'PRE' ? 'PRE' : 'CDI';
                // Isentos: os prazos das regras (no padrão, pré até 3 anos; CDI e IPCA só no vértice de 2)
                const permitido = regras.isentos[sub.toLowerCase()].includes(prazo);
                if (!permitido) { descartar('isento'); continue; }
                // Chave por prazo e subtipo: LCA, LCI e LCD competem entre si
                disputar(pools.isentos, `${prazo}_${sub}`, { ...entrada, sub });
            } else {
                const pool = indexador === 'IPCA' ? pools.ipca : indexador === 'PRE' ? pools.pre : pools.pos;
                disputar(pool, prazo, entrada);
            }
            resultado.totais.elegiveis++;
        }
    }

    const porPrazo = (a, b) => a.prazo - b.prazo;
    const exibidos = (pool, filtro) => Object.values(pool).filter((e) => filtro(e.prazo)).sort(porPrazo);
    const ordemSub = { PRE: 0, CDI: 1, IPCA: 2 };

    resultado.secoes = [
        { id: 'pre', titulo: 'Pré-fixadas', itens: exibidos(pools.pre, (p) => regras.prazos.pre.includes(p)) },
        { id: 'pos', titulo: 'Pós-fixadas', itens: exibidos(pools.pos, (p) => regras.prazos.pos.includes(p)) },
        { id: 'ipca', titulo: 'IPCA+', itens: exibidos(pools.ipca, (p) => regras.prazos.ipca.includes(p)) },
        { id: 'isentos', titulo: 'Isentos de IR', itens: Object.values(pools.isentos).sort((a, b) => (ordemSub[a.sub] - ordemSub[b.sub]) || porPrazo(a, b)) },
    ];
    resultado.totais.vencedores = Object.values(pools).reduce((soma, pool) => soma + Object.keys(pool).length, 0);
    resultado.totais.exibidos = resultado.secoes.reduce((soma, secao) => soma + secao.itens.length, 0);
    return resultado;
}

function fmtT(num) {
    let s = num.toFixed(2).replace('.', ',');
    if (s.endsWith(',00')) return s.slice(0, -3);
    return s;
}

function fmtP(a) { return a === 1 ? '1 ano' : `${a} anos`; }

/**
 * Partes da taxa para exibir na interface: { prefixo, valor, sufixo }.
 * Ex.: { '', '14,20', '% a.a.' } · { 'IPCA + ', '8,40', '% a.a.' } · { '', '105', '% CDI' }
 */
function partesDaTaxa(item) {
    const valor = fmtT(item.taxa);
    if (item.indexador === 'IPCA') return { prefixo: 'IPCA + ', valor, sufixo: '% a.a.' };
    if (item.indexador === 'CDI+') return { prefixo: 'CDI + ', valor, sufixo: '% a.a.' };
    if (item.indexador === 'CDI') return { prefixo: '', valor, sufixo: '% CDI' };
    return { prefixo: '', valor, sufixo: '% a.a.' };
}

/**
 * Texto final para WhatsApp. É o que o cliente lê: mantenha o formato
 * (asteriscos de negrito, "-> ", travessão "–" nos isentos) estável.
 * Retorna '' quando não há oportunidade.
 */
function montarMensagem(resultado, regras = regrasPadrao(resultado?.secundario ? 'secundario' : 'primario')) {
    const vazia = { texto: '', cabecalho: '', blocos: {}, rodape: '' };
    if (!resultado || !resultado.totais.exibidos) return vazia;
    const m = regras.mensagem;
    const taxa = (num) => {
        let t = num.toFixed(m.casas).replace('.', ',');
        if (m.tirarZeros && m.casas > 0 && t.endsWith(',' + '0'.repeat(m.casas))) t = t.slice(0, -(m.casas + 1));
        return t;
    };
    const prazo = (p) => (p === 1 ? m.prazoUm : m.prazoVarios.replace(/\{n\}/g, String(p)));
    const preencher = (modelo, e) =>
        modelo.replace(/\{(prazo|tipo|taxa|emissor)\}/g, (_, k) =>
            k === 'prazo' ? prazo(e.prazo) : k === 'tipo' ? e.tipo : k === 'taxa' ? taxa(e.taxa) : m.mostrarEmissor && e.emissor ? ` (${e.emissor})` : '');
    const modeloDe = {
        pre: () => m.linhas.pre,
        pos: (e) => (e.indexador === 'CDI+' ? m.linhas.posCdiMais : m.linhas.posCdi),
        ipca: () => m.linhas.ipca,
        isentos: (e) => (e.sub === 'IPCA' ? m.linhas.isentoIpca : e.indexador === 'CDI+' ? m.linhas.isentoCdiMais : e.sub === 'CDI' ? m.linhas.isentoCdi : m.linhas.isentoPre),
    };

    const porId = Object.fromEntries(resultado.secoes.map((secao) => [secao.id, secao]));
    const blocos = {};
    for (const id of m.ordem) {
        const secao = porId[id];
        if (!secao || !secao.itens.length) continue;
        blocos[id] = [m.titulos[id], ...secao.itens.map((e) => preencher(modeloDe[id](e), e))].filter((linha, i) => i > 0 || linha !== '').join('\n');
    }
    const ids = Object.keys(blocos);
    // Como o original: uma linha em branco depois de cada seção, menos a dos isentos no fim.
    let corpo = ids.map((id) => blocos[id]).join('\n\n') + (ids.at(-1) === 'isentos' ? '' : '\n');
    if (m.rodape) corpo = corpo.replace(/\n*$/, '') + '\n\n' + m.rodape;
    const texto = (m.cabecalho ? m.cabecalho + '\n\n' : '') + corpo;
    return { texto, cabecalho: m.cabecalho, blocos, rodape: m.rodape };
}

/**
 * Texto final para WhatsApp. É o que o cliente lê: com as regras do padrão, o formato do original
 * (asteriscos de negrito, "-> ", travessão "–" nos isentos), estável. Retorna '' quando não há
 * oportunidade.
 */
function montarTexto(resultado, regras) {
    return montarMensagem(resultado, regras).texto;
}

export {
    processRows, montarTexto, montarMensagem, motivosDoDescarte, mapearColunas, partesDaTaxa, parseTaxaLocal, parsePULocal, parsePrazoLocal, diasAteOVencimento,
    classificarDiasEmAnos, normalizeTipoLocal, detectarIndexador, extrairEmissor, parseNumero,
    fmtT, fmtP, MOTIVOS_DESCARTE, PRAZOS_EXIBIDOS,
};

import './ui/base.css';
import './ui/componentes.css';
import './shell/casca.css';

import { iniciarAnotacoes } from './modulos/anotacoes/index.js';
import { repositorioDasAnotacoes } from './modulos/anotacoes/banco.js';
import { linkDaNota } from './modulos/anotacoes/render.js';
import { iniciarVigia } from './modulos/anotacoes/vigia.js';
import { iniciarCalendario } from './modulos/calendario/index.js';
import { iniciarContadorDaFila, iniciarFila, iniciarVigiaDaFila } from './modulos/fila/index.js';
import { iniciarFotosDaPrateleira, iniciarFundos } from './modulos/fundos/index.js';
import { iniciarOperacional } from './modulos/operacional/index.js';
import { iniciarOrdens } from './modulos/ordens/index.js';
import { iniciarRendaFixa } from './modulos/rendafixa/index.js';
import { acharEm, registrarFonteDeBusca } from './comum/busca.js';
import { NOMES_DOS_GRUPOS } from './comum/fila/regras.js';
import { filaDaPagina } from './comum/fila/repositorio.js';
import { quandoHouver, servico } from './comum/servicos.js';
import { POSTS, TOPICOS } from './modulos/operacional/conteudo.js';
import { ABAS, ligarAbas } from './shell/abas.js';
import { ligarBusca } from './shell/busca.js';
import { ligarRelogio } from './shell/relogio.js';
import { esc } from './ui/html.js';
import { ligarBotaoDeTema } from './ui/tema.js';
import { ligarBotaoDeSom } from './ui/avisos.js';

/**
 * A casca: tema, abas e o início de cada ferramenta.
 *
 * Nenhuma regra de negócio mora aqui nem em `shell/` — cada ferramenta é um módulo em
 * `modulos/`, e a casca só decide qual está à vista.
 */

const falhar = (id, secao, erro) => {
  console.error(`Falha ao iniciar ${id}:`, erro);
  secao.innerHTML = `
    <div class="falha-modulo">
      <div class="alert alert-danger">Esta ferramenta não abriu: ${esc(erro?.message ?? erro)}. As outras abas seguem funcionando.</div>
    </div>`;
};

ligarBotaoDeTema(document.getElementById('btn-tema'));
ligarBotaoDeSom(document.getElementById('btn-som'));
ligarRelogio();
ligarBusca();

// O Ordens inicia com a página, como sempre: é a aba padrão e não depende de rede.
iniciarOrdens(document.getElementById('modulo-ordens'));

ligarAbas({
  preguicosos: {
    fila: iniciarFila,
    fundos: iniciarFundos,
    rendafixa: iniciarRendaFixa,
    calendario: iniciarCalendario,
    operacional: iniciarOperacional,
    anotacoes: iniciarAnotacoes
  },
  aoFalhar: falhar
});

// Os lembretes das Anotações vigiam desde já, em qualquer aba: quem passa o dia no Ordens também
// tem de ver o alerta. A aba Anotações em si continua abrindo só na primeira visita.
try {
  iniciarVigia({ repo: repositorioDasAnotacoes(), abrirNota: (id) => (location.hash = linkDaNota(id)) });
} catch (erro) {
  console.error('Os lembretes das Anotações não iniciaram:', erro);
}

// O contador da Fila também: a resposta do cliente e o prazo perto aparecem em qualquer aba.
/*
 * As fontes da busca (Ctrl+K), na ordem em que aparecem: as abas, os modelos e passos do Operacional
 * (a base do Slab que vem no arquivo), as anotações e os cartões da Fila (os dois no navegador). O
 * histórico do Ordens é registrado pelo próprio Ordens.
 */
const NOMES_DAS_ABAS = { ordens: 'Ordens', fila: 'Fila do dia', fundos: 'Prateleira de fundos', rendafixa: 'Renda Fixa', calendario: 'Calendário', operacional: 'Operacional', anotacoes: 'Anotações' };
registrarFonteDeBusca({
  id: 'abas',
  nome: 'Abas',
  buscar: (termo) =>
    acharEm(ABAS, termo, (aba) => ({ titulo: NOMES_DAS_ABAS[aba] ?? aba })).map((aba) => ({
      titulo: `Ir para ${NOMES_DAS_ABAS[aba] ?? aba}`,
      detalhe: `Alt + ${ABAS.indexOf(aba) + 1}`,
      abrir: () => (location.hash = aba)
    }))
});
const NOMES_DOS_TOPICOS = Object.fromEntries(TOPICOS.map((t) => [t.slug, t.nome]));
registrarFonteDeBusca({
  id: 'operacional',
  nome: 'Operacional',
  buscar: (termo) =>
    acharEm(POSTS, termo, (p) => ({ titulo: p.titulo, resto: `${NOMES_DOS_TOPICOS[p.topico] ?? ''} ${p.conteudo ?? ''}` })).map((p) => ({
      titulo: p.titulo,
      detalhe: NOMES_DOS_TOPICOS[p.topico] ?? '',
      abrir: () => (location.hash = `#operacional/post/${p.slug}`)
    }))
});
registrarFonteDeBusca({
  id: 'anotacoes',
  nome: 'Anotações',
  buscar: async (termo) => {
    const notas = (await repositorioDasAnotacoes().listarNotas()).filter((n) => !n.excluidaEm);
    const tituloDe = (n) => n.titulo?.trim() || (n.texto ?? '').trim().split('\n')[0] || 'Sem título';
    return acharEm(notas, termo, (n) => ({ titulo: tituloDe(n), resto: `${n.texto ?? ''} ${(n.etiquetas ?? []).join(' ')}` })).map((n) => ({
      titulo: tituloDe(n),
      detalhe: (n.etiquetas ?? []).map((e) => `#${e}`).join(' ') || (n.texto ?? '').replace(/\s+/g, ' ').slice(0, 90),
      abrir: () => (location.hash = linkDaNota(n.id))
    }));
  }
});
const ESTADOS_NA_BUSCA = { enviado: 'aguardando o cliente', respondeu: 'o cliente respondeu', aprovado: 'aprovado', executado: 'executado', cancelado: 'cancelado' };
registrarFonteDeBusca({
  id: 'fila',
  nome: 'Fila do dia',
  buscar: async (termo) => {
    const pedidos = (await filaDaPagina().listarTodos()).reverse();
    return acharEm(pedidos, termo, (p) => ({
      titulo: `${p.conta} ${p.cliente?.nome ?? ''}`,
      resto: `${NOMES_DOS_GRUPOS[p.grupo] ?? ''} ${p.ordens.map((o) => o.ativo).join(' ')} ${ESTADOS_NA_BUSCA[p.estado] ?? ''}`
    })).map((p) => {
      const [ano, mes, dia] = p.dia.split('-');
      return {
        titulo: `Conta ${p.conta}${p.cliente?.nome ? ` · ${p.cliente.nome}` : ''}`,
        detalhe: `${dia}/${mes}/${ano} · ${NOMES_DOS_GRUPOS[p.grupo] ?? p.grupo} · ${p.ordens.map((o) => o.ativo).join(', ')} · ${ESTADOS_NA_BUSCA[p.estado] ?? p.estado}`,
        abrir: () => {
          location.hash = 'fila';
          quandoHouver('fila.mostrar', (mostrar) => mostrar(p));
        }
      };
    });
  }
});

// Os fundos da prateleira: abre a aba Fundos já filtrada.
registrarFonteDeBusca({
  id: 'fundos',
  nome: 'Prateleira de fundos',
  buscar: (termo) =>
    acharEm(servico('prateleira')?.atual()?.fundos ?? [], termo, (f) => ({ titulo: `${f.ticker ?? ''} ${f.nome}` })).map((f) => ({
      titulo: f.ticker ? `${f.ticker} · ${f.nome}` : f.nome,
      detalhe: `deságio ${(f.desagio ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%${(f.estoque ?? 0) > 0 ? '' : ' · sem estoque'}`,
      abrir: () => {
        location.hash = 'fundos';
        quandoHouver('fundos.mostrar', (mostrar) => mostrar(f.ticker ?? f.nome));
      }
    }))
});

// A foto da prateleira de cada dia, para o "o que mudou" da aba Fundos.
try {
  iniciarFotosDaPrateleira();
} catch (erro) {
  console.error('A foto da prateleira não iniciou:', erro);
}

// E o vigia das respostas no Outlook, pelo robô.
try {
  iniciarContadorDaFila();
  iniciarVigiaDaFila();
} catch (erro) {
  console.error('O contador da Fila não iniciou:', erro);
}

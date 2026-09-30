/**
 * Modelos de anotação: os casos que a mesa anota toda semana, já com o esqueleto — os campos que
 * sempre se esquece de anotar e a checklist do que fazer. Como os modelos do Evernote e do Notion,
 * mas só os da mesa. Funções puras, testadas em `recursos.test.js`.
 *
 * Nenhum modelo inventa prazo: só o de retorno de ligação sugere "daqui 1 hora", porque retorno de
 * ligação é isso; os outros saem sem lembrete, e a pessoa marca o dela.
 */

import { aplicarAtalho } from './lembretes.js';

export const MODELOS = [
  {
    id: 'estorno',
    nome: 'Estorno',
    dica: 'conta, valor, motivo e o passo a passo',
    titulo: 'Estorno — ',
    texto: 'Conta: \nCliente/assessor: \nValor: R$ \nData do lançamento: \nMotivo: \n\n[ ] Pedir o estorno\n[ ] Anexar o print\n[ ] Avisar o assessor\n[ ] Conferir se caiu',
    etiquetas: ['estorno']
  },
  {
    id: 'pendencia',
    nome: 'Pendência de cliente',
    dica: 'o que falta e com quem falar',
    titulo: 'Pendência — ',
    texto: 'Conta: \nO que falta: \nCom quem falar: \n\n[ ] Cobrar\n[ ] Resolver\n[ ] Confirmar com o assessor',
    etiquetas: ['pendência']
  },
  {
    id: 'ajudar',
    nome: 'Ajudar um colega',
    dica: 'para não esquecer o que prometeu',
    titulo: 'Ajudar ',
    texto: 'Quem: \nNo quê: \nPrazo combinado: \n\n[ ] Separar o material\n[ ] Ajudar\n[ ] Dar retorno',
    etiquetas: ['ajudar']
  },
  {
    id: 'retorno',
    nome: 'Retornar ligação',
    dica: 'lembra daqui 1 hora',
    titulo: 'Retornar — ',
    texto: 'Quem ligou: \nTelefone: \nAssunto: \n',
    etiquetas: ['retorno'],
    atalho: '1h'
  }
];

/** Os campos de uma anotação nova feita a partir do modelo. */
export const aplicarModelo = (modelo, agora = new Date()) => ({
  titulo: modelo.titulo ?? '',
  texto: modelo.texto ?? '',
  etiquetas: [...(modelo.etiquetas ?? [])],
  lembrete: modelo.atalho ? aplicarAtalho(modelo.atalho, agora) : null
});

import { describe, expect, it } from 'vitest';
import { EQUIPE, POSTS, TOPICOS, slugDe } from './conteudo.js';

/**
 * A semente é a cópia do Slab da mesa. Estes testes prendem a estrutura ao que foi colado de lá em
 * 30/09/2026 — tópicos, ordem dos posts e quais vieram sem texto —, para uma edição do arquivo não
 * inventar post nem perder um.
 */

const titulosDe = (topico) => POSTS.filter((p) => p.topico === topico).map((p) => p.titulo);

describe('semente da base Operacional (cópia do Slab)', () => {
  it('é da equipe do Slab da mesa', () => {
    expect(EQUIPE).toBe("Gregori's Team");
  });

  it('tem a raiz e os cinco tópicos, na ordem do Slab', () => {
    expect(TOPICOS.map((t) => t.nome)).toEqual([
      'Mesa de Operações Argentum',
      'Padrões de Email',
      'Disparos',
      'Passo a Passo',
      'Padrões de Fixing',
      'Execução de Ordens'
    ]);
    expect(TOPICOS[0]).toMatchObject({ pai: null, descricao: 'Material de conhecimento e uso de colaboradores da mesa de operações' });
    expect(TOPICOS.slice(1).every((t) => t.pai === 'mesa-de-operacoes-argentum')).toBe(true);
  });

  it('lista os posts de cada tópico na ordem do Slab', () => {
    expect(titulosDe('padroes-de-email')).toEqual([
      'Confirmação de ordem Venda',
      'Confirmação de ordem Compra',
      'Confirmação aplicação Tesouro Direto',
      'Confirmação resgate Tesouro Direto',
      'Confirmação de ordem e cancelamento de carteira',
      'Confirmação de resgate',
      'Confirmação resgate fundos',
      'Confirmação zeragem estrutura',
      'Confirmação de aplicação',
      'Cancelamento de Carteira',
      'Confirmação aplicação Fundos',
      'Confirmação zeragem SWAP',
      'Subscrição – Exercício',
      'Cancelamento de Custódia Remunerada'
    ]);
    expect(titulosDe('disparos')).toEqual(['Tabela de Cetipados', 'Trade Idea Destaque', 'Disparo RF']);
    expect(titulosDe('passo-a-passo')).toEqual(['Relatórios', 'Contratar/Cancelar Custódia remunerada', 'Posições']);
    expect(titulosDe('padroes-de-fixing')).toEqual([
      'Rubi', 'Financiamento', 'Smart Coupon', 'Booster', 'Fence', 'POP',
      'Spider', 'Collar', 'DOC', 'Put', 'Call', 'Alocação Estratégica'
    ]);
    expect(titulosDe('execucao-de-ordens')).toEqual(['Cetipados', 'Ações e Fundos Listados']);
    expect(POSTS).toHaveLength(34);
  });

  // O texto destes não veio do Slab. Vazio é honesto; um texto inventado iria para o cliente.
  it('deixa sem texto só os posts que vieram só com o título', () => {
    const vazios = POSTS.filter((p) => !p.conteudo).map((p) => p.titulo);
    expect(vazios).toEqual([
      'Confirmação resgate fundos',
      'Confirmação aplicação Fundos',
      'Rubi', 'Financiamento', 'Smart Coupon', 'Booster', 'Fence', 'POP',
      'Spider', 'Collar', 'DOC', 'Put', 'Call', 'Alocação Estratégica',
      'Ações e Fundos Listados'
    ]);
  });

  it('guarda o texto como no Slab, inclusive os dois modelos da Venda', () => {
    const venda = POSTS.find((p) => p.titulo === 'Confirmação de ordem Venda').conteudo;
    expect(venda.startsWith('Prezado(a) CLIENTE,\nConforme conversado, gostaria de realizar a ordem abaixo na conta XP XXXXX')).toBe(true);
    expect(venda).toContain('\nPARA AÇÕES:\n');
    expect(venda).toContain('Valor: R$ 9.600,00;');
    expect(venda.endsWith('Att,')).toBe(true);
    expect(POSTS.find((p) => p.titulo === 'Disparo RF').conteudo).toContain('*Oportunidades de RENDA FIXA hoje!* ⭐');
    expect(POSTS.find((p) => p.titulo === 'Contratar/Cancelar Custódia remunerada').conteudo).toContain('(somente para cncelar)');
  });

  it('não carrega espaço invisível nem espaço no fim da linha', () => {
    for (const p of POSTS) {
      expect(p.conteudo, p.titulo).not.toMatch(/ /);
      expect(p.conteudo, p.titulo).not.toMatch(/[ \t]+$/m);
      expect(p.conteudo, p.titulo).toBe(p.conteudo.trim() === '' ? '' : p.conteudo.replace(/^\n+|\n+$/g, ''));
    }
  });

  it('dá a cada post e tópico um slug único e estável', () => {
    const slugs = [...TOPICOS, ...POSTS].map((x) => x.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(POSTS[0].slug).toBe('confirmacao-de-ordem-venda');
    expect(slugDe('Subscrição – Exercício')).toBe('subscricao-exercicio');
    expect(slugDe('Contratar/Cancelar Custódia remunerada')).toBe('contratar-cancelar-custodia-remunerada');
  });
});

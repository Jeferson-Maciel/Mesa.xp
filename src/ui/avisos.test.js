import { describe, expect, it } from 'vitest';
import { MAXIMO_DE_AVISOS, avisosParaTirar, aviso, tocaSom } from './avisos.js';

// Fase 3 (21/10/2026, Q32 e Q33): o som só no que pede a pessoa de volta, e no máximo 3 avisos à vista.
describe('o som dos avisos', () => {
  it('toca no erro, no aviso de prazo e quando o chamador pede (a resposta do cliente)', () => {
    expect(tocaSom({ tipo: 'erro' })).toBe(true);
    expect(tocaSom({ tipo: 'prazo' })).toBe(true);
    expect(tocaSom({ tipo: 'info', som: true })).toBe(true);
  });

  it('não toca no aviso comum: "copiado", "salvo", o Desfazer', () => {
    expect(tocaSom({ tipo: 'info' })).toBe(false);
    expect(tocaSom({})).toBe(false);
  });

  it('o chamador pode calar até o erro', () => {
    expect(tocaSom({ tipo: 'erro', som: false })).toBe(false);
  });
});

describe('no máximo 3 avisos à vista', () => {
  it('com 3 à vista, o novo tira o mais antigo', () => {
    expect(MAXIMO_DE_AVISOS).toBe(3);
    expect(avisosParaTirar(['info', 'info', 'info'])).toEqual([0]);
  });

  it('com menos de 3, nada sai', () => {
    expect(avisosParaTirar([])).toEqual([]);
    expect(avisosParaTirar(['info', 'erro'])).toEqual([]);
  });

  it('o erro não sai: tira o mais antigo que não é erro', () => {
    expect(avisosParaTirar(['erro', 'info', 'prazo'])).toEqual([1]);
    expect(avisosParaTirar(['erro', 'erro', 'info'])).toEqual([2]);
  });

  it('só erros à vista: nenhum sai, e o novo entra assim mesmo', () => {
    expect(avisosParaTirar(['erro', 'erro', 'erro'])).toEqual([]);
  });

  it('com mais que 3 (erros que ficaram), tira o bastante para sobrar lugar só para o novo', () => {
    expect(avisosParaTirar(['erro', 'erro', 'erro', 'info', 'info'])).toEqual([3, 4]);
  });
});

describe('proteção contra avalanche e vazamento no DOM', () => {
  const criarElementoMock = (tag = 'div') => {
    const el = {
      tagName: tag.toUpperCase(),
      children: [],
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); }
      },
      dataset: {},
      style: { setProperty() {} },
      setAttribute() {},
      append(...filhos) {
        this.children.push(...filhos);
        filhos.forEach((f) => (f.parentElement = this));
      },
      appendChild(filho) {
        this.children.push(filho);
        filho.parentElement = this;
        return filho;
      },
      remove() {
        if (this.parentElement) {
          this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
        }
      },
      addEventListener() {}
    };
    return el;
  };

  it('mensagens idênticas ativas não criam novos toasts duplicados', () => {
    const container = criarElementoMock('div');
    container.id = 'toasts';
    globalThis.document = {
      getElementById: (id) => (id === 'toasts' ? container : null),
      createElement: (tag) => criarElementoMock(tag)
    };

    aviso('Mensagem repetida');
    aviso('Mensagem repetida');
    aviso('Mensagem repetida');

    expect(container.children.length).toBe(1);
    delete globalThis.document;
  });

  it('o teto rígido não permite que mais de MAXIMO_DE_AVISOS permaneçam no container', () => {
    const container = criarElementoMock('div');
    container.id = 'toasts';
    globalThis.document = {
      getElementById: (id) => (id === 'toasts' ? container : null),
      createElement: (tag) => criarElementoMock(tag)
    };

    aviso('Mensagem 1');
    aviso('Mensagem 2');
    aviso('Mensagem 3');
    aviso('Mensagem 4');
    aviso('Mensagem 5');

    expect(container.children.length).toBeLessThanOrEqual(MAXIMO_DE_AVISOS);
    delete globalThis.document;
  });
});

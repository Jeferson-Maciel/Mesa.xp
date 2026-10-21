import { describe, expect, it } from 'vitest';
import { chaveDoDia } from './dia.js';

describe('a chave do dia', () => {
  it('é a do dia local, de uma data ou de um momento: às 22h ainda é hoje (em UTC já seria amanhã)', () => {
    const noite = new Date(2026, 9, 21, 22, 30);
    expect(chaveDoDia(noite)).toBe('2026-10-21');
    expect(chaveDoDia(noite.getTime())).toBe('2026-10-21');
    expect(chaveDoDia(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

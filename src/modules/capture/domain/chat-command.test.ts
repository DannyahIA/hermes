import { describe, expect, it } from 'vitest';

import { readChatCommand } from './chat-command';

describe('reading a command sent to the bot', () => {
  it('reads each command, in any case and with the bot’s name', () => {
    expect(readChatCommand('/livre')).toBe('livre');
    expect(readChatCommand('/FATURA')).toBe('fatura');
    expect(readChatCommand('/hoje@hermes_dan_bot')).toBe('hoje');
    expect(readChatCommand('  /desfazer  ')).toBe('desfazer');
    expect(readChatCommand('/ajuda')).toBe('ajuda');
    expect(readChatCommand('/help')).toBe('ajuda');
  });

  it('takes an unknown command as a call for help', () => {
    expect(readChatCommand('/saldo')).toBe('ajuda');
  });

  it('leaves anything else for the entry reader', () => {
    expect(readChatCommand('almoço 32,50')).toBeNull();
    expect(readChatCommand('pizza /2 40')).toBeNull();
    expect(readChatCommand('12/10 mercado 80')).toBeNull();
  });
});

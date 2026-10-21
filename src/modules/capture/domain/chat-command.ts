/**
 * The bot's read-only commands (spec 2026-10-17-telegram-apple-pay-
 * design.md §5.6), with what the Telegram menu says about each.
 */
export const CHAT_COMMANDS = [
  { name: 'livre', description: 'Quanto ainda dá para gastar' },
  { name: 'fatura', description: 'As faturas dos cartões' },
  { name: 'hoje', description: 'Os gastos de hoje' },
  { name: 'desfazer', description: 'Desfaz o último registro' },
  { name: 'ajuda', description: 'Como registrar pelo chat' },
] as const;

export type ChatCommand = (typeof CHAT_COMMANDS)[number]['name'];

const NAMES = new Set<string>(CHAT_COMMANDS.map((command) => command.name));
/** "/hoje" or "/hoje@hermes_bot", alone in the message. */
const COMMAND = /^\/([a-z]+)(?:@\w+)?$/i;

/**
 * The command a message is, or null for a message to read as an entry.
 * An unknown command ("/saldo") gets the help, which lists the real ones.
 */
export function readChatCommand(text: string): ChatCommand | null {
  const match = COMMAND.exec(text.trim());
  if (!match) return null;
  const name = match[1].toLowerCase();
  return NAMES.has(name) ? (name as ChatCommand) : 'ajuda';
}

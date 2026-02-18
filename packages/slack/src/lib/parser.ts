import type { ParsedCommand } from '../types.js';

const KNOWN_SUBCOMMANDS = [
  'init',
  'log',
  'products',
  'features',
  'revert',
  'link',
  'search',
  'describe',
] as const;

const SCOPE_VALUES = ['minor', 'major', 'architectural'] as const;

type KnownSubcommand = (typeof KNOWN_SUBCOMMANDS)[number];

function isKnownSubcommand(word: string): word is KnownSubcommand {
  return KNOWN_SUBCOMMANDS.includes(word as KnownSubcommand);
}

function isValidScope(value: string): value is 'minor' | 'major' | 'architectural' {
  return SCOPE_VALUES.includes(value as (typeof SCOPE_VALUES)[number]);
}

/**
 * Tokenize the input string, respecting quoted strings (both single and double quotes).
 * Quoted strings are returned without their surrounding quotes.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null;
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (inQuote) {
      if (char === inQuote) {
        // End of quoted string — push what we have
        tokens.push(current);
        current = '';
        inQuote = null;
      } else {
        current += char;
      }
    } else {
      if (char === '"' || char === "'") {
        // Start of quoted string — push any accumulated unquoted text first
        if (current.length > 0) {
          tokens.push(current);
          current = '';
        }
        inQuote = char;
      } else if (/\s/.test(char)) {
        if (current.length > 0) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    i++;
  }

  // Push any remaining text
  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Parse an @lock mention text into a structured command.
 *
 * Strips the bot mention (anything like `<@U...>`), identifies subcommands,
 * extracts flags, and collects the remaining text as the message.
 */
export function parseCommand(text: string): ParsedCommand {
  // Strip bot mention — matches <@UXXXXXXX> patterns
  const stripped = text.replace(/<@[A-Z0-9]+>/g, '').trim();

  const tokens = tokenize(stripped);

  const flags: ParsedCommand['flags'] = {
    tags: [],
  };
  const positionalArgs: string[] = [];
  const messageParts: string[] = [];

  let subcommand: ParsedCommand['subcommand'] = 'commit';
  let subcommandFound = false;

  let i = 0;

  // Check if the first token is a known subcommand
  if (tokens.length > 0 && isKnownSubcommand(tokens[0])) {
    subcommand = tokens[0] as ParsedCommand['subcommand'];
    subcommandFound = true;
    i = 1;
  }

  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '--scope' && i + 1 < tokens.length) {
      const value = tokens[i + 1];
      if (isValidScope(value)) {
        flags.scope = value;
      }
      i += 2;
      continue;
    }

    if (token === '--ticket' && i + 1 < tokens.length) {
      flags.ticket = tokens[i + 1];
      i += 2;
      continue;
    }

    if (token === '--tag' && i + 1 < tokens.length) {
      flags.tags.push(tokens[i + 1]);
      i += 2;
      continue;
    }

    if (token === '--also' && i + 1 < tokens.length) {
      flags.also = tokens[i + 1];
      i += 2;
      continue;
    }

    if (token === '--product' && i + 1 < tokens.length) {
      flags.product = tokens[i + 1];
      i += 2;
      continue;
    }

    if (token === '--feature' && i + 1 < tokens.length) {
      flags.feature = tokens[i + 1];
      i += 2;
      continue;
    }

    // For subcommands that take positional args (revert, link), collect them separately
    if (subcommandFound && (subcommand === 'revert' || subcommand === 'link')) {
      // First positional arg is the short_id, rest are message/ref
      if (positionalArgs.length === 0 && token.startsWith('l-')) {
        positionalArgs.push(token);
      } else if (subcommand === 'link' && positionalArgs.length === 1) {
        // Second positional arg for link is the reference
        positionalArgs.push(token);
      } else {
        messageParts.push(token);
      }
    } else {
      messageParts.push(token);
    }

    i++;
  }

  return {
    subcommand,
    message: messageParts.join(' '),
    flags,
    args: positionalArgs,
  };
}

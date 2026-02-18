export interface ParsedCommand {
  subcommand:
    | 'init'
    | 'log'
    | 'products'
    | 'features'
    | 'revert'
    | 'link'
    | 'search'
    | 'describe'
    | 'commit';
  message: string;
  flags: {
    scope?: 'minor' | 'major' | 'architectural';
    ticket?: string;
    tags: string[];
    also?: string;
    product?: string;
    feature?: string;
  };
  args: string[]; // positional arguments like short_id for revert/link
}

export interface ThreadContext {
  messages: { userId: string; text: string; userName?: string }[];
  participants: string[];
  permalink?: string;
  snippet: string;
}

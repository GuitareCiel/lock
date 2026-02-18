import OpenAI from 'openai';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export interface ClassificationResult {
  relationship: 'no_relation' | 'related' | 'potential_conflict' | 'supersession';
  explanation: string;
}

export async function classifyRelationship(
  existingLock: { message: string; scope: string; context?: string | null; featureName: string },
  newLock: { message: string; scope: string; context?: string | null; featureName: string }
): Promise<ClassificationResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { relationship: 'no_relation', explanation: '' };
  }

  const prompt = `You are analyzing product decisions for conflicts.

Decision A (existing, ${existingLock.scope}): "${existingLock.message}"
  Context: ${existingLock.context || 'None'}
  Feature: ${existingLock.featureName}

Decision B (new, ${newLock.scope}): "${newLock.message}"
  Context: ${newLock.context || 'None'}
  Feature: ${newLock.featureName}

Classify the relationship as exactly one of:
- "no_relation" — these decisions are about different things
- "related" — these are about the same area but don't conflict
- "potential_conflict" — these decisions may contradict each other
- "supersession" — Decision B replaces/updates Decision A

Respond with JSON only: { "relationship": "...", "explanation": "..." }`;

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 256,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.choices[0]?.message?.content ?? '';

  try {
    return JSON.parse(text) as ClassificationResult;
  } catch {
    return { relationship: 'no_relation', explanation: '' };
  }
}

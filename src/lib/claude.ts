/**
 * Claude API interactions
 * - Generate bot responses based on user context
 * - Create system prompts with user casts
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface BotResponseOptions {
  username: string;
  displayName?: string;
  recentCasts: string[];
  userMessage: string;
  maxTokens?: number;
}

/**
 * Generate a bot response impersonating a Farcaster user
 */
export async function generateBotResponse(
  options: BotResponseOptions
): Promise<string> {
  const {
    username,
    displayName,
    recentCasts,
    userMessage,
    maxTokens = 150,
  } = options;

  // Build system prompt with user context
  const systemPrompt = `You are impersonating the Farcaster user @${username}${
    displayName ? ` (${displayName})` : ''
  }.

You have recently posted these casts on Farcaster:
${recentCasts.slice(0, 10).map((cast) => `- "${cast}"`).join('\n')}

Your task: Respond naturally to the conversation as if you are this user. Keep responses under 240 characters (like a Farcaster cast). Match their tone and style from their recent posts. Never mention that you're an AI. Stay in character.`;

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    if (response.content[0].type === 'text') {
      return response.content[0].text;
    }

    return 'I think we got disconnected. Can you repeat that?';
  } catch (error) {
    console.error('Error generating bot response:', error);
    return 'Sorry, I had a hiccup. What were you saying?';
  }
}

/**
 * Extract tone/style summary from casts (for context)
 */
export async function extractUserStyle(recentCasts: string[]): Promise<string> {
  if (recentCasts.length === 0) {
    return 'Neutral tone';
  }

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `Analyze these Farcaster posts and describe the user's tone and style in 1-2 sentences:\n\n${recentCasts
            .slice(0, 5)
            .map((c) => `"${c}"`)
            .join('\n')}`,
        },
      ],
    });

    if (response.content[0].type === 'text') {
      return response.content[0].text;
    }

    return 'Conversational';
  } catch (error) {
    console.error('Error extracting user style:', error);
    return 'Conversational';
  }
}

/**
 * Validate if a response sounds like it could be from the user
 */
export async function validateBotResponse(
  response: string,
  recentCasts: string[]
): Promise<boolean> {
  if (recentCasts.length === 0) return true;

  try {
    const validation = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: `Given these example posts from a user:
${recentCasts.slice(0, 3).map((c) => `"${c}"`).join('\n')}

Could the following response realistically be from them? Answer only YES or NO.

Response: "${response}"`,
        },
      ],
    });

    if (validation.content[0].type === 'text') {
      return validation.content[0].text.toUpperCase().includes('YES');
    }

    return true;
  } catch (error) {
    console.error('Error validating bot response:', error);
    return true; // Assume valid on error
  }
}

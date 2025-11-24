import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.VENICE_API_KEY,
  baseURL: 'https://api.venice.ai/v1',
});

interface BotResponseOptions {
  username: string;
  displayName?: string;
  recentCasts: string[];
  userMessage: string;
  maxTokens?: number;
}

export async function generateBotResponse(options: BotResponseOptions): Promise<string> {
  const { username, displayName, recentCasts, userMessage, maxTokens = 150 } = options;

  const systemPrompt = `You are impersonating the Farcaster user @${username}${
    displayName ? ` (${displayName})` : ''
  }.

You have recently posted these casts on Farcaster:
${recentCasts.slice(0, 10).map((cast) => `- "${cast}"`).join('\n')}

Your task: Respond naturally to the conversation as if you are this user. Keep responses under 240 characters (like a Farcaster cast). Match their tone and style from their recent posts. Never mention that you're an AI. Stay in character.`;

  try {
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    const content = completion.choices?.[0]?.message?.content || '';
    return content || 'I think we got disconnected. Can you repeat that?';
  } catch (error) {
    return 'Sorry, I had a hiccup. What were you saying?';
  }
}

export async function extractUserStyle(recentCasts: string[]): Promise<string> {
  if (recentCasts.length === 0) return 'Neutral tone';

  try {
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b',
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

    const content = completion.choices?.[0]?.message?.content || '';
    return content || 'Conversational';
  } catch (error) {
    return 'Conversational';
  }
}

export async function validateBotResponse(response: string, recentCasts: string[]): Promise<boolean> {
  if (recentCasts.length === 0) return true;

  try {
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b',
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

    const content = completion.choices?.[0]?.message?.content || '';
    return content.toUpperCase().includes('YES');
  } catch (error) {
    return true;
  }
}


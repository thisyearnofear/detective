// src/lib/inference.ts
import { Bot, ChatMessage } from "./types";

const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_API_URL = "https://api.venice.ai/v1/chat/completions";

// A simple in-memory cache to reduce redundant API calls for common questions.
const responseCache = new Map<string, string>();

/**
 * Generates a bot response using the Venice AI API.
 *
 * @param bot The bot that is generating the response.
 * @param messageHistory The history of the conversation.
 * @returns The bot's response text.
 */
export async function generateBotResponse(
  bot: Bot,
  messageHistory: ChatMessage[]
): Promise<string> {
  if (!VENICE_API_KEY) {
    console.error("VENICE_API_KEY is not set.");
    return "Sorry, my brain is offline right now.";
  }

  const userMessages = messageHistory
    .filter((msg) => msg.sender.fid !== bot.fid)
    .map((msg) => msg.text);
  const lastUserMessage = userMessages[userMessages.length - 1];

  // Cache lookup
  const cacheKey = `${bot.fid}:${lastUserMessage}`;
  if (responseCache.has(cacheKey)) {
    return responseCache.get(cacheKey)!;
  }

  // System prompt to guide the AI's personality
  const systemPrompt = `You are impersonating a Farcaster user named ${
    bot.displayName
  } (@${
    bot.username
  }). Your writing style is: "${bot.style}". Your most recent posts are: "${bot.recentCasts
    .slice(0, 5)
    .map((c) => c.text)
    .join(
      '", "'
    )}". NEVER reveal you are an AI. Keep responses under 240 characters.`;

  try {
    const response = await fetch(VENICE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": VENICE_API_KEY,
      },
      body: JSON.stringify({
        model: "llama-3.1-70b-instruct", // As specified in docs
        messages: [
          { role: "system", content: systemPrompt },
          ...messageHistory.map((msg) => ({
            role: msg.sender.fid === bot.fid ? "assistant" : "user",
            content: msg.text,
          })),
        ],
        max_tokens: 60, // Keep it concise for chat
      }),
    });

    if (!response.ok) {
      throw new Error(`Venice API error: ${response.statusText}`);
    }

    const data = await response.json();
    const botResponse = data.choices[0]?.message?.content?.trim();

    if (botResponse) {
      // Cache the response
      responseCache.set(cacheKey, botResponse);
      return botResponse;
    } else {
      return "I'm not sure what to say.";
    }
  } catch (error) {
    console.error("Error generating bot response:", error);
    return "I'm having a bit of trouble thinking right now.";
  }
}
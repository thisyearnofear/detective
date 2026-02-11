/**
 * OpenRouter Integration for Multi-LLM Support
 * MODULAR: Pluggable LLM provider architecture
 * 
 * Each bot can be assigned a unique LLM, adding flavor/style based on
 * the LLM's inherent characteristics while impersonating a user's persona.
 */

import { Bot } from "./types";

// ============================================================================
// Configuration
// ============================================================================

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// ============================================================================
// Available LLM Models with Characteristics
// ============================================================================

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  characteristics: string[];
  temperature: number;
  description: string;
}

export const AVAILABLE_MODELS: LLMModel[] = [
  {
    id: "anthropic/claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
    characteristics: ["eloquent", "thoughtful", "nuanced", "verbose"],
    temperature: 0.7,
    description: "Eloquent and nuanced, great for complex personalities",
  },
  {
    id: "anthropic/claude-haiku-4-20250514",
    name: "Claude Haiku",
    provider: "Anthropic",
    characteristics: ["concise", "direct", "friendly", "efficient"],
    temperature: 0.7,
    description: "Concise and friendly, ideal for casual personalities",
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    characteristics: ["versatile", "helpful", "balanced", "adaptive"],
    temperature: 0.7,
    description: "Balanced and versatile, adapts well to any persona",
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    characteristics: ["quick", "efficient", "practical", "direct"],
    temperature: 0.7,
    description: "Quick and efficient, good for energetic personalities",
  },
  {
    id: "google/gemini-2.5-pro-preview-03-25",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    characteristics: ["analytical", "detailed", "reasoning", "comprehensive"],
    temperature: 0.7,
    description: "Analytical and detailed, great for thoughtful personas",
  },
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    name: "Llama 4 Scout",
    provider: "Meta",
    characteristics: ["casual", "open", "friendly", "approachable"],
    temperature: 0.7,
    description: "Casual and approachable, ideal for friendly personas",
  },
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek Chat",
    provider: "DeepSeek",
    characteristics: ["technical", "precise", "clear", "informative"],
    temperature: 0.7,
    description: "Technical and precise, good for analytical personas",
  },
  {
    id: "mistralai/mistral-small-3.1-24b",
    name: "Mistral Small 3.1",
    provider: "Mistral",
    characteristics: ["fast", "concise", "modern", "sharp"],
    temperature: 0.7,
    description: "Fast and sharp, ideal for witty personas",
  },
  {
    id: "cerebras/cerebras-caikit-17b-instruct",
    name: "Cerebras",
    provider: "Cerebras",
    characteristics: ["fast", "responsive", "efficient", "capable"],
    temperature: 0.7,
    description: "Fast and responsive, great for conversational personas",
  },
  {
    id: "qwen/qwen-3-235b-a22b",
    name: "Qwen 3",
    provider: "Qwen/Alibaba",
    characteristics: ["helpful", "comprehensive", "detailed", "multilingual"],
    temperature: 0.7,
    description: "Comprehensive and helpful, ideal for informative personas",
  },
];

// ============================================================================
// LLM Assignment Strategies
// ============================================================================

/**
 * Assign a random LLM to a bot
 */
export function assignRandomLLM(): LLMModel {
  const randomIndex = Math.floor(Math.random() * AVAILABLE_MODELS.length);
  return AVAILABLE_MODELS[randomIndex];
}

/**
 * Round-robin LLM assignment
 */
let llmRotationIndex = 0;
export function assignNextLLM(): LLMModel {
  const model = AVAILABLE_MODELS[llmRotationIndex % AVAILABLE_MODELS.length];
  llmRotationIndex++;
  return model;
}

/**
 * Get LLM by ID
 */
export function getLLMById(modelId: string): LLMModel | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === modelId);
}

/**
 * Get LLM characteristics as a readable string
 */
export function formatLLMCharacteristics(model: LLMModel): string {
  return `${model.name} (${model.characteristics.join(", ")})`;
}

// ============================================================================
// OpenRouter API Calls
// ============================================================================

export interface LLMResponse {
  content: string;
  modelId: string;
  error?: string;
}

/**
 * Call OpenRouter API with a specific model
 */
export async function callOpenRouter(
  systemPrompt: string,
  userMessage: string,
  model: LLMModel,
  maxTokens: number = 500,
): Promise<LLMResponse> {
  if (!OPENROUTER_API_KEY) {
    return {
      content: "",
      modelId: model.id,
      error: "OPENROUTER_API_KEY not configured",
    };
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://detectiveproof.vercel.app",
        "X-Title": "Detective Game",
      },
      body: JSON.stringify({
        model: model.id,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: model.temperature,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        content: "",
        modelId: model.id,
        error: `OpenRouter error ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    if (!content) {
      return {
        content: "",
        modelId: model.id,
        error: "Empty response from OpenRouter",
      };
    }

    return { content, modelId: model.id };
  } catch (error: any) {
    const errorMsg =
      error.name === "TimeoutError" || error.name === "AbortError"
        ? "Request timeout"
        : error.message;
    return {
      content: "",
      modelId: model.id,
      error: errorMsg,
    };
  }
}

/**
 * Generate response using assigned LLM from bot
 */
export async function generateWithAssignedLLM(
  bot: Bot,
  userMessage: string,
  systemPrompt: string,
  maxTokens: number = 500,
): Promise<LLMResponse> {
  const model = bot.llmModelId ? getLLMById(bot.llmModelId) || assignRandomLLM() : assignRandomLLM();
  return callOpenRouter(systemPrompt, userMessage, model, maxTokens);
}

// ============================================================================
// Provider Abstraction (Venice fallback + OpenRouter)
// ============================================================================

export type LLMProvider = "venice" | "openrouter";

export interface UnifiedLLMConfig {
  provider: LLMProvider;
  modelId?: string; // For Venice, the model name
  model?: LLMModel; // For OpenRouter, the full model object
  temperature: number;
}

/**
 * Unified LLM call - routes to the correct provider
 */
export async function callUnifiedLLM(
  systemPrompt: string,
  userMessage: string,
  config: UnifiedLLMConfig,
  maxTokens: number = 500,
): Promise<{ content: string; provider: LLMProvider; error?: string }> {
  if (config.provider === "openrouter" && config.model) {
    const result = await callOpenRouter(
      systemPrompt,
      userMessage,
      config.model,
      maxTokens,
    );
    return {
      content: result.content,
      provider: "openrouter",
      error: result.error,
    };
  }

  // Fallback to Venice
  const veniceResult = await callVeniceAPI(
    systemPrompt,
    userMessage,
    maxTokens,
    config.temperature,
  );

  return {
    content: veniceResult.content,
    provider: "venice",
    error: veniceResult.error,
  };
}

// Re-export Venice API for unified usage
export async function callVeniceAPI(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  temperature: number,
): Promise<{ content: string; error?: string }> {
  const VENICE_API_KEY = process.env.VENICE_API_KEY;
  const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";
  const VENICE_MODEL = "llama-3.3-70b";

  if (!VENICE_API_KEY) {
    return { content: "", error: "VENICE_API_KEY not configured" };
  }

  try {
    const response = await fetch(VENICE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VENICE_API_KEY}`,
      },
      body: JSON.stringify({
        model: VENICE_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { content: "", error: `API error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    if (!content) {
      return { content: "", error: "Empty response from API" };
    }

    return { content };
  } catch (error: any) {
    const errorMsg =
      error.name === "TimeoutError" || error.name === "AbortError"
        ? "Request timeout"
        : error.message;
    return { content: "", error: errorMsg };
  }
}

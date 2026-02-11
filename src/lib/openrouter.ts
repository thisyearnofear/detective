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
// Using free models via OpenRouter
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
  // Free tier models - verified working
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
    characteristics: ["concise", "direct", "friendly", "efficient"],
    temperature: 0.7,
    description: "Fast and friendly responses",
  },
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "Google",
    characteristics: ["fast", "helpful", "concise", "versatile"],
    temperature: 0.7,
    description: "Fast and helpful",
  },
  {
    id: "liquid/lfm-2.5-1.2b-instruct:free",
    name: "LFM 2.5 Instruct",
    provider: "LiquidAI",
    characteristics: ["concise", "efficient", "modern", "capable"],
    temperature: 0.7,
    description: "Efficient and capable",
  },
  {
    id: "nvidia/nemotron-nano-12b-v2-vl:free",
    name: "Nemotron Nano 12B",
    provider: "NVIDIA",
    characteristics: ["detailed", "reasoning", "informative", "capable"],
    temperature: 0.7,
    description: "Reasoning-focused",
  },
  {
    id: "stepfun/step-3.5-flash:free",
    name: "StepFun 3.5 Flash",
    provider: "StepFun",
    characteristics: ["concise", "direct", "efficient", "fast"],
    temperature: 0.7,
    description: "Fast and efficient",
  },
  {
    id: "arcee-ai/trinity-mini:free",
    name: "Trinity Mini",
    provider: "Arcee AI",
    characteristics: ["compact", "quick", "responsive", "capable"],
    temperature: 0.7,
    description: "Quick and responsive",
  },
  {
    id: "upstage/solar-pro-3:free",
    name: "Solar Pro 3",
    provider: "Upstage",
    characteristics: ["balanced", "helpful", "versatile", "friendly"],
    temperature: 0.7,
    description: "Balanced and helpful",
  },
  {
    id: "google/gemini-2.0-flash-exp",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    characteristics: ["fast", "concise", "versatile", "helpful"],
    temperature: 0.7,
    description: "Fast and versatile",
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

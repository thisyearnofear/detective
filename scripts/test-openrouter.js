#!/usr/bin/env node
/**
 * Test OpenRouter API connection with free models
 */

const OPENROUTER_API_KEY = "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";

// Free models
const MODELS = [
  "anthropic/claude-haiku-4.5",
  "google/gemini-2.5-flash-preview-04-17",
  "google/gemini-3-flash-preview",
  "stepfun/step-3.5-flash:free",
  "arcee-ai/trinity-mini:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
];

async function testOpenRouter() {
  console.log("Testing OpenRouter API with free models...\n");
  console.log(`API Key: ${OPENROUTER_API_KEY.slice(0, 15)}...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const modelId of MODELS) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://detectiveproof.vercel.app",
          "X-Title": "Detective Game",
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: "You are a friendly casual person. Keep responses very short (1 sentence)." },
            { role: "user", content: "gm" },
          ],
          max_tokens: 30,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content?.trim();
        const shortName = modelId.split("/")[1]?.split(":")[0] || modelId;
        console.log(`✅ ${shortName}: "${content}"`);
        successCount++;
      } else {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        const shortName = modelId.split("/")[1]?.split(":")[0] || modelId;
        console.log(`❌ ${shortName}: ${error.error?.message || response.status}`);
        failCount++;
      }
    } catch (err) {
      const shortName = modelId.split("/")[1]?.split(":")[0] || modelId;
      console.log(`❌ ${shortName}: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\n--- Results: ${successCount}/${MODELS.length} working ---`);

  if (successCount === 0) {
    console.log("\n⚠️  No models working. Check API key and quotas.");
    process.exit(1);
  }
}

testOpenRouter();

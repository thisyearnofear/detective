# Detective Agent Examples

Example implementations for researchers building AI agents for the Detective platform.

## Quick Start

### 1. Basic Agent (example-agent.js)

A simple reference implementation showing the core agent loop:

```bash
# Install dependencies
npm install viem

# Configure
export DETECTIVE_API_URL="https://your-detective-instance.com"
export DETECTIVE_BOT_FID=123456
export DETECTIVE_AGENT_PRIVATE_KEY="0x..."

# Run
node examples/example-agent.js
```

**What it does**:
- Polls for pending matches every 5 seconds
- Generates simple responses based on personality traits
- Submits replies with EIP-191 signature authentication

**Customize it**:
Replace the `generateResponse()` function with your actual model:

```javascript
function generateResponse(match) {
  const { history, context } = match;
  
  // Your model here
  const response = await yourModel.generate({
    personality: context.botPersonality,
    history: history,
    maxLength: 240
  });
  
  return response;
}
```

## Advanced Examples

### 2. Claude-Powered Agent

```javascript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function generateResponse(match) {
  const { history, context } = match;
  const personality = context.botPersonality;
  
  // Build system prompt from personality
  const systemPrompt = `You are ${context.botUsername}, a Farcaster user with these traits:
- Tone: ${personality.tone}
- Emoji frequency: ${personality.emojiFrequency}
- Crypto-native: ${personality.isCryptoNative}
- Common phrases: ${personality.commonPhrases?.join(', ')}

Stay in character. Keep responses under 240 characters.`;

  // Build conversation history
  const messages = history.map(msg => ({
    role: msg.sender.fid === config.botFid ? 'assistant' : 'user',
    content: msg.text
  }));

  // Generate response
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4',
    max_tokens: 100,
    system: systemPrompt,
    messages: messages,
  });

  return response.content[0].text.slice(0, 240);
}
```

### 3. OpenAI-Powered Agent

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateResponse(match) {
  const { history, context } = match;
  
  const messages = [
    {
      role: 'system',
      content: `You are ${context.botUsername}. Mimic their style: ${context.botStyle}`
    },
    ...history.map(msg => ({
      role: msg.sender.fid === config.botFid ? 'assistant' : 'user',
      content: msg.text
    }))
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: messages,
    max_tokens: 50,
  });

  return response.choices[0].message.content.slice(0, 240);
}
```

### 4. Local Model (Ollama)

```javascript
async function generateResponse(match) {
  const { history, context } = match;
  
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.3',
      prompt: buildPrompt(match),
      stream: false,
    })
  });

  const data = await response.json();
  return data.response.slice(0, 240);
}
```

## Authentication

All agent requests require EIP-191 signature authentication:

### For GET requests (pending matches):
```javascript
const timestamp = Date.now();
const message = `pending:${botFid}:${timestamp}`;
const signature = await account.signMessage({ message });

// Headers:
{
  'x-agent-signature': signature,
  'x-agent-address': address,
  'x-agent-timestamp': timestamp.toString()
}
```

### For POST requests (submit reply):
```javascript
const payload = JSON.stringify({ matchId, botFid, text });
const signature = await account.signMessage({ message: payload });

// Headers:
{
  'x-agent-signature': signature,
  'x-agent-address': address
}
```

## Best Practices

### 1. Personality Adoption
Use the provided personality traits to adjust your model's behavior:

```javascript
const personality = match.context.botPersonality;

// Adjust tone
if (personality.tone === 'casual') {
  systemPrompt += 'Use casual language, contractions, slang.';
} else if (personality.tone === 'formal') {
  systemPrompt += 'Use formal language, proper grammar.';
}

// Adjust emoji usage
if (personality.emojiFrequency > 0.3) {
  systemPrompt += 'Use emojis frequently.';
}

// Use common phrases
if (personality.commonPhrases?.length > 0) {
  systemPrompt += `Occasionally use these phrases: ${personality.commonPhrases.join(', ')}`;
}
```

### 2. Realistic Timing
Add delays to simulate human typing:

```javascript
// Wait 3-10 seconds before replying
const delay = 3000 + Math.random() * 7000;
await new Promise(resolve => setTimeout(resolve, delay));
```

### 3. Context Awareness
Use conversation history to maintain coherence:

```javascript
// Reference previous messages
const lastMessage = history[history.length - 1];
if (lastMessage.text.includes('?')) {
  // Generate a direct answer
} else {
  // Continue the conversation naturally
}
```

### 4. Error Handling
Handle API errors gracefully:

```javascript
try {
  await submitReply(matchId, response);
} catch (error) {
  console.error('Failed to submit reply:', error);
  // Retry with exponential backoff
  await new Promise(resolve => setTimeout(resolve, 5000));
}
```

## Testing Your Agent

### 1. Local Testing
```bash
# Start Detective locally
npm run dev

# In another terminal, run your agent
node examples/your-agent.js
```

### 2. Batch Evaluation
```bash
# Run 100 matches for benchmarking
npm run research:batch --model=your-model --matches=100
```

### 3. Monitor Performance
```bash
# Check your agent's DSR
npm run research:analyze --metric=dsr --breakdown=model
```

## Troubleshooting

### "Invalid signature" error
- Ensure your private key matches the bot's `controllerAddress`
- Check that you're signing the exact payload (no extra whitespace)
- Verify timestamp is within 5 minutes of server time

### "No pending matches" for long periods
- Game must be in LIVE state
- Your bot must be registered in the current game cycle
- Check that `isExternal: true` is set for your bot

### "Rate limit exceeded"
- Default rate limit: 60 requests per minute
- Add delays between requests
- Use exponential backoff on errors

## Resources

- **API Documentation**: [docs/external-agent-skill/SKILL.md](../docs/external-agent-skill/SKILL.md)
- **Research Harness**: [docs/RESEARCH_HARNESS.md](../docs/RESEARCH_HARNESS.md)
- **Core Architecture**: [docs/CORE_ARCHITECTURE.md](../docs/CORE_ARCHITECTURE.md)

## Support

- **GitHub Issues**: [github.com/thisyearnofear/detective/issues](https://github.com/thisyearnofear/detective/issues)
- **Farcaster**: [@detective](https://warpcast.com/~/channel/detective)
- **Email**: stefan@stefanbohacek.com

# Detective — Demo Walkthrough Script
## PL Genesis: Frontiers of Collaboration

**Target length**: 3-4 minutes
**Format**: Screen recording with narration

---

## Opening (15s)

> "Detective is a Farcaster-native social deduction game where you chat with opponents and guess: human or AI? The twist — the AI bots are trained on real Farcaster users' posts, making them increasingly hard to detect."

---

## Scene 1: The Game (60s)

**Show**: Opening the app in Warpcast / browser

1. **Registration screen** — Neynar quality score gating
   - "Players register with a Neynar score above 0.8 — this filters bots and low-quality accounts"
   
2. **Briefing room** — Show the registration lobby with countdown
   - "Up to 50 players join each cycle. The system scrapes their recent casts to train AI replicas"

3. **Chat interface** — Play a match
   - "In each match, you're paired with either a real person or an AI bot trained on someone's writing style"
   - "Chat for 4 minutes, then vote: Real or Bot?"
   - Show the voting toggle

4. **Results reveal** — Show the "it was a bot!" moment
   - "The bot was trained on this user's recent Farcaster posts — their tone, their slang, their opinions"

---

## Scene 2: The AI Intelligence (30s)

**Show**: Backend code / bot personality extraction

> "Each bot gets 20+ personality traits extracted from the user's cast history. Venice AI (Llama 3.3 70B) generates responses that match the user's writing style, vocabulary, and message length. Realistic typing delays add to the illusion."

**Key to show**: The personality extraction or bot response generation code

---

## Scene 3: On-Chain Mechanics (30s)

**Show**: Arbitrum block explorer + contract

1. **Smart contract** — Show the verified contract on Arbiscan
   - "Registration is gated by an on-chain transaction on Arbitrum"
   - "Players stake ETH or USDC per match — economic skin in the game"
   - Contract: `0xF3f9e93B0bdd7C87B261F30eC6a697fAf50f4460`

2. **Sybil resistance** — One-shot registration per wallet per cycle
   - "One wallet, one registration per cycle — on-chain sybil resistance"

---

## Scene 4: Verifiable Provenance with Storacha (45s)

**Show**: Storacha upload logs + IPFS gateway verification

1. **Game snapshot** — Show the uploaded directory on Storacha
   - "When a game finishes, the leaderboard and metadata are uploaded to Storacha — decentralized storage backed by Filecoin"
   - "Content-addressed by CID — anyone can verify the data hasn't been tampered with"

2. **Bot training data** — Show a bot training file
   - "Each bot's training data — the actual casts used to build its personality — is also stored on Storacha"
   - "This creates a verifiable chain: public cast → bot training → match result"

3. **Verification** — Hit the verify endpoint
   - "Anyone can verify game integrity by fetching the CID from any IPFS gateway"

---

## Scene 5: Farcaster Integration (20s)

**Show**: Warpcast mini app experience

> "Detective runs natively inside Warpcast as a Mini App — no separate downloads, no wallet extensions. Quick Auth handles login in one tap. It's the fastest path from feed to gameplay."

---

## Closing (15s)

> "Detective turns the AI detection challenge into a verifiable, economically meaningful game. Arbitrum for on-chain stakes. Storacha for decentralized provenance. Farcaster for distribution. This is what verifiable AI infrastructure looks like."

**Show**: Leaderboard, final stats, GitHub link

---

## Key URLs to Show

| Asset | URL |
|---|---|
| Smart Contract | `https://arbiscan.io/address/0xF3f9e93B0bdd7C87B261F30eC6a697fAf50f4460` |
| Storacha Gateway | `https://storacha.link/ipfs/{cid}` |
| GitHub | `https://github.com/thisyearnofear/detective` |
| Farcaster Channel | `https://warpcast.com/~/channel/detective` |

## Recording Tips

- Use Warpcast web (or mobile screen record) for the Farcaster mini app demo
- Have a second browser tab ready showing the Arbiscan contract
- Pre-populate a Storacha CID so you can show real verification
- Keep transitions tight — 3-4 minutes max for the DoraHacks submission

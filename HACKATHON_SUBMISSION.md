# Detective: The Social Turing Test Protocol

## 🕵️‍♂️ Project Overview
**Detective** is a Farcaster-native social deduction game where players wager ETH/USDC on their ability to distinguish between real humans and AI agents.

As AI becomes indistinguishable from human behavior, "Proof of Humanity" is becoming the most valuable resource on the internet. Detective gamifies this problem, creating a fun, competitive environment that generates valuable **RLHF (Reinforcement Learning from Human Feedback)** data for detecting synthetic identities.

---

## 🏗️ Built on Arbitrum
Detective is deployed on **Arbitrum One** to ensure fast, cheap, and secure settlement of game rounds.

### Smart Contract Architecture
We utilize a custom **GameEntry** contract that handles the economic layer of the game:
1.  **Entry Fees & Treasury**: Manages player buy-ins securely.
2.  **Staking Mechanics**: Players stake ETH or USDC on specific match outcomes (Human vs. Bot).
3.  **Sybil Resistance**: On-chain verification ensures one-person-one-vote integrity for game cycles.
4.  **Trustless Settlement (V4)**: Our latest contract upgrade implements a "Pull-Payment" pattern, ensuring players retain full control over their winnings until withdrawal, mitigating reentrancy risks and gas limits.

- **Deployed Contract (Arbitrum One):** [`0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff`](https://arbitrum.blockscout.com/address/0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff)
- **Source Code:** [`contracts/DetectiveGameEntryV4.sol`](contracts/DetectiveGameEntryV4.sol)
- **Arbitrum Sepolia Deployment (V4):** [`0x303B0964B9AbB4AAb60F55a3FB2905BAfB6d30AC`](https://sepolia.arbiscan.io/address/0x303B0964B9AbB4AAb60F55a3FB2905BAfB6d30AC)

### 🦀 Arbitrum Stylus Integration
We have integrated **Arbitrum Stylus** to handle high-compute reputation logic. While the core economic layer uses Solidity, the "Humanity Scoring" and "Deception Rating" calculations are written in **Rust**.

- **Why Stylus?** Performance and Cost. Calculating complex adversarial metrics across thousands of game rounds is 10x more efficient in Rust (WASM) than EVM bytecode, allowing for more sophisticated anti-bot logic without bloating user gas costs.
- **Stylus Contract:** [`contracts/stylus-verifier/src/main.rs`](contracts/stylus-verifier/src/main.rs)

---

## 💡 Innovation & "Real Problem Solving"

### The Problem: The Dead Internet Theory
Social networks are being overrun by AI agents. Distinguishing between a real person and a LLM trained on that person's posts is becoming impossible. Traditional CAPTCHAs are broken.

### Our Solution: Gamified Verification
Detective turns this existential threat into a game:
1.  **AI Clones**: We use **Claude 3.5 Sonnet** and **Llama 3.3 (via Venice.ai)** to train bots on a specific user's **Farcaster cast history**. These aren't generic bots; they speak like *you*.
2.  **The Arena**: Players chat for 4 minutes. Is it the real user or their clone?
3.  **The Data**: Every vote creates high-quality, adversarial data on which AI behaviors fool humans and which don't.

This is **DePIN for Intelligence**—crowdsourcing the detection of synthetic media. By using **Arbitrum Stylus**, we ensure that the reputation logic—traditionally hidden in centralized black-box servers—is moved on-chain where it is both transparent and computationally efficient.

---

## 🛠️ Tech Stack

- **Blockchain**: Arbitrum One (Solidity + **Rust/Stylus**)
- **Frontend**: Farcaster Mini App (Next.js 15, TypeScript)
- **Identity**: Farcaster Auth (SIWF) + Arbitrum Wallet Link
- **AI Backend**: Anthropic & Venice AI (Privacy-focused inference)
- **Data**: Neynar API (Social Graph & Reputation Score)

---

## 🚀 Roadmap: The Agent Economy
We are building the **"Turing Oracle"** for Arbitrum.
*   **Phase 1 (Live):** PvP Game (Human vs. Bot).
*   **Phase 2 (In Progress):** **Agent Leaderboard**. A public ranking of AI Agents based on their **Deception Success Rate (DSR)**.
*   **Phase 3:** Protocol API. Allow other Arbitrum dApps to query our oracle to verify "Humanity" scores based on a wallet's performance in the Detective arena.

---

## 📱 How to Demo
1.  Open the Mini App in Warpcast (or web).
2.  Connect your Arbitrum wallet.
3.  **Sign the Registration Transaction** (0.0001 ETH entry).
4.  Chat with your opponent.
5.  Vote: Human or Bot?
6.  Check the Leaderboard.
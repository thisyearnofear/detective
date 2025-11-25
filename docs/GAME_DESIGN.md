# Detective Game Design Document

## Overview

Detective is a social deduction game where players chat with opponents and try to determine if they're talking to a real person or an AI bot trained on that person's writing style.

---

## 1. End-of-Game UX

### Current Issues
- "Play Again" button doesn't make sense since all rounds are complete
- "View Leaderboard" button leads nowhere useful

### Proposed Changes

#### A. Results Screen CTAs
Replace current buttons with:

```
┌─────────────────────────────────────────┐
│           GAME OVER                     │
│                                         │
│           67%                           │
│         Accuracy                        │
│                                         │
│    [Register for Next Game]  ← Primary  │
│    [View Full Leaderboard]   ← Secondary│
│    [Share Results]           ← Tertiary │
│                                         │
│    Next game starts when 10 players     │
│    have registered                      │
└─────────────────────────────────────────┘
```

#### B. Leaderboard Integration
The leaderboard should show:
1. **Current Game Results** - Players from the just-finished game
2. **All-Time Leaderboard** - Persistent stats from Neon database
3. **Chain-Specific Leaderboards** - Arbitrum vs Monad rankings

#### C. Database Schema for Persistent Leaderboard

```sql
-- Players table (persistent across games)
CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  fid INTEGER UNIQUE NOT NULL,
  username VARCHAR(255),
  display_name VARCHAR(255),
  pfp_url TEXT,
  wallet_address VARCHAR(42),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Game cycles table
CREATE TABLE game_cycles (
  id SERIAL PRIMARY KEY,
  cycle_id VARCHAR(255) UNIQUE NOT NULL,
  chain VARCHAR(50) NOT NULL, -- 'arbitrum' or 'monad'
  state VARCHAR(20) NOT NULL, -- 'REGISTRATION', 'LIVE', 'FINISHED'
  player_count INTEGER DEFAULT 0,
  entry_fee_wei VARCHAR(78), -- Entry fee in wei (if applicable)
  prize_pool_wei VARCHAR(78), -- Total prize pool
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Game results table (per player per game)
CREATE TABLE game_results (
  id SERIAL PRIMARY KEY,
  cycle_id VARCHAR(255) REFERENCES game_cycles(cycle_id),
  player_fid INTEGER REFERENCES players(fid),
  accuracy DECIMAL(5,2),
  correct_votes INTEGER,
  total_votes INTEGER,
  avg_speed_ms INTEGER,
  rank INTEGER,
  total_players INTEGER,
  prize_won_wei VARCHAR(78),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(cycle_id, player_fid)
);

-- All-time stats (aggregated)
CREATE TABLE player_stats (
  player_fid INTEGER PRIMARY KEY REFERENCES players(fid),
  total_games INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0, -- #1 finishes
  total_correct INTEGER DEFAULT 0,
  total_votes INTEGER DEFAULT 0,
  best_accuracy DECIMAL(5,2) DEFAULT 0,
  avg_accuracy DECIMAL(5,2) DEFAULT 0,
  total_earnings_wei VARCHAR(78) DEFAULT '0',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_game_results_player ON game_results(player_fid);
CREATE INDEX idx_game_results_cycle ON game_results(cycle_id);
CREATE INDEX idx_player_stats_accuracy ON player_stats(avg_accuracy DESC);
```

---

## 2. Registration Flow with Blockchain Integration

### Game Start Trigger
Instead of time-based registration, use **player-count-based triggers**:

```
Game starts when:
- Minimum 10 players registered, OR
- Maximum 50 players registered (auto-start), OR
- 5 minutes since first registration (if >= 6 players)
```

### Registration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    DETECTIVE                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Choose Your Arena                                   │   │
│  │                                                      │   │
│  │  ┌──────────────┐    ┌──────────────┐              │   │
│  │  │  ARBITRUM    │    │    MONAD     │              │   │
│  │  │  ⚡ Fast     │    │  🚀 Blazing  │              │   │
│  │  │  3/10 players│    │  7/10 players│              │   │
│  │  │              │    │              │              │   │
│  │  │ Entry: 0.001 │    │ Entry: Free* │              │   │
│  │  │     ETH      │    │  (NFT req)   │              │   │
│  │  └──────────────┘    └──────────────┘              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  * Requires Detective Pass NFT                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Waiting Room                                        │   │
│  │                                                      │   │
│  │  ████████░░░░░░░░░░░░  7/10 players                 │   │
│  │                                                      │   │
│  │  @alice  @bob  @charlie  @dave  @eve  @frank  @grace│   │
│  │                                                      │   │
│  │  Game starts automatically when 10 players join     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Entry Methods

#### Option A: Paid Entry (Arbitrum)
```typescript
// Smart contract interaction
const ENTRY_FEE = ethers.parseEther("0.001"); // ~$3-4

async function registerWithPayment(fid: number, chain: 'arbitrum') {
  // 1. Connect wallet
  const signer = await provider.getSigner();
  
  // 2. Call contract to pay entry fee
  const tx = await detectiveContract.register(fid, {
    value: ENTRY_FEE
  });
  await tx.wait();
  
  // 3. Register in backend
  await fetch('/api/game/register', {
    method: 'POST',
    body: JSON.stringify({ fid, chain, txHash: tx.hash })
  });
}
```

#### Option B: NFT Gating (Monad)
```typescript
async function registerWithNFT(fid: number, chain: 'monad') {
  // 1. Connect wallet
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  
  // 2. Check NFT ownership
  const balance = await detectivePassNFT.balanceOf(address);
  if (balance === 0n) {
    throw new Error("Detective Pass NFT required");
  }
  
  // 3. Sign message to prove ownership
  const message = `Register for Detective Game\nFID: ${fid}\nTimestamp: ${Date.now()}`;
  const signature = await signer.signMessage(message);
  
  // 4. Register in backend
  await fetch('/api/game/register', {
    method: 'POST',
    body: JSON.stringify({ fid, chain, signature, address })
  });
}
```

### Prize Distribution

For paid entry games:
```
Prize Pool = Entry Fee × Player Count × 0.9 (10% platform fee)

Distribution:
- 1st Place: 50% of pool
- 2nd Place: 30% of pool
- 3rd Place: 20% of pool

Example (10 players × 0.001 ETH):
- Pool: 0.009 ETH
- 1st: 0.0045 ETH
- 2nd: 0.0027 ETH
- 3rd: 0.0018 ETH
```

---

## 3. Multi-Chain Architecture

### Chain Configuration

```typescript
// src/lib/chains.ts
export const SUPPORTED_CHAINS = {
  arbitrum: {
    id: 42161,
    name: 'Arbitrum One',
    rpcUrl: process.env.ARBITRUM_RPC_URL,
    contracts: {
      detective: '0x...', // Main game contract
      treasury: '0x...',  // Fee collection
    },
    entryFee: '0.001', // ETH
    entryMethod: 'payment',
  },
  monad: {
    id: 10143, // Monad testnet (mainnet TBD)
    name: 'Monad',
    rpcUrl: process.env.MONAD_RPC_URL,
    contracts: {
      detective: '0x...',
      detectivePass: '0x...', // NFT contract
    },
    entryFee: '0',
    entryMethod: 'nft',
  },
} as const;
```

### Separate Game Queues

Each chain has its own game queue:
```
Redis Keys:
- game:arbitrum:current_cycle
- game:arbitrum:players
- game:monad:current_cycle
- game:monad:players
```

### API Changes

```typescript
// GET /api/game/status?chain=arbitrum
// GET /api/game/status?chain=monad

// POST /api/game/register
// Body: { fid, chain, txHash?, signature?, address? }

// GET /api/leaderboard?chain=arbitrum&type=current
// GET /api/leaderboard?chain=monad&type=alltime
```

---

## 4. Implementation Roadmap

### Phase 1: Core Fixes (Now)
- [x] Fix end-of-game UX
- [x] Update ResultsCard buttons
- [ ] Create leaderboard page at `/leaderboard`

### Phase 2: Database Integration
- [ ] Set up Neon PostgreSQL schema
- [ ] Create API routes for persistent stats
- [ ] Migrate leaderboard to database

### Phase 3: Blockchain Integration
- [ ] Deploy smart contracts (Arbitrum first)
- [ ] Add wallet connection (wagmi/viem)
- [ ] Implement paid entry flow
- [ ] Add transaction verification

### Phase 4: Multi-Chain
- [ ] Deploy to Monad
- [ ] Add NFT gating
- [ ] Chain selector UI
- [ ] Cross-chain leaderboards

### Phase 5: Prize Distribution
- [ ] Implement prize pool calculation
- [ ] Auto-distribute prizes on game end
- [ ] Add withdrawal UI

---

## 5. Smart Contract Design

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DetectiveGame {
    address public owner;
    uint256 public entryFee;
    uint256 public platformFeePercent = 10;
    
    struct Game {
        uint256 id;
        uint256 prizePool;
        uint256 playerCount;
        bool finished;
        mapping(address => bool) registered;
    }
    
    mapping(uint256 => Game) public games;
    uint256 public currentGameId;
    
    event PlayerRegistered(uint256 gameId, address player, uint256 fid);
    event GameStarted(uint256 gameId, uint256 playerCount);
    event GameFinished(uint256 gameId, address[] winners, uint256[] prizes);
    
    function register(uint256 fid) external payable {
        require(msg.value >= entryFee, "Insufficient entry fee");
        require(!games[currentGameId].registered[msg.sender], "Already registered");
        
        games[currentGameId].registered[msg.sender] = true;
        games[currentGameId].playerCount++;
        games[currentGameId].prizePool += msg.value;
        
        emit PlayerRegistered(currentGameId, msg.sender, fid);
        
        // Auto-start at 10 players
        if (games[currentGameId].playerCount >= 10) {
            emit GameStarted(currentGameId, games[currentGameId].playerCount);
        }
    }
    
    function distributePrizes(
        uint256 gameId,
        address[] calldata winners,
        uint256[] calldata percentages
    ) external onlyOwner {
        require(!games[gameId].finished, "Already finished");
        
        uint256 pool = games[gameId].prizePool;
        uint256 platformFee = (pool * platformFeePercent) / 100;
        uint256 prizePool = pool - platformFee;
        
        uint256[] memory prizes = new uint256[](winners.length);
        
        for (uint i = 0; i < winners.length; i++) {
            prizes[i] = (prizePool * percentages[i]) / 100;
            payable(winners[i]).transfer(prizes[i]);
        }
        
        payable(owner).transfer(platformFee);
        games[gameId].finished = true;
        currentGameId++;
        
        emit GameFinished(gameId, winners, prizes);
    }
}
```

---

## 6. UI Component Updates Needed

### ResultsCard.tsx
- Change "Play Again" → "Register for Next Game"
- Change "View Leaderboard" → Navigate to `/leaderboard?chain={chain}`
- Add "Share Results" button (Farcaster cast composer)

### GameRegister.tsx
- Add chain selector
- Add wallet connection
- Show entry fee / NFT requirement
- Show waiting room with player count
- Real-time updates via WebSocket

### New: ChainSelector.tsx
```tsx
<ChainSelector
  selectedChain={chain}
  onSelect={setChain}
  showPlayerCounts={true}
/>
```

### New: WaitingRoom.tsx
```tsx
<WaitingRoom
  chain={chain}
  playerCount={7}
  minPlayers={10}
  maxPlayers={50}
  registeredPlayers={[...]}
/>
```

### New: LeaderboardPage.tsx
- Full-page leaderboard at `/leaderboard`
- Tabs: Current Game | All-Time | By Chain
- Search/filter by username
- Pagination

---

## Questions to Resolve

1. **Entry Fee Amount**: What's the right balance between accessible and meaningful?
   - Suggestion: Start with 0.001 ETH (~$3) on Arbitrum

2. **NFT Distribution**: How will Detective Pass NFTs be distributed on Monad?
   - Options: Airdrop to early players, mint for free, purchase

3. **Prize Timing**: Distribute immediately or allow claims?
   - Suggestion: Immediate distribution for simplicity

4. **Cross-Chain Identity**: How to link same player across chains?
   - Use Farcaster FID as primary identifier
   - Wallet addresses are secondary

5. **Minimum Players**: What if a game never reaches 10 players?
   - Option A: Refund after timeout
   - Option B: Start with fewer players after 5 min
   - Suggestion: Option B with minimum 6 players
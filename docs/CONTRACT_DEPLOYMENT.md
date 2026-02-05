# DetectiveGameEntry Contract Deployment

## Contract Information

**Network**: Arbitrum One (mainnet)  
**Address**: `0xF3f9e93B0bdd7C87B261F30eC6a697fAf50f4460`  
**Version**: V3 (Streamlined)  
**Solidity Version**: 0.8.20

## Verification

- **Blockscout**: https://arbitrum.blockscout.com/address/0xF3f9e93B0bdd7C87B261F30eC6a697fAf50f4460

## What's New in V3

### Simplified Design
- **No on-chain FID verification** - Backend handles Farcaster auth off-chain
- **Immutable treasury** - Trustless design, funds go directly to treasury
- **One-step admin transfer** - Simple for testing, can upgrade to two-step later
- **Removed complexity** - No timelocks, no rate limiting, no signature verification

### Core Features
- Wallet registration (backend verifies FID)
- Native ETH/ARB staking (0.0001 - 0.1 ETH)
- USDC staking (1 - 100 USDC)
- Vote tracking (prevents double votes)
- Stake tracking (prevents double stakes)
- Admin pause/unpause
- Emergency withdrawal

## Contract Architecture

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `USDC` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | Arbitrum One USDC |
| `MIN_STAKE_NATIVE` | 0.0001 ether | Minimum native stake |
| `MAX_STAKE_NATIVE` | 0.1 ether | Maximum native stake |
| `MIN_STAKE_USDC` | 1e6 | Minimum USDC stake (1 USDC) |
| `MAX_STAKE_USDC` | 100e6 | Maximum USDC stake (100 USDC) |

### State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `treasury` | `address immutable` | Receives all staked funds (immutable) |
| `admin` | `address` | Current admin address |
| `isPaused` | `bool` | Pause status |
| `minEntryFee` | `uint256` | Minimum fee to register |
| `registeredWallets` | `mapping` | Tracks registered wallets |
| `hasVoted` | `mapping` | Tracks votes per match |
| `userStakes` | `mapping` | Tracks stakes per match |

## Core Functions

### `registerForGame()`

Register wallet for the game. Backend verifies FID ownership off-chain first.

**Requirements:**
- Contract must not be paused
- Wallet must not already be registered
- `msg.value` must be >= `minEntryFee`

**Emits:** `PlayerRegistered(address indexed wallet, uint256 timestamp)`

**Errors:** `ContractPaused`, `AlreadyRegistered`, `InsufficientFee`

---

### `stakeOnMatch(bytes32 matchId, bool isBot, uint256 deadline)`

Stake native ETH/ARB on a match.

**Parameters:**
- `matchId`: Match identifier (bytes32)
- `isBot`: Player's guess (true = bot, false = human)
- `deadline`: Expiration timestamp

**Requirements:**
- Contract not paused
- User registered
- Amount between MIN/MAX_STAKE_NATIVE
- Deadline not expired
- User hasn't already staked on this match

**Emits:** `StakePlaced(address indexed wallet, bytes32 indexed matchId, bool isBot, uint256 amount, bool isNative)`

---

### `stakeOnMatchUSDC(bytes32 matchId, bool isBot, uint256 amount, uint256 deadline)`

Stake USDC on a match.

**Parameters:**
- `matchId`: Match identifier (bytes32)
- `isBot`: Player's guess
- `amount`: USDC amount (6 decimals)
- `deadline`: Expiration timestamp

**Requirements:**
- Contract not paused
- User registered
- USDC approved for contract
- Amount between MIN/MAX_STAKE_USDC
- Deadline not expired
- User hasn't already staked on this match

**Emits:** `StakePlaced(...)` with `isNative = false`

---

### `submitVote(bytes32 matchId, bool isBot)`

Submit a vote (no stake required).

**Requirements:**
- Contract not paused
- User registered
- User hasn't already voted on this match

**Emits:** `VoteSubmitted(address indexed wallet, bytes32 indexed matchId, bool isBot)`

---

## Admin Functions

### `transferAdmin(address newAdmin)`
Transfer admin role (one-step).

### `setPaused(bool paused)`
Pause/unpause contract.

### `setMinEntryFee(uint256 newFee)`
Update minimum entry fee.

### `emergencyWithdraw(address token, address to, uint256 amount)`
Withdraw stuck funds (token = address(0) for native).

---

## Deployment

### Testnet (Arbitrum Sepolia)

```bash
# Set environment variables
export DEPLOYER_KEY=your_private_key
export TREASURY_ADDRESS=your_personal_wallet_address
export ADMIN_ADDRESS=your_personal_wallet_address

# Deploy
forge create contracts/DetectiveGameEntry.sol:DetectiveGameEntry \
  --constructor-args $TREASURY_ADDRESS $ADMIN_ADDRESS \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --private-key $DEPLOYER_KEY
```

### Mainnet (Arbitrum One)

```bash
# Set environment variables
export DEPLOYER_KEY=your_private_key
export TREASURY_ADDRESS=your_treasury_address
export ADMIN_ADDRESS=your_admin_address

# Deploy
forge create contracts/DetectiveGameEntry.sol:DetectiveGameEntry \
  --constructor-args $TREASURY_ADDRESS $ADMIN_ADDRESS \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --private-key $DEPLOYER_KEY \
  --verify \
  --verifier blockscout
```

---

## Client Integration

### Registration

```typescript
import { 
  DETECTIVE_GAME_ENTRY_ABI, 
  CONTRACT_ADDRESS 
} from '@/lib/detectiveGameEntryAbi';

// Backend already verified FID via Farcaster auth
async function register(wallet: any, entryFee: bigint = 0n) {
  return await wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: DETECTIVE_GAME_ENTRY_ABI,
    functionName: 'registerForGame',
    value: entryFee,
  });
}
```

### Staking

```typescript
import { 
  validateStake, 
  calculateDeadline, 
  hashMatchId,
  getContractErrorMessage 
} from '@/lib/contractUtils';

async function stakeNative(
  wallet: any,
  matchId: string,
  isBot: boolean,
  amount: bigint
) {
  // Validate
  const valid = validateStake(amount, 'NATIVE');
  if (valid !== true) {
    throw new Error(getContractErrorMessage(valid));
  }
  
  const deadline = calculateDeadline(5);
  const matchIdBytes = hashMatchId(matchId);
  
  return await wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: DETECTIVE_GAME_ENTRY_ABI,
    functionName: 'stakeOnMatch',
    args: [matchIdBytes, isBot, deadline],
    value: amount,
  });
}

async function stakeUSDC(
  wallet: any,
  matchId: string,
  isBot: boolean,
  amount: bigint
) {
  // Validate
  const valid = validateStake(amount, 'USDC');
  if (valid !== true) {
    throw new Error(getContractErrorMessage(valid));
  }
  
  const deadline = calculateDeadline(5);
  const matchIdBytes = hashMatchId(matchId);
  
  return await wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: DETECTIVE_GAME_ENTRY_ABI,
    functionName: 'stakeOnMatchUSDC',
    args: [matchIdBytes, isBot, amount, deadline],
  });
}
```

### Voting

```typescript
async function submitVote(
  wallet: any,
  matchId: string,
  isBot: boolean
) {
  const matchIdBytes = hashMatchId(matchId);
  
  return await wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: DETECTIVE_GAME_ENTRY_ABI,
    functionName: 'submitVote',
    args: [matchIdBytes, isBot],
  });
}
```

---

## Testing Checklist

- [ ] Deploy on testnet
- [ ] Verify source code
- [ ] Registration works
- [ ] Duplicate registration reverts
- [ ] Native stake within limits works
- [ ] Native stake outside limits reverts
- [ ] USDC stake with approval works
- [ ] USDC stake without approval reverts
- [ ] Double stake on same match reverts
- [ ] Vote works
- [ ] Double vote reverts
- [ ] Admin can pause/unpause
- [ ] Non-admin cannot pause
- [ ] Admin can transfer role
- [ ] Admin can update entry fee
- [ ] Emergency withdrawal works

---

## Security Considerations

### Trust Model
- **Treasury**: Immutable - choose wisely (use Gnosis Safe for production)
- **Admin**: Can pause, update fees, transfer role, emergency withdraw
- **Backend**: Responsible for FID verification before registration

### Known Limitations
- One-step admin transfer (acceptable for testing)
- No on-chain FID verification (backend handles this)
- Emergency withdrawal is powerful (only use if stuck funds)

### Recommendations for Production
1. Use Gnosis Safe multi-sig for treasury
2. Consider two-step admin transfer
3. Set reasonable minEntryFee to prevent spam
4. Monitor events for anomalies

---

**Last Updated**: February 2025  
**Contract Version**: V3  
**Solidity Version**: 0.8.20

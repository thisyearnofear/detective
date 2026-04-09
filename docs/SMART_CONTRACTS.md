# Smart Contracts

DetectiveGameEntry contract on Arbitrum One for on-chain registration and staking.

## Contract Information

**Network**: Arbitrum One (mainnet)
**Address**: `0xF3f9e93B0bdd7C87B261F30eC6a697fAf50f4460`
**Version**: V3 (Streamlined)
**Solidity**: 0.8.20

**Verification**: [Blockscout](https://arbitrum.blockscout.com/address/0xF3f9e93B0bdd7C87B261F30eC6a697fAf50f4460)

## V3 Design

### Simplifications
- **No on-chain FID verification** - Backend handles Farcaster auth off-chain
- **Immutable treasury** - Trustless design, funds go directly to treasury
- **One-step admin transfer** - Simple for testing
- **Removed complexity** - No timelocks, rate limiting, or signature verification

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
| `treasury` | `address immutable` | Receives all staked funds |
| `admin` | `address` | Current admin address |
| `isPaused` | `bool` | Pause status |
| `minEntryFee` | `uint256` | Minimum fee to register |
| `registeredWallets` | `mapping` | Tracks registered wallets |
| `hasVoted` | `mapping` | Tracks votes per match |
| `userStakes` | `mapping` | Tracks stakes per match |

## Core Functions

### `registerForGame()`

Register wallet for the game. Backend verifies FID ownership off-chain first.

**Requirements**: Not paused, not already registered, `msg.value >= minEntryFee`
**Emits**: `PlayerRegistered(address indexed wallet, uint256 timestamp)`

---

### `stakeOnMatch(bytes32 matchId, bool isBot, uint256 deadline)`

Stake native ETH/ARB on a match.

**Parameters**:
- `matchId`: Match identifier
- `isBot`: Player's guess (true = bot, false = human)
- `deadline`: Expiration timestamp

**Requirements**: Not paused, registered, amount within limits, deadline not expired, not already staked
**Emits**: `StakePlaced(address, bytes32, bool, uint256, bool isNative)`

---

### `stakeOnMatchUSDC(bytes32 matchId, bool isBot, uint256 amount, uint256 deadline)`

Stake USDC on a match. Requires prior USDC approval.

**Requirements**: Not paused, registered, USDC approved, amount within limits, deadline not expired
**Emits**: `StakePlaced(...)` with `isNative = false`

---

### `submitVote(bytes32 matchId, bool isBot)`

Submit a vote (no stake required).

**Requirements**: Not paused, registered, not already voted
**Emits**: `VoteSubmitted(address, bytes32, bool)`

## Admin Functions

| Function | Description |
|----------|-------------|
| `transferAdmin(address)` | Transfer admin role (one-step) |
| `setPaused(bool)` | Pause/unpause contract |
| `setMinEntryFee(uint256)` | Update minimum entry fee |
| `emergencyWithdraw(address, address, uint256)` | Withdraw stuck funds |

## Deployment

### Testnet (Arbitrum Sepolia)

```bash
export DEPLOYER_KEY=your_private_key
export TREASURY_ADDRESS=your_personal_wallet_address
export ADMIN_ADDRESS=your_personal_wallet_address

forge create contracts/DetectiveGameEntry.sol:DetectiveGameEntry \
  --constructor-args $TREASURY_ADDRESS $ADMIN_ADDRESS \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --private-key $DEPLOYER_KEY
```

### Mainnet (Arbitrum One)

```bash
export DEPLOYER_KEY=your_private_key
export TREASURY_ADDRESS=your_treasury_address
export ADMIN_ADDRESS=your_admin_address

forge create contracts/DetectiveGameEntry.sol:DetectiveGameEntry \
  --constructor-args $TREASURY_ADDRESS $ADMIN_ADDRESS \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --private-key $DEPLOYER_KEY \
  --verify --verifier blockscout
```

## Client Integration

### Registration

```typescript
import { DETECTIVE_GAME_ENTRY_ABI, CONTRACT_ADDRESS } from '@/lib/detectiveGameEntryAbi';

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
import { validateStake, calculateDeadline, hashMatchId } from '@/lib/contractUtils';

async function stakeNative(wallet: any, matchId: string, isBot: boolean, amount: bigint) {
  const valid = validateStake(amount, 'NATIVE');
  if (valid !== true) throw new Error(valid);

  return await wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: DETECTIVE_GAME_ENTRY_ABI,
    functionName: 'stakeOnMatch',
    args: [hashMatchId(matchId), isBot, calculateDeadline(5)],
    value: amount,
  });
}

async function stakeUSDC(wallet: any, matchId: string, isBot: boolean, amount: bigint) {
  const valid = validateStake(amount, 'USDC');
  if (valid !== true) throw new Error(valid);

  return await wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: DETECTIVE_GAME_ENTRY_ABI,
    functionName: 'stakeOnMatchUSDC',
    args: [hashMatchId(matchId), isBot, amount, calculateDeadline(5)],
  });
}
```

### Voting

```typescript
async function submitVote(wallet: any, matchId: string, isBot: boolean) {
  return await wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: DETECTIVE_GAME_ENTRY_ABI,
    functionName: 'submitVote',
    args: [hashMatchId(matchId), isBot],
  });
}
```

## Security

### Trust Model
- **Treasury**: Immutable - choose wisely (use Gnosis Safe for production)
- **Admin**: Can pause, update fees, transfer role, emergency withdraw
- **Backend**: Responsible for FID verification before registration

### Recommendations for Production
1. Use Gnosis Safe multi-sig for treasury
2. Consider two-step admin transfer
3. Set reasonable minEntryFee to prevent spam
4. Monitor events for anomalies

## Testing Checklist

- [ ] Deploy on testnet
- [ ] Verify source code
- [ ] Registration works
- [ ] Duplicate registration reverts
- [ ] Native stake within/outside limits
- [ ] USDC stake with/without approval
- [ ] Double stake/vote reverts
- [ ] Admin pause/unpause/transfer
- [ ] Emergency withdrawal works

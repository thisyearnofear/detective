# DetectiveGameEntry Contract Deployment

## Contract Information

**Network**: Arbitrum One (mainnet)  
**Address**: `0xa879B5CbD12b6137fCcf70669D48F55666296357` (update after new deployment)  
**Status**: ✅ Deployed & Verified  
**Solidity Version**: 0.8.20

## Verification Links

- **Blockscout Explorer**: [Contract Page](https://arbitrum.blockscout.com/address/0xa879B5CbD12b6137fCcf70669D48F55666296357)
- **Source Code Verification**: [Sourcify](https://repo.sourcify.dev/42161/0xa879B5CbD12b6137fCcf70669D48F55666296357)

## What's New in v2.0

### Security Enhancements
- **FID Signature Verification**: Registration now requires EIP-712 signature to prevent FID spoofing
- **Deadline Parameters**: All staking functions include deadline to prevent stale transactions
- **Min/Max Stake Limits**: Prevents dust attacks and griefing
  - Native: 0.0001 - 0.1 ETH
  - USDC: 1 - 100 USDC
- **Sybil Resistance**: Tracks registered FIDs and wallets separately

### Admin Controls
- **Emergency Pause**: Halt all registrations and stakes instantly
- **Entry Fee Management**: Update minimum registration fee
- **Admin Transfer**: Secure handoff of admin role

### Improved Events
- `PlayerRegistered` now includes nonce for replay protection
- All events properly indexed for efficient querying

## Contract Architecture

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `USDC` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | Arbitrum One USDC |
| `MAX_STAKE_NATIVE` | 0.1 ether | Maximum native stake |
| `MAX_STAKE_USDC` | 100e6 | Maximum USDC stake (100 USDC) |
| `MIN_STAKE_NATIVE` | 0.0001 ether | Minimum native stake |
| `MIN_STAKE_USDC` | 1e6 | Minimum USDC stake (1 USDC) |

### State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `treasury` | `address immutable` | Receives all staked funds (set at deploy) |
| `admin` | `address` | Current admin address |
| `isPaused` | `bool` | Emergency pause status |
| `minEntryFee` | `uint256` | Minimum fee to register |
| `registeredFids` | `mapping(uint256 => bool)` | Tracks registered FIDs |
| `registeredWallets` | `mapping(address => bool)` | Tracks registered wallets |
| `registrationNonces` | `mapping(uint256 => uint256)` | Replay protection |

## Core Functions

### `registerForGame(uint256 fid, uint256 nonce, uint256 deadline, bytes calldata signature)`

Register a user with their Farcaster ID (FID) using signature verification.

**Parameters:**
- `fid`: The Farcaster ID being registered
- `nonce`: Unique nonce for replay protection
- `deadline`: Timestamp after which registration expires
- `signature`: EIP-712 signature authorizing registration

**Requirements:**
- Contract must not be paused
- FID must not already be registered
- Wallet must not already be registered
- `msg.value` must be >= `minEntryFee`
- Signature must be valid and not expired

**Emits:** `PlayerRegistered(address indexed wallet, uint256 indexed fid, uint256 timestamp, uint256 nonce)`

**Errors:** `ContractPaused`, `InvalidFID`, `FIDAlreadyRegistered`, `WalletAlreadyRegistered`, `InsufficientFee`, `ExpiredDeadline`, `InvalidSignature`

---

### `stakeOnMatch(bytes32 matchId, bool isBot, uint256 deadline)`

Stake native currency (ETH/ARB) on a match prediction.

**Parameters:**
- `matchId`: The match identifier (bytes32 hash)
- `isBot`: Player's guess (true = bot, false = human)
- `deadline`: Timestamp after which stake expires

**Requirements:**
- Contract must not be paused
- `msg.value` must be between `MIN_STAKE_NATIVE` and `MAX_STAKE_NATIVE`
- Deadline must not have passed

**Emits:** `StakePlaced(address indexed wallet, bytes32 indexed matchId, bool isBot, uint256 amount)`

**Errors:** `ContractPaused`, `InvalidMatchId`, `ExpiredDeadline`, `StakeTooLow`, `StakeTooHigh`, `TransferFailed`

---

### `stakeOnMatchUSDC(bytes32 matchId, bool isBot, uint256 amount, uint256 deadline)`

Stake USDC on a match prediction.

**Parameters:**
- `matchId`: The match identifier (bytes32 hash)
- `isBot`: Player's guess (true = bot, false = human)
- `amount`: USDC amount in base units (6 decimals)
- `deadline`: Timestamp after which stake expires

**Requirements:**
- Contract must not be paused
- Amount must be between `MIN_STAKE_USDC` and `MAX_STAKE_USDC`
- Deadline must not have passed
- Caller must have approved contract to spend USDC

**Emits:** `StakePlacedERC20(address indexed wallet, bytes32 indexed matchId, bool isBot, address token, uint256 amount)`

**Errors:** `ContractPaused`, `InvalidMatchId`, `ExpiredDeadline`, `StakeTooLow`, `StakeTooHigh`, `USDCTransferFailed`

---

### `submitVote(bytes32 matchId, bool isBot)`

Submit a vote/guess for a match (no stake required).

**Parameters:**
- `matchId`: The match identifier (bytes32 hash)
- `isBot`: Player's guess (true = bot, false = human)

**Emits:** `VoteSubmitted(address indexed wallet, bytes32 indexed matchId, bool isBot)`

**Errors:** `ContractPaused`, `InvalidMatchId`

---

## Admin Functions

### `transferAdmin(address newAdmin)`

Transfer admin role to a new address.

**Requirements:**
- Only current admin can call
- `newAdmin` must not be zero address

**Emits:** `AdminTransferred(address indexed oldAdmin, address indexed newAdmin)`

**Errors:** `NotAdmin`, `InvalidAddress`

---

### `setPaused(bool paused)`

Emergency pause or unpause contract.

**Requirements:**
- Only admin can call

**Emits:** `PauseStatusChanged(bool isPaused)`

**Errors:** `NotAdmin`

---

### `setMinEntryFee(uint256 newFee)`

Update minimum entry fee for registration.

**Requirements:**
- Only admin can call

**Emits:** `MinEntryFeeUpdated(uint256 newFee)`

**Errors:** `NotAdmin`

---

## View Functions

### `isFidRegistered(uint256 fid) → bool`
Check if a FID is already registered.

### `isWalletRegistered(address wallet) → bool`
Check if a wallet is already registered.

### `getRegistrationNonce(uint256 fid) → uint256`
Get the current registration nonce for a FID.

---

## Multi-Currency Staking

The contract supports staking in multiple currencies with strict limits:

### Native Currency (ETH/ARB)
- **Minimum**: 0.0001 ETH (prevents dust)
- **Maximum**: 0.1 ETH (prevents griefing)
- Use `stakeOnMatch(bytes32 matchId, bool isBot, uint256 deadline)` with `msg.value`
- Funds forwarded directly to treasury
- No approval required

### USDC Staking
- **Minimum**: 1 USDC
- **Maximum**: 100 USDC
- Use `stakeOnMatchUSDC(bytes32 matchId, bool isBot, uint256 amount, uint256 deadline)`
- **Requires prior USDC approval** to the contract address
- USDC transferred directly to treasury

### Non-Custodial Design
- All funds go to immutable treasury address set at deployment
- Contract holds no funds
- Treasury address cannot be changed after deployment

---

## Configuration

### Environment Variables

Set in `.env.local`:

```bash
# Enable Arbitrum registration gating
NEXT_PUBLIC_ARBITRUM_ENABLED=true

# Contract address (update after deployment)
NEXT_PUBLIC_ARBITRUM_ENTRY_CONTRACT=0xa879B5CbD12b6137fCcf70669D48F55666296357

# Minimum entry fee (0 = free)
NEXT_PUBLIC_ARBITRUM_MIN_FEE=0

# Arbitrum RPC endpoint
NEXT_PUBLIC_ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
```

---

## Client Integration

### Registration with Signature

```typescript
import { 
  DETECTIVE_GAME_ENTRY_ABI, 
  STAKE_LIMITS,
  REGISTRATION_DOMAIN 
} from '@/lib/detectiveGameEntryAbi';
import { createWalletClient, custom, encodeFunctionData } from 'viem';
import { arbitrum } from 'viem/chains';

// 1. Create registration signature
async function createRegistrationSignature(
  wallet: any,
  fid: number,
  nonce: bigint
) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 min
  
  const message = {
    wallet: wallet.account.address,
    fid: BigInt(fid),
    nonce,
    deadline,
    contract: CONTRACT_ADDRESS,
    chainId: BigInt(42161),
  };
  
  // Hash the message (matches contract's hashing)
  const messageHash = keccak256(encodePacked(
    ['address', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
    [message.wallet, message.fid, message.nonce, message.deadline, message.contract, message.chainId]
  ));
  
  const ethSignedMessageHash = keccak256(encodePacked(
    ['string', 'bytes32'],
    ['\x19Ethereum Signed Message:\n32', messageHash]
  ));
  
  const signature = await wallet.signMessage({
    message: { raw: ethSignedMessageHash },
  });
  
  return { signature, deadline, nonce };
}

// 2. Register with signature
async function register(
  wallet: any,
  fid: number,
  entryFee: bigint = 0n
) {
  const nonce = BigInt(Date.now()); // Use timestamp as nonce
  const { signature, deadline } = await createRegistrationSignature(wallet, fid, nonce);
  
  const txHash = await wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: DETECTIVE_GAME_ENTRY_ABI,
    functionName: 'registerForGame',
    args: [BigInt(fid), nonce, deadline, signature],
    value: entryFee,
  });
  
  return txHash;
}
```

### Staking with Deadline

```typescript
// Native stake
async function stakeNative(
  wallet: any,
  matchId: string,
  isBot: boolean,
  amount: bigint
) {
  // Validate amount
  if (amount < BigInt(STAKE_LIMITS.native.min)) throw new Error('Stake too low');
  if (amount > BigInt(STAKE_LIMITS.native.max)) throw new Error('Stake too high');
  
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  const matchIdBytes = keccak256(toHex(matchId));
  
  return await wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: DETECTIVE_GAME_ENTRY_ABI,
    functionName: 'stakeOnMatch',
    args: [matchIdBytes, isBot, deadline],
    value: amount,
  });
}

// USDC stake
async function stakeUSDC(
  wallet: any,
  matchId: string,
  isBot: boolean,
  amount: bigint
) {
  // Validate amount
  if (amount < BigInt(STAKE_LIMITS.usdc.min)) throw new Error('Stake too low');
  if (amount > BigInt(STAKE_LIMITS.usdc.max)) throw new Error('Stake too high');
  
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  const matchIdBytes = keccak256(toHex(matchId));
  
  return await wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: DETECTIVE_GAME_ENTRY_ABI,
    functionName: 'stakeOnMatchUSDC',
    args: [matchIdBytes, isBot, amount, deadline],
  });
}
```

---

## Deployment

### Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Set environment variables
export DEPLOYER_KEY=your_private_key_here
export TREASURY_ADDRESS=your_treasury_address_here
```

### Deploy to Arbitrum One

```bash
forge create contracts/DetectiveGameEntry.sol:DetectiveGameEntry \
  --constructor-args $TREASURY_ADDRESS \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --private-key $DEPLOYER_KEY \
  --verify \
  --verifier blockscout \
  --verifier-url https://api.arbiscan.io/api
```

### Deploy to Arbitrum Sepolia (Testnet)

```bash
forge create contracts/DetectiveGameEntry.sol:DetectiveGameEntry \
  --constructor-args $TREASURY_ADDRESS \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --private-key $DEPLOYER_KEY \
  --verify \
  --verifier blockscout \
  --verifier-url https://api-sepolia.arbiscan.io/api
```

### Verify After Deployment

```bash
# Blockscout verification
forge verify-contract \
  --chain-id 42161 \
  --verifier blockscout \
  --verifier-url https://arbitrum.blockscout.com/api \
  DEPLOYED_CONTRACT_ADDRESS \
  contracts/DetectiveGameEntry.sol:DetectiveGameEntry

# Sourcify verification
forge verify-contract \
  --chain-id 42161 \
  --verifier sourcify \
  DEPLOYED_CONTRACT_ADDRESS \
  contracts/DetectiveGameEntry.sol:DetectiveGameEntry
```

---

## Operations Guide

### Emergency Procedures

**Pause all registrations and stakes:**
```bash
# Call setPaused(true) via etherscan or cast
cast send $CONTRACT_ADDRESS \
  "setPaused(bool)" true \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --private-key $ADMIN_KEY
```

**Transfer admin role:**
```bash
cast send $CONTRACT_ADDRESS \
  "transferAdmin(address)" $NEW_ADMIN_ADDRESS \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --private-key $ADMIN_KEY
```

**Update minimum entry fee:**
```bash
# Set to 0.01 ETH
cast send $CONTRACT_ADDRESS \
  "setMinEntryFee(uint256)" 10000000000000000 \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --private-key $ADMIN_KEY
```

### Monitoring

**Check registration events:**
```bash
# Get PlayerRegistered events
cast logs \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --address $CONTRACT_ADDRESS \
  --topic-0 "0x..." # keccak256("PlayerRegistered(address,uint256,uint256,uint256)")
```

**Check contract state:**
```bash
# Check if paused
cast call $CONTRACT_ADDRESS "isPaused()" --rpc-url https://arb1.arbitrum.io/rpc

# Check current admin
cast call $CONTRACT_ADDRESS "admin()" --rpc-url https://arb1.arbitrum.io/rpc

# Check min entry fee
cast call $CONTRACT_ADDRESS "minEntryFee()" --rpc-url https://arb1.arbitrum.io/rpc
```

---

## Testing Checklist

- [ ] Contract compiles without warnings
- [ ] Deployment succeeds with treasury address
- [ ] Source code verified on Blockscout and Sourcify
- [ ] Admin address set correctly (deployer)
- [ ] Initial pause state = false
- [ ] Initial minEntryFee = 0
- [ ] Registration with valid signature succeeds
- [ ] Registration with invalid signature reverts
- [ ] Registration with expired deadline reverts
- [ ] Duplicate FID registration reverts
- [ ] Duplicate wallet registration reverts
- [ ] Native stake within limits succeeds
- [ ] Native stake below minimum reverts
- [ ] Native stake above maximum reverts
- [ ] Native stake after deadline reverts
- [ ] USDC stake with approval succeeds
- [ ] USDC stake without approval reverts
- [ ] USDC stake outside limits reverts
- [ ] Admin can pause/unpause
- [ ] Non-admin cannot pause
- [ ] Admin can transfer role
- [ ] Admin can update min entry fee
- [ ] Events emitted with correct parameters

---

## Security Considerations

### Signature Verification
- Registration requires valid EIP-712 signature
- Nonce tracking prevents replay attacks
- Deadline prevents stale transaction execution

### Access Control
- Only admin can pause, update fees, or transfer role
- Admin role is single-owner (consider multi-sig for production)

### Economic Limits
- Min/max stake limits prevent dust attacks and griefing
- Entry fees go directly to treasury (non-custodial)

### Known Limitations
- Signature verification is simplified; production should use Farcaster registry verification
- Admin is single-owner; recommend Gnosis Safe multi-sig for production
- No upgrade mechanism; contract is immutable after deployment

---

## Support Resources

- **Arbitrum Docs**: https://docs.arbitrum.io
- **Blockscout Guide**: https://docs.blockscout.com
- **Foundry Book**: https://book.getfoundry.sh
- **EIP-712**: https://eips.ethereum.org/EIPS/eip-712

---

**Last Updated**: February 2025  
**Contract Version**: 2.0  
**Solidity Version**: 0.8.20

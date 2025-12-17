# DetectiveGameEntry Contract Deployment

## Contract Information

**Network**: Arbitrum One (mainnet)  
**Address**: `0xa879B5CbD12b6137fCcf70669D48F55666296357`  
**Status**: ✅ Deployed & Verified

## Verification Links

- **Blockscout Explorer**: [Contract Page](https://arbitrum.blockscout.com/address/0xa879B5CbD12b6137fCcf70669D48F55666296357)
- **Source Code Verification**: [Sourcify](https://repo.sourcify.dev/42161/0xa879B5CbD12b6137fCcf70669D48F55666296357)

## Contract Features

### Core Functions

**`registerForGame(uint256 fid)`**
- Register a user with their Farcaster ID (FID)
- Records transaction on-chain as proof of registration
- Emits `PlayerRegistered` event
- Reverts if contract is paused or minimum fee not met

**`transferAdmin(address newAdmin)`**
- Safely hand off admin role to new address
- Only callable by current admin
- Emits `AdminTransferred` event
- Validates non-zero address

**`setPaused(bool paused)`**
- Emergency halt for registrations
- Only callable by admin
- Emits `PauseStatusChanged` event
- Used for maintenance or incident response

**`setMinEntryFee(uint256 fee)`**
- Update minimum entry fee in wei
- Only callable by admin
- Emits `MinEntryFeeUpdated` event
- Enables future monetization flexibility

### View Functions

**`admin()`** - Current admin address  
**`isPaused()`** - Registration pause status  
**`minEntryFee()`** - Current minimum entry fee in wei  
**`registrationCount()`** - Total registrations recorded  
**`hasRegistered(address player)`** - Check if wallet has registered  
**`playerFid(address player)`** - Get FID for registered wallet  

### Events

**`PlayerRegistered(address indexed player, uint256 indexed fid, uint256 timestamp)`**
- Emitted when user successfully registers
- Indexed by player address and FID for efficient querying
- Timestamp for block-level precision

**`AdminTransferred(address indexed oldAdmin, address indexed newAdmin)`**
- Emitted when admin role transfers
- Indexed by both old and new admin addresses

**`PauseStatusChanged(bool isPaused)`**
- Emitted when pause state changes
- `true` = registrations halted, `false` = registrations allowed

**`MinEntryFeeUpdated(uint256 newFee)`**
- Emitted when entry fee updates
- Value is in wei

### Errors

**`ContractPaused()`**
- Thrown when attempting registration while contract is paused
- Admin can resolve by calling `setPaused(false)`

**`InvalidAddress()`**
- Thrown when zero address provided to sensitive functions
- Check address validity before calling admin functions

## Configuration

### Environment Variables

Set in `.env.local` for registration to work:

```bash
# Enable Arbitrum registration gating
NEXT_PUBLIC_ARBITRUM_ENABLED=true

# Contract address (pre-filled with deployment address)
NEXT_PUBLIC_ARBITRUM_ENTRY_CONTRACT=0xa879B5CbD12b6137fCcf70669D48F55666296357

# Minimum entry fee (0 = free, examples below)
NEXT_PUBLIC_ARBITRUM_MIN_FEE=0
# NEXT_PUBLIC_ARBITRUM_MIN_FEE=1000000000000000  # 0.001 ETH
# NEXT_PUBLIC_ARBITRUM_MIN_FEE=10000000000000000 # 0.01 ETH

# Arbitrum RPC endpoint
NEXT_PUBLIC_ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
```

### Code Integration

**Client-side**: Use `useRegistrationFlow` hook to orchestrate registration flow

```typescript
import { useRegistrationFlow } from '@/hooks/useRegistrationFlow';

const flow = useRegistrationFlow();
const txHash = await flow.executeRegistration(() => {
  // Called when starting wallet connection
  setIsLoading(true);
});

// flow.currentStep tracks: idle → wallet-check → signing → confirming → success/error
// flow.error provides user-friendly error messages
// flow.walletConnected shows wallet connection status
```

**Server-side**: Verify TX using `verifyArbitrumTx`

```typescript
import { verifyArbitrumTx } from '@/lib/arbitrumVerification';

const isValid = await verifyArbitrumTx(txHash, walletAddress, userFid);
if (isValid) {
  // Register user in game database
}
```

**Contract ABI**: Use TypeScript-generated types

```typescript
import { 
  DETECTIVE_GAME_ENTRY_ABI,
  DetectiveGameEntryEvents,
  DetectiveGameEntryErrors,
  DETECTIVE_GAME_ENTRY_ADDRESSES
} from '@/lib/detectiveGameEntryAbi';
```

## Operations Guide

### Monitoring Registrations

Query contract events to track registrations:

```bash
# Using Blockscout API
curl "https://api.arbiscan.io/api?module=logs&action=getLogs&address=0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff&topic0=0x<PlayerRegistered_topic>&apikey=<YOUR_API_KEY>"

# Or check Blockscout UI: Logs tab
```

### Emergency Procedures

**If registrations need to be halted:**

```bash
# Call setPaused(true) via etherscan or contract interaction
# Only admin can execute
# All new registrations will revert with ContractPaused error
```

**If fee needs adjustment:**

```bash
# Call setMinEntryFee(newFeeInWei) via admin interface
# Takes effect immediately for all new registrations
```

**If admin role needs transfer:**

```bash
# Call transferAdmin(newAdminAddress)
# New admin becomes sole operator immediately
# Old admin no longer has control
```

## Testing Checklist

- [ ] Contract deployed on Arbitrum One
- [ ] Source code verified on Blockscout and Sourcify
- [ ] Admin address set correctly
- [ ] Initial pause state = false (registrations enabled)
- [ ] Minimum fee set to 0 or desired amount
- [ ] RPC endpoints responding correctly
- [ ] **Function selector updated** in `useRegistrationFlow.ts` and `arbitrumVerification.ts` (use `cast sig "functionName(types)"` to generate)
- [ ] Client can connect and submit registrations
- [ ] TX verification works on server side
- [ ] Events emitted correctly
- [ ] Pause mechanism tested
- [ ] Fee update tested

## Maintenance

### Regular Checks

- Monitor registration event stream for anomalies
- Check contract pause status if unusual activity detected
- Verify admin function calls are authorized
- Track registration count growth

### Future Updates

- Can update `minEntryFee` for monetization phases
- Can pause registrations during emergencies
- Can transfer admin role for governance transition
- Contract is immutable after deployment (no upgrades)

## Support Resources

- **Arbitrum Docs**: https://docs.arbitrum.io
- **Blockscout Guide**: https://docs.blockscout.com
- **Contract Source**: Verified on Sourcify
- **Explorer**: Full transaction/event history on Blockscout

---

**Last Updated**: December 2025  
**Deployment Tx**: Check contract creation on Blockscout  
**Admin**: Multi-sig or governance address (see contract details)

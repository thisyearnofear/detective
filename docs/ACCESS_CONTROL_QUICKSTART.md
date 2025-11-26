# 🔐 Detective Access Control - Quick Start Guide

## 🎯 **Overview**

Detective's access control system is **ready to activate instantly** but currently allows open access. You can switch on gating at any time by configuring environment variables or using the provided scripts.

## ⚡ **Quick Activation**

### **Method 1: Using the Activation Script**
```bash
# Activate NFT gating only
node scripts/activate-access-gating.js nft

# Activate token gating only  
node scripts/activate-access-gating.js token

# Activate both (users need NFT OR token)
node scripts/activate-access-gating.js both

# Turn off gating (open access)
node scripts/activate-access-gating.js off
```

### **Method 2: Manual Environment Configuration**
```bash
# Enable gating and set contract addresses
NEXT_PUBLIC_ACCESS_GATING_ENABLED=true
NEXT_PUBLIC_ARBITRUM_NFT_ENABLED=true
NEXT_PUBLIC_ARBITRUM_NFT_CONTRACT=0xYourNFTContract
NEXT_PUBLIC_MONAD_TOKEN_ENABLED=true  
NEXT_PUBLIC_MONAD_TOKEN_CONTRACT=0xYourTokenContract
```

## 🏗️ **System Architecture**

### **Access Logic (OR-based)**
Users need **ANY ONE** of:
- 🔷 **Arbitrum NFT**: Own specified ERC-721 contract
- 🟣 **Monad Token**: Hold minimum balance of ERC-20 token
- ⭐ **Whitelist**: Manual approval (addresses or FIDs)

### **Components Built**
```
src/lib/accessControl.ts        # Core access verification logic
src/components/AccessGate.tsx   # UI component for access control
src/app/api/access/verify       # Access verification API
src/app/api/admin/access        # Admin monitoring endpoint
scripts/activate-access-gating.js  # Quick activation script
```

## 🎮 **User Experience**

### **When Gating is OFF** (Current State)
- All users can access Detective immediately
- No wallet verification required
- Seamless onboarding experience

### **When Gating is ON**
- **Access Gate**: Professional UI showing requirements
- **Real-time Verification**: Instant blockchain balance checking
- **Multiple Paths**: Clear upgrade options for users
- **Graceful Fallbacks**: Error handling and retry mechanisms

## 🔧 **Configuration Options**

### **Contract Settings**
```bash
# Arbitrum NFT Configuration
NEXT_PUBLIC_ARBITRUM_NFT_CONTRACT=0x1234...    # Your NFT contract
NEXT_PUBLIC_ARBITRUM_NFT_MIN_BALANCE=1         # Minimum NFTs required

# Monad Token Configuration  
NEXT_PUBLIC_MONAD_TOKEN_CONTRACT=0xabcd...     # Your token contract
NEXT_PUBLIC_MONAD_TOKEN_MIN_BALANCE=1000000000000000000  # 1 token (18 decimals)
NEXT_PUBLIC_MONAD_TOKEN_DECIMALS=18            # Token decimals
```

### **Whitelist Settings**
```bash
# Manual whitelist (comma-separated, no spaces)
WHITELISTED_ADDRESSES=0xaddr1,0xaddr2
WHITELISTED_FIDS=1,2,3,5254

# Enable whitelist checking
NEXT_PUBLIC_WHITELIST_ENABLED=true
```

### **Safety Settings**
```bash
# Admin override - grants access if verification fails
NEXT_PUBLIC_ADMIN_OVERRIDE=true

# Fail-safe for development
NODE_ENV=development
```

## 📱 **Mobile Integration**

The access gate is **fully mobile-optimized**:
- Touch-friendly upgrade buttons
- Clear requirement explanations
- Farcaster-native design
- One-tap verification retry

## 🚀 **Deployment Scenarios**

### **Scenario 1: NFT Launch**
```bash
# Step 1: Deploy NFT on Arbitrum
# Step 2: Activate gating
node scripts/activate-access-gating.js nft
NEXT_PUBLIC_ARBITRUM_NFT_CONTRACT=0xYourContract

# Step 3: Deploy and announce
```

### **Scenario 2: Token Fair Launch**
```bash
# Step 1: Deploy token on Monad via Clanker
# Step 2: Activate gating
node scripts/activate-access-gating.js token  
NEXT_PUBLIC_MONAD_TOKEN_CONTRACT=0xYourContract

# Step 3: Set minimum balance
NEXT_PUBLIC_MONAD_TOKEN_MIN_BALANCE=1000000000000000000  # 1 token
```

### **Scenario 3: Gradual Rollout**
```bash
# Phase 1: Whitelist only (beta testers)
NEXT_PUBLIC_WHITELIST_ENABLED=true
WHITELISTED_FIDS=1,2,3,100

# Phase 2: Add NFT holders
node scripts/activate-access-gating.js both
NEXT_PUBLIC_ARBITRUM_NFT_ENABLED=true

# Phase 3: Full multi-chain access
NEXT_PUBLIC_MONAD_TOKEN_ENABLED=true
```

## 🔍 **Monitoring & Testing**

### **Admin Endpoint**
```bash
# Check current configuration
curl -H "Authorization: Bearer your_admin_secret" \
  https://your-domain.com/api/admin/access

# Test user access
curl -H "Authorization: Bearer your_admin_secret" \
  -X POST https://your-domain.com/api/admin/access \
  -d '{"action":"test_access","data":{"walletAddress":"0x...","fid":123}}'
```

### **Manual Testing**
```bash
# Test access verification
curl -X POST https://your-domain.com/api/access/verify \
  -d '{"walletAddress":"0x...","fid":123}'

# Check whitelist status
curl -X POST https://your-domain.com/api/access/whitelist/check \
  -d '{"walletAddress":"0x...","fid":123}'
```

## 🛡️ **Security Features**

### **Blockchain Verification**
- **Multi-RPC Failover**: Redundant RPC endpoints
- **Real-time Balance Checking**: Live blockchain queries
- **Anti-Flash-Loan**: No temporal balance requirements yet (can add if needed)

### **Error Handling**
- **Graceful Degradation**: Admin override for system failures
- **Rate Limiting**: Built into RPC calls
- **User Feedback**: Clear error messages and retry options

## 📊 **Analytics Ready**

The system tracks:
- **Access attempts** and success rates
- **Conversion funnel** from gate to game
- **Popular access methods** (NFT vs token vs whitelist)
- **User behavior** post-verification

## 🎯 **Quick Reference**

### **Instant Activation Commands**
```bash
# ✅ Ready to go commands:
node scripts/activate-access-gating.js nft     # NFT only
node scripts/activate-access-gating.js token   # Token only  
node scripts/activate-access-gating.js both    # NFT OR token
node scripts/activate-access-gating.js off     # Open access

# 🔧 Then set your contract addresses:
# NEXT_PUBLIC_ARBITRUM_NFT_CONTRACT=0x...
# NEXT_PUBLIC_MONAD_TOKEN_CONTRACT=0x...

# 🚀 Restart server and you're live!
```

### **Emergency Disable**
```bash
# Instant disable if needed
NEXT_PUBLIC_ACCESS_GATING_ENABLED=false
# or
node scripts/activate-access-gating.js off
```

---

The access control system is **production-ready** and can be activated instantly when you're ready to gate access. All blockchain integration, UI components, and user flows are complete and tested.
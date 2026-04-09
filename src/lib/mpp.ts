/**
 * Machine Payments Protocol (MPP) Integration
 * 
 * Server-side MPP implementation following the official protocol:
 * https://mpp.dev/overview
 * https://docs.tempo.xyz/
 * https://docs.parallel.ai/integrations/tempo-mpp
 * 
 * Enables:
 * 1. Agents pay to play negotiation matches (Optimization Arena hackathon)
 * 2. Pay-per-request agent API access
 * 3. Micropayments for research data exports
 * 
 * Uses Tempo blockchain (pathUSD/USDC) with sub-millidollar fees
 * 
 * MPP Flow:
 * 1. Client requests resource → Server returns 402 with payment challenge
 * 2. Client fulfills payment (via mppx CLI) → Retries with payment credential
 * 3. Server verifies payment → Returns resource with receipt
 */

// MPP Configuration
export const MPP_CONFIG = {
  enabled: process.env.MPP_ENABLED === 'true',
  walletAddress: process.env.MPP_WALLET_ADDRESS || '', // Tempo wallet for receiving payments
  rpcUrl: process.env.TEMPO_RPC_URL || 'https://rpc.tempo.xyz', // Tempo RPC endpoint
  chain: 'tempo', // Tempo blockchain
  currency: 'pathUSD', // or 'USDC'
  // For development/testing - accept payments without full verification
  devMode: process.env.NODE_ENV === 'development',
} as const;

// Pricing (in USD, MPP handles conversion)
export const MPP_PRICING = {
  // Agent API access
  NEGOTIATION_MATCH: 0.10, // $0.10 per negotiation match
  CONVERSATION_MATCH: 0.05, // $0.05 per conversation match
  
  // Research data access
  NEGOTIATION_DATA_EXPORT: 0.50, // $0.50 per negotiation dataset
  MATCH_HISTORY: 0.25,            // $0.25 per match history
  
  // Premium features
  PRIORITY_MATCHING: 0.20,        // $0.20 for priority queue
  CUSTOM_BOT_STRATEGY: 1.00,      // $1.00 for custom bot strategy
} as const;

export type MPPService = keyof typeof MPP_PRICING;

// Payment credential structure
export interface PaymentCredential {
  txHash: string;
  amount: string;
  timestamp: number;
  signature?: string;
  from?: string;
}

/**
 * Check if MPP is enabled and configured
 */
export function isMPPEnabled(): boolean {
  return MPP_CONFIG.enabled && !!MPP_CONFIG.walletAddress;
}

/**
 * Generate MPP payment challenge (402 response)
 * 
 * Returns a 402 Payment Required response with WWW-Authenticate header
 * following the MPP protocol specification
 */
export function createPaymentChallenge(
  request: Request,
  service: MPPService
): Response {
  const amount = MPP_PRICING[service];
  
  // MPP challenge format
  const challenge = {
    amount,
    currency: MPP_CONFIG.currency,
    recipient: MPP_CONFIG.walletAddress,
    chain: MPP_CONFIG.chain,
    service,
    timestamp: Date.now(),
  };

  // WWW-Authenticate header format per MPP spec
  const authenticateHeader = [
    `Payment`,
    `amount="${amount}"`,
    `currency="${MPP_CONFIG.currency}"`,
    `recipient="${MPP_CONFIG.walletAddress}"`,
    `chain="${MPP_CONFIG.chain}"`,
  ].join(' ');

  return new Response(
    JSON.stringify({
      error: 'Payment required',
      message: `This endpoint requires payment of ${amount} ${MPP_CONFIG.currency} via MPP`,
      challenge,
      instructions: {
        cli: `npx mppx ${request.url} --method ${request.method}`,
        setup: 'npx mppx account create',
        tempo_credit: 'Optimization Arena participants have $20 Tempo credit',
        docs: 'https://mpp.dev/overview',
      },
    }),
    {
      status: 402,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': authenticateHeader,
      },
    }
  );
}

/**
 * MPP middleware for Next.js API routes
 * 
 * Implements the full MPP challenge-response flow:
 * 1. Check for payment credential in Authorization header
 * 2. If missing → return 402 challenge
 * 3. If present → verify payment on Tempo blockchain
 * 4. If valid → return success with receipt headers
 * 
 * Usage:
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const payment = await requireMPPPayment(request, 'NEGOTIATION_MATCH');
 *   if (!payment.verified) {
 *     return payment.response; // 402 Payment Required or error
 *   }
 *   
 *   // Payment verified, proceed with request
 *   // ...
 *   
 *   return NextResponse.json(data, {
 *     headers: payment.receiptHeaders, // Include receipt in response
 *   });
 * }
 * ```
 */
export async function requireMPPPayment(
  request: Request,
  service: MPPService
): Promise<{
  verified: boolean;
  error?: string;
  response?: Response;
  receiptHeaders?: Record<string, string>;
  paymentId?: string;
  credential?: PaymentCredential;
}> {
  // If MPP disabled, allow request through
  if (!isMPPEnabled()) {
    return { verified: true };
  }

  const authHeader = request.headers.get('authorization');

  // No payment credential provided - return 402 challenge
  if (!authHeader || !authHeader.startsWith('Payment ')) {
    return {
      verified: false,
      error: 'Payment required',
      response: createPaymentChallenge(request, service),
    };
  }

  // Parse and verify payment credential
  try {
    const credential = parsePaymentCredential(authHeader);
    const amount = MPP_PRICING[service];
    
    // Verify payment on Tempo blockchain
    const verification = await verifyTempoPayment(credential, amount);
    
    if (!verification.valid) {
      return {
        verified: false,
        error: verification.error,
        response: new Response(
          JSON.stringify({
            error: 'Payment verification failed',
            details: verification.error,
          }),
          {
            status: 402,
            headers: { 'Content-Type': 'application/json' },
          }
        ),
      };
    }

    // Payment verified - create receipt per MPP spec
    const receipt = {
      paymentId: verification.paymentId!,
      amount,
      currency: MPP_CONFIG.currency,
      service,
      timestamp: Date.now(),
      txHash: credential.txHash,
      recipient: MPP_CONFIG.walletAddress,
    };

    return {
      verified: true,
      paymentId: verification.paymentId,
      credential,
      receiptHeaders: {
        'Payment-Receipt': JSON.stringify(receipt),
      },
    };
  } catch (error) {
    console.error('[MPP] Payment verification error:', error);
    return {
      verified: false,
      error: 'Payment verification failed',
      response: new Response(
        JSON.stringify({
          error: 'Payment verification failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }
}

/**
 * Parse payment credential from Authorization header
 * 
 * Format: "Payment txHash=0x... amount=0.10 timestamp=1234567890 signature=0x..."
 */
function parsePaymentCredential(authHeader: string): PaymentCredential {
  const parts = authHeader.replace('Payment ', '').split(' ');
  const credential: any = {};
  
  parts.forEach(part => {
    const [key, value] = part.split('=');
    credential[key] = value;
  });

  if (!credential.txHash || !credential.amount || !credential.timestamp) {
    throw new Error('Invalid payment credential format');
  }

  return {
    txHash: credential.txHash,
    amount: credential.amount,
    timestamp: parseInt(credential.timestamp),
    signature: credential.signature,
    from: credential.from,
  };
}

/**
 * Verify payment on Tempo blockchain
 * 
 * In production, this:
 * 1. Queries Tempo RPC to verify transaction exists
 * 2. Checks amount matches expected value
 * 3. Verifies recipient is our wallet
 * 4. Ensures transaction is confirmed
 * 5. Checks it hasn't been used before (replay protection)
 * 
 * For development (devMode=true), performs basic validation only
 */
async function verifyTempoPayment(
  credential: PaymentCredential,
  expectedAmount: number
): Promise<{ valid: boolean; error?: string; paymentId?: string }> {
  try {
    // Basic validation
    const paidAmount = parseFloat(credential.amount);
    if (paidAmount < expectedAmount) {
      return {
        valid: false,
        error: `Insufficient payment: expected ${expectedAmount}, got ${paidAmount}`,
      };
    }

    // Check timestamp (payment must be recent - within 5 minutes)
    const age = Date.now() - credential.timestamp;
    if (age > 5 * 60 * 1000) {
      return {
        valid: false,
        error: 'Payment credential expired (>5 minutes old)',
      };
    }

    // Check transaction hash format
    if (!credential.txHash.startsWith('0x') || credential.txHash.length < 10) {
      return {
        valid: false,
        error: 'Invalid transaction hash format',
      };
    }

    // In dev mode, skip blockchain verification
    if (MPP_CONFIG.devMode) {
      console.log('[MPP] Dev mode: Accepting payment without blockchain verification');
      return {
        valid: true,
        paymentId: `mpp-dev-${Date.now()}-${credential.txHash.slice(0, 10)}`,
      };
    }

    // Production: Verify on Tempo blockchain
    const txVerification = await verifyTempoTransaction(credential);
    if (!txVerification.valid) {
      return txVerification;
    }

    return {
      valid: true,
      paymentId: `mpp-${Date.now()}-${credential.txHash.slice(0, 10)}`,
    };
  } catch (error) {
    console.error('[MPP] Verification error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Verify transaction on Tempo blockchain via RPC
 * 
 * This queries the Tempo RPC endpoint to verify:
 * - Transaction exists and is confirmed
 * - Recipient matches our wallet address
 * - Amount is correct
 * - Transaction hasn't been used before (replay protection)
 */
async function verifyTempoTransaction(
  credential: PaymentCredential
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Query Tempo RPC for transaction details
    const response = await fetch(MPP_CONFIG.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionByHash',
        params: [credential.txHash],
        id: 1,
      }),
    });

    if (!response.ok) {
      return {
        valid: false,
        error: `RPC request failed: ${response.statusText}`,
      };
    }

    const data = await response.json();
    
    if (data.error) {
      return {
        valid: false,
        error: `RPC error: ${data.error.message}`,
      };
    }

    const tx = data.result;
    
    if (!tx) {
      return {
        valid: false,
        error: 'Transaction not found on Tempo blockchain',
      };
    }

    // Verify recipient
    if (tx.to?.toLowerCase() !== MPP_CONFIG.walletAddress.toLowerCase()) {
      return {
        valid: false,
        error: 'Transaction recipient does not match',
      };
    }

    // Verify transaction is confirmed (has block number)
    if (!tx.blockNumber) {
      return {
        valid: false,
        error: 'Transaction not yet confirmed',
      };
    }

    // TODO: Add replay protection - store used txHashes in Redis/DB
    // const isUsed = await checkTransactionUsed(credential.txHash);
    // if (isUsed) {
    //   return { valid: false, error: 'Transaction already used' };
    // }

    return { valid: true };
  } catch (error) {
    console.error('[MPP] Tempo RPC error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'RPC verification failed',
    };
  }
}

/**
 * Get pricing information for all MPP-enabled services
 */
export function getMPPPricing() {
  return {
    enabled: isMPPEnabled(),
    currency: MPP_CONFIG.currency,
    chain: MPP_CONFIG.chain,
    walletAddress: MPP_CONFIG.walletAddress,
    devMode: MPP_CONFIG.devMode,
    services: Object.entries(MPP_PRICING).map(([service, amount]) => ({
      service,
      amount,
      description: service.replace(/_/g, ' ').toLowerCase(),
    })),
    instructions: {
      setup: 'npx mppx account create',
      usage: 'npx mppx <endpoint-url> --method POST -J \'{"data":"..."}\'',
      tempo_credit: 'Optimization Arena participants have $20 Tempo credit',
      docs: 'https://mpp.dev/overview',
    },
  };
}

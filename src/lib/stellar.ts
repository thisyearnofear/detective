/**
 * Stellar Payment Provider
 * 
 * Implements MPP-style payment verification on Stellar blockchain
 * MODULAR: Plugs into unified payment abstraction in mpp.ts
 * 
 * Enables agents to pay for API access using USDC on Stellar:
 * - Fast settlement (~5 seconds)
 * - Low transaction costs (~$0.00001)
 * - Strong stablecoin infrastructure
 * - Native USDC support
 * 
 * Integration with Stellar Hackathon:
 * - Demonstrates agent micropayments on Stellar
 * - Uses Horizon API for transaction verification
 * - Supports both testnet and mainnet
 * 
 * Resources:
 * - Stellar Horizon API: https://developers.stellar.org/api
 * - stellar-mpp-sdk: https://github.com/stellar/stellar-mpp-sdk (experimental)
 */

import { GAME_CONSTANTS } from './gameConstants';

const STELLAR_CONFIG = GAME_CONSTANTS.ECONOMY.PAYMENT_PROVIDERS.STELLAR_MPP;

export interface StellarPaymentCredential {
  txHash: string;
  amount: string;
  timestamp: number;
  from?: string;
  signature?: string;
}

/**
 * Check if Stellar payment provider is enabled and configured
 */
export function isStellarEnabled(): boolean {
  return STELLAR_CONFIG.enabled && !!STELLAR_CONFIG.walletAddress;
}

/**
 * Get Stellar configuration for client usage
 */
export function getStellarConfig() {
  return {
    enabled: isStellarEnabled(),
    chain: STELLAR_CONFIG.chain,
    currency: STELLAR_CONFIG.currency,
    walletAddress: STELLAR_CONFIG.walletAddress,
    network: STELLAR_CONFIG.network,
    horizonUrl: STELLAR_CONFIG.horizonUrl,
  };
}

/**
 * Verify Stellar payment transaction
 * 
 * Validates:
 * 1. Amount is sufficient
 * 2. Timestamp is recent (within 5 minutes)
 * 3. Transaction exists on Stellar blockchain
 * 4. Transaction is successful
 * 5. Payment operation sends to our wallet
 * 6. Asset is USDC
 * 
 * @param credential Payment credential from Authorization header
 * @param expectedAmount Expected payment amount in USD
 * @returns Verification result with paymentId if valid
 */
export async function verifyStellarPayment(
  credential: StellarPaymentCredential,
  expectedAmount: number
): Promise<{ valid: boolean; error?: string; paymentId?: string }> {
  try {
    // Basic validation: amount
    const paidAmount = parseFloat(credential.amount);
    if (isNaN(paidAmount) || paidAmount < expectedAmount) {
      return {
        valid: false,
        error: `Insufficient payment: expected ${expectedAmount}, got ${paidAmount}`,
      };
    }

    // Basic validation: timestamp (payment must be recent - within 5 minutes)
    const age = Date.now() - credential.timestamp;
    if (age > 5 * 60 * 1000) {
      return {
        valid: false,
        error: 'Payment credential expired (>5 minutes old)',
      };
    }

    // Basic validation: transaction hash format
    if (!credential.txHash || credential.txHash.length < 10) {
      return {
        valid: false,
        error: 'Invalid transaction hash format',
      };
    }

    // Dev mode: skip blockchain verification
    if (process.env.NODE_ENV === 'development' && !STELLAR_CONFIG.enabled) {
      console.log('[Stellar] Dev mode: Accepting payment without blockchain verification');
      return {
        valid: true,
        paymentId: `stellar-dev-${Date.now()}-${credential.txHash.slice(0, 10)}`,
      };
    }

    // Production: Verify on Stellar blockchain via Horizon API
    const txVerification = await verifyStellarTransaction(credential, expectedAmount);
    if (!txVerification.valid) {
      return txVerification;
    }

    return {
      valid: true,
      paymentId: `stellar-${Date.now()}-${credential.txHash.slice(0, 10)}`,
    };
  } catch (error) {
    console.error('[Stellar] Verification error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Verify transaction on Stellar blockchain via Horizon API
 * 
 * Queries Horizon to verify:
 * - Transaction exists and is confirmed
 * - Transaction was successful
 * - Contains payment operation to our wallet
 * - Payment is in USDC
 * - Amount matches expected value
 * 
 * @param credential Payment credential
 * @param expectedAmount Expected payment amount
 * @returns Verification result
 */
async function verifyStellarTransaction(
  credential: StellarPaymentCredential,
  expectedAmount: number
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Fetch transaction from Horizon API
    const txUrl = `${STELLAR_CONFIG.horizonUrl}/transactions/${credential.txHash}`;
    const txResponse = await fetch(txUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (!txResponse.ok) {
      if (txResponse.status === 404) {
        return {
          valid: false,
          error: 'Transaction not found on Stellar blockchain',
        };
      }
      return {
        valid: false,
        error: `Horizon API error: ${txResponse.statusText}`,
      };
    }

    const tx = await txResponse.json();

    // Verify transaction is successful
    if (!tx.successful) {
      return {
        valid: false,
        error: 'Transaction failed on Stellar blockchain',
      };
    }

    // Fetch operations to verify payment details
    const opsUrl = tx._links.operations.href.replace('{?cursor,limit,order}', '');
    const opsResponse = await fetch(opsUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (!opsResponse.ok) {
      return {
        valid: false,
        error: 'Failed to fetch transaction operations',
      };
    }

    const opsData = await opsResponse.json();

    // Find payment operation to our wallet
    const paymentOp = opsData._embedded.records.find(
      (op: any) =>
        op.type === 'payment' &&
        op.to === STELLAR_CONFIG.walletAddress &&
        op.asset_code === STELLAR_CONFIG.currency
    );

    if (!paymentOp) {
      return {
        valid: false,
        error: `No valid ${STELLAR_CONFIG.currency} payment operation found to ${STELLAR_CONFIG.walletAddress}`,
      };
    }

    // Verify amount
    const paidAmount = parseFloat(paymentOp.amount);
    if (paidAmount < expectedAmount) {
      return {
        valid: false,
        error: `Payment amount insufficient: expected ${expectedAmount}, got ${paidAmount}`,
      };
    }

    // TODO: Add replay protection - store used txHashes in Redis/DB
    // This prevents the same transaction from being used multiple times
    // const isUsed = await checkTransactionUsed(credential.txHash);
    // if (isUsed) {
    //   return { valid: false, error: 'Transaction already used' };
    // }

    console.log('[Stellar] Payment verified:', {
      txHash: credential.txHash,
      amount: paidAmount,
      from: paymentOp.from,
      to: paymentOp.to,
      asset: paymentOp.asset_code || 'XLM',
    });

    return { valid: true };
  } catch (error) {
    console.error('[Stellar] Horizon API error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Horizon API verification failed',
    };
  }
}

/**
 * Generate Stellar payment challenge information
 * Used in 402 Payment Required responses
 */
export function createStellarChallenge(amount: number, service: string) {
  return {
    chain: STELLAR_CONFIG.chain,
    currency: STELLAR_CONFIG.currency,
    recipient: STELLAR_CONFIG.walletAddress,
    network: STELLAR_CONFIG.network,
    amount,
    service,
    horizonUrl: STELLAR_CONFIG.horizonUrl,
    instructions: {
      setup: 'Create Stellar wallet and fund with USDC',
      payment: `Send ${amount} ${STELLAR_CONFIG.currency} to ${STELLAR_CONFIG.walletAddress}`,
      submit: 'Include transaction hash in Authorization: Payment header',
      docs: 'https://developers.stellar.org/docs',
      sdk: 'https://github.com/stellar/stellar-mpp-sdk (experimental)',
    },
  };
}

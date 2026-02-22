#![cfg_attr(not(feature = "export-abi"), no_main)]
extern crate alloc;

/// Import items from the SDK. The core of writing Stylus contracts is the `stylus_sdk` crate.
use stylus_sdk::{
    alloy_primitives::{Address, U256},
    prelude::*,
};

#[storage]
#[entrypoint]
pub struct DetectiveStylusVerifier {
    // No state needed for this pure logic verifier
}

/// Define the implementation of the contract.
#[public]
impl DetectiveStylusVerifier {
    /// Verifies if a user's game performance meets the "Humanity Threshold".
    /// This logic is written in Rust to demonstrate high-efficiency computation
    /// that would be more expensive in Solidity.
    pub fn verify_humanity_score(
        &self,
        correct_guesses: U256,
        total_matches: U256,
        avg_response_time_ms: U256,
    ) -> bool {
        // A score below 50% is suspicious
        if total_matches == U256::ZERO {
            return false;
        }

        let accuracy = (correct_guesses * U256::from(100)) / total_matches;

        // Logic:
        // 1. Accuracy must be > 60% (Humans are better than random at detecting bots)
        // 2. Response time must not be "too fast" (e.g., < 500ms suggests a bot script)
        // 3. Response time must not be "too slow" (e.g., > 300,000ms suggests abandonment)

        let min_human_latency = U256::from(500); // 500ms
        let max_human_latency = U256::from(240_000); // 4 minutes

        accuracy > U256::from(60)
            && avg_response_time_ms > min_human_latency
            && avg_response_time_ms < max_human_latency
    }

    /// Computes a "Deception Rating" for an AI agent.
    /// Higher rating means the bot is better at fooling humans.
    pub fn calculate_deception_rating(
        &self,
        times_fooled_human: U256,
        total_interactions: U256,
    ) -> U256 {
        if total_interactions == U256::ZERO {
            return U256::ZERO;
        }
        // Return percentage 0-100
        (times_fooled_human * U256::from(100)) / total_interactions
    }
}

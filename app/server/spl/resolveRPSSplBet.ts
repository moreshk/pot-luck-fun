"use server";

import { sql } from "@vercel/postgres";
import { getRPSSplBetById } from "./getRPSSplBetById";
import { decryptPrivateKey } from "../sol/decryptKey";
import { transferSPLToken } from "./transferSPLToken";
import { decryptBet } from "../sol/decryptBet";
import { setTimeout } from 'timers/promises';
import { PublicKey, Connection } from "@solana/web3.js";

interface ResolveRPSBetResult {
  success: boolean;
  message?: string;
  error?: string;
  winner?: string;
  option?: 1 | 2 | 3;
  signature?: string;
}


export async function resolveRPSBet(id: number): Promise<ResolveRPSBetResult> {
  console.log(`Starting to resolve RPS game with ID: ${id}`);
  try {
        // Create the Connection object here
        const endpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
        const connection = new Connection(endpoint);
    
    // Get the bet details
    console.log("Fetching game details...");
    const betResult = await getRPSSplBetById(id);
    if (!betResult.success || !betResult.bet) {
      console.error("Failed to fetch game details:", betResult.error);
      throw new Error(betResult.error || "Failed to fetch game details");
    }
    const bet = betResult.bet;
    console.log("Game details:", JSON.stringify(bet, null, 2));

        // Log bet amount details
        // console.log(`Original bet amount: ${bet.original_bet_amount}`);
        console.log(`Bet amount in smallest unit: ${bet.bet_amount}`);
        console.log(`Token decimals: ${bet.token_decimals}`);

        
    // Check if the bet is already resolved
    if (bet.winner_address) {
      console.log("Game is already resolved");
      return {
        success: true,
        message: `Game was already resolved. Winner: ${
          bet.winner_address === "DRAW" ? "Draw" : bet.winner_address
        }`,
        winner: bet.winner_address,
      };
    }

    // Ensure the bet is ready to be resolved
    if (!bet.bet_taker_address || !bet.taker_bet) {
      console.error("Game is not ready to be resolved");
      throw new Error("Game is not ready to be resolved");
    }

    // Decrypt the maker's bet
    console.log("Decrypting maker's game...");
    let decryptedMakerBet;
    try {
      decryptedMakerBet = await decryptBet(bet.maker_bet);
      console.log("Maker's game decrypted successfully:", decryptedMakerBet);
    } catch (decryptError) {
      console.error("Error decrypting maker's game:", decryptError);
      throw new Error(`Failed to decrypt maker's game: ${(decryptError as Error).message || "Unknown error"}`);
    }

    // Determine the winner
    console.log("Determining the winner...");
    let option: 1 | 2 | 3;
    let winnerAddress: string;
    if (decryptedMakerBet === bet.taker_bet) {
      option = 3; // Draw
      winnerAddress = "DRAW";
    } else if (
      (decryptedMakerBet === "Rock" && bet.taker_bet === "Scissors") ||
      (decryptedMakerBet === "Paper" && bet.taker_bet === "Rock") ||
      (decryptedMakerBet === "Scissors" && bet.taker_bet === "Paper")
    ) {
      option = 1; // Maker wins
      winnerAddress = bet.bet_maker_address;
    } else {
      option = 2; // Taker wins
      winnerAddress = bet.bet_taker_address;
    }
    console.log(`Winner determined: ${winnerAddress}, Option: ${option}`);

    // Complete the bet resolution
    const completionResult = await completeRPSBetResolution(id, winnerAddress, option, connection);
    if (!completionResult.success) {
      throw new Error(completionResult.error || "Failed to complete bet resolution");
    }
  
    return {
      success: true,
      message: `Winner determined: ${winnerAddress === "DRAW" ? "Draw" : winnerAddress}`,
      winner: winnerAddress,
      option: option,
      signature: completionResult.signature // Add this line
    };

  } catch (error) {
    console.error("Error resolving RPS game:", error);
    return {
      success: false,
      error: `Failed to resolve RPS game: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

export async function completeRPSBetResolution(id: number, winnerAddress: string, option: 1 | 2 | 3, connection: Connection): Promise<ResolveRPSBetResult> {
  try {
    const betResult = await getRPSSplBetById(id);
    if (!betResult.success || !betResult.bet) {
      throw new Error(betResult.error || "Failed to fetch game details");
    }
    const bet = betResult.bet;

    // Get the encrypted private key for the pot address
    console.log("Fetching pot address details...");
    const potResult = await sql`
      SELECT encrypted_private_key
      FROM pot_addresses
      WHERE pot_address = ${bet.pot_address};
    `;
    if (potResult.rows.length === 0) {
      console.error("Pot address not found");
      throw new Error("Pot address not found");
    }
    console.log("Pot address details fetched successfully");

    // Decrypt the private key
    const encryptedPrivateKey = potResult.rows[0].encrypted_private_key;
    console.log("Encrypted private key:", encryptedPrivateKey);

    let privateKey;
    try {
      console.log("Attempting to decrypt private key...");
      const encryptedPrivateKeyString = Buffer.isBuffer(encryptedPrivateKey)
        ? encryptedPrivateKey.toString("utf8")
        : encryptedPrivateKey;
      privateKey = await decryptPrivateKey(encryptedPrivateKeyString);
      console.log("Private key decrypted successfully");
    } catch (decryptError) {
      console.error("Error decrypting private key:", decryptError);
      throw new Error(
        `Failed to decrypt private key: ${
          (decryptError as Error).message || "Unknown error"
        }`
      );
    }

    // Transfer SPL tokens with retries
    console.log("Initiating SPL token transfer...");
    const maxRetries = 3;
    const retryDelay = 5000; // 5 seconds
    let transferResult: { success: boolean; error?: string; signature?: string } = { success: false };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (!bet.bet_maker_address || !bet.bet_taker_address) {
        throw new Error("Maker or taker address is missing");
      }
      transferResult = await transferSPLToken({
        connection,
        publicKey: bet.pot_address,
        privateKey,
        destinationAddress1: bet.bet_maker_address,
        destinationAddress2: bet.bet_taker_address,
        option,
        tokenMint: new PublicKey(bet.token_contract_address),
        // amount: BigInt(bet.bet_amount),
        decimals: bet.token_decimals,
      });

      if (transferResult.success) {
        console.log(`SPL token transfer successful on attempt ${attempt}`);
        break;
      } else {
        console.warn(`SPL token transfer failed on attempt ${attempt}:`, transferResult.error);
        if (attempt < maxRetries) {
          console.log(`Retrying in ${retryDelay / 1000} seconds...`);
          await setTimeout(retryDelay);
        }
      }
    }

    if (!transferResult.success) {
      console.error("Failed to transfer SPL tokens after all retry attempts:", transferResult.error);
      throw new Error(transferResult.error || "Failed to transfer SPL tokens after multiple attempts");
    }

    // Update the bet record
    console.log("Updating game record...");
    await sql`
      UPDATE rock_paper_scissors_spl_bets
      SET winner_address = ${winnerAddress},
          winnings_disbursement_signature = ${transferResult.signature}
      WHERE id = ${id};
    `;
    console.log("Game record updated successfully");

    return {
      success: true,
      message: `Game resolved successfully. Winner: ${
        winnerAddress === "DRAW" ? "Draw" : winnerAddress
      }`,
      signature: transferResult.signature // Add this line
    };
  } catch (error) {
    console.error("Error completing RPS game resolution:", error);
    return {
      success: false,
      error: `Failed to complete RPS game resolution: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}
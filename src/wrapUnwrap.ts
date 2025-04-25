/**
 * MCP Moni Wrap/Unwrap Functions
 * 
 * This file contains the feature implementation to wrap/unwrap MON to WMON and vice versa.
 */

import { createWalletClient, parseEther, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

// Rather than importing directly, we'll import the required elements from config.js at runtime
// This should help bypass TypeScript's module resolution issues
let WMON_ABI: any;
let TOKEN_MAP: Record<string, { address: string, decimals: number }>;
let publicClient: any;

// Import dynamically to avoid TypeScript module resolution issues
async function importConfig() {
  try {
    const config = await import('./config.js');
    WMON_ABI = config.WMON_ABI;
    TOKEN_MAP = config.TOKEN_MAP;
    publicClient = config.publicClient;
    return true;
  } catch (error) {
    console.error("Error importing config:", error);
    return false;
  }
}

// Ensure config is imported before use
importConfig().catch(console.error);

// Define response content type for better type safety
interface ContentItem {
  type: "text";
  text: string;
  [key: string]: unknown;  // Add index signature for compatibility
}

interface ContentResponse {
  content: ContentItem[];
  [key: string]: unknown;  // Add index signature for compatibility
}

/**
 * Create a wallet client using the private key from environment variables
 * @returns Wallet client for transactions
 */
function getWalletClient() {
  // Get private key from environment variables
  const privateKey = process.env.TEST_WALLET_PRIVATE_KEY;
  
  if (!privateKey) {
    console.error("TEST_WALLET_PRIVATE_KEY not found in environment variables");
    throw new Error("Private key not found in environment variables");
  }
  
  console.error(`Using TEST_WALLET_PRIVATE_KEY from environment variables`);
  
  // Format private key correctly
  let formattedPrivateKey = privateKey;
  if (!formattedPrivateKey.startsWith('0x')) {
    formattedPrivateKey = '0x' + formattedPrivateKey;
  }
  
  // Create account from private key
  const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
  console.error(`Using wallet address: ${account.address}`);
  
  // Create and return wallet client
  return createWalletClient({
    account,
    chain: monadTestnet,
    transport: http("https://testnet-rpc.monad.xyz"),
  });
}

/**
 * Wrap MON to WMON
 * @param {string} amount - The amount of MON to wrap
 * @returns {Promise<object>} - Transaction result information
 */
export async function wrapMON(amount: string) {
  try {
    // Ensure config is imported
    if (!TOKEN_MAP) {
      await importConfig();
    }
    
    // Create wallet client for this transaction
    const walletClient = getWalletClient();
    
    // Convert amount to wei (bigint)
    const amountInWei = parseEther(amount);
    
    // Get wallet address
    const account = walletClient.account;
    if (!account) throw new Error("Wallet account not found");
    
    // Get WMON contract address
    const wmonAddress = TOKEN_MAP["WMON"].address;
    
    // Check MON balance before wrapping
    const balance = await publicClient.getBalance({
      address: account.address,
    });
    
    console.error(`Wallet address: ${account.address}`);
    console.error(`MON balance: ${formatEther(balance)} MON`);
    
    if (balance < amountInWei) {
      throw new Error(`Insufficient MON balance. You have ${formatEther(balance)} MON but trying to wrap ${amount} MON`);
    }
    
    console.error(`Wrapping ${amount} MON to WMON (${amountInWei} wei)`);
    console.error(`WMON contract address: ${wmonAddress}`);
    
    // Execute wrap transaction (deposit)
    const hash = await walletClient.writeContract({
      address: wmonAddress as `0x${string}`,
      abi: WMON_ABI,
      functionName: "deposit",
      args: [],
      value: amountInWei,
    });
    
    console.error(`Transaction sent with hash: ${hash}`);
    
    // Wait for transaction to be mined and get receipt
    console.error(`Waiting for transaction receipt...`);
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash,
      timeout: 60000, // 1 minute timeout
      confirmations: 1
    });
    
    // Verify transaction success
    if (receipt.status !== 'success' && receipt.status !== 1) {
      throw new Error("Transaction failed or was reverted on blockchain");
    }
    
    console.error(`Transaction confirmed in block ${receipt.blockNumber}`);
    
    return {
      success: true,
      from: account.address,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      amount,
      token: "MON",
      wrappedToken: "WMON",
    };
  } catch (error) {
    console.error("Error wrapping MON:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Unwrap WMON to MON
 * @param {string} amount - The amount of WMON to unwrap
 * @returns {Promise<object>} - Transaction result information
 */
export async function unwrapWMON(amount: string) {
  try {
    // Ensure config is imported
    if (!TOKEN_MAP) {
      await importConfig();
    }
    
    // Create wallet client for this transaction
    const walletClient = getWalletClient();
    
    // Convert amount to wei (bigint)
    const amountInWei = parseEther(amount);
    
    // Get wallet address
    const account = walletClient.account;
    if (!account) throw new Error("Wallet account not found");
    
    // Get WMON contract address
    const wmonAddress = TOKEN_MAP["WMON"].address;
    
    console.error(`Wallet address: ${account.address}`);
    
    // Check WMON balance before unwrapping
    const wmonBalance = await publicClient.readContract({
      address: wmonAddress as `0x${string}`,
      abi: WMON_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    
    console.error(`WMON balance: ${formatEther(wmonBalance as bigint)} WMON`);
    
    if (wmonBalance < amountInWei) {
      throw new Error(`Insufficient WMON balance. You have ${formatEther(wmonBalance as bigint)} WMON but trying to unwrap ${amount} WMON`);
    }
    
    console.error(`Unwrapping ${amount} WMON to MON (${amountInWei} wei)`);
    console.error(`WMON contract address: ${wmonAddress}`);
    
    // Execute unwrap transaction (withdraw)
    const hash = await walletClient.writeContract({
      address: wmonAddress as `0x${string}`,
      abi: WMON_ABI,
      functionName: "withdraw",
      args: [amountInWei],
    });
    
    console.error(`Transaction sent with hash: ${hash}`);
    
    // Wait for transaction to be mined and get receipt
    console.error(`Waiting for transaction receipt...`);
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash,
      timeout: 60000, // 1 minute timeout
      confirmations: 1
    });
    
    // Verify transaction success
    if (receipt.status !== 'success' && receipt.status !== 1) {
      throw new Error("Transaction failed or was reverted on blockchain");
    }
    
    console.error(`Transaction confirmed in block ${receipt.blockNumber}`);
    
    return {
      success: true,
      from: account.address,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      amount,
      token: "WMON",
      unwrappedToken: "MON",
    };
  } catch (error) {
    console.error("Error unwrapping WMON:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Format a transaction result for display
 * @param {object} result - The transaction result
 * @param {string} type - Either "wrap" or "unwrap"
 * @returns {ContentResponse} - Formatted result object
 */
export function formatTransactionResult(result: any, type: "wrap" | "unwrap"): ContentResponse {
  if (!result.success) {
    return {
      content: [
        {
          type: "text",
          text: `## ❌ Error ${type === "wrap" ? "Wrapping MON" : "Unwrapping WMON"}\n\n${result.error}\n\nSilakan coba lagi dengan jumlah yang berbeda atau periksa saldo Anda.`
        }
      ]
    };
  }
  
  const explorerUrl = `https://testnet.monadexplorer.com/tx/${result.txHash}`;
  
  if (type === "wrap") {
    return {
      content: [
        {
          type: "text",
          text: `## ✅ MON Wrapped Successfully\n\nYour ${result.amount} MON has been successfully wrapped to ${result.amount} WMON. The transaction is complete and has been confirmed on the blockchain.\n\n### Transaction Details\n- **From**: ${result.from}\n- **Transaction Hash**: ${result.txHash}\n- **Block Number**: ${result.blockNumber || 'Pending'}\n\n### [🔍 View Transaction on Monad Explorer](${explorerUrl})\n\nYou can now use your WMON tokens in compatible applications on Monad testnet.`
        }
      ]
    };
  } else {
    return {
      content: [
        {
          type: "text",
          text: `## ✅ WMON Unwrapped Successfully\n\nYour ${result.amount} WMON has been successfully unwrapped to ${result.amount} MON. The transaction is complete and has been confirmed on the blockchain.\n\n### Transaction Details\n- **From**: ${result.from}\n- **Transaction Hash**: ${result.txHash}\n- **Block Number**: ${result.blockNumber || 'Pending'}\n\n### [🔍 View Transaction on Monad Explorer](${explorerUrl})\n\nYou can now use your native MON tokens for transactions on Monad testnet.`
        }
      ]
    };
  }
}
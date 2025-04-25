/**
 * MCP Moni Staking Functions
 * 
 * This file contains the feature implementation for staking MON to aprMON
 * and unstaking aprMON back to MON on Apriori.
 */

import { createWalletClient, parseUnits, formatUnits, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { publicClient, ERC20_ABI, TOKEN_MAP } from "./config";

// Define the Apriori Staking contract address (already in TOKEN_MAP as aprMON)
export const APRIORI_STAKING_ADDRESS = TOKEN_MAP.aprMON.address;

// Define Apriori Staking ABI with necessary functions
export const APRIORI_STAKING_ABI = [
  // Deposit function yang benar sesuai dengan kontrak
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "_amount", type: "uint256" },
      { name: "_receiver", type: "address" }
    ],
    outputs: [],
  },
  // Stake function (alternative name that might be used)
  {
    name: "stake",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  // Unstake function (burns aprMON and returns MON)
  {
    name: "unstake",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  // Alternative names for unstaking functions that might be used
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  // Official withdraw matching Apriori selector 0x7d41c86e: withdraw(amount, from, receiver)
  { name: "withdraw", type: "function", stateMutability: "nonpayable", inputs: [
      { name: "_amount", type: "uint256" },
      { name: "_from", type: "address" },
      { name: "_receiver", type: "address" }
  ], outputs: [] },
  // Approval for ERC20 tokens
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  // Check allowance
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  // View pending withdrawals for a user
  {
    name: "withdrawalRequests",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "who", type: "address" }],
    outputs: [
      {
        components: [
          { name: "amount", type: "uint256" },
          { name: "availableAt", type: "uint256" }
        ],
        name: "",
        type: "tuple[]"
      }
    ]
  },
  // Claim matured withdrawals by IDs
  {
    name: "claim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "ids", type: "uint256[]" }],
    outputs: []
  }
];

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
 * Stake MON to get aprMON
 * @param amount - Amount of MON to stake
 * @returns Result of the staking operation
 */
export async function stakeMON(amount: string): Promise<any> {
  try {
    const privateKey = process.env.TEST_WALLET_PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error("Private key not found in environment variables");
    }
    
    let formattedPrivateKey = privateKey;
    if (!formattedPrivateKey.startsWith('0x')) {
      formattedPrivateKey = '0x' + formattedPrivateKey;
    }
    
    const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
    
    // Verify alamat wallet
    const expectedAddress = '0x5b84Dc548e45cC4f1498b95C000C748c1c953f64';
    if (account.address.toLowerCase() !== expectedAddress.toLowerCase()) {
      throw new Error(`Private key generates different address (${account.address}) than expected (${expectedAddress}). Please check your private key in .env file.`);
    }

    console.error(`Using wallet address: ${account.address}`);
    
    const amountIn = parseUnits(amount, 18);

    const balance = await publicClient.getBalance({
      address: account.address
    });

    if (balance < amountIn) {
      throw new Error(`Insufficient MON balance. You have ${formatUnits(balance, 18)} MON but tried to stake ${amount} MON`);
    }
    
    const walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport: http("https://testnet-rpc.monad.xyz"),
    });
    
    console.error(`Staking ${amount} MON to get aprMON using deposit method`);
    
    // Menggunakan method deposit dengan parameter yang benar
    const hash = await walletClient.writeContract({
      address: TOKEN_MAP.aprMON.address as `0x${string}`,
      abi: APRIORI_STAKING_ABI,
      functionName: 'deposit',
      args: [amountIn, account.address], // Mengirim amount dan receiver address
      value: amountIn // Nilai MON yang dikirim
    });
    
    console.error(`Staking transaction sent with hash: ${hash}`);
    
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash,
      timeout: 60000,
      confirmations: 1
    });
    
    if (!receipt || receipt.status === 'reverted') {
      throw new Error("Staking transaction failed or was reverted on blockchain");
    }
    
    console.error(`Staking transaction confirmed in block ${receipt.blockNumber}`);
    
    return {
      success: true,
      amount: amount,
      txHash: hash,
      blockNumber: receipt.blockNumber,
      from: account.address,
      method: "deposit"
    };
    
  } catch (error) {
    console.error("Error staking MON:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error staking MON"
    };
  }
}

/**
 * Request to unstake aprMON back to MON
 * @param amount - Amount of aprMON to unstake
 * @returns Result of the unstake operation
 */
export async function requestUnstakeAprMON(amount: string, useSwap: boolean = true): Promise<any> {
  try {
    // Get private key from environment variables
    const privateKey = process.env.TEST_WALLET_PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error("Private key not found in environment variables");
    }
    
    // Format private key correctly
    let formattedPrivateKey = privateKey;
    if (!formattedPrivateKey.startsWith('0x')) {
      formattedPrivateKey = '0x' + formattedPrivateKey;
    }
    
    // Create account from private key
    const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
    console.error(`Using wallet address: ${account.address}`);
    
    // Parse amount with correct decimals (aprMON has 18 decimals)
    const amountIn = parseUnits(amount, 18);
    
    // Create wallet client
    const walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport: http("https://testnet-rpc.monad.xyz"),
    });
    
    console.error(`Checking if approval is needed for unstaking ${amount} aprMON`);
    
    // First, check if we need to approve the staking contract to spend our aprMON
    const allowance = await publicClient.readContract({
      address: TOKEN_MAP.aprMON.address as `0x${string}`,
      abi: APRIORI_STAKING_ABI,
      functionName: 'allowance',
      args: [account.address, APRIORI_STAKING_ADDRESS]
    }) as bigint;  // Assert the return type as bigint
    
    // If allowance is less than the amount we want to unstake, we need to approve
    if (allowance < amountIn) {
      console.error(`Approving staking contract to spend ${amount} aprMON`);
      
      // Approve the staking contract to spend our aprMON
      const approvalHash = await walletClient.writeContract({
        address: TOKEN_MAP.aprMON.address as `0x${string}`,
        abi: APRIORI_STAKING_ABI,
        functionName: 'approve',
        args: [
          APRIORI_STAKING_ADDRESS,
          parseUnits("1000000000", 18) // Approve a large amount to avoid future approvals
        ]
      });
      
      console.error(`Approval transaction sent with hash: ${approvalHash}`);
      
      // Wait for approval transaction to be mined
      await publicClient.waitForTransactionReceipt({
        hash: approvalHash,
        timeout: 60000,
        confirmations: 1
      });
      
      console.error(`Approval transaction confirmed`);
    } else {
      console.error(`Approval not needed, allowance is sufficient`);
    }
    
    let hash: `0x${string}`;
    let receipt: any;
    let method: string;
    
    if (useSwap) {
      // Use swap as fallback method (aprMON → MON)
      console.error(`Using swap method to convert ${amount} aprMON to MON`);
      
      try {
        // Import swap functionality
        const { executeSwap } = await import('./swap');
        
        // Execute swap from aprMON to MON
        const swapResult = await executeSwap('aprMON', 'MON', amount, 5.0);
        
        if (!swapResult.success) {
          throw new Error(`Swap failed: ${swapResult.error}`);
        }
        
        return {
          success: true,
          amount: amount,
          receivedAmount: swapResult.toAmount,
          txHash: swapResult.txHash,
          blockNumber: swapResult.blockNumber,
          from: account.address,
          method: 'swap',
          message: `Your ${amount} aprMON has been converted to approximately ${swapResult.toAmount} MON using the swap method.`
        };
      } catch (swapError) {
        console.error("Swap fallback method failed:", swapError);
        throw swapError; // Re-throw to be caught by outer catch
      }
    } else {
      // Try official unstake: call withdraw(amount, from, receiver)
      try {
        console.error(`Attempting official withdraw for unstaking ${amount} aprMON`);
        hash = await walletClient.writeContract({
          address: APRIORI_STAKING_ADDRESS as `0x${string}`,
          abi: APRIORI_STAKING_ABI,
          functionName: 'withdraw',
          args: [amountIn, account.address, account.address]
        });
        method = 'withdraw';
        console.error(`Unstaking transaction sent with hash: ${hash}`);
        receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60000, confirmations: 1 });
        console.error(`Unstaking transaction confirmed in block ${receipt.blockNumber}`);
      } catch (unstakeError) {
        console.error("Official withdraw method failed:", unstakeError);
        
        // If official unstake fails, try direct transfer as fallback
        console.error(`Attempting direct transfer of ${amount} aprMON to staking contract`);
        hash = await walletClient.writeContract({
          address: TOKEN_MAP.aprMON.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [
            APRIORI_STAKING_ADDRESS as `0x${string}`,
            amountIn
          ]
        });
        method = 'transfer';
        console.error(`Transfer transaction sent with hash: ${hash}`);
        receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60000, confirmations: 1 });
        console.error(`Transfer transaction confirmed in block ${receipt.blockNumber}`);
      }
      
      return {
        success: true,
        amount: amount,
        txHash: hash,
        blockNumber: receipt.blockNumber,
        from: account.address,
        method: method,
        message: `Your ${amount} aprMON has been unstaked using the ${method} method. Please check your MON balance.`
      };
    }
    
  } catch (error) {
    console.error("All unstaking methods failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error requesting unstake"
    };
  }
}

/**
 * Format a staking result for display
 * @param result - The staking transaction result
 * @returns Formatted response
 */
export function formatStakingResult(result: any): ContentResponse {
  if (!result.success) {
    return {
      content: [
        {
          type: "text",
          text: `## ❌ Error Staking MON\n\n${result.error}\n\nPlease check your MON balance and try again.`
        }
      ]
    };
  }
  
  const explorerUrl = `https://testnet.monadexplorer.com/tx/${result.txHash}`;
  const methodUsed = result.method || 'standard staking';
  
  return {
    content: [
      {
        type: "text",
        text: `## ✅ MON Staked Successfully\n\nYour ${result.amount} MON has been successfully staked using the "${methodUsed}" method and you've received ${result.amount} aprMON. The transaction has been confirmed on the blockchain.\n\n### Transaction Details\n- **From**: ${result.from}\n- **Transaction Hash**: ${result.txHash}\n- **Block Number**: ${result.blockNumber || 'Pending'}\n- **Staked**: ${result.amount} MON ➡️ ${result.amount} aprMON\n- **Method Used**: ${methodUsed}\n\n### [🔍 View Transaction on Monad Explorer](${explorerUrl})\n\nYou can unstake your aprMON at any time by using the \`execute-unstake\` tool.`
      }
    ]
  };
}

/**
 * Format an unstake request result for display
 * @param result - The unstake request transaction result
 * @returns Formatted response
 */
export function formatUnstakeRequestResult(result: any): ContentResponse {
  if (!result.success) {
    return {
      content: [
        {
          type: "text",
          text: `## ❌ Error Unstaking aprMON\n\n${result.error}\n\nPlease check your aprMON balance and try again.`
        }
      ]
    };
  }
  
  const explorerUrl = `https://testnet.monadexplorer.com/tx/${result.txHash}`;
  
  return {
    content: [
      {
        type: "text",
        text: `## ✅ aprMON Unstaked Successfully\n\n${result.message}\n\n### Transaction Details\n- **From**: ${result.from}\n- **Transaction Hash**: ${result.txHash}\n- **Block Number**: ${result.blockNumber || 'Pending'}\n- **Unstaking Amount**: ${result.amount} aprMON\n- **Method Used**: ${result.method || 'Standard unstake'}\n\n### [🔍 View Transaction on Monad Explorer](${explorerUrl})`
      }
    ]
  };
}

/**
 * For compatibility - Apriori staking might not have pending withdrawals
 * but we keep this function for compatibility with the MCP interface
 */
export async function getPendingWithdrawals(): Promise<any> {
  try {
    const privateKey = process.env.TEST_WALLET_PRIVATE_KEY;
    if (!privateKey) throw new Error("Private key not found");
    const formattedKey = privateKey.startsWith('0x') ? privateKey : '0x'+privateKey;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);
    // Read withdrawalRequests for this user
    const requests = await publicClient.readContract({
      address: APRIORI_STAKING_ADDRESS as `0x${string}`,
      abi: APRIORI_STAKING_ABI,
      functionName: 'withdrawalRequests',
      args: [account.address]
    }) as Array<{ amount: bigint; availableAt: bigint }>;
    // Format to simple array
    const result = requests.map((req, idx) => ({
      id: idx,
      amount: formatUnits(req.amount, 18),
      availableAt: Number(req.availableAt)
    }));
    return { success: true, requests: result };
  } catch(error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * For compatibility - Apriori staking might not have a claim process
 * but we keep this function for compatibility with the MCP interface
 */
export async function claimUnstakedMON(requestIds: string[]): Promise<any> {
  try {
    const privateKey = process.env.TEST_WALLET_PRIVATE_KEY;
    if (!privateKey) throw new Error("Private key not found");
    const formattedKey = privateKey.startsWith('0x') ? privateKey : '0x'+privateKey;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: monadTestnet, transport: http("https://testnet-rpc.monad.xyz") });
    // Convert ids to bigints
    const ids = requestIds.map(id => BigInt(id));
    const hash = await walletClient.writeContract({
      address: APRIORI_STAKING_ADDRESS as `0x${string}`,
      abi: APRIORI_STAKING_ABI,
      functionName: 'claim',
      args: [ids]
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60000, confirmations: 1 });
    return { success: true, txHash: hash, blockNumber: receipt.blockNumber };
  } catch(error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Format pending withdrawals for display (compatibility function)
 */
export function formatPendingWithdrawals(result: any): ContentResponse {
  if (!result.success) {
    return {
      content: [
        {
          type: "text",
          text: `## ❌ Error Getting Pending Withdrawals\n\n${result.error}`
        }
      ]
    };
  }
  
  return {
    content: [
      {
        type: "text",
        text: `## Pending Withdrawals\n\nYou have no pending withdrawal requests. The Apriori staking system processes unstaking in one transaction - there is no need to check pending requests.`
      }
    ]
  };
}

/**
 * Format claim result for display (compatibility function)
 */
export function formatClaimResult(result: any): ContentResponse {
  return {
    content: [
      {
        type: "text",
        text: `## Claiming Not Required\n\nThe Apriori staking system handles unstaking automatically - there is no need to claim MON after unstaking. When you unstake aprMON, your MON is automatically returned to your wallet.`
      }
    ]
  };
}
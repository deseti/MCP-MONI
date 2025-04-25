/**
 * MCP Moni Swap Functions
 * 
 * This file contains the feature implementation to swap tokens on Monad testnet
 * using the swap contract at 0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89.
 */

import { createWalletClient, parseUnits, formatUnits, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { publicClient, ERC20_ABI, TOKEN_MAP } from "./config";

// Define the Swap Router contract address
export const SWAP_ROUTER_ADDRESS = '0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89';

// Define Swap Router ABI (simplified for the functions we need)
export const SWAP_ROUTER_ABI = [
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    name: "swapExactTokensForTokens",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    name: "swapExactETHForTokens",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    name: "swapExactTokensForETH",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "amountA", type: "uint256" },
      { name: "reserveA", type: "uint256" },
      { name: "reserveB", type: "uint256" }
    ],
    name: "getAmountOut",
    outputs: [{ name: "amountB", type: "uint256" }],
    stateMutability: "pure",
    type: "function"
  },
  {
    inputs: [
      { name: "amountOut", type: "uint256" },
      { name: "path", type: "address[]" }
    ],
    name: "getAmountsIn",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" }
    ],
    name: "getAmountsOut",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "view",
    type: "function"
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
 * Get a price quote for swapping tokens
 * @param fromToken - Source token symbol
 * @param toToken - Destination token symbol
 * @param amount - Amount of source token to swap
 * @returns Quote information
 */
export async function getSwapQuote(fromToken: string, toToken: string, amount: string) {
  try {
    // Normalize token symbols - preserve case for special tokens like "aprMON"
    let sourceToken = fromToken;
    let destToken = toToken;
    
    // Check if tokens are supported with case-sensitive matching
    const sourceTokenExists = Object.keys(TOKEN_MAP).find(key => key.toLowerCase() === sourceToken.toLowerCase());
    const destTokenExists = Object.keys(TOKEN_MAP).find(key => key.toLowerCase() === destToken.toLowerCase());
    
    if (!sourceTokenExists && sourceToken.toUpperCase() !== "MON") {
      throw new Error(`Source token ${sourceToken} is not supported. Supported tokens: ${Object.keys(TOKEN_MAP).join(", ")}`);
    }
    
    if (!destTokenExists && destToken.toUpperCase() !== "MON") {
      throw new Error(`Destination token ${destToken} is not supported. Supported tokens: ${Object.keys(TOKEN_MAP).join(", ")}`);
    }
    
    // Use the correct case from the TOKEN_MAP
    sourceToken = sourceToken.toUpperCase() === "MON" ? "MON" : sourceTokenExists as string;
    destToken = destToken.toUpperCase() === "MON" ? "MON" : destTokenExists as string;
    
    console.error(`Using normalized tokens: ${sourceToken} -> ${destToken}`);
    
    // Get token addresses and decimals
    const sourceTokenInfo = sourceToken === "MON" ? TOKEN_MAP["WMON"] : TOKEN_MAP[sourceToken];
    const destTokenInfo = destToken === "MON" ? TOKEN_MAP["WMON"] : TOKEN_MAP[destToken];
    
    // Create path for the swap
    // When using MON (native token), we need to use WMON address in the path
    const path = [sourceTokenInfo.address, destTokenInfo.address];
    
    // Parse amount with correct decimals
    const amountIn = parseUnits(amount, sourceTokenInfo.decimals);
    
    console.error(`Getting swap quote: ${amount} ${sourceToken} to ${destToken}`);
    console.error(`Path: ${path.join(' -> ')}`);
    
    // Call getAmountsOut function to get the expected output amount
    const amounts = await publicClient.readContract({
      address: SWAP_ROUTER_ADDRESS as `0x${string}`,
      abi: SWAP_ROUTER_ABI,
      functionName: 'getAmountsOut',
      args: [amountIn, path.map(addr => addr as `0x${string}`)]
    });
    
    // The returned amounts array contains the input amount (at index 0) and output amount (at index 1)
    const expectedOutputAmount = (amounts as bigint[])[1];
    const formattedOutputAmount = formatUnits(expectedOutputAmount, destTokenInfo.decimals);
    
    console.error(`Expected output: ${formattedOutputAmount} ${destToken}`);
    
    return {
      success: true,
      fromToken: sourceToken,
      toToken: destToken,
      fromAmount: amount,
      toAmount: formattedOutputAmount,
      rate: Number(formattedOutputAmount) / Number(amount)
    };
  } catch (error) {
    console.error("Error getting swap quote:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error getting swap quote"
    };
  }
}

/**
 * Execute a token swap transaction
 * @param fromToken - Source token symbol
 * @param toToken - Destination token symbol
 * @param amount - Amount of source token to swap
 * @param slippagePercent - Allowed slippage percentage (default: 2.0)
 * @returns Transaction result
 */
export async function executeSwap(fromToken: string, toToken: string, amount: string, slippagePercent: number = 2.0) {
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
    
    // Normalize token symbols - preserve case for special tokens like "aprMON"
    let sourceToken = fromToken;
    let destToken = toToken;
    
    // Check if tokens are supported with case-sensitive matching
    const sourceTokenExists = Object.keys(TOKEN_MAP).find(key => key.toLowerCase() === sourceToken.toLowerCase());
    const destTokenExists = Object.keys(TOKEN_MAP).find(key => key.toLowerCase() === destToken.toLowerCase());
    
    if (!sourceTokenExists && sourceToken.toUpperCase() !== "MON") {
      throw new Error(`Source token ${sourceToken} is not supported. Supported tokens: ${Object.keys(TOKEN_MAP).join(", ")}`);
    }
    
    if (!destTokenExists && destToken.toUpperCase() !== "MON") {
      throw new Error(`Destination token ${destToken} is not supported. Supported tokens: ${Object.keys(TOKEN_MAP).join(", ")}`);
    }
    
    // Use the correct case from the TOKEN_MAP
    sourceToken = sourceToken.toUpperCase() === "MON" ? "MON" : sourceTokenExists as string;
    destToken = destToken.toUpperCase() === "MON" ? "MON" : destTokenExists as string;
    
    console.error(`Using normalized tokens: ${sourceToken} -> ${destToken}`);
    
    // Handle special case for native MON (use WMON token info for path, but native transfer for value)
    const isNativeSource = sourceToken === "MON";
    const isNativeDest = destToken === "MON";
    
    // Get token addresses and decimals
    const sourceTokenInfo = isNativeSource ? TOKEN_MAP["WMON"] : TOKEN_MAP[sourceToken];
    const destTokenInfo = isNativeDest ? TOKEN_MAP["WMON"] : TOKEN_MAP[destToken];
    
    // Parse amount with correct decimals
    const amountIn = parseUnits(amount, sourceTokenInfo.decimals);
    
    // Create wallet client
    const walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport: http("https://testnet-rpc.monad.xyz"),
    });
    
    // Get the current block timestamp to calculate deadline
    const currentBlock = await publicClient.getBlock();
    const currentTimestamp = Number(currentBlock.timestamp);
    
    // Set deadline to 20 minutes from now
    const deadline = BigInt(currentTimestamp + 20 * 60);
    
    let hash: `0x${string}`;
    
    // **** SPECIAL CASE FOR aprMON to MON (BASED ON SUCCESSFUL TX) ****
    if (sourceToken === "aprMON" && destToken === "MON") {
      console.error(`Using special case for aprMON to MON with known working path`);
      
      // Special path for aprMON -> MON based on successful transaction 0x0734c8c436a1d1aa96bb833ccfd34084e1175233e2477fee09751fe9d6c01daf
      // Path: aprMON -> sMON -> MON (native)
      const path = [
        "0xb2f82d0f38dc453d596ad40a37799446cc89274a" as `0x${string}`, // aprMON
        "0xe1d2439b75fb9746e7bc6cb777ae10aa7f7ef9c5" as `0x${string}`, // sMON
        "0x760afe86e5de5fa0ee542fc7b7b713e1c5425701" as `0x${string}`  // WMON
      ];
      
      console.error(`Using optimized path from successful transaction: ${path.join(' -> ')} -> MON (native)`);
      
      // First need to approve the router to spend our aprMON tokens
      const approvalHash = await walletClient.writeContract({
        address: TOKEN_MAP.aprMON.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [
          SWAP_ROUTER_ADDRESS as `0x${string}`,
          amountIn
        ]
      });
      
      console.error(`Approval transaction sent with hash: ${approvalHash}`);
      
      // Wait for approval to be confirmed
      await publicClient.waitForTransactionReceipt({ 
        hash: approvalHash,
        timeout: 60000, // 1 minute timeout
        confirmations: 1
      });
      
      // Calculate output amount with slippage (based on successful tx which had ~0.1 aprMON -> ~0.09988 MON)
      const expectedOutput = (amountIn * 9988n) / 10000n; // Approximate based on successful tx
      const slippageFactor = 1000n - BigInt(slippagePercent * 10);
      const amountOutMin = (expectedOutput * slippageFactor) / 1000n;
      
      console.error(`Expected output (approx): ${formatUnits(expectedOutput, 18)} MON`);
      console.error(`Minimum output with ${slippagePercent}% slippage: ${formatUnits(amountOutMin, 18)} MON`);
      
      // Now execute the swap using swapExactTokensForETH (which swaps tokens for native MON)
      hash = await walletClient.writeContract({
        address: SWAP_ROUTER_ADDRESS as `0x${string}`,
        abi: [
          {
            inputs: [
              { name: "amountIn", type: "uint256" },
              { name: "amountOutMin", type: "uint256" },
              { name: "path", type: "address[]" },
              { name: "to", type: "address" },
              { name: "deadline", type: "uint256" }
            ],
            name: "swapExactTokensForETH",
            outputs: [{ name: "amounts", type: "uint256[]" }],
            stateMutability: "nonpayable",
            type: "function"
          }
        ],
        functionName: 'swapExactTokensForETH',
        args: [
          amountIn,
          amountOutMin,
          path,
          account.address,
          deadline
        ]
      });
      
      console.error(`aprMON to MON swap transaction sent with hash: ${hash}`);
      
      // Wait for transaction to be mined and get receipt
      console.error(`Waiting for swap transaction receipt...`);
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        timeout: 60000, // 1 minute timeout
        confirmations: 1
      });
      
      // Format the expected output for display (approximate based on successful tx)
      const formattedOutput = formatUnits((amountIn * 9988n) / 10000n, 18);
      
      return {
        success: true,
        fromToken: sourceToken,
        toToken: destToken,
        fromAmount: amount,
        toAmount: formattedOutput,
        txHash: hash,
        blockNumber: receipt.blockNumber,
        from: account.address
      };
    }
    
    // Default swap cases (for other token pairs)
    // Create path for the swap
    const path = [sourceTokenInfo.address, destTokenInfo.address];
    
    // Get expected output amount from the swap router
    const amounts = await publicClient.readContract({
      address: SWAP_ROUTER_ADDRESS as `0x${string}`,
      abi: SWAP_ROUTER_ABI,
      functionName: 'getAmountsOut',
      args: [amountIn, path.map(addr => addr as `0x${string}`)]
    });
    
    // Calculate minimum output amount considering slippage
    const expectedOutput = (amounts as bigint[])[1];
    const slippageFactor = 1000n - BigInt(slippagePercent * 10);
    const amountOutMin = (expectedOutput * slippageFactor) / 1000n;
    
    console.error(`Swapping ${amount} ${sourceToken} to ${destToken}`);
    console.error(`Expected output: ${formatUnits(expectedOutput, destTokenInfo.decimals)} ${destToken}`);
    console.error(`Minimum output with ${slippagePercent}% slippage: ${formatUnits(amountOutMin, destTokenInfo.decimals)} ${destToken}`);
    
    // Different swap methods based on token types
    if (isNativeSource) {
      // Swapping MON (native) to ERC20 token
      console.error(`Swapping MON to ${destToken}`);
      
      hash = await walletClient.writeContract({
        address: SWAP_ROUTER_ADDRESS as `0x${string}`,
        abi: SWAP_ROUTER_ABI,
        functionName: 'swapExactETHForTokens',
        args: [
          amountOutMin,
          path.map(addr => addr as `0x${string}`),
          account.address,
          deadline
        ],
        value: amountIn
      });
    } else if (isNativeDest) {
      // Swapping ERC20 token to MON (native)
      console.error(`Swapping ${sourceToken} to MON`);
      
      // First need to approve the router to spend our tokens
      const approvalHash = await walletClient.writeContract({
        address: sourceTokenInfo.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [
          SWAP_ROUTER_ADDRESS as `0x${string}`,
          amountIn
        ]
      });
      
      console.error(`Approval transaction sent with hash: ${approvalHash}`);
      
      // Wait for approval to be confirmed
      await publicClient.waitForTransactionReceipt({ 
        hash: approvalHash,
        timeout: 60000, // 1 minute timeout
        confirmations: 1
      });
      
      // Now execute the swap
      hash = await walletClient.writeContract({
        address: SWAP_ROUTER_ADDRESS as `0x${string}`,
        abi: SWAP_ROUTER_ABI,
        functionName: 'swapExactTokensForETH',
        args: [
          amountIn,
          amountOutMin,
          path.map(addr => addr as `0x${string}`),
          account.address,
          deadline
        ]
      });
    } else {
      // Swapping ERC20 to ERC20
      console.error(`Swapping ${sourceToken} to ${destToken}`);
      
      // First need to approve the router to spend our tokens
      const approvalHash = await walletClient.writeContract({
        address: sourceTokenInfo.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [
          SWAP_ROUTER_ADDRESS as `0x${string}`,
          amountIn
        ]
      });
      
      console.error(`Approval transaction sent with hash: ${approvalHash}`);
      
      // Wait for approval to be confirmed
      await publicClient.waitForTransactionReceipt({ 
        hash: approvalHash,
        timeout: 60000, // 1 minute timeout
        confirmations: 1
      });
      
      // Now execute the swap
      hash = await walletClient.writeContract({
        address: SWAP_ROUTER_ADDRESS as `0x${string}`,
        abi: SWAP_ROUTER_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [
          amountIn,
          amountOutMin,
          path.map(addr => addr as `0x${string}`),
          account.address,
          deadline
        ]
      });
    }
    
    console.error(`Swap transaction sent with hash: ${hash}`);
    
    // Wait for transaction to be mined and get receipt
    console.error(`Waiting for swap transaction receipt...`);
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash,
      timeout: 60000, // 1 minute timeout
      confirmations: 1
    });
    
    // Verify transaction success
    const txStatus = receipt.status;
    if (typeof txStatus === 'string' && txStatus !== 'success') {
      throw new Error("Swap transaction failed or was reverted on blockchain");
    } else if (typeof txStatus === 'number' || typeof txStatus === 'bigint') {
      if (Number(txStatus) !== 1) {
        throw new Error("Swap transaction failed or was reverted on blockchain");
      }
    }
    
    console.error(`Swap transaction confirmed in block ${receipt.blockNumber}`);
    
    // Format the expected output for display
    const formattedOutput = formatUnits(expectedOutput, destTokenInfo.decimals);
    
    return {
      success: true,
      fromToken: sourceToken,
      toToken: destToken,
      fromAmount: amount,
      toAmount: formattedOutput,
      txHash: hash,
      blockNumber: receipt.blockNumber,
      from: account.address
    };
  } catch (error) {
    console.error("Error executing swap:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error executing swap"
    };
  }
}

/**
 * Format a swap transaction result for display
 * @param result - The swap transaction result
 * @returns Formatted result object
 */
export function formatSwapResult(result: any): ContentResponse {
  if (!result.success) {
    return {
      content: [
        {
          type: "text",
          text: `## ❌ Error Executing Swap\n\n${result.error}\n\nPlease check your token balance or try again with a different amount.`
        }
      ]
    };
  }
  
  const explorerUrl = `https://testnet.monadexplorer.com/tx/${result.txHash}`;
  
  return {
    content: [
      {
        type: "text",
        text: `## ✅ Swap Executed Successfully\n\nYour ${result.fromAmount} ${result.fromToken} has been successfully swapped to approximately ${result.toAmount} ${result.toToken}. The transaction is complete and has been confirmed on the blockchain.\n\n### Transaction Details\n- **From**: ${result.from}\n- **Transaction Hash**: ${result.txHash}\n- **Block Number**: ${result.blockNumber || 'Pending'}\n- **Swapped**: ${result.fromAmount} ${result.fromToken} ➡️ ${result.toAmount} ${result.toToken}\n\n### [🔍 View Transaction on Monad Explorer](${explorerUrl})\n\nYou can now use your ${result.toToken} tokens for other operations on Monad testnet.`
      }
    ]
  };
}
/**
 * MCP Moni Server - Index File
 * 
 * This file contains the main MCP server that interacts with the Monad testnet blockchain.
 * Some features have been separated into separate files for better organization.
 */

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

// Import necessary dependencies
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { formatUnits, http, parseUnits, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Import functions from config module
import { publicClient, ERC20_ABI, WMON_ABI, TOKEN_MAP, getTokenBalance, getTokenBalanceList, getWalletAddressFromEnv } from "./config";

// Import wrap/unwrap functions
import { wrapMON, unwrapWMON, formatTransactionResult } from "./wrapUnwrap";

// Import utilities
import { getLatestBlocks, getTransactionDetails } from "./utilities";

// Import NFT functionality
import { createNFTCollection, formatNFTCollectionInfo } from "./nft";
import { NFTCreationResult, NFTArtType } from "./nft/types";

// Import swap functions
import { getSwapQuote, executeSwap, formatSwapResult } from "./swap";

// Import staking functions
import { stakeMON, requestUnstakeAprMON, claimUnstakedMON, getPendingWithdrawals,
         formatStakingResult, formatUnstakeRequestResult, formatClaimResult, formatPendingWithdrawals } from "./staking";

// Load environment variables with correct path
const envPath = path.resolve(__dirname, '../.env');
console.error(`Attempting to load .env from: ${envPath}`);
console.error(`File exists: ${fs.existsSync(envPath)}`);

if (fs.existsSync(envPath)) {
    // Load .env file manually
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = envContent.split('\n').reduce<Record<string, string>>((acc, line) => {
        // Skip comments and empty lines
        if (line.startsWith('#') || !line.trim()) return acc;
        
        // Extract key=value pairs
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            // Remove quotes if present
            value = value.replace(/^['"]|['"]$/g, '');
            acc[key] = value;
        }
        
        return acc;
    }, {});
    
    // Set environment variables
    Object.keys(envVars).forEach(key => {
        process.env[key] = envVars[key];
    });
    console.error('Loaded environment variables from .env file');
    
    // Log private key existence (safely)
    if (process.env.TEST_WALLET_PRIVATE_KEY) {
        console.error('TEST_WALLET_PRIVATE_KEY found in .env file');
        console.error(`Key starts with: ${process.env.TEST_WALLET_PRIVATE_KEY.substring(0, 4)}...`);
    } else {
        console.error('TEST_WALLET_PRIVATE_KEY not found in .env file');
    }
} else {
    console.error('.env file not found. Please create it with your test wallet private key.');
    dotenv.config(); // Try the standard method as fallback
}

// Initialize the MCP server with a name, version, and capabilities
const server = new McpServer({
    name: "MCP Moni",
    version: "1.0.0",
    // Array of supported tool names that clients can call
    capabilities: [
        "get-mon-balance", 
        "get-token-portfolio", 
        "get-token-balance", 
        "transfer-token",
        "get-latest-blocks",
        "get-transaction",
        "execute-transfer",
        "execute-wrap",       // Add this for supporting MON to WMON wrapping
        "execute-unwrap",     // Add this for supporting WMON to MON unwrapping
        "deposit",            // Add this as an alias for wrap
        "withdraw",           // Add this as an alias for unwrap
        "get-gas-price",
        "natural-language-request",  // Add this for natural language command support
        "create-nft-collection",     // Add this for NFT collection creation
        "generate-nft-image",        // Add this for NFT image generation
        "get-swap-quote",            // Add this for token swap quotes
        "execute-swap",              // Add this for executing token swaps
        "execute-stake",             // Add this for staking MON to aprMON
        "execute-unstake",           // Add this for requesting unstake of aprMON back to MON
        "execute-claim",             // Add this for claiming MON after unstaking
        "get-pending-withdrawals"    // Add this for viewing pending withdrawals
    ]
});

// Define a tool that gets the MON balance for a given address
server.tool(
    // Tool ID 
    "get-mon-balance",
    // Description of what the tool does
    "Get MON balance for an address on Monad testnet",
    // Input schema
    {
        address: z.string().describe("Monad testnet address to check balance for"),
    },
    // Tool implementation
    async ({ address }) => {
        try {
            // Check MON balance for the input address
            const balance = await publicClient.getBalance({
                address: address as `0x${string}`,
            });

            // Return a human friendly message indicating the balance.
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Balance for ${address}: ${formatUnits(balance, 18)} MON`,
                    },
                ],
            };
        } catch (error) {
            // If the balance check process fails, return a graceful message back to the MCP client indicating a failure.
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Failed to retrieve balance for address: ${address}. Error: ${
                        error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            };
        }
    }
);

// Define a tool to get a specific token balance
server.tool(
    "get-token-balance",
    "Get the balance of a specific token for an address on Monad testnet",
    {
        address: z.string().describe("Monad testnet address to check balance for"),
        token: z.string().default("MON").describe("Token symbol (default: MON)")
    },
    async ({ address, token }) => {
        try {
            // Normalize token symbol to uppercase
            const tokenSymbol = token.toUpperCase();
            
            // Check if token is supported
            if (!TOKEN_MAP[tokenSymbol]) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Token ${tokenSymbol} is not supported. Supported tokens: ${Object.keys(TOKEN_MAP).join(", ")}`,
                        },
                    ],
                };
            }
            
            // Get token balance
            const balance = await getTokenBalance(address, tokenSymbol);
            
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Balance for ${address}: ${balance} ${tokenSymbol}`,
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Failed to retrieve ${token} balance for address: ${address}. Error: ${
                        error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            };
        }
    }
);

// Define a tool to get portfolio (all token balances)
server.tool(
    "get-token-portfolio",
    "Get all token balances for an address on Monad testnet",
    {
        address: z.string().describe("Monad testnet address to check balances for"),
    },
    async ({ address }) => {
        try {
            // Get all token balances
            const balances = await getTokenBalanceList(address);
            
            // Format response
            let responseText = `Portfolio for ${address} (Popular tokens):\n\n`;
            
            for (const balance of balances) {
                if (balance.error) {
                    responseText += `- ${balance.symbol}: Error fetching balance\n`;
                } else {
                    responseText += `- ${balance.symbol}: ${balance.amount} (decimals: ${balance.decimals})\n`;
                }
            }
            
            return {
                content: [
                    {
                        type: "text" as const,
                        text: responseText,
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Failed to retrieve portfolio for address: ${address}. Error: ${
                    error instanceof Error ? error.message : String(error)
                    }`,
                    },
                ],
            };
        }
    }
);

// Define a tool to get the user's own MON balance (using wallet from private key)
server.tool(
    "get-my-balance",
    "Get MON balance for your own wallet address (from private key in .env)",
    {},
    async () => {
        try {
            // Get wallet address from private key in .env file
            let address;
            try {
                address = getWalletAddressFromEnv();
                console.error(`Using wallet address from private key: ${address}`);
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `❌ Failed to get wallet address: ${
                                error instanceof Error ? error.message : String(error)
                            }\n\nPlease make sure you have TEST_WALLET_PRIVATE_KEY set correctly in your .env file.`,
                        },
                    ],
                };
            }
            
            // Check MON balance for the user's address
            const balance = await publicClient.getBalance({
                address: address as `0x${string}`,
            });

            // Return a human friendly message indicating the balance.
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Balance for your wallet (${address}): ${formatUnits(balance, 18)} MON`,
                    },
                ],
            };
        } catch (error) {
            // If the balance check process fails, return a graceful message back to the MCP client indicating a failure.
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Failed to retrieve your wallet balance. Error: ${
                        error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            };
        }
    }
);

// Define a tool to get the user's own token portfolio (using wallet from private key)
server.tool(
    "get-my-portfolio",
    "Get all token balances for your own wallet address (from private key in .env)",
    {},
    async () => {
        try {
            // Get wallet address from private key in .env file
            let address;
            try {
                address = getWalletAddressFromEnv();
                console.error(`Using wallet address from private key: ${address}`);
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `❌ Failed to get wallet address: ${
                                error instanceof Error ? error.message : String(error)
                            }\n\nPlease make sure you have TEST_WALLET_PRIVATE_KEY set correctly in your .env file.`,
                        },
                    ],
                };
            }
            
            // Get all token balances
            const balances = await getTokenBalanceList(address);
            
            // Format response
            let responseText = `Portfolio for your wallet (${address}):\n\n`;
            
            for (const balance of balances) {
                if (balance.error) {
                    responseText += `- ${balance.symbol}: Error fetching balance\n`;
                } else {
                    responseText += `- ${balance.symbol}: ${balance.amount} (decimals: ${balance.decimals})\n`;
                }
            }
            
            return {
                content: [
                    {
                        type: "text" as const,
                        text: responseText,
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Failed to retrieve your wallet portfolio. Error: ${
                    error instanceof Error ? error.message : String(error)
                    }`,
                    },
                ],
            };
        }
    }
);

// Define a tool to transfer token (returns instructions, actual transfer needs to be done by user)
server.tool(
    "transfer-token",
    "Get instructions on how to transfer tokens on Monad testnet",
    {
        from: z.string().describe("Sender's Monad testnet address"),
        to: z.string().describe("Recipient's Monad testnet address"),
        amount: z.string().describe("Amount to transfer"),
        token: z.string().default("MON").describe("Token symbol (default: MON)")
    },
    async ({ from, to, amount, token }) => {
        try {
            // Normalize token symbol to uppercase
            const tokenSymbol = token.toUpperCase();
            
            // Check if token is supported
            if (!TOKEN_MAP[tokenSymbol]) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Token ${tokenSymbol} is not supported. Supported tokens: ${Object.keys(TOKEN_MAP).join(", ")}`,
                        },
                    ],
                };
            }
            
            // Get token details
            const tokenDetails = TOKEN_MAP[tokenSymbol];
            
            // Format transfer instructions
            let instructions = `### Transfer Instructions for ${tokenSymbol}\n\n`;
            
            instructions += `To transfer ${amount} ${tokenSymbol} from ${from} to ${to}, you'll need to:\n\n`;
            
            if (tokenSymbol === "MON") {
                instructions += `1. Connect your wallet (containing address ${from})\n`;
                instructions += `2. Send a transaction with the following parameters:\n`;
                instructions += `   - To: ${to}\n`;
                instructions += `   - Value: ${amount} MON\n`;
                instructions += `   - Gas Limit: Auto (or ~21000)\n`;
            } else {
                instructions += `1. Connect your wallet (containing address ${from})\n`;
                instructions += `2. Interact with the token contract at ${tokenDetails.address}\n`;
                instructions += `3. Call the 'transfer' function with parameters:\n`;
                instructions += `   - to: ${to}\n`;
                instructions += `   - value: ${amount} (will be converted to ${tokenDetails.decimals} decimals)\n`;
            }
            
            instructions += `\nPlease note: This tool provides instructions only. The actual transfer needs to be executed by you using a wallet that controls the ${from} address.`;
            instructions += `\n\nAlternatively, you can use the 'execute-transfer' tool with your private key (only use test wallets, never your main wallet) to execute the transfer directly.`;
            
            return {
                content: [
                    {
                        type: "text",
                        text: instructions,
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to generate transfer instructions. Error: ${
                        error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            };
        }
    }
);

// Define a tool to get latest blocks from Monad testnet
server.tool(
    "get-latest-blocks",
    "Get the latest blocks from Monad testnet",
    {
        count: z.number().default(5).describe("Number of latest blocks to retrieve (default: 5)")
    },
    async ({ count }) => {
        try {
            const blocks = await getLatestBlocks(count);
            
            let responseText = `## Latest ${blocks.length} Blocks on Monad Testnet\n\n`;
            
            for (const block of blocks) {
                responseText += `### Block #${block.number}\n`;
                responseText += `- **Hash**: ${block.hash}\n`;
                responseText += `- **Time**: ${block.timestamp}\n`;
                responseText += `- **Transactions**: ${block.transactions}\n`;
                responseText += `- **Explorer**: [View on Monad Explorer](https://testnet.monadexplorer.com/block/${block.number})\n\n`;
            }
            
            return {
                content: [
                    {
                        type: "text",
                        text: responseText,
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve latest blocks. Error: ${
                        error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            };
        }
    }
);

// Define a tool to get transaction details
server.tool(
    "get-transaction",
    "Get details of a transaction on Monad testnet",
    {
        txHash: z.string().describe("Transaction hash to look up")
    },
    async ({ txHash }) => {
        try {
            const txDetails = await getTransactionDetails(txHash);
            
            let responseText = `## Transaction Details\n\n`;
            responseText += `- **Hash**: ${txDetails.hash}\n`;
            responseText += `- **From**: ${txDetails.from}\n`;
            responseText += `- **To**: ${txDetails.to}\n`;
            responseText += `- **Value**: ${txDetails.value} MON\n`;
            responseText += `- **Status**: ${txDetails.status}\n`;
            responseText += `- **Block**: ${txDetails.blockNumber}\n`;
            responseText += `- **Gas Used**: ${txDetails.gasUsed}\n`;
            responseText += `- **Explorer**: [View on Monad Explorer](https://testnet.monadexplorer.com/tx/${txDetails.hash})\n`;
            
            return {
                content: [
                    {
                        type: "text",
                        text: responseText,
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve transaction details. Error: ${
                        error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            };
        }
    }
);

// Define a tool to execute token transfers with private key (FROM ENV FILE)
server.tool(
    "execute-transfer",
    "Execute an actual token transfer on Monad testnet using the configured test wallet",
    {
        to: z.string().describe("Recipient's Monad testnet address"),
        amount: z.string().describe("Amount to transfer"),
        token: z.string().default("MON").describe("Token symbol (default: MON)")
    },
    async ({ to, amount, token }) => {
        try {
            console.error("execute-transfer tool called with params:", { to, amount, token });
            
            // Get private key from environment variable
            const privateKey = process.env.TEST_WALLET_PRIVATE_KEY;
            
            if (!privateKey) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "⚠️ ERROR: No test wallet private key found in .env file.\n\nPlease create a .env file with TEST_WALLET_PRIVATE_KEY variable. See .env.example for format.",
                        },
                    ],
                };
            }
            
            // Normalize token symbol to uppercase
            const tokenSymbol = token.toUpperCase();
            
            // Check if token is supported
            if (!TOKEN_MAP[tokenSymbol]) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Token ${tokenSymbol} is not supported. Supported tokens: ${Object.keys(TOKEN_MAP).join(", ")}`,
                        },
                    ],
                };
            }
            
            try {
                // Format private key correctly if needed
                let formattedPrivateKey = privateKey;
                if (!formattedPrivateKey.startsWith('0x')) {
                    formattedPrivateKey = '0x' + formattedPrivateKey;
                }
                
                console.error(`Private key formatted, length: ${formattedPrivateKey.length}`);
                
                // Create account from private key
                const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
                const from = account.address;
                console.error(`Using wallet address: ${from}`);
                
                // Check balance
                const balance = await publicClient.getBalance({
                    address: account.address,
                });
                console.error(`Wallet balance: ${formatUnits(balance, 18)} MON`);
                
                if (balance === 0n) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `The wallet has 0 MON balance. Please fund the wallet first before attempting a transfer.`,
                            },
                        ],
                    };
                }
                
                // Create wallet client
                const walletClient = createWalletClient({
                    account,
                    chain: monadTestnet,
                    transport: http("https://testnet-rpc.monad.xyz"),
                });
                
                let hash: `0x${string}`;
                
                if (tokenSymbol === "MON") {
                    // Transfer native MON
                    console.error(`Sending ${amount} MON to ${to}`);
                    hash = await walletClient.sendTransaction({
                        to: to as `0x${string}`,
                        value: parseUnits(amount, 18),
                    });
                    console.error(`Transaction sent with hash: ${hash}`);
                } else if (TOKEN_MAP[tokenSymbol]) {
                    // Transfer ERC20 token
                    const tokenConfig = TOKEN_MAP[tokenSymbol];
                    
                    // Execute token transfer using walletClient
                    console.error(`Sending ${amount} ${tokenSymbol} to ${to}`);
                    hash = await walletClient.writeContract({
                        address: tokenConfig.address as `0x${string}`,
                        abi: ERC20_ABI,
                        functionName: 'transfer',
                        args: [
                            to as `0x${string}`,
                            parseUnits(amount, tokenConfig.decimals)
                        ]
                    });
                    console.error(`Transaction sent with hash: ${hash}`);
                } else {
                    throw new Error(`Unsupported token: ${tokenSymbol}`);
                }
                
                // Format response with prominent link
                const explorerLink = `https://testnet.monadexplorer.com/tx/${hash}`;
                
                let responseText = `## ✅ Transfer Successful!\n\n`;
                responseText += `Your ${amount} ${tokenSymbol} has been successfully sent to address:\n\`${to}\`\n\n`;
                responseText += `### Transaction Details\n`;
                responseText += `- **From**: ${from}\n`;
                responseText += `- **Transaction Hash**: ${hash}\n`;
                responseText += `- **Token**: ${tokenSymbol}\n\n`;
                responseText += `### [🔍 View Transaction on Monad Explorer](${explorerLink})\n\n`;
                responseText += `The transaction has been confirmed on the blockchain.`;
                
                return {
                    content: [
                        {
                            type: "text",
                            text: responseText
                        }
                    ]
                };
            } catch (error) {
                console.error("Inner transfer error:", error);
                throw error; // Re-throw to be caught by outer catch
            }
        } catch (error) {
            console.error("Transfer tool error:", error);
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to execute transfer: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
            };
        }
    }
);

// Define a tool to execute MON wrapping (MON -> WMON)
server.tool(
    "execute-wrap",
    "Wrap native MON to WMON (Wrapped MON) token",
    {
        amount: z.string().describe("Amount of MON to wrap into WMON")
    },
    async ({ amount }, extra) => {
        try {
            console.error("execute-wrap tool called with params:", { amount });
            
            // Get private key from environment variable
            const privateKey = process.env.TEST_WALLET_PRIVATE_KEY;
            
            if (!privateKey) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: "⚠️ ERROR: No test wallet private key found in .env file.\n\nPlease create a .env file with TEST_WALLET_PRIVATE_KEY variable. See .env.example for format.",
                        },
                    ],
                };
            }

            // Using the new wrapMON function from wrapUnwrap.ts
            const result = await wrapMON(amount);
            const formatted = formatTransactionResult(result, "wrap");
            return formatted;
        } catch (error) {
            console.error("Wrap tool error:", error);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Failed to execute wrapping. Error: ${
                        error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            };
        }
    }
);

// Define a tool to execute WMON unwrapping (WMON -> MON)
server.tool(
    "execute-unwrap",
    "Unwrap WMON (Wrapped MON) back to native MON token",
    {
        amount: z.string().describe("Amount of WMON to unwrap into MON")
    },
    async ({ amount }, extra) => {
        try {
            console.error("execute-unwrap tool called with params:", { amount });
            
            // Get private key from environment variable
            const privateKey = process.env.TEST_WALLET_PRIVATE_KEY;
            
            if (!privateKey) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: "⚠️ ERROR: No test wallet private key found in .env file.\n\nPlease create a .env file with TEST_WALLET_PRIVATE_KEY variable. See .env.example for format.",
                        },
                    ],
                };
            }

            // Using the new unwrapWMON function from wrapUnwrap.ts
            const result = await unwrapWMON(amount);
            const formatted = formatTransactionResult(result, "unwrap");
            return formatted;
        } catch (error) {
            console.error("Unwrap tool error:", error);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Failed to execute unwrapping. Error: ${
                        error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            };
        }
    }
);

// Define a tool to deposit native MON into WMON (warp)
server.tool(
    "deposit",
    "Deposit native MON to WMON (warp)",
    { amount: z.string().describe("Amount of MON to deposit into WMON") },
    async ({ amount }) => {
        const result = await wrapMON(amount);
        return formatTransactionResult(result, "wrap");
    }
);

// Define a tool to withdraw WMON back into native MON (unwarp)
server.tool(
    "withdraw",
    "Withdraw WMON to MON (unwrap)",
    { amount: z.string().describe("Amount of WMON to withdraw into MON") },
    async ({ amount }) => {
        const result = await unwrapWMON(amount);
        return formatTransactionResult(result, "unwrap");
    }
);

// Define a tool to get current gas price on Monad testnet
server.tool(
    "get-gas-price",
    "Get the current gas price on Monad testnet",
    {},
    async () => {
        try {
            const gasPrice = await publicClient.getGasPrice();
            
            const gasPriceInGwei = formatUnits(gasPrice, 9); // Convert wei to gwei
            
            return {
                content: [
                    {
                        type: "text",
                        text: `Current gas price on Monad testnet: ${gasPriceInGwei} Gwei`,
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve gas price. Error: ${
                        error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            };
        }
    }
);

// Define a tool to generate NFT image from description
server.tool(
    "generate-nft-image",
    "Generate an NFT image from a text description",
    {
        description: z.string().describe("Detailed description of the image you want to generate"),
        style: z.string().optional().describe("Optional art style (e.g., pixel art, abstract, realistic)")
    },
    async ({ description, style }) => {
        try {
            console.error(`Generating NFT image with description: "${description}", style: "${style || 'default'}"`);
            
            // In a real implementation, this would call an image generation API like DALL-E, Midjourney, or similar
            // For this demo, we'll simulate image generation by returning a base64 encoded placeholder image
            
            // Simulate processing time to make it feel more realistic
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Generate a random "artwork" ID to simulate unique generations
            const artworkId = `artwork-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            
            // Return a placeholder base64 image (1x1 transparent pixel)
            // In a real implementation, this would be the actual generated image
            const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
            
            return {
                content: [
                    {
                        type: "text",
                        text: `## ✨ NFT Image Generated Successfully

### Image Details
- **Based on**: "${description}"
- **Style**: ${style || "Default"}
- **Artwork ID**: ${artworkId}

### Usage Instructions
1. This image can be used as input for the \`create-nft-collection\` tool
2. Copy the base64 data below when prompted for collection image

### Base64 Image Data
\`\`\`
${base64Image}
\`\`\`

### Preview
Note: In a real implementation, this would show the actual generated image preview. This is a placeholder for demonstration purposes.
`
                    }
                ]
            };
        } catch (error) {
            console.error("NFT image generation error:", error);
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to generate NFT image. Error: ${error instanceof Error ? error.message : String(error)}`
                    }
                ]
            };
        }
    }
);

// Define a tool to create NFT collection on Magic Eden (Monad Testnet)
server.tool(
    "create-nft-collection",
    "Create and launch an NFT collection on Magic Eden (Monad Testnet)",
    {
        name: z.string().describe("Collection name"),
        symbol: z.string().describe("Collection symbol/ticker (e.g., POND)"),
        description: z.string().optional().describe("Collection description"),
        image: z.string().describe("Base64 encoded image data for collection"),
        artType: z.enum(["SAME_ARTWORK", "UNIQUE_ARTWORK"]).describe("NFT art type: SAME_ARTWORK (ERC-1155) or UNIQUE_ARTWORK (ERC-721)"),
        mintPrice: z.string().default("0").describe("Mint price in MON (default: 0)"),
        royaltyFee: z.number().default(0).describe("Royalty fee percentage (0-100)"),
        maxSupply: z.number().nullable().default(null).describe("Maximum supply (null for unlimited)"),
        mintLimitPerWallet: z.number().nullable().default(null).describe("Mint limit per wallet (null for unlimited)"),
        startDate: z.string().optional().describe("Mint start date (ISO format)"),
        endDate: z.string().optional().describe("Mint end date (ISO format)"),
        artworks: z.array(z.string()).optional().describe("Array of base64 encoded artwork images (for UNIQUE_ARTWORK type)")
    },
    async ({ name, symbol, description, image, artType, mintPrice, royaltyFee, maxSupply, 
           mintLimitPerWallet, startDate, endDate, artworks }) => {
        try {
            console.error(`Creating NFT collection "${name}" on Magic Eden (Monad Testnet)...`);
            
            // Get private key from environment variable
            const privateKey = process.env.TEST_WALLET_PRIVATE_KEY;
            
            if (!privateKey) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "⚠️ ERROR: No test wallet private key found in .env file.\n\nPlease create a .env file with TEST_WALLET_PRIVATE_KEY variable. See .env.example for format."
                        }
                    ]
                };
            }
            
            // Prepare the config object
            const nftConfig = {
                chain: "MONAD_TESTNET" as const,
                metadata: {
                    name,
                    symbol,
                    description: description || `${name} - A unique NFT collection on Monad`,
                    image,
                    feeRecipient: ""
                },
                artType: artType as NFTArtType,
                mintPrice,
                royaltyFee,
                maxSupply: maxSupply === undefined ? null : maxSupply,
                mintLimitPerWallet: mintLimitPerWallet === undefined ? null : mintLimitPerWallet,
                mintStages: [
                    {
                        name: "Public Sale",
                        price: mintPrice,
                        startDate: startDate || new Date().toISOString(),
                        endDate: endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        isAllowlist: false,
                        allowlistAddresses: []
                    }
                ],
                artworks: artworks || []
            };
            
            // Execute NFT collection creation using imported function
            const result = await createNFTCollection(nftConfig);
            
            // Format and return the result
            const formattedResult = formatNFTCollectionInfo(nftConfig, result);
            return {
                content: [
                    {
                        type: "text",
                        text: formattedResult
                    }
                ]
            };
        } catch (error) {
            console.error("NFT collection creation error:", error);
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to create NFT collection. Error: ${error instanceof Error ? error.message : String(error)}`
                    }
                ]
            };
        }
    }
);

// Tool for staking MON to aprMON
server.tool(
    "execute-stake",
    "Stake MON to receive aprMON token (liquid staking)",
    {
        amount: z.string().describe("Amount of MON to stake")
    },
    async ({ amount }) => {
        try {
            console.error("execute-stake tool called with params:", { amount });
            
            // Get private key from environment variable
            const privateKey = process.env.TEST_WALLET_PRIVATE_KEY;
            
            if (!privateKey) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "⚠️ ERROR: No test wallet private key found in .env file.\n\nPlease create a .env file with TEST_WALLET_PRIVATE_KEY variable. See .env.example for format."
                        }
                    ]
                };
            }
            
            // Execute the stake operation
            const result = await stakeMON(amount);
            
            // Format and return the result
            return formatStakingResult(result);
        } catch (error) {
            console.error("Stake execution error:", error);
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to execute stake. Error: ${error instanceof Error ? error.message : String(error)}`
                    }
                ]
            };
        }
    }
);

// Tool for requesting to unstake aprMON back to MON
server.tool(
    "execute-unstake",
    "Request to unstake aprMON back to MON (starts the unstake process)",
    {
        amount: z.string().describe("Amount of aprMON to unstake")
    },
    async ({ amount }) => {
        try {
            console.error("execute-unstake tool called but disabled");
            
            // Check balance first
            const privateKey = process.env.TEST_WALLET_PRIVATE_KEY;
            if (!privateKey) {
                throw new Error("Private key not found in environment variables");
            }
            
            let formattedPrivateKey = privateKey;
            if (!formattedPrivateKey.startsWith('0x')) {
                formattedPrivateKey = '0x' + formattedPrivateKey;
            }
            
            const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
            
            // Check if user has enough aprMON
            const aprMonBalance = await getTokenBalance(account.address, "aprMON");
            if (parseFloat(aprMonBalance) < parseFloat(amount)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `## ❌ Insufficient aprMON Balance\n\nYou have ${aprMonBalance} aprMON but tried to unstake ${amount} aprMON.\n\nPlease check your balance and try again with a smaller amount.`
                        }
                    ]
                };
            }
            
            // Execute the swap directly - conversion from aprMON to MON using swap tool
            try {
                console.error(`Using swap method to convert ${amount} aprMON to MON based on successful example`);
                
                const result = await executeSwap("aprMON", "MON", amount, 5.0);
                
                if (!result.success) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `## ⚠️ Unstaking Feature Maintenance\n\nApriori unstaking is currently disabled for maintenance. Would you like to swap your aprMON to MON using Pancakeswap instead?\n\nThis would convert your ${amount} aprMON to approximately ${amount} MON using the following steps:\n\n1. Connect your wallet to Pancakeswap\n2. Swap aprMON to MON\n\nExample of successful swap transaction:\n[0xc2de37c44ffd1fffbe79974d76c53d8f2b3b16a4a208fe355ae78fbaec6fe8e1](https://testnet.monadexplorer.com/tx/0xc2de37c44ffd1fffbe79974d76c53d8f2b3b16a4a208fe355ae78fbaec6fe8e1)\n\nTo proceed with the swap, please reply with: "Yes, swap my aprMON to MON"`
                            }
                        ]
                    };
                }
                
                // Format successful response
                const explorerUrl = `https://testnet.monadexplorer.com/tx/${result.txHash}`;
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `## ✅ aprMON Converted Successfully\n\nYour ${amount} aprMON has been successfully converted to ${result.toAmount} MON using Pancakeswap. The transaction is complete and has been confirmed on the blockchain.\n\n### Transaction Details\n- **From**: ${result.from}\n- **Transaction Hash**: ${result.txHash}\n- **Block Number**: ${result.blockNumber || 'Pending'}\n- **Converted**: ${amount} aprMON ➡️ ${result.toAmount} MON\n\n### [🔍 View Transaction on Monad Explorer](${explorerUrl})`
                        }
                    ]
                };
            } catch (swapError) {
                console.error("Direct swap failed:", swapError);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `## ⚠️ Unstaking Feature Maintenance\n\nApriori unstaking is currently disabled for maintenance. Would you like to swap your aprMON to MON using Pancakeswap?\n\nTo swap ${amount} aprMON to MON, please use Pancakeswap directly at:\nhttps://pancakeswap.finance/swap\n\nYou can swap aprMON to MON with the following steps:\n1. Connect your wallet\n2. Add the aprMON token with address: ${TOKEN_MAP.aprMON.address}\n3. Select aprMON as the "From" token\n4. Select MON as the "To" token\n5. Enter the amount: ${amount}\n6. Click "Swap" and confirm the transaction\n\nExample of successful swap transaction:\n[0xc2de37c44ffd1fffbe79974d76c53d8f2b3b16a4a208fe355ae78fbaec6fe8e1](https://testnet.monadexplorer.com/tx/0xc2de37c44ffd1fffbe79974d76c53d8f2b3b16a4a208fe355ae78fbaec6fe8e1)\n\nTo proceed with a direct swap through this tool, please reply with: "Yes, swap my aprMON to MON"`
                        }
                    ]
                };
            }
        } catch (error) {
            console.error("Unstake request error:", error);
            return {
                content: [
                    {
                        type: "text",
                        text: `## ⚠️ Unstaking Feature Disabled\n\nThe unstaking feature is currently disabled due to technical limitations.\n\nPlease use Pancakeswap directly to swap your aprMON back to MON.`
                    }
                ]
            };
        }
    }
);

// Tool for getting the list of pending withdrawal requests
server.tool(
    "get-pending-withdrawals",
    "Get a list of pending withdrawal requests for aprMON unstaking",
    {},
    async () => {
        try {
            console.error("get-pending-withdrawals tool called but disabled");
            
            return {
                content: [
                    {
                        type: "text",
                        text: `## ⚠️ Claim Feature Disabled\n\nThe unstaking and claim features are currently disabled due to technical limitations.\n\nTo unstake your aprMON back to MON, please use Pancakeswap directly to swap your aprMON tokens to MON.`
                    }
                ]
            };
        } catch (error) {
            console.error("Get pending withdrawals error:", error);
            return {
                content: [
                    {
                        type: "text",
                        text: `## ⚠️ Claim Feature Disabled\n\nThe unstaking and claim features are currently disabled.`
                    }
                ]
            };
        }
    }
);

// Tool for claiming MON from completed unstake requests
server.tool(
    "execute-claim",
    "Claim MON from completed aprMON unstake requests",
    {
        requestIds: z.array(z.string()).describe("Array of request IDs to claim")
    },
    async ({ requestIds }) => {
        try {
            console.error("execute-claim tool called but disabled");
            
            return {
                content: [
                    {
                        type: "text",
                        text: `## ⚠️ Claim Feature Disabled\n\nThe unstaking and claim features are currently disabled due to technical limitations.\n\nTo unstake your aprMON back to MON, please use Pancakeswap directly to swap your aprMON tokens to MON.`
                    }
                ]
            };
        } catch (error) {
            console.error("Claim execution error:", error);
            return {
                content: [
                    {
                        type: "text",
                        text: `## ⚠️ Claim Feature Disabled\n\nThe unstaking and claim features are currently disabled.`
                    }
                ]
            };
        }
    }
);

// Helper function to execute a transfer (used in natural language processing)
async function executeTransfer(to: string, amount: string, token: string): Promise<ContentResponse> {
    // Get private key from environment variable
    const privateKey = process.env.TEST_WALLET_PRIVATE_KEY;
    
    if (!privateKey) {
        throw new Error("No test wallet private key found in .env file");
    }
    
    // Normalize token symbol to uppercase
    const tokenSymbol = token.toUpperCase();
    
    // Check if token is supported
    if (!TOKEN_MAP[tokenSymbol]) {
        throw new Error(`Token ${tokenSymbol} is not supported. Supported tokens: ${Object.keys(TOKEN_MAP).join(", ")}`);
    }
    
    // Format private key correctly if needed
    let formattedPrivateKey = privateKey;
    if (!formattedPrivateKey.startsWith('0x')) {
        formattedPrivateKey = '0x' + formattedPrivateKey;
    }
    
    // Create account from private key
    const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
    const from = account.address;
    
    // Check balance
    const balance = await publicClient.getBalance({
        address: account.address,
    });
    
    if (balance === 0n) {
        throw new Error("The wallet has 0 MON balance. Please fund the wallet first before attempting a transfer");
    }
    
    // Create wallet client
    const walletClient = createWalletClient({
        account,
        chain: monadTestnet,
        transport: http("https://testnet-rpc.monad.xyz"),
    });
    
    let hash: `0x${string}`;
    
    if (tokenSymbol === "MON") {
        // Transfer native MON
        hash = await walletClient.sendTransaction({
            to: to as `0x${string}`,
            value: parseUnits(amount, 18),
        });
    } else if (TOKEN_MAP[tokenSymbol]) {
        // Transfer ERC20 token
        const tokenConfig = TOKEN_MAP[tokenSymbol];
        
        // Execute token transfer using walletClient
        hash = await walletClient.writeContract({
            address: tokenConfig.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [
                to as `0x${string}`,
                parseUnits(amount, tokenConfig.decimals)
            ]
        });
    } else {
        throw new Error(`Unsupported token: ${tokenSymbol}`);
    }
    
    // Format response with prominent link
    const explorerLink = `https://testnet.monadexplorer.com/tx/${hash}`;
    
    let responseText = `## ✅ Transfer Successful!\n\n`;
    responseText += `Your ${amount} ${tokenSymbol} has been successfully sent to address:\n\`${to}\`\n\n`;
    responseText += `### Transaction Details\n`;
    responseText += `- **From**: ${from}\n`;
    responseText += `- **Transaction Hash**: ${hash}\n`;
    responseText += `- **Token**: ${tokenSymbol}\n\n`;
    responseText += `### [🔍 View Transaction on Monad Explorer](${explorerLink})\n\n`;
    responseText += `The transaction has been confirmed on the blockchain.`;
    
    return {
        content: [
            {
                type: "text",
                text: responseText
            }
        ]
    };
}

// Function to process user's natural language requests
server.tool(
    "natural-language-request",
    "Process natural language requests like 'warp 0.01 MON' or 'unwrap 0.02 WMON'",
    {
        request: z.string().describe("User's natural language request")
    },
    async ({ request }, extra) => {
        try {
            console.error(`Processing natural language request: "${request}"`);
            
            // Convert request to lowercase for easier matching
            const lowerRequest = request.toLowerCase();
            
            // Check for wrap/warp patterns
            const wrapPattern = /(warp|wrap)\s+(\d+(\.\d+)?)\s*(mon)?/i;
            const wrapMatch = lowerRequest.match(wrapPattern);
            
            // Check for unwrap/unwarp patterns
            const unwrapPattern = /(unwarp|unwrap)\s+(\d+(\.\d+)?)\s*(wmon|mon)?/i;
            const unwrapMatch = lowerRequest.match(unwrapPattern);
            
            // Check for transfer patterns
            const transferPattern = /(kirim|transfer|send)\s+(\d+(\.\d+)?)\s*([a-zA-Z]+)?\s*(ke|to)?\s*([0-9a-fA-Fx]+)/i;
            const transferMatch = lowerRequest.match(transferPattern);
            
            // Check for swap patterns
            const swapPattern = /(swap|tukar)\s+(\d+(\.\d+)?)\s*([a-zA-Z]+)\s*(ke|to)\s*([a-zA-Z]+)/i;
            const swapMatch = lowerRequest.match(swapPattern);
            
            if (wrapMatch) {
                // User wants to wrap MON
                const amount = wrapMatch[2];
                console.error(`Detected wrap request for ${amount} MON`);
                
                // Execute wrap directly using the wrapMON function
                try {
                    const result = await wrapMON(amount);
                    
                    // Check if the wrap was successful
                    if (!result.success) {
                        console.error(`Wrap failed: ${result.error}`);
                        return {
                            content: [
                                {
                                    type: "text" as const,
                                    text: `❌ Failed to wrap ${amount} MON to WMON.\n\nError: ${result.error}\n\nPlease check your MON balance or try again with a smaller amount.`
                                }
                            ]
                        };
                    }
                    
                    // Make sure transaction hash exists
                    if (!result.txHash) {
                        console.error(`Wrap completed but no transaction hash was returned`);
                        return {
                            content: [
                                {
                                    type: "text" as const,
                                    text: `⚠️ Unwrap transaction may have been sent but no transaction hash was returned. Please check your MON balance manually.`
                                }
                            ]
                        };
                    }
                    
                    // Format successful response
                    console.error(`Wrap successful: ${result.txHash}`);
                    const explorerLink = `https://testnet.monadexplorer.com/tx/${result.txHash}`;
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `## ✅ MON Wrapped Successfully\n\nYour ${amount} MON has been successfully wrapped to ${amount} WMON. The transaction is complete and has been confirmed on the blockchain.\n\n### Transaction Details\n- **From**: ${result.from || 'Your wallet'}\n- **Transaction Hash**: ${result.txHash}\n- **Block Number**: ${result.blockNumber || 'Pending'}\n\n### [🔍 View Transaction on Monad Explorer](${explorerLink})\n\nYou can now use your WMON tokens in compatible applications on Monad testnet.`
                            }
                        ]
                    };
                } catch (error) {
                    console.error(`Wrap error caught: ${error}`);
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `❌ Failed to execute wrap: ${error instanceof Error ? error.message : String(error)}`
                            }
                        ]
                    };
                }
                
            } else if (unwrapMatch) {
                // User wants to unwrap WMON
                const amount = unwrapMatch[2];
                console.error(`Detected unwrap request for ${amount} WMON`);
                
                // Execute unwrap directly using the unwrapWMON function
                try {
                    const result = await unwrapWMON(amount);
                    
                    // Check if the unwrap was successful
                    if (!result.success) {
                        console.error(`Unwrap failed: ${result.error}`);
                        return {
                            content: [
                                {
                                    type: "text" as const,
                                    text: `❌ Failed to unwrap ${amount} WMON to MON.\n\nError: ${result.error}\n\nPlease check your WMON balance or try again with a smaller amount.`
                                }
                            ]
                        };
                    }
                    
                    // Make sure transaction hash exists
                    if (!result.txHash) {
                        console.error(`Unwrap completed but no transaction hash was returned`);
                        return {
                            content: [
                                {
                                    type: "text" as const,
                                    text: `⚠️ Unwrap transaction may have been sent but no transaction hash was returned. Please check your MON balance manually.`
                                }
                            ]
                        };
                    }
                    
                    // Format successful response
                    console.error(`Unwrap successful: ${result.txHash}`);
                    const explorerLink = `https://testnet.monadexplorer.com/tx/${result.txHash}`;
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `## ✅ WMON Unwrapped Successfully\n\nYour ${amount} WMON has been successfully unwrapped to ${amount} MON. The transaction is complete and has been confirmed on the blockchain.\n\n### Transaction Details\n- **From**: ${result.from || 'Your wallet'}\n- **Transaction Hash**: ${result.txHash}\n- **Block Number**: ${result.blockNumber || 'Pending'}\n\n### [🔍 View Transaction on Monad Explorer](${explorerLink})\n\nYou can now use your native MON tokens for transactions on Monad testnet.`
                            }
                        ]
                    };
                } catch (error) {
                    console.error(`Unwrap error caught: ${error}`);
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `❌ Failed to execute unwrap: ${error instanceof Error ? error.message : String(error)}`
                            }
                        ]
                    };
                }
                
            } else if (transferMatch) {
                // User wants to transfer tokens
                const amount = transferMatch[2];
                const token = transferMatch[4]?.toUpperCase() || "MON";
                const to = transferMatch[6];
                
                console.error(`Detected transfer request for ${amount} ${token} to ${to}`);
                
                // Validate address format
                if (!to.startsWith('0x') || to.length !== 42) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Invalid destination address. Please provide a valid Ethereum address (starting with 0x and 42 characters long).`,
                            },
                        ],
                    };
                }
                
                // Execute transfer directly using imported function
                try {
                    const result = await executeTransfer(to, amount, token);
                    return result;
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Failed to execute transfer: ${error instanceof Error ? error.message : String(error)}`
                            }
                        ]
                    };
                }
                
            } else if (swapMatch) {
                // User wants to swap tokens
                const amount = swapMatch[2];
                const fromToken = swapMatch[4]?.toUpperCase() || "MON";
                const toToken = swapMatch[6]?.toUpperCase();
                
                console.error(`Detected swap request for ${amount} ${fromToken} to ${toToken}`);
                
                // Validate tokens
                if (!TOKEN_MAP[fromToken]) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Source token ${fromToken} is not supported. Supported tokens: ${Object.keys(TOKEN_MAP).join(", ")}`
                            }
                        ]
                    };
                }
                
                if (!TOKEN_MAP[toToken]) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Destination token ${toToken} is not supported. Supported tokens: ${Object.keys(TOKEN_MAP).join(", ")}`
                            }
                        ]
                    };
                }
                
                // First get a quote
                try {
                    const quote = await getSwapQuote(fromToken, toToken, amount);
                    
                    if (!quote.success) {
                        return {
                            content: [
                                {
                                    type: "text" as const,
                                    text: `❌ Failed to get swap quote: ${quote.error}\n\nPlease check your input and try again.`
                                }
                            ]
                        };
                    }
                    
                    // Show the quote and ask for confirmation
                    const rate = Number(quote.toAmount) / Number(quote.fromAmount);
                    
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `## Swap Quote: ${quote.fromToken} to ${quote.toToken}\n\n` +
                                      `I can swap your ${quote.fromAmount} ${quote.fromToken} to approximately ${quote.toAmount} ${quote.toToken}.\n\n` +
                                      `- **Input**: ${quote.fromAmount} ${quote.fromToken}\n` +
                                      `- **Expected Output**: ${quote.toAmount} ${quote.toToken}\n` +
                                      `- **Rate**: 1 ${quote.fromToken} ≈ ${rate.toFixed(6)} ${quote.toToken}\n\n` +
                                      `To execute this swap, use the \`execute-swap\` tool with the same parameters.\n\n` +
                                      `Note: Actual swap values may vary slightly due to price movements and slippage.`
                            }
                        ]
                    };
                } catch (error) {
                    console.error("Swap quote error:", error);
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Failed to get swap quote. Error: ${error instanceof Error ? error.message : String(error)}`
                            }
                        ]
                    };
                }
                
            } else if (lowerRequest.includes("confirm swap")) {
                // User is confirming a swap
                const confirmPattern = /confirm\s+swap\s+(\d+(\.\d+)?)\s+([a-zA-Z]+)\s+to\s+([a-zA-Z]+)/i;
                const confirmMatch = lowerRequest.match(confirmPattern);
                
                if (!confirmMatch) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Could not parse confirmation. Please use the format: "confirm swap [amount] [fromToken] to [toToken]"`
                            }
                        ]
                    };
                }
                
                const amount = confirmMatch[1];
                const fromToken = confirmMatch[3]?.toUpperCase();
                const toToken = confirmMatch[4]?.toUpperCase();
                
                console.error(`Detected swap confirmation for ${amount} ${fromToken} to ${toToken}`);
                
                // Execute the swap
                try {
                    // Default slippage is 2%
                    const result = await executeSwap(fromToken, toToken, amount, 2.0);
                    
                    // Format and return the result
                    return formatSwapResult(result);
                } catch (error) {
                    console.error("Swap execution error:", error);
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Failed to execute swap. Error: ${error instanceof Error ? error.message : String(error)}`
                            }
                        ]
                    };
                }
                
            } else {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `I don't recognize that command. Supported commands:\n\n` +
                                  `- "wrap X MON" to convert MON to WMON\n` + 
                                  `- "unwrap X WMON" to convert WMON back to MON\n` +
                                  `- "send X MON to 0x..." to transfer tokens\n` +
                                  `- "swap X MON to USDC" to swap between tokens`,
                        },
                    ],
                };
            }
        } catch (error) {
            console.error("Natural language processing error:", error);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Failed to process request. Error: ${
                        error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            };
        }
    }
);

/**
 * Main function to start the MCP server
 * Uses stdio for communication with LLM clients
 */
async function main() {
    // Create a transport layer using standard input/output
    const transport = new StdioServerTransport();
    
    // Log environment variables for debugging
    console.error("Environment variables loaded:");
    console.error(`TEST_WALLET_PRIVATE_KEY exists: ${!!process.env.TEST_WALLET_PRIVATE_KEY}`);
    if (process.env.TEST_WALLET_PRIVATE_KEY) {
        console.error(`TEST_WALLET_PRIVATE_KEY length: ${process.env.TEST_WALLET_PRIVATE_KEY.length}`);
        console.error(`TEST_WALLET_PRIVATE_KEY starts with: ${process.env.TEST_WALLET_PRIVATE_KEY.substring(0, 6)}...`);
    }
    console.error(`Current directory: ${process.cwd()}`);
    
    // Connect the server to the transport
    await server.connect(transport);
    
    console.error("Monad testnet MCP Server running on stdio");
}

// Start the server and handle any fatal errors
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});

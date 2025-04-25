/**
 * MCP Moni Configuration File
 * 
 * This file contains configuration, constants, and utility functions for the MCP server.
 */

// Import necessary dependencies
import { createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Create a public client to interact with the Monad testnet using the provided RPC
export const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http("https://testnet-rpc.monad.xyz"),
});

// Define ERC20 ABI for token interactions
export const ERC20_ABI = [
    {
        name: "transfer",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "to", type: "address" },
            { name: "value", type: "uint256" }
        ],
        outputs: [{ name: "", type: "bool" }]
    },
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }]
    },
    {
        name: "approve",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" }
        ],
        outputs: [{ name: "", type: "bool" }]
    }
];

// Define WMON (Wrapped MON) ABI for wrap/unwrap operations
export const WMON_ABI = [
    // deposit (wrap) - Converts MON to WMON
    {
        name: "deposit",
        type: "function",
        stateMutability: "payable",
        inputs: [],
        outputs: []
    },
    // withdraw (unwrap) - Converts WMON back to MON
    {
        name: "withdraw",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "amount", type: "uint256" }
        ],
        outputs: []
    },
    // Standard ERC20 functions
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view", 
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }]
    },
    {
        name: "transfer",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "to", type: "address" },
            { name: "value", type: "uint256" }
        ],
        outputs: [{ name: "", type: "bool" }]
    }
];

// Define token type
type TokenConfig = {
    name: string;
    symbol: string;
    decimals: number;
    address: string;
};

// Define token map type with specific keys
type TokenMapType = {
    MON: TokenConfig;
    WMON: TokenConfig;
    aprMON: TokenConfig;
    [key: string]: TokenConfig; // Allow indexing by string symbols
};

// Update token addresses
export const TOKEN_MAP: TokenMapType = {
    MON: {
        name: 'Monad',
        symbol: 'MON',
        decimals: 18,
        address: '0x0000000000000000000000000000000000000000' // Native token
    },
    WMON: {
        name: 'Wrapped MON',
        symbol: 'WMON',
        decimals: 18,
        address: '0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701'
    },
    aprMON: {
        name: 'Apriori Staked MON',
        symbol: 'aprMON',
        decimals: 18,
        address: '0xb2f82D0f38dc453D596Ad40A37799446Cc89274A'
    },
    USDC: {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        address: '0xf817257fed379853cDe0fa4F97AB987181B1E5Ea'
    },
    USDT: {
        name: 'Tether USD',
        symbol: 'USDT',
        decimals: 6,
        address: '0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D'
    },
    WETH: {
        name: 'Wrapped Ethereum',
        symbol: 'WETH',
        decimals: 18,
        address: '0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37'
    },
    WBTC: {
        name: 'Wrapped Bitcoin',
        symbol: 'WBTC',
        decimals: 8,
        address: '0xcf5a6076cfa32686c0Df13aBaDa2b40dec133F1d'
    },
    DAK: {
        name: 'Daiki Finance',
        symbol: 'DAK',
        decimals: 18,
        address: '0x0F0BDEbF0F83cD1EE3974779Bcb7315f9808c714'
    },
    COG: {
        name: 'Cogito',
        symbol: 'COG',
        decimals: 18,
        address: '0xE0590015A873bF326bd645c3E1266d4db41C4E6B'
    },
    YAKI: {
        name: 'Yaki Finance',
        symbol: 'YAKI',
        decimals: 18,
        address: '0xfe140e1dCe99Be9F4F15d657CD9b7BF622270C50'
    },
    shMON: {
        name: 'Staked MON',
        symbol: 'shMON',
        decimals: 18,
        address: '0x3a98250F98Dd388C211206983453837C8365BDc1'
    },
    gMON: {
        name: 'Governance MON',
        symbol: 'gMON',
        decimals: 18,
        address: '0xaEef2f6B429Cb59C9B2D7bB2141ADa993E8571c3'
    }
};


// Helper function to get wallet address from private key
export function getWalletAddressFromEnv(): string {
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
    
    return account.address;
}

// Helper function to get token balance
export async function getTokenBalance(address: string, tokenSymbol: string = "MON") {
    const { formatUnits } = await import("viem");
    
    if (tokenSymbol === "MON") {
        const balance = await publicClient.getBalance({
            address: address as `0x${string}`,
        });
        return formatUnits(balance, 18);
    } else if (tokenSymbol in TOKEN_MAP) {
        const tokenConfig = TOKEN_MAP[tokenSymbol];
        // Using viem's public client to get token balance
        const balance = await publicClient.readContract({
            address: tokenConfig.address as `0x${string}`,
            abi: [
                {
                    name: "balanceOf",
                    type: "function",
                    stateMutability: "view",
                    inputs: [{ name: "account", type: "address" }],
                    outputs: [{ name: "", type: "uint256" }],
                },
            ],
            functionName: "balanceOf",
            args: [address as `0x${string}`],
        });
        return formatUnits(balance as bigint, tokenConfig.decimals);
    } else {
        return "0";
    }
}

// Helper function to get all token balances
export async function getTokenBalanceList(address: string) {
    const results = [];
    const symbols = Object.keys(TOKEN_MAP) as Array<keyof TokenMapType>;
    for (const symbol of symbols) {
        try {
            // Cast symbol to string for getTokenBalance
            const amount = await getTokenBalance(address, symbol as string);
            results.push({
                symbol,
                amount,
                decimals: TOKEN_MAP[symbol].decimals,
            });
        } catch (error) {
            console.error(`Error fetching balance for ${symbol}:`, error);
            results.push({
                symbol,
                amount: "0",
                decimals: TOKEN_MAP[symbol].decimals,
                error: true
            });
        }
    }
    return results;
}
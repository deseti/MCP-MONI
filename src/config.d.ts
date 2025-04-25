// Type definitions for local config module
// This helps TypeScript recognize the module when imported in other files

import { createPublicClient } from "viem";

// Define the ERC20 ABI type
export const ERC20_ABI: readonly any[];

// Define the WMON ABI type
export const WMON_ABI: readonly any[];

// Define the TOKEN_MAP type
export const TOKEN_MAP: Record<string, { address: string, decimals: number }>;

// Define the publicClient type
export const publicClient: ReturnType<typeof createPublicClient>;

// Define the getTokenBalance function type
export function getTokenBalance(address: string, tokenSymbol?: string): Promise<string>;

// Define the getTokenBalanceList function type
export function getTokenBalanceList(address: string): Promise<Array<{
  symbol: string;
  amount: string;
  decimals: number;
  error?: boolean;
}>>;
/**
 * MCP Moni Utilities
 * 
 * This file contains common utility functions used by the MCP server.
 */

import { publicClient } from "./config";
import { formatUnits } from "viem";

// Helper function to get latest blocks from Monad testnet
export async function getLatestBlocks(count: number = 5) {
    const latestBlock = await publicClient.getBlockNumber();
    const blocks = [];

    for (let i = 0; i < count; i++) {
        if (latestBlock - BigInt(i) < 0n) break;
        
        try {
            const block = await publicClient.getBlock({
                blockNumber: latestBlock - BigInt(i)
            });
            
            blocks.push({
                number: Number(block.number),
                hash: block.hash,
                timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
                transactions: block.transactions.length
            });
        } catch (error) {
            console.error(`Error fetching block ${latestBlock - BigInt(i)}:`, error);
        }
    }
    
    return blocks;
}

// Helper function to get transaction details
export async function getTransactionDetails(txHash: string) {
    try {
        const tx = await publicClient.getTransaction({
            hash: txHash as `0x${string}`
        });
        
        const receipt = await publicClient.getTransactionReceipt({
            hash: txHash as `0x${string}`
        });
        
        return {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: formatUnits(tx.value, 18),
            gas: Number(tx.gas),
            status: receipt.status === 'success' ? 'Success' : 'Failed',
            blockNumber: Number(receipt.blockNumber),
            blockHash: receipt.blockHash,
            gasUsed: Number(receipt.gasUsed)
        };
    } catch (error) {
        console.error(`Error fetching transaction ${txHash}:`, error);
        throw new Error(`Failed to fetch transaction: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * NFT Utilities
 * 
 * Utility functions for NFT creation and management on Monad Testnet
 */

import { formatUnits, parseUnits } from "viem";
import { ImageUploadResult } from "./types";

/**
 * Convert base64 image to file data for upload
 * @param base64Data Base64 encoded image
 * @param filename Filename to use
 * @returns File object
 */
export function base64ToFile(base64Data: string, filename: string): File {
  // Remove data URL prefix if present
  const base64Content = base64Data.includes('base64,') 
    ? base64Data.split('base64,')[1] 
    : base64Data;
  
  // Determine MIME type from base64 data
  let mimeType = 'image/png'; // Default
  if (base64Data.includes('data:')) {
    const matches = base64Data.match(/data:([^;]+);/);
    if (matches && matches.length > 1) {
      mimeType = matches[1];
    }
  }
  
  // Decode base64 to binary
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Create Blob and File
  const blob = new Blob([bytes], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

/**
 * Upload image to storage (simulated for testnet)
 * @param imageData Base64 image data or file
 * @param filename Filename to save as
 * @returns Result with URL or error
 */
export async function uploadImage(imageData: string | File, filename: string): Promise<ImageUploadResult> {
  try {
    console.error(`Simulating upload of ${filename} to IPFS...`);
    
    // In a real implementation, this would upload to IPFS or another decentralized storage
    // For this demo, we'll simulate the upload
    
    // Wait for a simulated amount of time to make it feel more realistic
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate a "hash" for the simulated IPFS
    const hash = `bafkrei${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    const url = `https://ipfs.io/ipfs/${hash}`;
    
    console.error(`Image "${filename}" uploaded successfully to ${url}`);
    
    return {
      success: true,
      url
    };
  } catch (error) {
    console.error(`Error uploading image:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error uploading image"
    };
  }
}

/**
 * Format date for display
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Generate collection description if not provided
 * @param collectionName Name of the collection
 * @returns Generated description
 */
export function generateDescription(collectionName: string): string {
  return `${collectionName} is a unique NFT collection on Monad Testnet featuring exclusive digital art. This collection is deployed on Magic Eden's marketplace, allowing collectors to own and trade these special digital assets.`;
}

/**
 * Format price from MON to human readable string
 * @param price Price in MON (can be string or number)
 * @returns Formatted price string
 */
export function formatPrice(price: string | number): string {
  const priceNum = typeof price === 'string' ? parseFloat(price) : price;
  
  if (priceNum === 0) {
    return "FREE";
  }
  
  return `${priceNum} MON`;
}